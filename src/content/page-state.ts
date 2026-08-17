import { CONTENT_WATCHDOG_MS } from '../shared/constants';
import { FixedElementManager } from './fixed-element-detector';

const STYLE_ID = 'shotdock-capture-mode';

/**
 * Owns every change ShotDock makes to the page, and guarantees they come back off.
 *
 * The watchdog is the important part: if the service worker is evicted or the
 * extension is reloaded mid-capture, nothing would ever send the restore message.
 * The page must not be left with a hidden header, so it restores itself.
 */
export class PageState {
  private readonly fixedElements = new FixedElementManager();
  private savedScroll: { x: number; y: number } | null = null;
  private watchdog: number | null = null;
  private active = false;

  prepare(): void {
    if (this.active) {
      this.touch();
      return;
    }
    this.active = true;
    this.savedScroll = { x: window.scrollX, y: window.scrollY };
    injectCaptureStyles();
    this.touch();
  }

  hideFixedElements(): number {
    return this.fixedElements.hideAll();
  }

  showFixedElements(): void {
    this.fixedElements.restoreAll();
  }

  /** Resets the self-restore timer; called on every message from the worker. */
  touch(): void {
    if (this.watchdog !== null) clearTimeout(this.watchdog);
    this.watchdog = window.setTimeout(() => this.restore(true), CONTENT_WATCHDOG_MS);
  }

  restore(restoreScroll: boolean): void {
    if (this.watchdog !== null) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
    this.fixedElements.restoreAll();
    removeCaptureStyles();
    if (restoreScroll && this.savedScroll) {
      window.scrollTo({
        left: this.savedScroll.x,
        top: this.savedScroll.y,
        behavior: 'instant' as ScrollBehavior,
      });
    }
    this.savedScroll = null;
    this.active = false;
  }

  get isActive(): boolean {
    return this.active;
  }
}

/**
 * Freezes the things that would otherwise change between two frames: smooth
 * scrolling (which would make our scroll positions lies), CSS animations, and
 * the text caret.
 */
function injectCaptureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html { scroll-behavior: auto !important; }
    *, *::before, *::after {
      animation-play-state: paused !important;
      transition: none !important;
      caret-color: transparent !important;
    }
  `;
  (document.head ?? document.documentElement).appendChild(style);
}

function removeCaptureStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}
