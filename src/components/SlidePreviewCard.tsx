import React, { useRef } from 'react';
import { Camera, Download, ImagePlus, MonitorPlay, ZoomIn } from 'lucide-react';
import type { LayoutKey, StudioStep } from '../types/studio';
import { toPersianDigits } from '../utils/persian';

interface SlidePreviewCardProps {
  step: StudioStep;
  overrideLayout: LayoutKey | null;
  zoomed: boolean;
  slideImages: Record<number, string>;
  onUploadSlides: (files: FileList) => void;
  onOverrideLayout: (layout: LayoutKey) => void;
  onToggleZoom: () => void;
  onTriggerObsHotkey: (hotkey: string) => void;
  onOpenObsExport: () => void;
}

export const SlidePreviewCard: React.FC<SlidePreviewCardProps> = ({
  step,
  overrideLayout,
  zoomed,
  slideImages,
  onUploadSlides,
  onOverrideLayout,
  onToggleZoom,
  onTriggerObsHotkey,
  onOpenObsExport,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeLayout: LayoutKey = overrideLayout ?? step.layoutKey;
  const slideUrl = step.slide > 0 ? slideImages[step.slide] : undefined;

  const layoutTitle =
    activeLayout === 'SLIDE'
      ? '01 اسلاید'
      : activeLayout === 'SCAM'
        ? '02 اسلاید + من'
        : '03 فقط من';

  return (
    <section
      aria-label="پیش‌نمایش صحنه خروجی OBS"
      className="flex flex-col rounded-xl border border-white/10 bg-[#13161D] p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-200">صحنه خروجی OBS: 00 استودیو</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-400">{layoutTitle}</span>
          {overrideLayout && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-sky-400">تغییر دستی</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUploadSlides(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1A1E28] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-white/25 hover:bg-[#222836] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ImagePlus className="h-3.5 w-3.5 text-amber-400" />
            <span>بارگذاری اسلایدها (PNG)</span>
          </button>
          <button
            type="button"
            onClick={onOpenObsExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>فایل‌های OBS (v8)</span>
          </button>
        </div>
      </div>

      {/* 16:9 Program Canvas */}
      <div
        data-testid="obs-program-canvas"
        className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-[#080A0E]"
      >
        {activeLayout === 'CAM' ? (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#161B26] via-[#0F131B] to-[#090B10] p-6 text-center">
            <Camera className="mb-3 h-10 w-10 text-slate-400" />
            <p className="text-sm font-semibold text-slate-200">نمای تمام‌صفحه دوربین (فقط من)</p>
            <p className="mt-1 text-xs text-slate-400">
              لایه ۰۳ در صحنه ۰۰ استودیو فعال است
            </p>
          </div>
        ) : (
          <div
            className={`relative h-full w-full transition-transform duration-500 ease-out ${
              zoomed ? 'scale-125' : 'scale-100'
            }`}
          >
            {slideUrl ? (
              <img
                src={slideUrl}
                alt={`اسلاید ${step.slide}`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain bg-black"
              />
            ) : (
              <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-[#141923] to-[#0B0E14] p-5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span dir="ltr" className="font-mono tabular-nums">
                    slides/slide-{String(step.slide || 1).padStart(2, '0')}.png
                  </span>
                  <span>پرده {toPersianDigits(step.act)}</span>
                </div>

                <div className="my-auto max-w-xl self-center text-center">
                  <div className="mb-2 text-xs font-medium text-amber-400">
                    پیش‌نمایش اسلاید {toPersianDigits(step.slide || 1)}
                  </div>
                  <p className="line-clamp-3 text-base font-semibold leading-relaxed text-slate-100 sm:text-lg">
                    {step.text}
                  </p>
                </div>

                <div
                  className={`flex items-center justify-between text-[11px] text-slate-500 ${
                    activeLayout === 'SCAM' ? 'pl-[32%]' : ''
                  }`}
                >
                  <span className="truncate">برای نمایش تصویر واقعی، اسلایدها را بارگذاری کنید</span>
                  <span dir="ltr" className="font-mono tabular-nums shrink-0">
                    1920×1080
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom-left Webcam PiP matching Lua: place(sc, cam, 24, 740, 560, 315) */}
        {activeLayout === 'SCAM' && (
          <div
            aria-label="پنجره دوربین روی اسلاید"
            className="absolute bottom-[3.2%] left-[1.25%] flex h-[29.1%] w-[29.1%] flex-col items-center justify-center rounded-md border border-amber-400/50 bg-[#1B2230]/95 shadow-lg"
          >
            <Camera className="mb-1 h-4 w-4 text-amber-400" />
            <span className="text-[11px] font-medium text-slate-200">دوربین شما</span>
            <span dir="ltr" className="font-mono text-[10px] text-slate-400 tabular-nums">
              560×315
            </span>
          </div>
        )}
      </div>

      {/* Quick Scene & Motion Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onOverrideLayout('SLIDE')}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeLayout === 'SLIDE'
              ? 'border-amber-400/60 bg-amber-500/15 text-amber-300'
              : 'border-white/10 bg-[#1A1E28] text-slate-300 hover:bg-[#222836]'
          }`}
        >
          <MonitorPlay className="h-3.5 w-3.5" />
          <span>فقط اسلاید (F1)</span>
        </button>

        <button
          type="button"
          onClick={() => onOverrideLayout('SCAM')}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeLayout === 'SCAM'
              ? 'border-amber-400/60 bg-amber-500/15 text-amber-300'
              : 'border-white/10 bg-[#1A1E28] text-slate-300 hover:bg-[#222836]'
          }`}
        >
          <span>اسلاید + من (F2)</span>
        </button>

        <button
          type="button"
          onClick={() => onOverrideLayout('CAM')}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeLayout === 'CAM'
              ? 'border-amber-400/60 bg-amber-500/15 text-amber-300'
              : 'border-white/10 bg-[#1A1E28] text-slate-300 hover:bg-[#222836]'
          }`}
        >
          <span>فقط من (F3)</span>
        </button>

        <button
          type="button"
          onClick={onToggleZoom}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            zoomed
              ? 'border-amber-400/60 bg-amber-500/15 text-amber-300'
              : 'border-white/10 bg-[#1A1E28] text-slate-300 hover:bg-[#222836]'
          }`}
        >
          <ZoomIn className="h-3.5 w-3.5" />
          <span>{zoomed ? 'زوم اوت (F6)' : 'زوم (F5)'}</span>
        </button>

        <button
          type="button"
          onClick={() => onTriggerObsHotkey('hs_motion')}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#1A1E28] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-[#222836] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>حرکت زنده (F7)</span>
        </button>
      </div>
    </section>
  );
};
