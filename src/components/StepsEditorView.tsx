import React, { useMemo, useState } from 'react';
import { Play, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import type { LayoutKey, MotionKind, StudioStep } from '../types/studio';
import { layoutLabelFromKey, toPersianDigits } from '../utils/persian';

interface StepsEditorViewProps {
  steps: StudioStep[];
  currentIndex: number;
  onSelectAndPlay: (index: number) => void;
  onUpdateStep: (index: number, patch: Partial<StudioStep>) => void;
  onAddStepAfter: (index: number) => void;
  onDeleteStep: (index: number) => void;
  onResetDefaultSteps: () => void;
}

export const StepsEditorView: React.FC<StepsEditorViewProps> = ({
  steps,
  currentIndex,
  onSelectAndPlay,
  onUpdateStep,
  onAddStepAfter,
  onDeleteStep,
  onResetDefaultSteps,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [actFilter, setActFilter] = useState<number | 'all'>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(currentIndex);

  const acts = useMemo(
    () => Array.from(new Set(steps.map((s) => s.act))).sort((a, b) => a - b),
    [steps]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => {
        if (actFilter !== 'all' && step.act !== actFilter) return false;
        if (!q) return true;
        return (
          step.text.toLowerCase().includes(q) ||
          step.lay.toLowerCase().includes(q) ||
          String(step.slide).includes(q) ||
          String(step.n).includes(q)
        );
      });
  }, [steps, actFilter, searchQuery]);

  const safeSelectedIndex = Math.min(selectedIndex, Math.max(0, steps.length - 1));
  const selectedStep = steps[safeSelectedIndex];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Steps Table / List */}
      <section className="flex flex-col rounded-xl border border-white/10 bg-[#13161D] p-4 lg:col-span-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-100">
              مراحل و اسلایدها ({toPersianDigits(steps.length)} مرحله)
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              تغییرات شما مستقیماً در فایل‌های خروجی steps_data.lua و prompter.html ذخیره می‌شود.
            </p>
          </div>

          <button
            type="button"
            onClick={onResetDefaultSteps}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1A1E28] px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-[#222836] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>بازنشانی ۳۸ مرحله اصلی</span>
          </button>
        </div>

        {/* Search + Act Filter */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در متن پرامپتر یا شماره اسلاید..."
              aria-label="جستجو در مراحل"
              className="w-full rounded-lg border border-white/10 bg-[#0B0D11] py-2 pr-9 pl-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-[#0B0D11] p-1">
            <button
              type="button"
              onClick={() => setActFilter('all')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                actFilter === 'all'
                  ? 'bg-[#1D222E] text-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              همه
            </button>
            {acts.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setActFilter(a)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  actFilter === a
                    ? 'bg-[#1D222E] text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                پرده {toPersianDigits(a)}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-white/5 bg-[#0B0D11] py-12 text-center">
            <p className="text-sm text-slate-300">مرحله‌ای با این فیلتر پیدا نشد.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActFilter('all');
              }}
              className="mt-3 rounded-lg bg-[#1A1E28] px-4 py-2 text-xs font-medium text-amber-400 hover:bg-[#222836] cursor-pointer"
            >
              نمایش همه مراحل
            </button>
          </div>
        ) : (
          <div className="max-h-[560px] divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10 bg-[#0B0D11]">
            {filteredItems.map(({ step, index }) => {
              const isSelected = index === safeSelectedIndex;
              const isLive = index === currentIndex;
              return (
                <div
                  key={`${step.n}-${index}`}
                  className={`flex items-start justify-between gap-3 p-3 transition-colors ${
                    isSelected ? 'bg-[#171C26]' : 'hover:bg-[#12161F]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedIndex(index)}
                    className="flex-1 text-right cursor-pointer focus-visible:outline-none"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="font-bold text-amber-400 tabular-nums">
                        مرحله {toPersianDigits(step.n)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>پرده {toPersianDigits(step.act)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{step.lay}</span>
                      {step.slide > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            اسلاید {toPersianDigits(step.slide)}
                          </span>
                        </>
                      )}
                      {isLive && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-emerald-400">در حال نمایش</span>
                        </>
                      )}
                    </div>
                    <p className="line-clamp-2 text-sm leading-relaxed text-slate-200">
                      {step.text}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectAndPlay(index)}
                    title="نمایش در تله‌پرامپتر"
                    aria-label={`اجرای مرحله ${step.n}`}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#1A1E28] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-amber-400/50 hover:text-amber-300 shrink-0 cursor-pointer"
                  >
                    <Play className="h-3 w-3" />
                    <span>اجرا</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Selected Step Inspector / Editor */}
      <section className="flex flex-col rounded-xl border border-white/10 bg-[#13161D] p-4 lg:col-span-5">
        {selectedStep ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/10 pb-3">
              <h2 className="text-base font-bold text-slate-100">
                ویرایش مرحله {toPersianDigits(selectedStep.n)}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onAddStepAfter(safeSelectedIndex);
                    setSelectedIndex(safeSelectedIndex + 1);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#1A1E28] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#222836] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-amber-400" />
                  <span>مرحله جدید بعد از این</span>
                </button>
                <button
                  type="button"
                  disabled={steps.length <= 1}
                  onClick={() => onDeleteStep(safeSelectedIndex)}
                  aria-label="حذف مرحله"
                  className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-[#1A1E28] p-1.5 text-slate-400 hover:border-red-500/50 hover:text-red-400 disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                <span>پرده (Act)</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={selectedStep.act}
                  onChange={(e) =>
                    onUpdateStep(safeSelectedIndex, {
                      act: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="rounded-lg border border-white/10 bg-[#0B0D11] px-3 py-2 text-sm text-slate-100 tabular-nums focus:border-amber-400 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-slate-400">
                <span>شماره اسلاید (۰ = بدون اسلاید)</span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={selectedStep.slide}
                  onChange={(e) =>
                    onUpdateStep(safeSelectedIndex, {
                      slide: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="rounded-lg border border-white/10 bg-[#0B0D11] px-3 py-2 text-sm text-slate-100 tabular-nums focus:border-amber-400 focus:outline-none"
                />
              </label>

              <label className="col-span-2 flex flex-col gap-1 text-xs text-slate-400 sm:col-span-1">
                <span>زمان تقریبی</span>
                <input
                  type="text"
                  value={selectedStep.time}
                  placeholder="02:35"
                  onChange={(e) =>
                    onUpdateStep(safeSelectedIndex, { time: e.target.value })
                  }
                  className="rounded-lg border border-white/10 bg-[#0B0D11] px-3 py-2 font-mono text-sm text-slate-100 tabular-nums focus:border-amber-400 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                <span>صحنه OBS</span>
                <select
                  value={selectedStep.layoutKey}
                  onChange={(e) => {
                    const layoutKey = e.target.value as LayoutKey;
                    onUpdateStep(safeSelectedIndex, {
                      layoutKey,
                      lay: layoutLabelFromKey(layoutKey),
                    });
                  }}
                  className="rounded-lg border border-white/10 bg-[#0B0D11] px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
                >
                  <option value="SLIDE">01 اسلاید تمام‌صفحه (SLIDE)</option>
                  <option value="SCAM">02 اسلاید + من (SCAM)</option>
                  <option value="CAM">03 فقط من (CAM)</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-slate-400">
                <span>انیمیشن اسلاید (Ken Burns)</span>
                <select
                  value={selectedStep.motion ?? 'auto'}
                  onChange={(e) =>
                    onUpdateStep(safeSelectedIndex, {
                      motion: e.target.value as MotionKind,
                    })
                  }
                  className="rounded-lg border border-white/10 bg-[#0B0D11] px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
                >
                  <option value="auto">خودکار چرخشی</option>
                  <option value="in">زوم به داخل (in)</option>
                  <option value="out">زوم به بیرون (out)</option>
                  <option value="left">حرکت به چپ (left)</option>
                  <option value="right">حرکت به راست (right)</option>
                  <option value="none">ثابت بدون حرکت (none)</option>
                </select>
              </label>
            </div>

            <label className="mt-3 flex flex-1 flex-col gap-1.5 text-xs text-slate-400">
              <span>متن تله‌پرامپتر</span>
              <textarea
                rows={8}
                value={selectedStep.text}
                onChange={(e) =>
                  onUpdateStep(safeSelectedIndex, { text: e.target.value })
                }
                className="w-full flex-1 rounded-lg border border-white/10 bg-[#0B0D11] p-3 text-sm leading-relaxed text-slate-100 focus:border-amber-400 focus:outline-none"
              />
            </label>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onSelectAndPlay(safeSelectedIndex)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-[#0B0D11] hover:bg-amber-300 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                <span>نمایش این مرحله روی تله‌پرامپتر</span>
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">یک مرحله را برای ویرایش انتخاب کنید.</p>
        )}
      </section>
    </div>
  );
};
