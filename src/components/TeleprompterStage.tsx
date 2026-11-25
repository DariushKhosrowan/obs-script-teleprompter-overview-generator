import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FlipHorizontal2,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
} from 'lucide-react';
import type { ActSummary, ObsSettings, StudioStep } from '../types/studio';
import type { ObsStatusSnapshot } from '../utils/obsWebSocket';
import { formatMMSS, toPersianDigits } from '../utils/persian';

interface TeleprompterStageProps {
  steps: StudioStep[];
  currentIndex: number;
  settings: ObsSettings;
  obsStatus: ObsStatusSnapshot;
  actSummaries: ActSummary[];
  totalRecordedSec: number;
  localRecordingActive: boolean;
  localRecStartMs: number | null;
  onNext: () => void;
  onPrev: () => void;
  onJumpToStep: (index: number) => void;
  onJumpToActStart: (act: number) => void;
  onToggleRecord: () => void;
  onUpdateSettings: (patch: Partial<ObsSettings>) => void;
  compactDock?: boolean;
}

export const TeleprompterStage: React.FC<TeleprompterStageProps> = ({
  steps,
  currentIndex,
  settings,
  obsStatus,
  actSummaries,
  totalRecordedSec,
  localRecordingActive,
  localRecStartMs,
  onNext,
  onPrev,
  onJumpToActStart,
  onToggleRecord,
  onUpdateSettings,
  compactDock = false,
}) => {
  const step = steps[currentIndex] ?? steps[0];
  const nextStep = steps[currentIndex + 1];
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  const isRecording = obsStatus.status === 'connected' ? obsStatus.recording : localRecordingActive;

  useEffect(() => {
    setScrollOffset(0);
    if (wrapRef.current) {
      wrapRef.current.scrollTop = 0;
    }
  }, [currentIndex]);

  useEffect(() => {
    if (!settings.autoScroll) return;
    let rafId = 0;
    const stepScroll = () => {
      setScrollOffset((prev) => prev - settings.scrollSpeed * 0.6);
      rafId = requestAnimationFrame(stepScroll);
    };
    rafId = requestAnimationFrame(stepScroll);
    return () => cancelAnimationFrame(rafId);
  }, [settings.autoScroll, settings.scrollSpeed]);

  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const activeRecSeconds =
    isRecording && localRecStartMs
      ? Math.max(0, nowSec - Math.floor(localRecStartMs / 1000))
      : 0;

  return (
    <section
      aria-label="تله‌پرامپتر و کنترل یک‌کلیکی"
      className={`flex flex-col rounded-xl border border-white/10 bg-[#13161D] ${
        compactDock ? 'h-[calc(100vh-80px)] min-h-[540px]' : 'min-h-[540px]'
      }`}
    >
      {/* Top Status & Cue Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <span className="font-bold text-amber-400">
            پرده {toPersianDigits(step.act)}
          </span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="font-medium text-slate-100 tabular-nums">
            مرحله {toPersianDigits(step.n)} از {toPersianDigits(steps.length)}
          </span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="text-slate-300">{step.lay}</span>
          {step.slide > 0 && (
            <>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-slate-300 tabular-nums">
                اسلاید {toPersianDigits(step.slide)}
              </span>
            </>
          )}
          {step.time && (
            <>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {toPersianDigits(step.time)}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          {isRecording && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-red-400 tabular-nums">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span>REC {formatMMSS(activeRecSeconds)}</span>
            </span>
          )}
          <span className="text-slate-400">
            {obsStatus.status === 'connected'
              ? 'OBS WebSocket متصل'
              : 'حالت پیش‌نمایش محلی'}
          </span>
        </div>
      </div>

      {/* Next Step Hint */}
      <div className="border-b border-white/5 bg-[#0F1218] px-4 py-2 text-xs text-slate-400">
        {nextStep ? (
          <span>
            بعدی: {nextStep.lay}
            {nextStep.slide > 0 ? ` · اسلاید ${toPersianDigits(nextStep.slide)}` : ''}
            {nextStep.act !== step.act ? ' — پایان پرده (آماده قطع ضبط)' : ''}
          </span>
        ) : (
          <span>پایان اسکریپت</span>
        )}
      </div>

      {/* Teleprompter Reading Pane */}
      <div
        ref={wrapRef}
        onClick={() => {
          if (settings.clickTextToAdvance) onNext();
        }}
        title={
          settings.clickTextToAdvance
            ? 'کلیک روی متن = مرحله بعد (پرامپتر + اسلاید)'
            : undefined
        }
        className={`relative flex-1 overflow-y-auto px-6 py-5 sm:px-8 ${
          settings.clickTextToAdvance ? 'cursor-pointer select-none' : ''
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none sticky top-0 z-10 mb-3 flex items-center gap-2 bg-[#13161D]/90 pb-2 backdrop-blur-xs"
        >
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="h-[1px] flex-1 bg-amber-400/35" />
        </div>
        <div
          data-testid="prompter-text"
          style={{
            fontSize: `${compactDock ? Math.min(settings.fontSizePx, 32) : settings.fontSizePx}px`,
            transform: `translateY(${scrollOffset}px) ${settings.mirror ? 'scaleX(-1)' : ''}`,
          }}
          className="leading-[1.78] font-bold text-slate-50 transition-transform duration-100"
        >
          {step.text}
        </div>
      </div>

      {/* Primary One-Click Action Bar */}
      <div className="border-t border-white/10 bg-[#101319] p-3">
        <div className={compactDock ? 'flex flex-col gap-2' : 'flex flex-wrap items-center gap-2'}>
          <button
            type="button"
            onClick={onNext}
            disabled={currentIndex >= steps.length - 1}
            className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-[#0B0D11] transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 sm:text-base ${
              compactDock ? 'w-full' : 'flex-1'
            }`}
          >
            <span>مرحله بعد (پرامپتر + اسلاید)</span>
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className={compactDock ? 'grid grid-cols-3 gap-2' : 'flex items-center gap-2'}>
            <button
              type="button"
              onClick={onPrev}
              disabled={currentIndex <= 0}
              aria-label="مرحله قبلی"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#1A1E28] px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-[#222836] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
              <span>قبلی</span>
            </button>

            <button
              type="button"
              onClick={() => onJumpToActStart(step.act)}
              aria-label="برگشت به اول این پرده (F9)"
              title="برگشت به اول این پرده (F9)"
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#1A1E28] px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-[#222836] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>اول پرده</span>
            </button>

            <button
              type="button"
              onClick={onToggleRecord}
              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isRecording
                  ? 'border-red-500 bg-red-600 text-white hover:bg-red-500'
                  : 'border-white/10 bg-[#1A1E28] text-slate-200 hover:bg-[#222836]'
              }`}
            >
              <Radio className="h-4 w-4" />
              <span>{isRecording ? 'توقف ضبط' : 'شروع ضبط'}</span>
            </button>
          </div>
        </div>

        {/* Teleprompter Secondary Controls */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onUpdateSettings({ autoScroll: !settings.autoScroll })}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                settings.autoScroll
                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                  : 'border-white/10 bg-[#171B24] text-slate-300 hover:bg-[#1F2430]'
              }`}
            >
              {settings.autoScroll ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span>اسکرول خودکار</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ fontSizePx: Math.max(22, settings.fontSizePx - 4) })
              }
              aria-label="کوچک کردن فونت"
              className="inline-flex items-center justify-center rounded-md border border-white/10 bg-[#171B24] p-1.5 text-slate-300 hover:bg-[#1F2430] cursor-pointer"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span dir="ltr" className="px-1 font-mono tabular-nums text-slate-300">
              {toPersianDigits(settings.fontSizePx)}px
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ fontSizePx: Math.min(72, settings.fontSizePx + 4) })
              }
              aria-label="بزرگ کردن فونت"
              className="inline-flex items-center justify-center rounded-md border border-white/10 bg-[#171B24] p-1.5 text-slate-300 hover:bg-[#1F2430] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ mirror: !settings.mirror })}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                settings.mirror
                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                  : 'border-white/10 bg-[#171B24] text-slate-300 hover:bg-[#1F2430]'
              }`}
            >
              <FlipHorizontal2 className="h-3.5 w-3.5" />
              <span>آینه (M)</span>
            </button>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.clickTextToAdvance}
              onChange={(e) =>
                onUpdateSettings({ clickTextToAdvance: e.target.checked })
              }
              className="h-3.5 w-3.5 accent-amber-400"
            />
            <span>کلیک روی متن هم مرحله را جلو ببرد</span>
          </label>
        </div>
      </div>

      {/* Act Timeline */}
      <div className="border-t border-white/10 bg-[#0E1117] px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-400">
          <span className="tabular-nums whitespace-nowrap">
            مجموع ضبط‌شده: {formatMMSS(totalRecordedSec)} از حدود ۱۳:۱۵
          </span>
          {!compactDock && (
            <span className="hidden sm:inline whitespace-nowrap">
              کلیدها: PageDown / ← جلو · PageUp / → عقب · Space اسکرول
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {actSummaries.map((act) => {
            const isCurrent = step.act === act.act;
            const isDone = act.latestDurationSec !== null;
            return (
              <button
                key={act.act}
                type="button"
                onClick={() => onJumpToActStart(act.act)}
                className={`flex flex-col items-start rounded-lg border p-2 text-right transition-colors cursor-pointer ${
                  isCurrent
                    ? 'border-amber-400 bg-amber-500/10 text-slate-100'
                    : isDone
                      ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-950/60'
                      : 'border-white/10 bg-[#171B24] text-slate-300 hover:bg-[#1D222E]'
                }`}
              >
                <span className="text-xs font-bold">پرده {toPersianDigits(act.act)}</span>
                <span className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                  {isDone && act.latestDurationSec !== null
                    ? `برداشت ${toPersianDigits(act.takes.length)} · ${formatMMSS(act.latestDurationSec)}`
                    : `${toPersianDigits(act.stepCount)} مرحله`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
