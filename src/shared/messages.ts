import type {
  CaptureDelay,
  CaptureType,
  CapturedFrame,
  ImageFormat,
  PageMetrics,
  SessionState,
} from './types';

/**
 * Every message carries a `target` so each context can ignore traffic that isn't
 * addressed to it — chrome.runtime.sendMessage broadcasts to all of them.
 */
export type MessageTarget = 'background' | 'offscreen' | 'ui' | 'content';

// --- UI → background --------------------------------------------------------

export type UiMessage =
  | { target: 'background'; type: 'start-capture'; captureType: CaptureType }
  | { target: 'background'; type: 'pause' }
  | { target: 'background'; type: 'resume' }
  | { target: 'background'; type: 'cancel' }
  | { target: 'background'; type: 'get-state' }
  | { target: 'background'; type: 'reset' }
  | { target: 'background'; type: 'set-format'; format: ImageFormat; quality: number }
  | { target: 'background'; type: 'download' }
  | { target: 'background'; type: 'get-image'; part: number }
  | { target: 'background'; type: 'get-object-url'; part: number }
  | { target: 'background'; type: 'open-preview' };

// --- background → content ---------------------------------------------------

export type ContentMessage =
  | { target: 'content'; type: 'ping' }
  | { target: 'content'; type: 'analyze' }
  | { target: 'content'; type: 'prepare' }
  | {
      target: 'content';
      type: 'scroll-to';
      x: number;
      y: number;
      /** Fixed/sticky elements stay visible for the first frame, then get hidden. */
      hideFixedElements: boolean;
      delay: CaptureDelay;
    }
  | { target: 'content'; type: 'restore'; restoreScroll: boolean };

export interface ScrollResult {
  /** Where the page actually landed — the stitcher trusts this, not the request. */
  x: number;
  y: number;
  /** Re-measured page height; a growing page means lazy content appeared. */
  pageHeight: number;
  pageWidth: number;
  stabilizedInMs: number;
}

// --- background → offscreen -------------------------------------------------

export type OffscreenMessage =
  | {
      target: 'offscreen';
      type: 'begin';
      /** Everything in CSS pixels; the renderer measures the device scale itself. */
      pageWidth: number;
      pageHeight: number;
      viewportWidth: number;
      viewportHeight: number;
      seamDetection: boolean;
    }
  | { target: 'offscreen'; type: 'add-frame'; frame: CapturedFrame }
  | { target: 'offscreen'; type: 'finish'; format: ImageFormat; quality: number }
  | { target: 'offscreen'; type: 'reencode'; format: ImageFormat; quality: number }
  | { target: 'offscreen'; type: 'get-image'; part: number }
  | { target: 'offscreen'; type: 'get-object-url'; part: number }
  | { target: 'offscreen'; type: 'release' };

export interface RenderedOutput {
  parts: { index: number; width: number; height: number; byteSize: number }[];
  /** Final image size in device pixels (height summed across parts). */
  width: number;
  height: number;
  scale: number;
  previewDataUrl: string;
}

// --- background → UI (broadcast) -------------------------------------------

export type BroadcastMessage = { target: 'ui'; type: 'state'; state: SessionState };

export type AnyMessage = UiMessage | ContentMessage | OffscreenMessage | BroadcastMessage;

/** Uniform envelope so callers never have to branch on chrome.runtime.lastError. */
export type Response<T> = { ok: true; value: T } | { ok: false; error: string; code?: string };

export const ok = <T>(value: T): Response<T> => ({ ok: true, value });
export const fail = (error: string, code?: string): Response<never> => ({ ok: false, error, code });

/** Result payload types, keyed for readability at call sites. */
export interface AnalyzeResult {
  metrics: PageMetrics;
}

export function sendToBackground<T>(message: UiMessage): Promise<Response<T>> {
  return chrome.runtime.sendMessage(message) as Promise<Response<T>>;
}
