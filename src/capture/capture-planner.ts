import { FRAME_OVERLAP_PX, MAX_FRAMES, MIN_SCROLL_STEP_PX } from '../shared/constants';
import type { CapturePlan, CapturePosition, PageMetrics } from '../shared/types';

export interface PlanOptions {
  /** Overlap between neighbouring frames, in CSS pixels. */
  overlap?: number;
  maxFrames?: number;
}

/**
 * Turns page geometry into an ordered list of scroll stops.
 *
 * Two details matter more than they look:
 *  - consecutive stops overlap, which is what lets the stitcher absorb scroll
 *    rounding and (optionally) seam-correct;
 *  - the final stop is clamped to the maximum scrollable offset rather than
 *    continuing past the bottom, because the browser would clamp it anyway and
 *    the stitcher needs to know the real position.
 *
 * Pure and synchronous: no DOM, no chrome APIs.
 */
export function planCapture(metrics: PageMetrics, options: PlanOptions = {}): CapturePlan {
  const overlap = options.overlap ?? FRAME_OVERLAP_PX;
  const maxFrames = options.maxFrames ?? MAX_FRAMES;

  // Geometry arrives over a message channel from a page that can report anything;
  // a NaN or an Infinity here would propagate into every downstream calculation.
  const pageWidthRaw = finite(metrics.pageWidth, 1);
  const pageHeightRaw = finite(metrics.pageHeight, 1);
  const viewportWidth = Math.max(1, Math.floor(finite(metrics.viewportWidth, 1)));
  const viewportHeight = Math.max(1, Math.floor(finite(metrics.viewportHeight, 1)));

  // A page wider than the viewport needs horizontal stops; a page within 8px of it
  // is just scrollbar/rounding noise, and clamping to the layout width there is
  // what trims the scrollbar strip off the right edge of the output.
  const widthSlack = pageWidthRaw - viewportWidth;
  const captureWidth = Math.max(
    1,
    widthSlack > 8 ? Math.floor(pageWidthRaw) : Math.min(Math.floor(pageWidthRaw), viewportWidth),
  );
  const captureHeight = Math.max(1, Math.floor(pageHeightRaw));

  // Both axes are capped at the frame budget as they are generated. Without that,
  // an effectively bottomless page would build millions of stops here and only
  // then have them thrown away — long enough to look like a hang.
  const xs = scrollStops(captureWidth, viewportWidth, overlap, maxFrames);
  const maxRows = Math.max(1, Math.floor(maxFrames / xs.length));
  let ys = scrollStops(captureHeight, viewportHeight, overlap, maxRows + 1);

  let truncated = false;
  if (ys.length > maxRows) {
    ys = ys.slice(0, maxRows);
    truncated = true;
  }

  const positions: CapturePosition[] = [];
  ys.forEach((y, row) => {
    xs.forEach((x, col) => {
      positions.push({ index: positions.length, x, y, row, col });
    });
  });

  const lastY = ys[ys.length - 1] ?? 0;
  const effectiveHeight = truncated ? Math.min(captureHeight, lastY + viewportHeight) : captureHeight;

  return {
    positions,
    rows: ys.length,
    columns: xs.length,
    captureWidth,
    captureHeight: effectiveHeight,
    viewportWidth,
    viewportHeight,
    truncated,
  };
}

const finite = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

/**
 * Stops along one axis: 0, step, 2·step … then the clamped end position.
 * `maxStops` bounds the work, not just the result — see {@link planCapture}.
 */
function scrollStops(total: number, viewport: number, overlap: number, maxStops: number): number[] {
  const maxScroll = Math.max(0, total - viewport);
  if (maxScroll <= 0) return [0];

  const limit = Math.max(1, Math.floor(maxStops));
  const step = Math.max(MIN_SCROLL_STEP_PX, viewport - Math.max(0, overlap));
  const stops: number[] = [];
  for (let position = 0; position < maxScroll && stops.length < limit; position += step) {
    stops.push(position);
  }
  const last = stops[stops.length - 1] ?? 0;
  // Only add the clamped end stop if it is meaningfully below the previous one.
  if (maxScroll - last > 1 && stops.length < limit) stops.push(maxScroll);
  return stops;
}

/** Progress denominator, kept next to the planner so the two can never disagree. */
export function frameCount(plan: CapturePlan): number {
  return plan.positions.length;
}
