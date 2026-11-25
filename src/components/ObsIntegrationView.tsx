import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ImageDown,
  Loader2,
  Plug,
  PlugZap,
  Monitor,
} from 'lucide-react';
import type { ObsSettings, StudioStep } from '../types/studio';
import type { ObsStatusSnapshot } from '../utils/obsWebSocket';
import {
  generateInstallerScript,
  generateLuaV8,
  generatePrompterHtml,
  generateStepsDataLua,
} from '../utils/obsGenerators';
import {
  exportPrompterPngZip,
  renderStepPrompterCanvas,
} from '../utils/prompterPngExporter';
import { toPersianDigits } from '../utils/persian';

interface ObsIntegrationViewProps {
  steps: StudioStep[];
  settings: ObsSettings;
  obsStatus: ObsStatusSnapshot;
  onUpdateSettings: (patch: Partial<ObsSettings>) => void;
  onConnectObs: () => void;
  onDisconnectObs: () => void;
  onEnableStudioPreviewPrompter: () => void;
}

type FileTab = 'lua' | 'prompter' | 'steps' | 'installer';

function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadBinaryFile(filename: string, bytes: Uint8Array, mime = 'application/zip') {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const ObsIntegrationView: React.FC<ObsIntegrationViewProps> = ({
  steps,
  settings,
  obsStatus,
  onUpdateSettings,
  onConnectObs,
  onDisconnectObs,
  onEnableStudioPreviewPrompter,
}) => {
  const [fileTab, setFileTab] = useState<FileTab>('installer');
  const [copiedTab, setCopiedTab] = useState<FileTab | null>(null);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [zipReadyMsg, setZipReadyMsg] = useState<string | null>(null);
  const [previewStepIdx, setPreviewStepIdx] = useState<number>(0);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || steps.length === 0) return;
    const safeIdx = Math.max(0, Math.min(steps.length - 1, previewStepIdx));
    void renderStepPrompterCanvas(canvas, steps, safeIdx);
  }, [steps, previewStepIdx]);

  const handleDownloadPrompterZip = async () => {
    if (zipProgress || steps.length === 0) return;
    setZipReadyMsg(null);
    setZipProgress({ done: 0, total: steps.length });
    try {
      const zipBytes = await exportPrompterPngZip(steps, (done, total) => {
        setZipProgress({ done, total });
      });
      downloadBinaryFile('prompter_slides.zip', zipBytes, 'application/zip');
      setZipReadyMsg(`فایل prompter_slides.zip (${toPersianDigits(steps.length)} تصویر 1920×1080) آماده و دانلود شد.`);
    } finally {
      setZipProgress(null);
    }
  };

  const luaCode = useMemo(() => generateLuaV8(steps, settings), [steps, settings]);
  const prompterCode = useMemo(
    () => generatePrompterHtml(steps, settings),
    [steps, settings]
  );
  const stepsCode = useMemo(() => generateStepsDataLua(steps), [steps]);
  const installerCode = useMemo(
    () => generateInstallerScript(steps, settings),
    [steps, settings]
  );

  const activeCode =
    fileTab === 'lua'
      ? luaCode
      : fileTab === 'prompter'
        ? prompterCode
        : fileTab === 'steps'
          ? stepsCode
          : installerCode;
  const activeFilename =
    fileTab === 'lua'
      ? 'hark_studio_v8.lua'
      : fileTab === 'prompter'
        ? 'prompter.html'
        : fileTab === 'steps'
          ? 'steps_data.lua'
          : 'replace_hark_v8.sh';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopiedTab(fileTab);
      setTimeout(() => setCopiedTab(null), 1800);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div className="space-y-6">
      {/* Pixel-perfect PNG Prompter Exporter + Instructions */}
      <section className="rounded-xl border border-white/10 bg-[#13161D] p-5">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <h1 className="text-lg font-bold text-slate-100">
              تله‌پرامپتر راست‌چینِ بی‌نقص داخل OBS + جابجایی با کلیدهای جهت (← / →)
            </h1>
            <p className="text-sm leading-relaxed text-slate-300">
              موتور متنی پیش‌فرض OBS در لینوکس (<code dir="ltr" className="rounded bg-black/40 px-1.5 py-0.5 text-xs text-amber-300">text_ft2_source_v2</code>) از راست‌چین و چسباندن حروف فارسی پشتیبانی نمی‌کند. در نسخه جدید، علاوه بر موتور راست‌چین‌ساز فارسی+انگلیسی در خود اسکریپت Lua، می‌توانید تمام {toPersianDigits(steps.length)} مرحله را به‌صورت تصاویر <strong dir="ltr">1920×1080</strong> با فونت وزیرمتن بسازید تا حتی داخل OBS لینوکس ۱۰۰٪ استاندارد نمایش داده شوند.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                disabled={zipProgress !== null}
                onClick={() => void handleDownloadPrompterZip()}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-[#0B0D11] transition-colors hover:bg-amber-300 disabled:cursor-wait disabled:opacity-75 cursor-pointer"
              >
                {zipProgress ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      در حال ساخت تصویر {toPersianDigits(zipProgress.done)} از {toPersianDigits(zipProgress.total)}...
                    </span>
                  </>
                ) : (
                  <>
                    <ImageDown className="h-4 w-4" />
                    <span>ساخت و دانلود تصاویر پرامپتر (prompter_slides.zip)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => downloadTextFile('replace_hark_v8.sh', installerCode)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#1A1E28] px-4 py-2.5 text-xs font-semibold text-slate-100 hover:bg-[#222836] cursor-pointer"
              >
                <Download className="h-4 w-4 text-amber-400" />
                <span>دانلود اسکریپت جایگزینی (replace_hark_v8.sh)</span>
              </button>
            </div>

            {zipReadyMsg && (
              <div className="rounded-lg border border-emerald-500/35 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
                {zipReadyMsg} فایل را داخل پوشه Hark Studio اکسترکت کنید تا پوشه <span dir="ltr" className="font-mono text-emerald-100">prompter/</span> ساخته شود، سپس در OBS دکمه <strong dir="ltr">Build scenes</strong> را بزنید.
              </div>
            )}
          </div>

          {/* Live 16:9 Preview of generated OBS PNG */}
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0B0D11]">
              <canvas
                ref={previewCanvasRef}
                className="block aspect-video w-full"
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>پیش‌نمایش خروجی <span dir="ltr" className="font-mono text-slate-300">prompter/p-{String(previewStepIdx + 1).padStart(2, '0')}.png</span></span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewStepIdx((i) => Math.max(0, i - 1))}
                  className="rounded border border-white/10 bg-[#1A1E28] px-2 py-0.5 text-slate-200 hover:bg-[#242A38] cursor-pointer"
                >
                  قبلی
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewStepIdx((i) => Math.min(steps.length - 1, i + 1))}
                  className="rounded border border-white/10 bg-[#1A1E28] px-2 py-0.5 text-slate-200 hover:bg-[#242A38] cursor-pointer"
                >
                  بعدی
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-[#0E1117] p-4">
            <div className="text-sm font-bold text-amber-400">
              روش ۱ (پیشنهادی برای لینوکس بدون Browser Source): تصاویر پرامپتر + Studio Mode
            </div>
            <ol className="mt-2.5 list-inside list-decimal space-y-1.5 text-xs leading-6 text-slate-300">
              <li>
                دکمه زرد <strong>prompter_slides.zip</strong> را بزنید و آن را داخل پوشه <span dir="ltr" className="font-mono text-slate-200">HarkStudio</span> اکسترکت کنید (پوشه <span dir="ltr" className="font-mono text-slate-200">prompter/</span> ساخته می‌شود).
              </li>
              <li>
                اسکریپت <strong dir="ltr">hark_studio_v8.lua</strong> جدید را با <span dir="ltr" className="font-mono text-slate-200">replace_hark_v8.sh</span> جایگزین و در OBS روی <strong>Build scenes</strong> بزنید.
              </li>
              <li>
                برای فعال‌شدن کلیدهای جهت، در پنجره <span dir="ltr" className="font-mono text-slate-200">Tools &gt; Scripts</span> روی دکمه <strong>«تنظیم کلیدهای جهت (← جلو / → عقب)»</strong> کلیک کنید.
              </li>
              <li>
                <strong>Studio Mode</strong> را روشن کنید: خروجی (Program) روی <strong>00 استودیو</strong> می‌ماند و ضبط می‌شود؛ پیش‌نمایش (Preview) همیشه پرامپترِ راست‌چین و مرتب را نمایش می‌دهد.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#0E1117] p-4">
            <div className="text-sm font-bold text-slate-100">
              روش ۲ (اگر OBS شما Browser Dock دارد): داک سفارشی + WebSocket
            </div>
            <ol className="mt-2.5 list-inside list-decimal space-y-1.5 text-xs leading-6 text-slate-300">
              <li>
                در OBS به مسیر{' '}
                <span dir="ltr" className="inline-block font-mono text-slate-200">
                  Tools &gt; WebSocket Server Settings
                </span>{' '}
                بروید و <strong dir="ltr">Enable WebSocket server</strong> (پورت <span dir="ltr" className="font-mono">4455</span>) را فعال کنید.
              </li>
              <li>
                از منوی{' '}
                <span dir="ltr" className="inline-block font-mono text-slate-200">
                  Docks &gt; Custom Browser Docks
                </span>{' '}
                یک داک با آدرس <span dir="ltr" className="font-mono">prompter.html</span> (یا همین برنامه با <span dir="ltr" className="font-mono">?dock=1</span>) اضافه کنید.
              </li>
              <li>
                کلیدهای جهت چپ (<span dir="ltr" className="font-mono">←</span> = مرحله بعد) و راست (<span dir="ltr" className="font-mono">→</span> = مرحله قبل) هم در داک و هم مستقیم در OBS کار می‌کنند.
              </li>
              <li>
                اگر پوشه <span dir="ltr" className="font-mono">prompter/</span> نباشد، Lua به‌صورت خودکار حروف فارسی و کلمات انگلیسی مثل <span dir="ltr" className="font-mono">SLIDE / SCAM</span> را برای متن بومی OBS مرتب می‌کند.
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* OBS WebSocket Live Connection & Settings */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-white/10 bg-[#13161D] p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-100">اتصال زنده به OBS (WebSocket v5)</h2>
            <span
              className={`text-xs font-semibold ${
                obsStatus.status === 'connected'
                  ? 'text-emerald-400'
                  : obsStatus.status === 'error'
                    ? 'text-red-400'
                    : 'text-slate-400'
              }`}
            >
              {obsStatus.status === 'connected'
                ? `متصل${obsStatus.obsVersion ? ` · OBS ${obsStatus.obsVersion}` : ''}`
                : obsStatus.status === 'connecting'
                  ? 'در حال اتصال...'
                  : 'قطع'}
            </span>
          </div>

          <div className="space-y-3">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              <span>آدرس WebSocket</span>
              <input
                type="text"
                dir="ltr"
                value={settings.wsUrl}
                onChange={(e) => onUpdateSettings({ wsUrl: e.target.value })}
                placeholder="ws://127.0.0.1:4455"
                className="rounded-lg border border-white/10 bg-[#0B0D11] px-3 py-2 font-mono text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs text-slate-400">
              <span>رمز عبور WebSocket (اگر در OBS فعال است)</span>
              <input
                type="password"
                dir="ltr"
                value={settings.wsPassword}
                onChange={(e) => onUpdateSettings({ wsPassword: e.target.value })}
                placeholder="اختیاری"
                className="rounded-lg border border-white/10 bg-[#0B0D11] px-3 py-2 font-mono text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                <span>سیستم‌عامل شما (برای فونت بومی)</span>
                <select
                  value={settings.osTarget}
                  onChange={(e) =>
                    onUpdateSettings({
                      osTarget: e.target.value as ObsSettings['osTarget'],
                    })
                  }
                  className="rounded-lg border border-white/10 bg-[#0B0D11] px-3 py-2 text-xs text-slate-100 focus:border-amber-400 focus:outline-none"
                >
                  <option value="linux">Linux (FreeType 2)</option>
                  <option value="windows">Windows (GDI+)</option>
                  <option value="macos">macOS (FreeType 2)</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-slate-400">
                <span>سرعت همگام‌سازی state.js</span>
                <select
                  value={settings.pollIntervalMs}
                  onChange={(e) =>
                    onUpdateSettings({ pollIntervalMs: Number(e.target.value) })
                  }
                  className="rounded-lg border border-white/10 bg-[#0B0D11] px-3 py-2 font-mono text-xs text-slate-100 focus:border-amber-400 focus:outline-none"
                >
                  <option value={150}>150ms (فوری)</option>
                  <option value={300}>300ms</option>
                  <option value={500}>500ms</option>
                  <option value={1000}>1000ms</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 pt-1 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoStudioPreviewSync}
                onChange={(e) =>
                  onUpdateSettings({ autoStudioPreviewSync: e.target.checked })
                }
                className="h-4 w-4 accent-amber-400"
              />
              <span>در Studio Mode، صحنه «99 تلهپرامپتر» را همیشه در Preview نگه دار</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.slideMotion}
                onChange={(e) =>
                  onUpdateSettings({ slideMotion: e.target.checked })
                }
                className="h-4 w-4 accent-amber-400"
              />
              <span>حرکت و زوم خودکار اسلایدها (اگر لبه‌ها بیرون می‌زند خاموش بگذارید)</span>
            </label>

            {obsStatus.errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-xs leading-relaxed text-red-200"
              >
                {obsStatus.errorMessage}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              {obsStatus.status === 'connected' ? (
                <button
                  type="button"
                  onClick={onDisconnectObs}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#1A1E28] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-[#222836] cursor-pointer"
                >
                  <Plug className="h-4 w-4 text-slate-400" />
                  <span>قطع اتصال OBS</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onConnectObs}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-xs font-bold text-[#0B0D11] hover:bg-amber-300 cursor-pointer"
                >
                  <PlugZap className="h-4 w-4" />
                  <span>اتصال به OBS</span>
                </button>
              )}

              <button
                type="button"
                disabled={obsStatus.status !== 'connected'}
                onClick={onEnableStudioPreviewPrompter}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1A1E28] px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:bg-[#222836] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <Monitor className="h-3.5 w-3.5 text-amber-400" />
                <span>نمایش پرامپتر در Preview استودیو</span>
              </button>
            </div>
          </div>
        </section>

        {/* Export & Code Inspector */}
        <section className="flex flex-col rounded-xl border border-white/10 bg-[#13161D] p-5 lg:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#0B0D11] p-1">
              <button
                type="button"
                onClick={() => setFileTab('installer')}
                className={`rounded-md px-3 py-1.5 font-mono text-xs font-medium transition-colors cursor-pointer ${
                  fileTab === 'installer'
                    ? 'bg-[#1D222E] text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                replace_hark_v8.sh
              </button>
              <button
                type="button"
                onClick={() => setFileTab('lua')}
                className={`rounded-md px-3 py-1.5 font-mono text-xs font-medium transition-colors cursor-pointer ${
                  fileTab === 'lua'
                    ? 'bg-[#1D222E] text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                hark_studio_v8.lua
              </button>
              <button
                type="button"
                onClick={() => setFileTab('prompter')}
                className={`rounded-md px-3 py-1.5 font-mono text-xs font-medium transition-colors cursor-pointer ${
                  fileTab === 'prompter'
                    ? 'bg-[#1D222E] text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                prompter.html
              </button>
              <button
                type="button"
                onClick={() => setFileTab('steps')}
                className={`rounded-md px-3 py-1.5 font-mono text-xs font-medium transition-colors cursor-pointer ${
                  fileTab === 'steps'
                    ? 'bg-[#1D222E] text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                steps_data.lua
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1A1E28] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#222836] cursor-pointer"
              >
                {copiedTab === fileTab ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>کپی شد</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>کپی کد</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => downloadTextFile(activeFilename, activeCode)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-[#0B0D11] hover:bg-amber-300 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>دانلود {activeFilename}</span>
              </button>
            </div>
          </div>

          <pre
            dir="ltr"
            className="max-h-[400px] flex-1 overflow-auto rounded-lg border border-white/10 bg-[#080A0E] p-3 font-mono text-xs leading-relaxed text-slate-300"
          >
            {activeCode}
          </pre>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>هر سه فایل را کنار پوشه slides/ و fonts/ قرار دهید.</span>
            <button
              type="button"
              onClick={() => {
                downloadTextFile('hark_studio_v8.lua', luaCode);
                downloadTextFile('prompter.html', prompterCode, 'text/html;charset=utf-8');
                downloadTextFile('steps_data.lua', stepsCode);
              }}
              className="font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              دانلود یک‌جای هر ۳ فایل
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
