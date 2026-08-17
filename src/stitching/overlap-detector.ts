import { SEAM_CONFIDENCE_RATIO } from '../shared/constants';

/**
 * Seam detection: when a page nudges itself while ShotDock is scrolling (sticky
 * layout shifts, lazy images resizing above the fold), the frame's reported
 * scroll offset no longer matches its pixels. Comparing the bottom strip of what
 * is already on the canvas against the top of the incoming frame recovers the
 * real offset.
 *
 * Deliberately conservative: a correction is only applied when it is clearly
 * better than the planned alignment, otherwise the planned geometry wins.
 */

export interface SeamMatch {
  /** Device-pixel correction to apply to the incoming frame's source offset. */
  shift: number;
  /** Mean absolute difference at the chosen shift (0 = identical). */
  score: number;
  /** Mean absolute difference at the planned position. */
  baselineScore: number;
  confident: boolean;
}

/** Averages RGBA pixels down to one luminance byte per sample column. */
export function toGrayscale(
  rgba: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  columnStep = 4,
): { data: Uint8Array; width: number; height: number } {
  const sampledWidth = Math.max(1, Math.ceil(width / columnStep));
  const data = new Uint8Array(sampledWidth * height);
  for (let y = 0; y < height; y++) {
    for (let sx = 0; sx < sampledWidth; sx++) {
      const x = Math.min(width - 1, sx * columnStep);
      const i = (y * width + x) * 4;
      // Rec. 601 luma, integer-weighted.
      data[y * sampledWidth + sx] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
    }
  }
  return { data, width: sampledWidth, height };
}

/**
 * Finds the vertical shift that best aligns `candidate` with `reference`.
 *
 * `reference` holds `rows` rows. `candidate` must hold `rows + 2 * maxShift` rows,
 * centred on the planned alignment, so shifts from -maxShift to +maxShift can be
 * evaluated without reading out of bounds.
 */
export function findBestVerticalOffset(
  reference: Uint8Array | number[],
  candidate: Uint8Array | number[],
  width: number,
  rows: number,
  maxShift: number,
): SeamMatch {
  let bestShift = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  let baselineScore = Number.POSITIVE_INFINITY;

  for (let shift = -maxShift; shift <= maxShift; shift++) {
    const offsetRow = shift + maxShift;
    let sum = 0;
    for (let y = 0; y < rows; y++) {
      const refBase = y * width;
      const candBase = (y + offsetRow) * width;
      for (let x = 0; x < width; x++) {
        const diff = reference[refBase + x] - candidate[candBase + x];
        sum += diff < 0 ? -diff : diff;
      }
    }
    const score = sum / (rows * width);
    if (shift === 0) baselineScore = score;
    if (score < bestScore) {
      bestScore = score;
      bestShift = shift;
    }
  }

  // A best match sitting on the edge of the search window means the true offset
  // is probably outside it — don't trust it.
  const onBoundary = Math.abs(bestShift) === maxShift;
  const improved = bestScore <= baselineScore * SEAM_CONFIDENCE_RATIO;
  return {
    shift: bestShift,
    score: bestScore,
    baselineScore,
    confident: !onBoundary && improved && bestShift !== 0,
  };
}
