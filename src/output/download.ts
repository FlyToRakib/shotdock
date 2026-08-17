import { DOWNLOAD_FOLDER } from '../shared/constants';
import { ShotDockError } from '../shared/errors';
import type { CaptureResult } from '../shared/types';
import { buildFilename } from '../utils/image';

/**
 * Saves through the browser's own downloads API. Nothing is uploaded anywhere —
 * the bytes go from the offscreen canvas straight to disk.
 */
export async function downloadImage(dataUrl: string, filename: string): Promise<number> {
  try {
    return await chrome.downloads.download({
      url: dataUrl,
      filename: `${DOWNLOAD_FOLDER}/${filename}`,
      saveAs: false,
    });
  } catch (error) {
    throw new ShotDockError('DOWNLOAD_FAILED', { cause: error });
  }
}

/** `{hostname}-{capture-type}-{date}.{ext}`, with a part suffix only when split. */
export function filenameFor(result: CaptureResult, part: number): string {
  return buildFilename({
    hostname: result.hostname,
    captureType: result.type,
    format: result.format,
    date: new Date(result.createdAt),
    part,
    totalParts: result.parts.length,
  });
}
