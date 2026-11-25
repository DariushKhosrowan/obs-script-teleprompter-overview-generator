import type { ObsConnectionStatus } from '../types/studio';

interface ObsPendingRequest {
  resolve: (data: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface ObsStatusSnapshot {
  status: ObsConnectionStatus;
  errorMessage: string | null;
  obsVersion: string | null;
  recording: boolean;
  recordTimecode: string | null;
  studioMode: boolean;
  programScene: string | null;
}

type StatusListener = (snapshot: ObsStatusSnapshot) => void;

async function sha256Base64(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = new Uint8Array(digest);
  let bin = '';
  for (let i = 0; i < arr.length; i += 1) {
    bin += String.fromCharCode(arr[i]);
  }
  return btoa(bin);
}

export async function computeObsAuthString(
  password: string,
  salt: string,
  challenge: string
): Promise<string> {
  const secret = await sha256Base64(password + salt);
  return sha256Base64(secret + challenge);
}

export class ObsWebSocketClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, ObsPendingRequest>();
  private reqCounter = 0;
  private listeners = new Set<StatusListener>();
  private snapshot: ObsStatusSnapshot = {
    status: 'disconnected',
    errorMessage: null,
    obsVersion: null,
    recording: false,
    recordTimecode: null,
    studioMode: false,
    programScene: null,
  };

  getSnapshot(): ObsStatusSnapshot {
    return this.snapshot;
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(patch: Partial<ObsStatusSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) {
      fn(this.snapshot);
    }
  }

  disconnect() {
    if (this.ws) {
      try {
        this.ws.close(1000, 'User disconnect');
      } catch {
        // ignore close error
      }
      this.ws = null;
    }
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('Disconnected'));
    }
    this.pending.clear();
    this.emit({
      status: 'disconnected',
      errorMessage: null,
      obsVersion: null,
    });
  }

  connect(url: string, password: string) {
    this.disconnect();
    const cleanUrl = url.trim();
    if (!cleanUrl.startsWith('ws://') && !cleanUrl.startsWith('wss://')) {
      this.emit({
        status: 'error',
        errorMessage: 'آدرس WebSocket باید با ws:// یا wss:// شروع شود.',
      });
      return;
    }

    this.emit({ status: 'connecting', errorMessage: null });

    let socket: WebSocket;
    try {
      socket = new WebSocket(cleanUrl);
    } catch (err) {
      this.emit({
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'خطا در باز کردن WebSocket',
      });
      return;
    }

    this.ws = socket;

    socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        const op = msg.op as number;
        const d = (msg.d ?? {}) as Record<string, unknown>;

        if (op === 0) {
          // Hello
          const authObj = d.authentication as
            | { challenge: string; salt: string }
            | undefined;
          let authentication: string | undefined;
          if (authObj) {
            if (!password) {
              this.emit({
                status: 'error',
                errorMessage: 'OBS نیاز به رمز عبور WebSocket دارد.',
              });
              socket.close();
              return;
            }
            authentication = await computeObsAuthString(
              password,
              authObj.salt,
              authObj.challenge
            );
          }
          socket.send(
            JSON.stringify({
              op: 1,
              d: {
                rpcVersion: 1,
                ...(authentication ? { authentication } : {}),
              },
            })
          );
        } else if (op === 2) {
          // Identified
          this.emit({ status: 'connected', errorMessage: null });
          void this.refreshInitialState();
        } else if (op === 5) {
          // Event
          const eventType = d.eventType as string;
          const eventData = (d.eventData ?? {}) as Record<string, unknown>;
          if (eventType === 'RecordStateChanged') {
            this.emit({
              recording: Boolean(eventData.outputActive),
            });
          } else if (eventType === 'CurrentProgramSceneChanged') {
            this.emit({
              programScene: (eventData.sceneName as string) ?? null,
            });
          } else if (eventType === 'StudioModeStateChanged') {
            this.emit({
              studioMode: Boolean(eventData.studioModeEnabled),
            });
          }
        } else if (op === 7) {
          // RequestResponse
          const requestId = String(d.requestId ?? '');
          const pendingReq = this.pending.get(requestId);
          if (pendingReq) {
            clearTimeout(pendingReq.timer);
            this.pending.delete(requestId);
            const requestStatus = (d.requestStatus ?? {}) as {
              result?: boolean;
              comment?: string;
              code?: number;
            };
            if (requestStatus.result) {
              pendingReq.resolve((d.responseData ?? {}) as Record<string, unknown>);
            } else {
              pendingReq.reject(
                new Error(
                  requestStatus.comment || `OBS Error (${requestStatus.code ?? 'unknown'})`
                )
              );
            }
          }
        }
      } catch {
        // Ignore malformed packets
      }
    };

    socket.onerror = () => {
      this.emit({
        status: 'error',
        errorMessage:
          'اتصال به OBS برقرار نشد. مطمئن شوید OBS باز است و Tools > WebSocket Server Settings فعال است (پورت 4455).',
      });
    };

    socket.onclose = (ev) => {
      if (this.ws === socket) {
        this.ws = null;
        if (this.snapshot.status !== 'error') {
          this.emit({
            status: 'disconnected',
            errorMessage: ev.reason ? `قطع اتصال: ${ev.reason}` : null,
          });
        }
      }
    };
  }

  private async refreshInitialState() {
    try {
      const [ver, rec, studio, scene] = await Promise.all([
        this.request('GetVersion'),
        this.request('GetRecordStatus'),
        this.request('GetStudioModeEnabled'),
        this.request('GetCurrentProgramScene'),
      ]);
      this.emit({
        obsVersion: (ver.obsVersion as string) ?? null,
        recording: Boolean(rec.outputActive),
        recordTimecode: (rec.outputTimecode as string) ?? null,
        studioMode: Boolean(studio.studioModeEnabled),
        programScene: (scene.currentProgramSceneName as string) ?? null,
      });
    } catch {
      // Non-fatal
    }
  }

  request(
    requestType: string,
    requestData?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('OBS متصل نیست'));
        return;
      }
      this.reqCounter += 1;
      const requestId = `hs_${Date.now()}_${this.reqCounter}`;
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Timeout: ${requestType}`));
      }, 4000);

      this.pending.set(requestId, { resolve, reject, timer });
      this.ws.send(
        JSON.stringify({
          op: 6,
          d: {
            requestType,
            requestId,
            ...(requestData ? { requestData } : {}),
          },
        })
      );
    });
  }

  triggerHotkey(hotkeyName: string) {
    return this.request('TriggerHotkeyByName', { hotkeyName });
  }

  toggleRecord() {
    return this.request('ToggleRecord');
  }

  setStudioMode(enabled: boolean) {
    return this.request('SetStudioModeEnabled', { studioModeEnabled: enabled });
  }

  setPreviewScene(sceneName: string) {
    return this.request('SetCurrentPreviewScene', { sceneName });
  }
}

export const obsClient = new ObsWebSocketClient();
