import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../src/shared/settings';

/**
 * Settings come back out of synced storage, which survives every upgrade and can
 * be edited by hand — so anything read from it is treated as untrusted input.
 * These are the shapes that used to reach the capture pipeline unchecked.
 */
describe('normalizeSettings', () => {
  it('returns the defaults for missing or empty storage', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps every valid stored value', () => {
    const stored = {
      defaultAction: 'visible',
      format: 'jpeg',
      jpegQuality: 60,
      captureDelay: 'thorough',
      handleFixedElements: false,
      restoreScrollPosition: false,
      seamDetection: false,
      showPreview: false,
      autoDownload: true,
      autoCopy: true,
      openInNewTab: false,
    } as const;

    expect(normalizeSettings({ ...stored })).toEqual(stored);
  });

  it('falls back to the default for an unrecognised enum value', () => {
    // A delay outside the known set used to reach the content script and throw
    // when it looked up a stabilisation budget that did not exist.
    const settings = normalizeSettings({ captureDelay: 'instant' } as never);
    expect(settings.captureDelay).toBe('auto');

    expect(normalizeSettings({ format: 'webp' } as never).format).toBe('png');
    expect(normalizeSettings({ defaultAction: 'everything' } as never).defaultAction).toBe('ask');
  });

  it('clamps the JPEG quality into the range the encoder accepts', () => {
    expect(normalizeSettings({ jpegQuality: 5000 }).jpegQuality).toBe(100);
    expect(normalizeSettings({ jpegQuality: -20 }).jpegQuality).toBe(40);
    expect(normalizeSettings({ jpegQuality: 72.6 }).jpegQuality).toBe(73);
  });

  it('rejects values of the wrong type outright', () => {
    expect(normalizeSettings({ jpegQuality: 'high' } as never).jpegQuality).toBe(
      DEFAULT_SETTINGS.jpegQuality,
    );
    expect(normalizeSettings({ jpegQuality: Number.NaN }).jpegQuality).toBe(
      DEFAULT_SETTINGS.jpegQuality,
    );
    expect(normalizeSettings({ autoDownload: 'yes' } as never).autoDownload).toBe(false);
    expect(normalizeSettings({ showPreview: null } as never).showPreview).toBe(true);
  });
});
