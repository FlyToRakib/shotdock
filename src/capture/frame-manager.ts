import { OFFSCREEN_DOCUMENT_PATH } from '../shared/constants';
import { ShotDockError } from '../shared/errors';
import type { OffscreenMessage, RenderedOutput, Response } from '../shared/messages';
import type { CapturedFrame, ImageFormat } from '../shared/types';
import { createLogger } from '../utils/logger';

const log = createLogger('frame-manager');

/**
 * The service worker's client for the offscreen renderer, and the reason very
 * long pages don't blow up memory: each frame is handed over and forgotten
 * immediately, so only one bitmap is ever in flight.
 */
export class FrameManager {
  private static creating: Promise<void> | null = null;

  async begin(options: {
    pageWidth: number;
    pageHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    seamDetection: boolean;
  }): Promise<void> {
    await this.ensureDocument();
    await this.send({ target: 'offscreen', type: 'begin', ...options });
  }

  async addFrame(frame: CapturedFrame): Promise<void> {
    await this.send({ target: 'offscreen', type: 'add-frame', frame });
  }

  finish(format: ImageFormat, quality: number): Promise<RenderedOutput> {
    return this.send<RenderedOutput>({ target: 'offscreen', type: 'finish', format, quality });
  }

  reencode(format: ImageFormat, quality: number): Promise<RenderedOutput> {
    return this.send<RenderedOutput>({ target: 'offscreen', type: 'reencode', format, quality });
  }

  /** Base64 data URL — for the clipboard, which needs the bytes in the popup. */
  getImage(part: number): Promise<string> {
    return this.send<string>({ target: 'offscreen', type: 'get-image', part });
  }

  /** Blob URL — for downloads, which only need a reference to the bytes. */
  getObjectUrl(part: number): Promise<string> {
    return this.send<string>({ target: 'offscreen', type: 'get-object-url', part });
  }

  /** Frees renderer memory. Safe to call when no document exists. */
  async release(): Promise<void> {
    if (!(await this.hasDocument())) return;
    try {
      await this.send({ target: 'offscreen', type: 'release' });
    } catch (error) {
      log.warn('release failed', error);
    }
  }

  /** Tears the document down entirely — used when a session is discarded. */
  async close(): Promise<void> {
    if (!(await this.hasDocument())) return;
    try {
      await chrome.offscreen.closeDocument();
    } catch (error) {
      log.warn('close failed', error);
    }
  }

  /**
   * Whether the renderer is still around — and with it the encoded bytes of the
   * last capture. A restored session is only meaningful while this is true.
   */
  async hasDocument(): Promise<boolean> {
    try {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      });
      return contexts.length > 0;
    } catch (error) {
      log.warn('could not check for the renderer', error);
      return false;
    }
  }

  private async ensureDocument(): Promise<void> {
    if (await this.hasDocument()) return;

    // Two captures racing would both try to create the single allowed document.
    if (FrameManager.creating) {
      await FrameManager.creating;
      return;
    }

    FrameManager.creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [chrome.offscreen.Reason.BLOBS],
        justification: 'Stitch and encode captured screenshot frames with canvas.',
      })
      .catch((error: unknown) => {
        // Lost the race — the document exists, which is all we wanted.
        if (String(error).includes('single offscreen')) return;
        throw new ShotDockError('RENDER_FAILED', { cause: error });
      })
      .finally(() => {
        FrameManager.creating = null;
      });

    await FrameManager.creating;
  }

  private async send<T = void>(message: OffscreenMessage): Promise<T> {
    const response = (await chrome.runtime.sendMessage(message)) as Response<T> | undefined;
    if (!response?.ok) {
      log.error('renderer rejected', message.type, response);
      throw new ShotDockError('RENDER_FAILED');
    }
    return response.value;
  }
}
