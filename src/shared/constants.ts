/** Tuning constants for the capture pipeline. Every magic number lives here. */

/**
 * The brand pair, for the places that cannot read a CSS variable: the toolbar
 * badge (drawn by the browser from the service worker), the icon generator and
 * the inline logo. Lime is the accent, graphite is the ground it sits on and the
 * only ink it ever carries — white on the lime is 1.4:1.
 * Source of truth for everything else is `src/ui/tokens.css`.
 */
export const BRAND_LIME = '#aeed22';
export const BRAND_INK = '#111827';

/**
 * chrome.tabs.captureVisibleTab is capped at MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND
 * (2/sec). Staying just under it avoids quota errors and the retries they cause.
 */
export const MIN_CAPTURE_INTERVAL_MS = 560;

/** Retries for a capture call that hit the quota anyway (e.g. another extension capturing). */
export const CAPTURE_RETRY_LIMIT = 3;
export const CAPTURE_RETRY_BACKOFF_MS = 700;

/**
 * Vertical overlap between consecutive frames, in CSS pixels. The overlap is what
 * lets the stitcher absorb sub-pixel scroll rounding and seam correction.
 */
export const FRAME_OVERLAP_PX = 64;

/** Never plan a step smaller than this, however small the viewport reports itself. */
export const MIN_SCROLL_STEP_PX = 80;

/** Hard stop on frame count so a runaway/infinite-scroll page cannot capture forever. */
export const MAX_FRAMES = 400;

/**
 * Skia's hard per-side maximum. A canvas wider or taller than this cannot be
 * allocated on any machine, so it bounds both the height of a single output part
 * and the width the whole output is scaled down to fit.
 */
export const MAX_CANVAS_DIMENSION = 32767;

/**
 * Per-part pixel budgets, by device tier — the *soft* limit. Chrome accepts far
 * larger allocations in principle, but on a machine without the memory to back
 * one it fails, sometimes silently as a blank bitmap, so the ceiling is chosen
 * per device rather than fixed. See `src/utils/device-tier.ts`.
 *
 * At 4 bytes per pixel: 40M ≈ 160 MB, 96M ≈ 384 MB, 160M ≈ 640 MB. The low tier
 * is deliberately the value every machine used before tiering existed, so weaker
 * hardware behaves exactly as it always has.
 *
 * Worth being precise about what splitting does and does not save: the stitcher
 * allocates every part up front and holds them all until encoding finishes, so a
 * page costs `width × height × 4` bytes however many parts it is cut into. This
 * budget governs the size of each individual allocation, not the total.
 */
export const PART_AREA_BUDGET = {
  low: 40_000_000,
  medium: 96_000_000,
  high: 160_000_000,
} as const;

/** Floor for the allocation retry ladder. Below this, splitting has stopped helping. */
export const MIN_PART_AREA = 8_000_000;

/** Downscaled preview shown in the popup. Small enough to persist and message freely. */
export const PREVIEW_MAX_WIDTH = 640;
export const PREVIEW_MAX_HEIGHT = 1600;
export const PREVIEW_QUALITY = 0.82;

/** Page-stabilisation budget per frame, by the `captureDelay` setting. */
export const STABILIZE_BUDGET_MS: Record<'fast' | 'auto' | 'thorough', { min: number; max: number }> = {
  fast: { min: 30, max: 250 },
  auto: { min: 60, max: 1200 },
  thorough: { min: 250, max: 3000 },
};

/**
 * Time a tab needs after being brought to the front before it has a composited
 * frame for captureVisibleTab to read.
 */
export const TAB_SWITCH_SETTLE_MS = 220;

/**
 * Head start given to the popup's auto-copy before the preview tab takes focus
 * and closes the popup out from under it. Only spent when both settings are on.
 */
export const AUTO_COPY_GRACE_MS = 500;

/** Timeout for a single round trip to the content script. */
export const CONTENT_MESSAGE_TIMEOUT_MS = 10_000;

/** Overall capture watchdog. Beyond this the session fails with a timeout error. */
export const CAPTURE_TIMEOUT_MS = 5 * 60_000;

/**
 * If the content script stops hearing from the service worker (worker evicted,
 * extension reloaded), it restores the page itself after this long.
 */
export const CONTENT_WATCHDOG_MS = 45_000;

/** Seam detection search range, in device pixels, and the margin that makes a match credible. */
export const SEAM_SEARCH_PX = 12;
export const SEAM_STRIP_HEIGHT = 8;
export const SEAM_CONFIDENCE_RATIO = 0.7;

/** Page-relative URL prefixes that Chrome forbids extensions from scripting. */
export const RESTRICTED_URL_PREFIXES = [
  'chrome://',
  'chrome-untrusted://',
  'chrome-extension://',
  'chrome-search://',
  'devtools://',
  'edge://',
  'brave://',
  'opera://',
  'vivaldi://',
  'about:',
  'view-source:',
  'data:',
  'blob:',
];

/** Web Store pages are ordinary https URLs but blocked for extensions. */
export const RESTRICTED_URL_HOSTS = ['chrome.google.com/webstore', 'chromewebstore.google.com'];

export const DOWNLOAD_FOLDER = 'ShotDock';

export const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
export const CONTENT_SCRIPT_PATH = 'content.js';
export const PREVIEW_PAGE_PATH = 'preview.html';
