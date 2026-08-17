import { RESTRICTED_URL_HOSTS, RESTRICTED_URL_PREFIXES } from './constants';
import type { CaptureErrorInfo } from './types';

export type ErrorCode =
  | 'RESTRICTED_PAGE'
  | 'NO_ACTIVE_TAB'
  | 'PAGE_UNREACHABLE'
  | 'PAGE_CHANGED'
  | 'TAB_SWITCHED'
  | 'TOO_LARGE'
  | 'TIMEOUT'
  | 'CAPTURE_FAILED'
  | 'RENDER_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'CLIPBOARD_FAILED'
  | 'CANCELLED'
  | 'UNKNOWN';

/**
 * Every failure surfaced to the user goes through here, so the popup never has to
 * render a raw exception. `cause` keeps the technical detail for the console.
 */
export class ShotDockError extends Error {
  readonly code: ErrorCode;
  readonly info: CaptureErrorInfo;

  constructor(code: ErrorCode, options?: { cause?: unknown }) {
    const info = USER_MESSAGES[code];
    super(`${code}: ${info.message}`, options);
    this.name = 'ShotDockError';
    this.code = code;
    this.info = info;
  }
}

const USER_MESSAGES: Record<ErrorCode, CaptureErrorInfo> = {
  RESTRICTED_PAGE: {
    code: 'RESTRICTED_PAGE',
    title: "ShotDock can't capture this page",
    message:
      'Chrome blocks extensions on browser pages like chrome://, the New Tab page, the Web Store ' +
      'and other extensions. Open an ordinary webpage and try again.',
    action: 'dismiss',
  },
  NO_ACTIVE_TAB: {
    code: 'NO_ACTIVE_TAB',
    title: 'No page to capture',
    message: 'Open the page you want to capture, then try again.',
    action: 'dismiss',
  },
  PAGE_UNREACHABLE: {
    code: 'PAGE_UNREACHABLE',
    title: "ShotDock couldn't reach the page",
    message: 'Reload the page and try again.',
    action: 'retry',
  },
  PAGE_CHANGED: {
    code: 'PAGE_CHANGED',
    title: 'The page changed while ShotDock was capturing it',
    message: 'Let the page finish loading, then capture again.',
    action: 'retry',
  },
  TAB_SWITCHED: {
    code: 'TAB_SWITCHED',
    title: 'ShotDock stopped — you switched tabs',
    message:
      'A capture reads whichever tab is in front, so ShotDock stops rather than mixing another ' +
      'tab into your screenshot. Go back to the page and capture again.',
    action: 'retry',
  },
  TOO_LARGE: {
    code: 'TOO_LARGE',
    title: 'This page is extremely large',
    message:
      "ShotDock couldn't safely render the complete image, so the capture was split into sections.",
    action: 'dismiss',
  },
  TIMEOUT: {
    code: 'TIMEOUT',
    title: 'Capture took too long',
    message: 'The page stopped responding while ShotDock was capturing it.',
    action: 'retry',
  },
  CAPTURE_FAILED: {
    code: 'CAPTURE_FAILED',
    title: "ShotDock couldn't capture the screen",
    message: 'Make sure the tab is visible and in the foreground, then try again.',
    action: 'retry',
  },
  RENDER_FAILED: {
    code: 'RENDER_FAILED',
    title: "ShotDock couldn't build the image",
    message: 'Something went wrong while assembling the screenshot.',
    action: 'retry',
  },
  DOWNLOAD_FAILED: {
    code: 'DOWNLOAD_FAILED',
    title: "Couldn't save the screenshot",
    message: 'Check your downloads folder permissions and try again.',
    action: 'retry',
  },
  CLIPBOARD_FAILED: {
    code: 'CLIPBOARD_FAILED',
    title: "Couldn't copy the screenshot",
    message: 'Your browser blocked clipboard access. Try downloading it instead.',
    action: 'dismiss',
  },
  CANCELLED: {
    code: 'CANCELLED',
    title: 'Capture cancelled',
    message: 'Nothing was saved and the page was restored.',
  },
  UNKNOWN: {
    code: 'UNKNOWN',
    title: 'Something went wrong',
    message: "ShotDock couldn't finish the capture. Try again.",
    action: 'retry',
  },
};

/** Normalises anything thrown into a user-presentable shape. */
export function toErrorInfo(error: unknown): CaptureErrorInfo {
  if (error instanceof ShotDockError) return error.info;
  return USER_MESSAGES.UNKNOWN;
}

export function isCancellation(error: unknown): boolean {
  return error instanceof ShotDockError && error.code === 'CANCELLED';
}

/**
 * True for failures the user caused or can see coming — a chrome:// tab, no tab
 * at all, a page that navigated mid-capture. They are already explained in the
 * UI, so the console gets a warning rather than an error with a stack trace.
 */
export function isExpectedFailure(error: unknown): boolean {
  return (
    error instanceof ShotDockError &&
    (error.code === 'RESTRICTED_PAGE' ||
      error.code === 'NO_ACTIVE_TAB' ||
      error.code === 'PAGE_CHANGED' ||
      error.code === 'TAB_SWITCHED' ||
      error.code === 'CANCELLED')
  );
}

/**
 * Classifies a URL we are about to script. Cheap guard before touching the tab.
 *
 * An *unknown* URL is deliberately not restricted. ShotDock ships with `activeTab`
 * and no host permissions, so `chrome.tabs.query` strips `url` from every tab the
 * extension hasn't been invoked on — a blank URL says nothing about the page and
 * must not be mistaken for a chrome:// one. Pages that really are off limits still
 * fail, loudly and correctly, when the content script cannot be injected.
 */
export function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (RESTRICTED_URL_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true;
  return RESTRICTED_URL_HOSTS.some((host) => lower.includes(host));
}
