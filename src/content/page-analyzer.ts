import type { PageMetrics } from '../shared/types';

export interface RawPageMeasurements {
  documentScrollWidth: number;
  documentScrollHeight: number;
  documentClientWidth: number;
  documentClientHeight: number;
  bodyScrollWidth: number;
  bodyScrollHeight: number;
  bodyOffsetWidth: number;
  bodyOffsetHeight: number;
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio: number;
  scrollX: number;
  scrollY: number;
}

/**
 * Page size from several sources, because no single DOM property is reliable:
 * `body.scrollHeight` misses absolutely positioned overflow, `documentElement`
 * under-reports on pages that let the body scroll, and both disagree with the
 * viewport on short pages. Taking the maximum is the only stable answer.
 *
 * Pure, so the arithmetic can be tested without a browser.
 */
export function derivePageMetrics(raw: RawPageMeasurements): PageMetrics {
  const viewportWidth = Math.max(1, Math.round(raw.innerWidth || raw.documentClientWidth));
  const viewportHeight = Math.max(1, Math.round(raw.innerHeight || raw.documentClientHeight));

  // Note the viewport is deliberately *not* part of these maxima. clientWidth /
  // clientHeight exclude the scrollbars, and using them as the floor is what keeps
  // a strip of scrollbar out of the right edge of every full-page screenshot.
  const pageWidth = Math.max(
    1,
    raw.documentScrollWidth,
    raw.documentClientWidth,
    raw.bodyScrollWidth,
    raw.bodyOffsetWidth,
  );
  const pageHeight = Math.max(
    1,
    raw.documentScrollHeight,
    raw.documentClientHeight,
    raw.bodyScrollHeight,
    raw.bodyOffsetHeight,
  );

  return {
    pageWidth: Math.round(pageWidth),
    pageHeight: Math.round(pageHeight),
    viewportWidth,
    viewportHeight,
    devicePixelRatio: raw.devicePixelRatio > 0 ? raw.devicePixelRatio : 1,
    scrollX: Math.round(raw.scrollX),
    scrollY: Math.round(raw.scrollY),
  };
}

export function readRawMeasurements(): RawPageMeasurements {
  const doc = document.documentElement;
  const body = document.body;
  return {
    documentScrollWidth: doc?.scrollWidth ?? 0,
    documentScrollHeight: doc?.scrollHeight ?? 0,
    documentClientWidth: doc?.clientWidth ?? 0,
    documentClientHeight: doc?.clientHeight ?? 0,
    bodyScrollWidth: body?.scrollWidth ?? 0,
    bodyScrollHeight: body?.scrollHeight ?? 0,
    bodyOffsetWidth: body?.offsetWidth ?? 0,
    bodyOffsetHeight: body?.offsetHeight ?? 0,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };
}

export function measurePage(): PageMetrics {
  return derivePageMetrics(readRawMeasurements());
}
