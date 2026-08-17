import { MIN_PART_AREA, SEAM_SEARCH_PX, SEAM_STRIP_HEIGHT } from '../shared/constants';
import { ShotDockError } from '../shared/errors';
import type { CapturedFrame, ImageFormat } from '../shared/types';
import { partAreaBudget } from '../utils/device-tier';
import { planOutputParts, widthScaleFactor } from '../utils/dimensions';
import { createLogger } from '../utils/logger';
import {
  createSurface,
  decodeFrame,
  encodeSurface,
  releaseSurface,
  renderPreview,
  type Surface,
} from './canvas-renderer';
import { CropTracker, shiftSource, type DrawOp } from './crop-calculator';
import { findBestVerticalOffset, toGrayscale } from './overlap-detector';

const log = createLogger('stitcher');

export interface StitcherOptions {
  /** Area to reproduce, in CSS pixels. */
  pageWidth: number;
  pageHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  seamDetection: boolean;
}

interface Part {
  index: number;
  y: number;
  surface: Surface;
}

export interface RenderedPart {
  index: number;
  width: number;
  height: number;
  blob: Blob;
}

/**
 * Streaming stitcher: frames are drawn and released one at a time, so a
 * 100×-viewport page never holds more than a single decoded bitmap in memory.
 *
 * Surfaces are allocated on the first frame rather than up front, because the
 * device-pixel scale is measured from that frame — captureVisibleTab returns
 * device pixels, and page zoom, high-DPI displays and OS scaling all feed into
 * that number. Measuring beats predicting.
 *
 * Output is always a list of parts. Ordinary pages produce exactly one; pages
 * beyond canvas limits are split instead of failing.
 */
export class Stitcher {
  private parts: Part[] = [];
  private tracker: CropTracker | null = null;
  private scale = 1;
  private width = 0;
  private height = 0;
  /**
   * Source bitmap pixels per output pixel. Exactly 1 for every page that fits
   * inside the canvas width limit — which is all but the most extreme — and above
   * 1 when the output had to be scaled down to fit.
   */
  private sourceRatio = 1;

  constructor(private readonly options: StitcherOptions) {
    if (options.pageWidth <= 0 || options.pageHeight <= 0) {
      throw new ShotDockError('RENDER_FAILED');
    }
  }

  get partCount(): number {
    return this.parts.length;
  }

  get outputScale(): number {
    return this.scale;
  }

  async addFrame(frame: CapturedFrame): Promise<void> {
    const bitmap = await decodeFrame(frame.dataUrl);
    try {
      if (!this.tracker) this.initialise(bitmap.width);
      const planned = this.tracker!.next(frame);
      if (!planned) return;

      const op = this.clampToSource(planned, bitmap.width, bitmap.height);
      if (!op) return;
      const corrected = this.options.seamDetection ? this.correctSeam(op, bitmap) : op;
      this.draw(bitmap, corrected);
    } finally {
      bitmap.close();
    }
  }

  private initialise(frameWidth: number): void {
    const { pageWidth, pageHeight, viewportWidth, viewportHeight } = this.options;

    const measured = frameWidth / Math.max(1, viewportWidth);
    // An extremely wide page can exceed canvas width limits; downscale rather than fail.
    const rawWidth = pageWidth * measured;
    const fit = widthScaleFactor(rawWidth);
    this.scale = measured * fit;
    // The captured frames are still full size, so every source rectangle has to be
    // read back up to bitmap scale — otherwise the shrunken geometry would crop
    // each frame's right-hand side away instead of scaling it down.
    this.sourceRatio = 1 / fit;

    this.width = Math.max(1, Math.round(pageWidth * this.scale));
    this.height = Math.max(1, Math.round(pageHeight * this.scale));

    this.parts = this.allocateParts();

    this.tracker = new CropTracker({
      viewportWidth,
      viewportHeight,
      outputWidth: this.width,
      outputHeight: this.height,
      scale: this.scale,
    });

    log.debug('surfaces ready', {
      scale: this.scale,
      width: this.width,
      height: this.height,
      parts: this.parts.length,
    });
  }

  /**
   * Allocates the output surfaces, stepping the per-part budget down until this
   * machine actually accepts them.
   *
   * Dividing more finely does not reduce the total memory — every part is held
   * until encoding finishes — but a set of smaller allocations succeeds where one
   * large contiguous one fails, which is how this usually runs out on a busy or
   * low-memory machine. So the ladder is a genuine second chance, not a ritual.
   *
   * The tier budget is therefore an opening bid, not a promise: guessing a
   * machine's capacity too high costs a retry here rather than a failed capture.
   */
  private allocateParts(): Part[] {
    let maxArea = partAreaBudget();

    for (;;) {
      const parts: Part[] = [];
      try {
        planOutputParts(this.width, this.height, { maxArea }).forEach((slice, index) => {
          parts.push({
            index,
            y: slice.y,
            surface: createSurface(this.width, slice.height, { verify: true }),
          });
        });
        return parts;
      } catch (error) {
        // Whatever was allocated before the refusal is dead weight for the next
        // attempt; hand it back before asking the machine for more.
        for (const part of parts) releaseSurface(part.surface);

        if (maxArea <= MIN_PART_AREA) throw error;
        maxArea = Math.max(MIN_PART_AREA, Math.floor(maxArea / 2));
        log.warn('surface allocation refused; retrying with smaller parts', { maxArea });
      }
    }
  }

  /**
   * The captured bitmap can be a pixel off from the predicted frame size. Limits
   * are expressed in output pixels, so the bitmap's own bounds are converted
   * down into that space first (a no-op at the usual 1:1 ratio).
   */
  private clampToSource(op: DrawOp, sourceWidth: number, sourceHeight: number): DrawOp | null {
    const ratio = this.sourceRatio;
    const sw = Math.min(op.sw, Math.floor(sourceWidth / ratio) - op.sx);
    const sh = Math.min(op.sh, Math.floor(sourceHeight / ratio) - op.sy);
    if (sw <= 0 || sh <= 0) return null;
    return sw === op.sw && sh === op.sh ? op : { ...op, sw, sh };
  }

  /**
   * Compares the strip already on the canvas with the incoming frame's overlap
   * region and nudges the source window when the page moved unexpectedly.
   */
  private correctSeam(op: DrawOp, bitmap: ImageBitmap): DrawOp {
    // Matching pixel rows only means anything while source and output rows line up
    // one to one. A downscaled output is already an approximation of the source.
    if (this.sourceRatio !== 1) return op;

    const margin = SEAM_STRIP_HEIGHT + SEAM_SEARCH_PX;
    if (op.dy <= margin || op.sy < margin) return op;
    if (op.sy + op.sh + SEAM_SEARCH_PX > bitmap.height) return op;

    const part = this.partAt(op.dy - 1);
    // A junction landing exactly on a part boundary has no reference strip.
    if (!part || op.dy - SEAM_STRIP_HEIGHT < part.y) return op;

    const sampleWidth = Math.min(op.sw, this.width - op.dx);
    if (sampleWidth < 16) return op;

    try {
      const reference = part.surface.ctx.getImageData(
        op.dx,
        op.dy - part.y - SEAM_STRIP_HEIGHT,
        sampleWidth,
        SEAM_STRIP_HEIGHT,
      );

      const candidateHeight = SEAM_STRIP_HEIGHT + SEAM_SEARCH_PX * 2;
      const scratch = createSurface(sampleWidth, candidateHeight);
      scratch.ctx.drawImage(
        bitmap,
        op.sx,
        op.sy - SEAM_STRIP_HEIGHT - SEAM_SEARCH_PX,
        sampleWidth,
        candidateHeight,
        0,
        0,
        sampleWidth,
        candidateHeight,
      );
      const candidate = scratch.ctx.getImageData(0, 0, sampleWidth, candidateHeight);
      // One of these is allocated per frame, so it is released straight away.
      releaseSurface(scratch);

      const grayReference = toGrayscale(reference.data, sampleWidth, SEAM_STRIP_HEIGHT);
      const grayCandidate = toGrayscale(candidate.data, sampleWidth, candidateHeight);
      const match = findBestVerticalOffset(
        grayReference.data,
        grayCandidate.data,
        grayReference.width,
        SEAM_STRIP_HEIGHT,
        SEAM_SEARCH_PX,
      );

      if (!match.confident) return op;
      log.debug('seam corrected', { frame: op.index, shift: match.shift });
      return shiftSource(op, match.shift, bitmap.height);
    } catch (error) {
      // Pixel reads can fail on very large surfaces; planned geometry is a safe fallback.
      log.warn('seam detection skipped', error);
      return op;
    }
  }

  private draw(bitmap: ImageBitmap, op: DrawOp): void {
    const ratio = this.sourceRatio;
    for (const part of this.parts) {
      const partBottom = part.y + part.surface.canvas.height;
      const top = Math.max(op.dy, part.y);
      const bottom = Math.min(op.dy + op.sh, partBottom);
      if (bottom <= top) continue;

      const sourceOffset = top - op.dy;
      // Source in bitmap pixels, destination in output pixels. The two are the
      // same number at the usual 1:1 ratio; when they aren't, this is what makes
      // the frame scale into place rather than get clipped.
      part.surface.ctx.drawImage(
        bitmap,
        op.sx * ratio,
        (op.sy + sourceOffset) * ratio,
        op.sw * ratio,
        (bottom - top) * ratio,
        op.dx,
        top - part.y,
        op.sw,
        bottom - top,
      );
    }
  }

  private partAt(y: number): Part | undefined {
    return this.parts.find((part) => y >= part.y && y < part.y + part.surface.canvas.height);
  }

  /** Encodes every part, plus one preview covering the whole capture. */
  async render(
    format: ImageFormat,
    quality: number,
  ): Promise<{
    parts: RenderedPart[];
    previewDataUrl: string;
    width: number;
    height: number;
    scale: number;
  }> {
    if (this.parts.length === 0) throw new ShotDockError('RENDER_FAILED');

    const parts: RenderedPart[] = [];
    for (const part of this.parts) {
      const blob = await encodeSurface(part.surface, format, quality);
      parts.push({
        index: part.index,
        width: part.surface.canvas.width,
        height: part.surface.canvas.height,
        blob,
      });
    }

    const previewDataUrl = await renderPreview(this.parts, this.width, this.height);
    return { parts, previewDataUrl, width: this.width, height: this.height, scale: this.scale };
  }

  /** Drops the backing surfaces so the offscreen document can be torn down. */
  release(): void {
    for (const part of this.parts) releaseSurface(part.surface);
    this.parts = [];
    this.tracker = null;
  }
}
