import { dataUrlToBlob } from '../utils/image';
import { createLogger } from '../utils/logger';
import { api } from './api';

const log = createLogger('capture-image');

/**
 * Reads one part of the finished capture out of the renderer.
 *
 * Prefers the renderer's own object URL: every ShotDock surface shares the
 * extension's origin, so a blob URL created in the offscreen document can simply
 * be fetched here — the bytes never have to cross the message channel as base64,
 * which for a long full-page screenshot is several megabytes of string.
 *
 * The data URL is the fallback, for the case where that URL has already been
 * revoked by a newer capture.
 */
export async function loadCaptureImage(part: number): Promise<Blob> {
  try {
    const objectUrl = await api.getObjectUrl(part);
    const response = await fetch(objectUrl);
    if (response.ok) return await response.blob();
  } catch (error) {
    log.debug('object URL unavailable, falling back to a data URL', error);
  }
  return dataUrlToBlob(await api.getImage(part));
}
