import { CAPTURE_RETRY_BACKOFF_MS, CAPTURE_RETRY_LIMIT } from '../shared/constants';
import { ShotDockError } from '../shared/errors';
import { createLogger } from '../utils/logger';
import { RateLimiter, sleep } from './capture-timing';

const log = createLogger('visible-capture');

/**
 * The one primitive the whole product is built on: a PNG of the visible tab.
 *
 * Frames are always grabbed as PNG regardless of the chosen output format —
 * re-encoding a lossy intermediate would smear text on every stitched frame.
 */
export async function captureVisibleTab(
  windowId: number,
  limiter: RateLimiter,
  /** A slot already reserved by the caller, so its wait could run alongside other work. */
  slot?: Promise<void>,
): Promise<string> {
  for (let attempt = 0; attempt <= CAPTURE_RETRY_LIMIT; attempt++) {
    await (attempt === 0 && slot ? slot : limiter.acquire());
    // Stamped as the call goes out, not when it comes back: the quota counts the
    // call, and a slot reserved earlier may have been waiting on something slower.
    limiter.mark();
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
      if (!dataUrl) throw new Error('empty capture');
      return dataUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const quotaExceeded = message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND');
      if (!quotaExceeded || attempt === CAPTURE_RETRY_LIMIT) {
        log.error('capture failed', message);
        throw new ShotDockError(
          message.toLowerCase().includes('cannot access') ? 'RESTRICTED_PAGE' : 'CAPTURE_FAILED',
          { cause: error },
        );
      }
      // Another extension is capturing too; back off and let the quota refill.
      log.warn('capture quota hit, retrying', { attempt });
      await sleep(CAPTURE_RETRY_BACKOFF_MS * (attempt + 1));
    }
  }
  throw new ShotDockError('CAPTURE_FAILED');
}

/** Device pixels per CSS pixel, measured from the frame rather than assumed. */
export function measureScale(frameWidth: number, viewportWidth: number): number {
  if (viewportWidth <= 0 || frameWidth <= 0) return 1;
  return frameWidth / viewportWidth;
}
