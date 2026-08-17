import { CONTENT_MESSAGE_TIMEOUT_MS, CONTENT_SCRIPT_PATH } from '../shared/constants';
import { ShotDockError } from '../shared/errors';
import type { AnalyzeResult, ContentMessage, Response, ScrollResult } from '../shared/messages';
import type { CaptureDelay, PageMetrics } from '../shared/types';
import { createLogger } from '../utils/logger';
import { withTimeout } from './capture-timing';

const log = createLogger('page-bridge');

/**
 * The service worker's handle on a tab: injects the content script if it isn't
 * already there, then speaks the typed content protocol over it.
 *
 * Injection is lazy and permission-light — it relies on the activeTab grant the
 * user just created by clicking the toolbar icon or pressing the shortcut.
 */
export class PageBridge {
  constructor(private readonly tabId: number) {}

  async connect(): Promise<void> {
    if (await this.ping()) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.tabId, allFrames: false },
        files: [CONTENT_SCRIPT_PATH],
      });
    } catch (error) {
      log.warn('injection failed', error);
      throw new ShotDockError('RESTRICTED_PAGE', { cause: error });
    }
    if (!(await this.ping())) throw new ShotDockError('PAGE_UNREACHABLE');
  }

  private async ping(): Promise<boolean> {
    try {
      const response = await chrome.tabs.sendMessage<ContentMessage, Response<boolean>>(
        this.tabId,
        { target: 'content', type: 'ping' },
      );
      return response?.ok === true;
    } catch {
      return false;
    }
  }

  analyze(): Promise<AnalyzeResult> {
    return this.send<AnalyzeResult>({ target: 'content', type: 'analyze' });
  }

  /** Saves the page's state and freezes animations. Nothing is hidden yet. */
  prepare(): Promise<PageMetrics> {
    return this.send<PageMetrics>({ target: 'content', type: 'prepare' });
  }

  scrollTo(options: {
    x: number;
    y: number;
    hideFixedElements: boolean;
    delay: CaptureDelay;
  }): Promise<ScrollResult> {
    return this.send<ScrollResult>({ target: 'content', type: 'scroll-to', ...options });
  }

  /** Best-effort: a restore failure must never mask the original error. */
  async restore(restoreScroll: boolean): Promise<void> {
    try {
      await this.send<boolean>({ target: 'content', type: 'restore', restoreScroll });
    } catch (error) {
      log.warn('restore failed; page watchdog will clean up', error);
    }
  }

  private async send<T>(message: ContentMessage): Promise<T> {
    const response = await withTimeout(
      chrome.tabs.sendMessage<ContentMessage, Response<T>>(this.tabId, message),
      CONTENT_MESSAGE_TIMEOUT_MS,
      () => new ShotDockError('TIMEOUT'),
    ).catch((error: unknown) => {
      if (error instanceof ShotDockError) throw error;
      throw new ShotDockError('PAGE_UNREACHABLE', { cause: error });
    });

    if (!response?.ok) throw new ShotDockError('PAGE_UNREACHABLE');
    return response.value;
  }
}
