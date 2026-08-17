import type { CaptureDelay, DefaultAction, ImageFormat, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  defaultAction: 'ask',
  format: 'png',
  jpegQuality: 85,
  captureDelay: 'auto',
  handleFixedElements: true,
  restoreScrollPosition: true,
  seamDetection: true,
  showPreview: true,
  autoDownload: false,
  autoCopy: false,
  openInNewTab: true,
};

/**
 * Resolved per call rather than at module load: `chrome.storage.sync` is absent
 * when sync is unavailable, and reading it eagerly would also mean this module
 * could not be imported anywhere without a live extension API — including by the
 * tests that cover the validation below.
 */
const area = (): chrome.storage.StorageArea => chrome.storage.sync ?? chrome.storage.local;

const DEFAULT_ACTIONS: DefaultAction[] = ['ask', 'full-page', 'visible'];
const FORMATS: ImageFormat[] = ['png', 'jpeg'];
const DELAYS: CaptureDelay[] = ['auto', 'fast', 'thorough'];

const pick = <T extends string>(value: unknown, allowed: T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const quality = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(40, Math.round(value)));
};

/**
 * Storage is not a trusted input. It syncs across profiles, survives every
 * upgrade, and is editable by hand — so a value read back can be the wrong type,
 * out of range, or from a schema this build no longer speaks. Everything is
 * validated on the way in, and anything unrecognised falls back to its default
 * rather than reaching the capture pipeline.
 */
export function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  const stored = (raw ?? {}) as Record<keyof Settings, unknown>;
  return {
    defaultAction: pick(stored.defaultAction, DEFAULT_ACTIONS, DEFAULT_SETTINGS.defaultAction),
    format: pick(stored.format, FORMATS, DEFAULT_SETTINGS.format),
    jpegQuality: quality(stored.jpegQuality, DEFAULT_SETTINGS.jpegQuality),
    captureDelay: pick(stored.captureDelay, DELAYS, DEFAULT_SETTINGS.captureDelay),
    handleFixedElements: bool(stored.handleFixedElements, DEFAULT_SETTINGS.handleFixedElements),
    restoreScrollPosition: bool(
      stored.restoreScrollPosition,
      DEFAULT_SETTINGS.restoreScrollPosition,
    ),
    seamDetection: bool(stored.seamDetection, DEFAULT_SETTINGS.seamDetection),
    showPreview: bool(stored.showPreview, DEFAULT_SETTINGS.showPreview),
    autoDownload: bool(stored.autoDownload, DEFAULT_SETTINGS.autoDownload),
    autoCopy: bool(stored.autoCopy, DEFAULT_SETTINGS.autoCopy),
    openInNewTab: bool(stored.openInNewTab, DEFAULT_SETTINGS.openInNewTab),
  };
}

export async function getSettings(): Promise<Settings> {
  try {
    const stored = (await area().get(DEFAULT_SETTINGS)) as Partial<Settings>;
    return normalizeSettings(stored);
  } catch {
    // A capture must not fail because storage is momentarily unavailable.
    return { ...DEFAULT_SETTINGS };
  }
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await area().set(patch);
}

export async function resetSettings(): Promise<void> {
  await area().set(DEFAULT_SETTINGS);
}

/** Subscribes to changes from any context (options page edits reach the popup live). */
export function onSettingsChanged(listener: (settings: Settings) => void): () => void {
  const handler = (_changes: unknown, areaName: string) => {
    if (areaName !== 'sync' && areaName !== 'local') return;
    void getSettings().then(listener);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
