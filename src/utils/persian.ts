import type { ActSummary, LayoutKey, StudioStep, TakeRecord } from '../types/studio';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: number | string): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

export function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const mins = String(Math.floor(safe / 60)).padStart(2, '0');
  const secs = String(safe % 60).padStart(2, '0');
  return toPersianDigits(`${mins}:${secs}`);
}

export function layoutLabelFromKey(key: LayoutKey): string {
  switch (key) {
    case 'SLIDE':
      return 'اسلاید تمام‌صفحه';
    case 'SCAM':
      return 'اسلاید + من';
    case 'CAM':
      return 'فقط من';
  }
}

export function layoutKeyFromLabel(label: string): LayoutKey {
  if (label.includes('فقط')) return 'CAM';
  if (label.includes('+')) return 'SCAM';
  return 'SLIDE';
}

export function clampStepIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, index));
}

export function getNextStepIndex(currentIndex: number, steps: StudioStep[]): number {
  return clampStepIndex(currentIndex + 1, steps.length);
}

export function getPrevStepIndex(currentIndex: number, steps: StudioStep[]): number {
  return clampStepIndex(currentIndex - 1, steps.length);
}

export function getFirstStepIndexOfAct(act: number, steps: StudioStep[]): number {
  const idx = steps.findIndex((s) => s.act === act);
  return idx >= 0 ? idx : 0;
}

export function computeActSummaries(steps: StudioStep[], takes: TakeRecord[]): ActSummary[] {
  const map = new Map<number, ActSummary>();
  steps.forEach((step, idx) => {
    const existing = map.get(step.act);
    if (!existing) {
      map.set(step.act, {
        act: step.act,
        stepCount: 1,
        firstStepIndex: idx,
        lastStepIndex: idx,
        takes: [],
        latestDurationSec: null,
      });
    } else {
      existing.stepCount += 1;
      existing.lastStepIndex = idx;
    }
  });

  const summaries = Array.from(map.values()).sort((a, b) => a.act - b.act);
  for (const summary of summaries) {
    const actTakes = takes.filter((t) => t.act === summary.act);
    summary.takes = actTakes;
    const latest = actTakes[actTakes.length - 1];
    summary.latestDurationSec = latest ? Math.max(0, latest.stop - latest.start) : null;
  }
  return summaries;
}

export function computeTotalRecordedSec(takes: TakeRecord[]): number {
  const latestByAct = new Map<number, TakeRecord>();
  for (const t of takes) {
    latestByAct.set(t.act, t);
  }
  let total = 0;
  for (const t of latestByAct.values()) {
    total += Math.max(0, t.stop - t.start);
  }
  return total;
}
