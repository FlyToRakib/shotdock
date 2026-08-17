/** Core domain types shared by every ShotDock context. */

export type CaptureType = 'full-page' | 'visible';

export type ImageFormat = 'png' | 'jpeg';

/**
 * Capture session lifecycle. Mirrors the state machine in the product spec:
 * IDLE → ANALYZING → PREPARING → CAPTURING ⇄ PAUSED → STITCHING → READY,
 * with ERROR and CANCELLED as terminal branches.
 */
export type CaptureStatus =
  | 'idle'
  | 'analyzing'
  | 'preparing'
  | 'capturing'
  | 'paused'
  | 'stitching'
  | 'ready'
  | 'error'
  | 'cancelled';

/** Raw geometry read from the page, in CSS pixels. */
export interface PageMetrics {
  pageWidth: number;
  pageHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  scrollX: number;
  scrollY: number;
}

/** One planned scroll stop. `row`/`col` place it in the capture grid. */
export interface CapturePosition {
  index: number;
  x: number;
  y: number;
  row: number;
  col: number;
}

export interface CapturePlan {
  positions: CapturePosition[];
  rows: number;
  columns: number;
  /** Page area actually covered, in CSS pixels (page size clamped to sane limits). */
  captureWidth: number;
  captureHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  /** True when the page is so tall that the plan had to stop short of the bottom. */
  truncated: boolean;
}

/** A captured viewport, tagged with where the page actually was when it was taken. */
export interface CapturedFrame {
  index: number;
  row: number;
  col: number;
  /** Actual scroll offsets reported by the page, not the requested ones. */
  x: number;
  y: number;
  dataUrl: string;
}

/** One rendered image. A capture yields several parts only when it exceeds canvas limits. */
export interface OutputPart {
  index: number;
  width: number;
  height: number;
  byteSize: number;
}

export interface CaptureResult {
  id: string;
  type: CaptureType;
  format: ImageFormat;
  quality: number;
  /** Page identity, for the filename and the result header. */
  hostname: string;
  title: string;
  /** Final image size in device pixels (summed height across parts). */
  width: number;
  height: number;
  parts: OutputPart[];
  /** Small downscaled preview, safe to pass around and persist. */
  previewDataUrl: string;
  /** Device pixels per CSS pixel in the output. */
  scale: number;
  createdAt: number;
  /** Set when the page was too tall to capture completely. */
  truncated: boolean;
}

export interface CaptureProgress {
  completed: number;
  total: number;
  /** Short human-readable status line, e.g. "Section 17 of 25". */
  detail: string;
}

export interface CaptureErrorInfo {
  code: string;
  title: string;
  message: string;
  /** Label for the single recovery action offered in the UI, if any. */
  action?: 'retry' | 'dismiss';
}

/** The one object every UI surface renders from. */
export interface SessionState {
  status: CaptureStatus;
  type: CaptureType | null;
  progress: CaptureProgress;
  result: CaptureResult | null;
  error: CaptureErrorInfo | null;
}

export type DefaultAction = CaptureType | 'ask';
export type CaptureDelay = 'auto' | 'fast' | 'thorough';

export interface Settings {
  defaultAction: DefaultAction;
  format: ImageFormat;
  jpegQuality: number;
  captureDelay: CaptureDelay;
  handleFixedElements: boolean;
  restoreScrollPosition: boolean;
  seamDetection: boolean;
  showPreview: boolean;
  autoDownload: boolean;
  autoCopy: boolean;
  /** Opens the finished capture full size in a tab of its own. */
  openInNewTab: boolean;
}
