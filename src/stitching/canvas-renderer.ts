import {
  PREVIEW_MAX_HEIGHT,
  PREVIEW_MAX_WIDTH,
  PREVIEW_QUALITY,
} from '../shared/constants';
import { ShotDockError } from '../shared/errors';
import { mimeFor } from '../utils/image';
import type { ImageFormat } from '../shared/types';

/** Thin canvas layer, so the stitcher never touches raw DOM/OffscreenCanvas APIs. */

export interface Surface {
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
}

/**
 * Allocates a drawing surface, optionally proving it is real before handing it
 * back. Throws RENDER_FAILED if the machine cannot back it, which is the signal
 * the stitcher's retry ladder waits for.
 */
export function createSurface(
  width: number,
  height: number,
  options: { verify?: boolean } = {},
): Surface {
  let canvas: OffscreenCanvas;
  try {
    canvas = new OffscreenCanvas(width, height);
  } catch (error) {
    // Past Skia's per-side maximum the constructor itself refuses.
    throw new ShotDockError('RENDER_FAILED', { cause: error });
  }

  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!ctx) throw new ShotDockError('RENDER_FAILED');
  // Screenshots are opaque; a white ground avoids black bands if a frame is short.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const surface = { canvas, ctx };

  if (options.verify && !isBacked(surface, width, height)) {
    releaseSurface(surface);
    throw new ShotDockError('RENDER_FAILED');
  }
  return surface;
}

/**
 * Whether a canvas is genuinely backed by memory.
 *
 * A canvas Chrome could not allocate does not throw. It reports the size it was
 * asked for and quietly discards every draw, which surfaces minutes later as a
 * blank screenshot — the one failure mode worth spending a pixel read to rule
 * out. The far corner is the telling one: it is the part of the buffer a partial
 * allocation would be missing. The ground was just painted white, so anything
 * else means the fill never landed.
 */
function isBacked(surface: Surface, width: number, height: number): boolean {
  try {
    const { data } = surface.ctx.getImageData(width - 1, height - 1, 1, 1);
    return data[0] === 255 && data[1] === 255 && data[2] === 255;
  } catch {
    // Pixel reads throw outright on a surface that was never really there.
    return false;
  }
}

/** Hands the backing store back now, rather than whenever the collector next runs. */
export function releaseSurface(surface: Surface): void {
  surface.canvas.width = 0;
  surface.canvas.height = 0;
}

export async function decodeFrame(dataUrl: string): Promise<ImageBitmap> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

export async function encodeSurface(
  surface: Surface,
  format: ImageFormat,
  quality: number,
): Promise<Blob> {
  const options: ImageEncodeOptions = { type: mimeFor(format) };
  if (format === 'jpeg') options.quality = clampQuality(quality);
  return surface.canvas.convertToBlob(options);
}

const clampQuality = (quality: number): number => Math.min(1, Math.max(0.1, quality / 100));

/**
 * Builds one small preview covering the whole capture, however many parts it was
 * split into. Fits inside PREVIEW_MAX_WIDTH × PREVIEW_MAX_HEIGHT so it stays cheap
 * to message around and persist in session storage.
 */
export async function renderPreview(
  parts: { surface: Surface; y: number }[],
  width: number,
  height: number,
): Promise<string> {
  const scale = Math.min(PREVIEW_MAX_WIDTH / width, PREVIEW_MAX_HEIGHT / height, 1);
  const previewWidth = Math.max(1, Math.round(width * scale));
  const previewHeight = Math.max(1, Math.round(height * scale));
  const preview = createSurface(previewWidth, previewHeight);
  preview.ctx.imageSmoothingQuality = 'high';

  // Each part is placed between two rounded boundaries rather than at a rounded
  // offset with a rounded height: rounding the two independently can leave a
  // hairline gap or overlap on the join between sections.
  for (const part of parts) {
    const top = Math.round(part.y * scale);
    const bottom = Math.min(
      previewHeight,
      Math.round((part.y + part.surface.canvas.height) * scale),
    );
    if (bottom <= top) continue;
    preview.ctx.drawImage(part.surface.canvas, 0, top, previewWidth, bottom - top);
  }

  const blob = await preview.canvas.convertToBlob({
    type: 'image/jpeg',
    quality: PREVIEW_QUALITY,
  });
  return blobToDataUrl(blob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new ShotDockError('RENDER_FAILED'));
    reader.readAsDataURL(blob);
  });
}
