import { ShotDockError } from '../shared/errors';
import { mimeFor } from '../utils/image';
import type { ImageFormat } from '../shared/types';

/**
 * Copies an image to the system clipboard.
 *
 * Runs in the popup, not the service worker or the offscreen document: the
 * Clipboard API requires a focused document, and the popup is the only context
 * that has both focus and the user's click.
 *
 * The Blob is handed to ClipboardItem as a *promise* deliberately — resolving it
 * first would spend the user gesture on an await and get the write rejected.
 * Chrome only accepts image/png this way, so JPEG output is copied as PNG.
 */
export async function copyImageToClipboard(
  image: Blob | string,
  format: ImageFormat,
): Promise<void> {
  try {
    const type = format === 'png' ? 'image/png' : mimeFor(format);
    const blobPromise =
      typeof image === 'string'
        ? fetch(image).then((response) => response.blob())
        : Promise.resolve(image);

    if (type === 'image/png') {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
      return;
    }

    // Clipboard support for JPEG is patchy; re-wrap the pixels as PNG.
    const pngBlob = await transcodeToPng(await blobPromise);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
  } catch (error) {
    throw new ShotDockError('CLIPBOARD_FAILED', { cause: error });
  }
}

async function transcodeToPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0);
    return await canvas.convertToBlob({ type: 'image/png' });
  } finally {
    bitmap.close();
  }
}
