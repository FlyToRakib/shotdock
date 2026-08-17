import { MAX_CANVAS_DIMENSION } from '../shared/constants';
import { partAreaBudget } from './device-tier';

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export interface PartLimits {
  /** Pixels one part may cover. Defaults to this machine's tier budget. */
  maxArea: number;
  /** Longest side one part may have. Defaults to Skia's hard maximum. */
  maxDimension: number;
}

/**
 * Splits a tall output into canvas-sized parts. Returns one part for ordinary
 * pages; several only when the image would exceed what this machine can allocate.
 *
 * `limits` is what the stitcher's retry ladder walks down: the same page replans
 * into more, smaller parts when the first attempt is refused.
 */
export function planOutputParts(
  width: number,
  height: number,
  limits: Partial<PartLimits> = {},
): { y: number; height: number }[] {
  const maxArea = limits.maxArea ?? partAreaBudget();
  const maxDimension = limits.maxDimension ?? MAX_CANVAS_DIMENSION;

  const byArea = Math.floor(maxArea / Math.max(width, 1));
  const maxHeight = Math.max(1, Math.min(maxDimension, byArea));

  if (height <= maxHeight) return [{ y: 0, height }];

  const parts: { y: number; height: number }[] = [];
  for (let y = 0; y < height; y += maxHeight) {
    parts.push({ y, height: Math.min(maxHeight, height - y) });
  }
  return parts;
}

/**
 * Scale factor that keeps the output inside canvas width limits. Pages are rarely
 * this wide, but a zoomed-out high-DPI screen can get there.
 *
 * Width is never split, only scaled — a part boundary running vertically would
 * cut through every line of text on the page — so this is bounded by the hard
 * per-side maximum rather than by the device tier.
 */
export function widthScaleFactor(width: number): number {
  return width > MAX_CANVAS_DIMENSION ? MAX_CANVAS_DIMENSION / width : 1;
}

export function formatDimensions(width: number, height: number): string {
  return `${Math.round(width)} × ${Math.round(height)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
