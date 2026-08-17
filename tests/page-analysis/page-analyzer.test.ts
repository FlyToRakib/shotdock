import { describe, expect, it } from 'vitest';
import { derivePageMetrics, type RawPageMeasurements } from '../../src/content/page-analyzer';
import { isRestrictedUrl } from '../../src/shared/errors';

const raw = (overrides: Partial<RawPageMeasurements> = {}): RawPageMeasurements => ({
  documentScrollWidth: 1425,
  documentScrollHeight: 12000,
  documentClientWidth: 1425,
  documentClientHeight: 900,
  bodyScrollWidth: 1425,
  bodyScrollHeight: 11800,
  bodyOffsetWidth: 1425,
  bodyOffsetHeight: 11800,
  innerWidth: 1440,
  innerHeight: 900,
  devicePixelRatio: 2,
  scrollX: 0,
  scrollY: 340,
  ...overrides,
});

describe('derivePageMetrics', () => {
  it('takes the largest height any DOM property reports', () => {
    const metrics = derivePageMetrics(raw({ bodyScrollHeight: 13500 }));
    expect(metrics.pageHeight).toBe(13500);
  });

  it('sees past a body that under-reports the document height', () => {
    // Absolutely positioned overflow: documentElement knows, body doesn't.
    const metrics = derivePageMetrics(
      raw({ documentScrollHeight: 9000, bodyScrollHeight: 600, bodyOffsetHeight: 600 }),
    );
    expect(metrics.pageHeight).toBe(9000);
  });

  it('keeps the scrollbar out of the page width', () => {
    const metrics = derivePageMetrics(raw());
    // innerWidth (1440) includes the scrollbar; the layout width does not.
    expect(metrics.pageWidth).toBe(1425);
    expect(metrics.viewportWidth).toBe(1440);
  });

  it('reports a page wider than the viewport as wider', () => {
    const metrics = derivePageMetrics(
      raw({ documentScrollWidth: 2400, bodyScrollWidth: 2400, bodyOffsetWidth: 2400 }),
    );
    expect(metrics.pageWidth).toBe(2400);
  });

  it('never returns a zero-sized page or viewport', () => {
    const metrics = derivePageMetrics(
      raw({
        documentScrollWidth: 0,
        documentScrollHeight: 0,
        documentClientWidth: 0,
        documentClientHeight: 0,
        bodyScrollWidth: 0,
        bodyScrollHeight: 0,
        bodyOffsetWidth: 0,
        bodyOffsetHeight: 0,
        innerWidth: 0,
        innerHeight: 0,
      }),
    );
    expect(metrics.pageWidth).toBeGreaterThan(0);
    expect(metrics.pageHeight).toBeGreaterThan(0);
    expect(metrics.viewportWidth).toBeGreaterThan(0);
    expect(metrics.viewportHeight).toBeGreaterThan(0);
  });

  it('falls back to a sane device pixel ratio', () => {
    expect(derivePageMetrics(raw({ devicePixelRatio: 0 })).devicePixelRatio).toBe(1);
    expect(derivePageMetrics(raw()).devicePixelRatio).toBe(2);
  });

  it('preserves the scroll position so it can be restored', () => {
    expect(derivePageMetrics(raw()).scrollY).toBe(340);
  });
});

describe('isRestrictedUrl', () => {
  it('rejects pages Chrome will not let an extension script', () => {
    for (const url of [
      'chrome://settings',
      'chrome-extension://abc/popup.html',
      'devtools://devtools/bundled/inspector.html',
      'edge://flags',
      'about:blank',
      'view-source:https://example.com',
      'https://chromewebstore.google.com/detail/x',
      'https://chrome.google.com/webstore/category/extensions',
    ]) {
      expect(isRestrictedUrl(url)).toBe(true);
    }
  });

  // ShotDock ships with activeTab and no host permissions, so Chrome hides `url`
  // on every tab it hasn't been invoked on. Treating that as restricted turned
  // ordinary pages into "ShotDock can't capture this page".
  it('does not condemn a page whose URL it cannot read', () => {
    expect(isRestrictedUrl(undefined)).toBe(false);
    expect(isRestrictedUrl('')).toBe(false);
  });

  it('allows ordinary pages', () => {
    for (const url of [
      'https://example.com',
      'http://localhost:3000/dashboard',
      'https://en.wikipedia.org/wiki/Screenshot',
      'file:///C:/report.html',
    ]) {
      expect(isRestrictedUrl(url)).toBe(false);
    }
  });
});
