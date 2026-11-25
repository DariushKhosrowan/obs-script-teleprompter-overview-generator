export type LayoutKey = 'SLIDE' | 'SCAM' | 'CAM';

export type MotionKind = 'auto' | 'in' | 'out' | 'left' | 'right' | 'none';

export interface StudioStep {
  n: number;
  act: number;
  lay: string;
  layoutKey: LayoutKey;
  slide: number;
  time: string;
  text: string;
  motion?: MotionKind;
  zoom?: { s: number; x: number; y: number };
}

export interface TakeRecord {
  act: number;
  take: number;
  start: number;
  stop: number;
  file?: string;
}

export interface ActSummary {
  act: number;
  stepCount: number;
  firstStepIndex: number;
  lastStepIndex: number;
  takes: TakeRecord[];
  latestDurationSec: number | null;
}

export type ObsIntegrationMode = 'dock_ws' | 'studio_preview_text' | 'projector_text';

export interface ObsSettings {
  wsUrl: string;
  wsPassword: string;
  integrationMode: ObsIntegrationMode;
  osTarget: 'linux' | 'windows' | 'macos';
  pollIntervalMs: number;
  clickTextToAdvance: boolean;
  autoStudioPreviewSync: boolean;
  fontSizePx: number;
  mirror: boolean;
  autoScroll: boolean;
  scrollSpeed: number;
}

export type ObsConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
