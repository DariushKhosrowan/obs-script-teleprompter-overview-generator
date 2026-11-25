import type { StudioStep } from '../types/studio';
import { toPersianDigits } from './persian';
import { buildUncompressedZip, type ZipEntryInput } from './zipBuilder';

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderStepPrompterCanvas(
  canvas: HTMLCanvasElement,
  steps: StudioStep[],
  stepIndex: number
): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const W = 1920;
  const H = 1080;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const step = steps[stepIndex] ?? steps[0];
  const nextStep = steps[stepIndex + 1];
  const acts = Array.from(new Set(steps.map((s) => s.act))).sort((a, b) => a - b);

  // Background
  ctx.fillStyle = '#0B0D11';
  ctx.fillRect(0, 0, W, H);

  // Top Header Bar
  ctx.fillStyle = '#13161D';
  ctx.fillRect(0, 0, W, 108);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(0, 107, W, 2);

  // Header RTL text (top-right)
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = '700 36px "Vazirmatn", Tahoma, sans-serif';
  ctx.fillStyle = '#F59E0B';
  const slideLabel = step.slide > 0 ? ` · اسلاید ${toPersianDigits(step.slide)}` : '';
  const timeLabel = step.time ? ` · ${toPersianDigits(step.time)}` : '';
  const headerText = `پرده ${toPersianDigits(step.act)} · مرحله ${toPersianDigits(step.n)} از ${toPersianDigits(steps.length)} · ${step.lay}${slideLabel}${timeLabel}`;
  ctx.fillText(headerText, W - 72, 54);

  // Header left status
  ctx.textAlign = 'left';
  ctx.font = '500 28px "Vazirmatn", Tahoma, sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('تله‌پرامپتر (ضبط نمی‌شود)', 72, 54);

  // Reading Guide Accent Line above body
  ctx.fillStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.fillRect(88, 152, W - 176, 3);

  // Main Body Text (Auto-fit font size so 100% of paragraph fits cleanly)
  const maxTextWidth = W - 180;
  const maxBodyHeight = H - 350;
  let fontSize = 60;
  let lines: string[] = [];
  let lineHeight = fontSize * 1.72;

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';

  while (fontSize >= 32) {
    ctx.font = `700 ${fontSize}px "Vazirmatn", Tahoma, sans-serif`;
    lines = wrapCanvasLines(ctx, step.text, maxTextWidth);
    lineHeight = fontSize * 1.68;
    if (lines.length * lineHeight <= maxBodyHeight) {
      break;
    }
    fontSize -= 3;
  }

  ctx.fillStyle = '#F8FAFC';
  let y = 186;
  for (const line of lines) {
    ctx.fillText(line, W - 90, y);
    y += lineHeight;
  }

  // Footer Cue + Act Progress Bar
  ctx.fillStyle = '#13161D';
  ctx.fillRect(0, H - 156, W, 156);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(0, H - 156, W, 2);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.font = '600 30px "Vazirmatn", Tahoma, sans-serif';
  ctx.fillStyle = '#CBD5E1';
  const nextLabel = nextStep
    ? `بعدی: ${nextStep.lay}${nextStep.slide > 0 ? ` · اسلاید ${toPersianDigits(nextStep.slide)}` : ''}${nextStep.act !== step.act ? ' — پایان پرده (ضبط را قطع کن)' : ''}`
    : 'پایان اسکریپت';
  ctx.fillText(nextLabel, W - 72, H - 110);

  // Act Blocks along bottom (right-to-left)
  const barMargin = 72;
  const gap = 12;
  const totalBarW = W - barMargin * 2 - gap * (acts.length - 1);
  const blockW = totalBarW / Math.max(1, acts.length);

  acts.forEach((actNum, idx) => {
    // RTL placement: Act 1 on the right
    const x = W - barMargin - (idx + 1) * blockW - idx * gap;
    const by = H - 68;
    const bh = 46;
    const isHere = actNum === step.act;
    const isPast = actNum < step.act;

    ctx.fillStyle = isHere ? '#F59E0B' : isPast ? '#14532D' : '#1E2430';
    ctx.beginPath();
    ctx.roundRect(x, by, blockW, bh, 8);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.font = '700 24px "Vazirmatn", Tahoma, sans-serif';
    ctx.fillStyle = isHere ? '#0B0D11' : '#E2E8F0';
    ctx.fillText(`پرده ${toPersianDigits(actNum)}`, x + blockW / 2, by + bh / 2 + 1);
  });
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('PNG encode failed'));
        return;
      }
      const buf = await blob.arrayBuffer();
      resolve(new Uint8Array(buf));
    }, 'image/png');
  });
}

export async function exportPrompterPngZip(
  steps: StudioStep[],
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  const entries: ZipEntryInput[] = [];

  for (let i = 0; i < steps.length; i += 1) {
    await renderStepPrompterCanvas(canvas, steps, i);
    const pngBytes = await canvasToPngBytes(canvas);
    const filename = `prompter/p-${String(i + 1).padStart(2, '0')}.png`;
    entries.push({ name: filename, data: pngBytes });
    onProgress?.(i + 1, steps.length);
  }

  return buildUncompressedZip(entries);
}
