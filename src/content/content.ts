import { fail, ok, type AnalyzeResult, type ContentMessage, type ScrollResult } from '../shared/messages';
import { measurePage } from './page-analyzer';
import { PageState } from './page-state';
import { scrollToPosition, waitForStability } from './scroll-controller';

/**
 * Injected on demand (never declared in the manifest) so ShotDock needs no host
 * permissions at all — activeTab grants access only for the tab the user just
 * acted on, and only until they navigate away.
 *
 * This script is stateless between captures apart from `pageState`, which exists
 * to guarantee the page is restored.
 */

declare global {
  interface Window {
    __shotdockContentReady?: boolean;
  }
}

if (!window.__shotdockContentReady) {
  window.__shotdockContentReady = true;

  const pageState = new PageState();

  chrome.runtime.onMessage.addListener((message: ContentMessage, sender, sendResponse) => {
    // Only ShotDock's own service worker drives this script. The check costs
    // nothing and closes the door on anything else that reaches this listener.
    if (sender.id !== chrome.runtime.id) return false;
    if (message?.target !== 'content') return false;
    pageState.touch();

    handle(message)
      .then((value) => sendResponse(ok(value)))
      .catch((error: unknown) => {
        // A failure here must never leave the page modified.
        pageState.restore(true);
        sendResponse(fail(error instanceof Error ? error.message : String(error)));
      });
    return true;
  });

  async function handle(message: ContentMessage): Promise<unknown> {
    switch (message.type) {
      case 'ping':
        return true;

      case 'analyze': {
        const result: AnalyzeResult = { metrics: measurePage() };
        return result;
      }

      case 'prepare': {
        pageState.prepare();
        // The first frame keeps sticky headers — they belong at the top of the
        // finished image. Hiding starts from the second frame onwards.
        return measurePage();
      }

      case 'scroll-to': {
        if (message.hideFixedElements) pageState.hideFixedElements();
        scrollToPosition(message.x, message.y);
        const stabilizedInMs = await waitForStability(message.delay);
        // Report where the page settled, not where it first landed — lazy content
        // loading in can shift it, and the stitcher aligns on these numbers.
        const metrics = measurePage();
        const result: ScrollResult = {
          x: metrics.scrollX,
          y: metrics.scrollY,
          pageWidth: metrics.pageWidth,
          pageHeight: metrics.pageHeight,
          stabilizedInMs,
        };
        return result;
      }

      case 'restore': {
        pageState.restore(message.restoreScroll);
        return true;
      }

      default:
        throw new Error('Unsupported message');
    }
  }

  // Navigating away mid-capture: nothing to restore, but drop the watchdog.
  // Deliberately not `once` — a page that comes back out of the bfcache keeps this
  // same script, and would otherwise be left without the listener from then on.
  window.addEventListener('pagehide', () => pageState.restore(false));
}
