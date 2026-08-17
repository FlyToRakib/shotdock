import {
  AUTO_COPY_GRACE_MS,
  BRAND_INK,
  BRAND_LIME,
  CAPTURE_TIMEOUT_MS,
  PREVIEW_PAGE_PATH,
  TAB_SWITCH_SETTLE_MS,
} from '../shared/constants';
import { ShotDockError, isExpectedFailure, isRestrictedUrl } from '../shared/errors';
import { getSettings } from '../shared/settings';
import type { CaptureResult, CaptureType, ImageFormat, SessionState } from '../shared/types';
import { RateLimiter, sleep, withTimeout } from '../capture/capture-timing';
import { FrameManager } from '../capture/frame-manager';
import { runFullPageCapture, type CaptureContext } from '../capture/full-page-capture';
import { PageBridge } from '../capture/page-bridge';
import { runVisibleCapture } from '../capture/visible-area-capture';
import { downloadImage, filenameFor } from '../output/download';
import { hostnameOf } from '../utils/image';
import { createLogger } from '../utils/logger';
import { CaptureSession } from './capture-session';

const log = createLogger('capture-manager');

const STATE_KEY = 'shotdock:state';

/**
 * Owns one capture at a time and everything around it: tab validation, the
 * offscreen renderer's lifetime, progress broadcasting, and the post-capture
 * actions (re-encode, download).
 *
 * The UI never talks to the capture engine directly — it sends intents here and
 * renders whatever state comes back. That's what lets the same engine serve the
 * popup, the keyboard shortcuts, and whatever surface comes next.
 */
export class CaptureManager {
  readonly session = new CaptureSession();
  private readonly frames = new FrameManager();
  private readonly limiter = new RateLimiter();
  private keepAlive: number | null = null;
  private capturingTabId: number | null = null;
  private capturingWindowId: number | null = null;
  /** Tracks whether a finished capture is currently in session storage. */
  private persisted = false;
  /** Last badge style applied, so the colours are only re-sent when they change. */
  private badgeStyle: 'progress' | 'error' | 'none' | null = null;
  /** Reused so a run of captures doesn't leave a trail of preview tabs behind. */
  private previewTabId: number | null = null;
  /** The page the open preview was taken from, so it can be recaptured from there. */
  private previewSourceTabId: number | null = null;

  constructor() {
    this.session.onChange((state) => {
      void this.persist(state);
      this.broadcast(state);
      this.updateBadge(state);
    });
  }

  /** Restores a finished capture after the worker was evicted and restarted. */
  async hydrate(): Promise<void> {
    // The worker is often woken *by* a capture request, so this can be racing one.
    // Whatever is happening now outranks anything stored from before.
    if (this.session.currentStatus !== 'idle') return;

    try {
      const stored = (await chrome.storage.session.get(STATE_KEY)) as Record<string, SessionState>;
      const state = stored[STATE_KEY];
      // Anything that was mid-flight died with the worker; only a finished result
      // is still meaningful — and only while the renderer that holds its bytes is
      // still alive. Restoring past that point would put a capture back on screen
      // whose Copy and Download could never work.
      const usable =
        state?.status === 'ready' && !!state.result && (await this.frames.hasDocument());

      // Re-checked after the awaits above: a capture may have started meanwhile.
      if (this.session.currentStatus !== 'idle') return;

      if (usable) {
        this.persisted = true;
        this.session.restore(state);
        this.updateBadge(this.session.snapshot());
        return;
      }

      this.persisted = false;
      await chrome.storage.session.remove(STATE_KEY);
      // A capture interrupted by eviction leaves its progress badge behind.
      this.badgeStyle = null;
      this.updateBadge(this.session.snapshot());
    } catch (error) {
      log.warn('hydrate failed', error);
    }
  }

  async start(type: CaptureType): Promise<void> {
    if (this.session.isActive) return;
    this.session.start(type);
    this.startKeepAlive();

    try {
      // Resolved inside the try so "this page can't be captured" surfaces as
      // session state in the UI rather than as a rejected message call.
      const tab = await this.targetTab();
      this.capturingTabId = tab.id ?? null;
      this.capturingWindowId = tab.windowId ?? null;
      this.previewSourceTabId = tab.id ?? null;
      const settings = await getSettings();
      await this.frames.release();

      const context: CaptureContext = {
        windowId: tab.windowId,
        bridge: new PageBridge(tab.id!),
        frames: this.frames,
        session: this.session,
        settings,
        limiter: this.limiter,
      };

      const run =
        type === 'full-page'
          ? runFullPageCapture(context).then((outcome) => ({
              output: outcome.output,
              truncated: outcome.plan.truncated,
            }))
          : runVisibleCapture(context).then((output) => ({ output, truncated: false }));

      const { output, truncated } = await withTimeout(
        run,
        CAPTURE_TIMEOUT_MS,
        () => new ShotDockError('TIMEOUT'),
      );

      const result: CaptureResult = {
        id: `${Date.now().toString(36)}-${type}`,
        type,
        format: settings.format,
        quality: settings.jpegQuality,
        hostname: hostnameOf(tab.url),
        title: tab.title ?? '',
        width: output.width,
        height: output.height,
        parts: output.parts,
        previewDataUrl: settings.showPreview ? output.previewDataUrl : '',
        scale: output.scale,
        createdAt: Date.now(),
        truncated,
      };
      this.session.succeed(result);
      // The capture itself is finished, and what follows deliberately opens and
      // focuses a tab. Letting go of the captured tab here keeps the tab-switch
      // guard from having to reason about ShotDock's own tab changes.
      this.capturingTabId = null;
      this.capturingWindowId = null;

      if (settings.autoDownload) await this.download();
      if (settings.openInNewTab) {
        // Auto-copy runs in the popup, and a new active tab closes the popup.
        // Let the clipboard write land before taking focus away from it — but only
        // when there is actually a popup open to do the writing.
        if (settings.autoCopy && (await popupIsOpen())) await sleep(AUTO_COPY_GRACE_MS);
        await this.openPreviewTab(tab);
      }
    } catch (error) {
      // Expected outcomes are explained in the UI; the console only gets the
      // ones that point at a real defect.
      if (isExpectedFailure(error)) log.warn('capture stopped', error);
      else log.error('capture failed', error);
      this.session.failWith(error);
      await this.frames.release();
    } finally {
      this.capturingTabId = null;
      this.capturingWindowId = null;
      this.stopKeepAlive();
    }
  }

  /**
   * A capture belongs to one page. If that page closes or navigates, the frames
   * already taken no longer describe anything real — stop rather than stitching
   * two different pages together.
   */
  notifyTabChanged(tabId: number): void {
    if (this.capturingTabId !== tabId) return;
    this.session.abort(new ShotDockError('PAGE_CHANGED'));
  }

  /**
   * captureVisibleTab reads whichever tab is in front of the window, not the tab
   * ShotDock started on. Bringing another tab forward mid-capture would therefore
   * splice its pixels into someone else's screenshot — so the capture stops
   * instead, and says why.
   */
  notifyTabActivated(tabId: number, windowId: number): void {
    if (this.capturingTabId === null || tabId === this.capturingTabId) return;
    if (this.capturingWindowId !== null && this.capturingWindowId !== windowId) return;
    this.session.abort(new ShotDockError('TAB_SWITCHED'));
  }

  pause(): void {
    this.session.pause();
  }

  resume(): void {
    this.session.resume();
  }

  cancel(): void {
    this.session.cancel();
  }

  async reset(): Promise<void> {
    // A running capture owns the renderer. Cancelling lets it unwind through its
    // own `finally` — clearing the session under it would strand the abort and
    // leave it to fail on a renderer that had been torn down mid-frame.
    if (this.session.isActive) {
      this.session.cancel();
      return;
    }

    this.session.reset();
    // Closing the renderer, rather than just emptying it, hands the decoded
    // screenshot's memory back instead of holding it until the next capture.
    await this.frames.close();
    await chrome.storage.session.remove(STATE_KEY);
    this.persisted = false;
  }

  /** Re-encodes the finished capture without re-capturing the page. */
  async setFormat(format: ImageFormat, quality: number): Promise<void> {
    const current = this.session.snapshot().result;
    if (!current) throw new ShotDockError('RENDER_FAILED');
    if (current.format === format && current.quality === quality) return;

    const output = await this.frames.reencode(format, quality);
    this.session.updateResult({
      ...current,
      format,
      quality,
      parts: output.parts,
      width: output.width,
      height: output.height,
      previewDataUrl: current.previewDataUrl ? output.previewDataUrl : '',
    });
  }

  async download(): Promise<void> {
    const result = this.session.snapshot().result;
    if (!result) throw new ShotDockError('RENDER_FAILED');

    for (const part of result.parts) {
      const filename = filenameFor(result, part.index);
      try {
        // A blob URL keeps a huge screenshot out of the message channel entirely.
        await downloadImage(await this.frames.getObjectUrl(part.index), filename);
      } catch (error) {
        log.warn('blob download failed, falling back to data URL', error);
        await downloadImage(await this.frames.getImage(part.index), filename);
      }
    }
  }

  /** Hands the encoded bytes to the popup, which owns clipboard access. */
  getImage(part: number): Promise<string> {
    return this.frames.getImage(part);
  }

  /**
   * A reference to the bytes instead of the bytes themselves. The preview page
   * shares this extension's origin, so it can read the renderer's blob URL
   * directly rather than pushing a multi-megabyte data URL through messaging.
   */
  getObjectUrl(part: number): Promise<string> {
    return this.frames.getObjectUrl(part);
  }

  /**
   * Shows the finished capture full size, in a tab of its own. Called
   * automatically after a capture when the setting is on, and on demand from the
   * popup — one path, so both reuse the same tab.
   *
   * Opening never fails a capture that already succeeded: the image is safe in
   * the renderer either way, and the popup can still reach it.
   */
  async openPreviewTab(source?: chrome.tabs.Tab): Promise<void> {
    const url = chrome.runtime.getURL(PREVIEW_PAGE_PATH);
    try {
      if (this.previewTabId !== null && (await isPreviewTab(this.previewTabId, url))) {
        // Re-navigating the existing tab both refreshes it onto the new capture
        // and keeps the user's tab strip from filling up with previews.
        await chrome.tabs.update(this.previewTabId, { url, active: true });
        return;
      }
      // The remembered tab has been navigated somewhere else since; it belongs to
      // the user now, so take a fresh one rather than steering theirs.
      this.previewTabId = null;
      const tab = await chrome.tabs.create({
        url,
        active: true,
        // Right beside the page it came from, when we know which page that was.
        windowId: source?.windowId,
        index: typeof source?.index === 'number' ? source.index + 1 : undefined,
      });
      this.previewTabId = tab.id ?? null;
    } catch (error) {
      // Usually the remembered tab was closed; forget it and open a fresh one.
      log.warn('could not open the preview tab', error);
      if (this.previewTabId === null) return;
      this.previewTabId = null;
      await this.openPreviewTab(source);
    }
  }

  /** Keeps the remembered tabs honest when the user closes one of them. */
  notifyTabRemoved(tabId: number): void {
    if (this.previewTabId === tabId) this.previewTabId = null;
    if (this.previewSourceTabId === tabId) this.previewSourceTabId = null;
  }

  /**
   * Picks the page to capture.
   *
   * Opening the preview in its own tab leaves that tab in front, so the obvious
   * next move — hit the shortcut again, capture the same page a second time —
   * would land on a chrome-extension:// URL and fail. Capturing from the preview
   * therefore means "capture the page this preview came from", which is the only
   * page the user could plausibly have meant.
   */
  private async targetTab(): Promise<chrome.tabs.Tab> {
    let tab = await resolveActiveTab();

    if (tab.id !== undefined && tab.id === this.previewTabId && this.previewSourceTabId !== null) {
      const source = await focusTab(this.previewSourceTabId);
      if (source) tab = source;
    }

    if (isRestrictedUrl(tab.pendingUrl ?? tab.url)) throw new ShotDockError('RESTRICTED_PAGE');
    return tab;
  }

  private broadcast(state: SessionState): void {
    // No popup open is the normal case, not an error.
    chrome.runtime.sendMessage({ target: 'ui', type: 'state', state }).catch(() => undefined);
  }

  /**
   * Only a finished capture is ever worth writing down — {@link hydrate} discards
   * everything else on the way back in. Progress fires this on every frame, so
   * persisting those states would mean dozens of pointless storage writes per
   * capture, each carrying the whole session object.
   */
  private async persist(state: SessionState): Promise<void> {
    const worthKeeping = state.status === 'ready' && !!state.result;
    if (!worthKeeping && !this.persisted) return;

    try {
      if (worthKeeping) {
        await chrome.storage.session.set({ [STATE_KEY]: state });
        this.persisted = true;
      } else {
        await chrome.storage.session.remove(STATE_KEY);
        this.persisted = false;
      }
    } catch (error) {
      log.warn('could not persist state', error);
    }
  }

  /**
   * The badge text colour has to be set alongside the background every time: the
   * brand lime needs the dark ink on it (white would be 1.41:1), and the error
   * red needs white back again.
   */
  private updateBadge(state: SessionState): void {
    const { status, progress } = state;

    // The text changes on every frame; the colours only change when the badge
    // does, so they are re-sent then rather than three times per captured frame.
    const applyStyle = (style: 'progress' | 'error' | 'none', background: string, ink: string) => {
      if (this.badgeStyle === style) return;
      this.badgeStyle = style;
      if (style === 'none') return;
      void chrome.action.setBadgeBackgroundColor({ color: background });
      void chrome.action.setBadgeTextColor?.({ color: ink });
    };

    if (status === 'capturing' || status === 'stitching' || status === 'paused') {
      const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
      applyStyle('progress', BRAND_LIME, BRAND_INK);
      void chrome.action.setBadgeText({ text: status === 'paused' ? '❚❚' : `${percent}%` });
      return;
    }
    if (status === 'error') {
      applyStyle('error', '#dc2626', '#ffffff');
      void chrome.action.setBadgeText({ text: '!' });
      return;
    }
    applyStyle('none', '', '');
    void chrome.action.setBadgeText({ text: '' });
  }

  /**
   * A paused capture makes no API calls, and an idle MV3 worker is evicted after
   * ~30s — which would silently kill the session. A cheap periodic call keeps it
   * alive for as long as the user is actually mid-capture.
   */
  private startKeepAlive(): void {
    if (this.keepAlive !== null) return;
    this.keepAlive = setInterval(() => {
      void chrome.runtime.getPlatformInfo();
    }, 20_000) as unknown as number;
  }

  private stopKeepAlive(): void {
    if (this.keepAlive === null) return;
    clearInterval(this.keepAlive);
    this.keepAlive = null;
  }
}

/**
 * Finds the tab in front of the user.
 *
 * The window filter matters: with DevTools undocked, or a picture-in-picture or
 * app window in front, the "last focused window" is not a browsing window at all,
 * and its active tab is a devtools:// page nobody asked to capture. Each query
 * narrows less than the one before it, so the common case stays exact and the odd
 * one still finds something sensible.
 */
async function resolveActiveTab(): Promise<chrome.tabs.Tab> {
  const tab =
    (await queryOne({ active: true, lastFocusedWindow: true, windowType: 'normal' })) ??
    (await queryOne({ active: true, currentWindow: true, windowType: 'normal' })) ??
    (await queryOne({ active: true, windowType: 'normal' })) ??
    (await queryOne({ active: true, lastFocusedWindow: true }));

  if (!tab?.id) throw new ShotDockError('NO_ACTIVE_TAB');
  return tab;
}

async function queryOne(query: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab | undefined> {
  try {
    const [tab] = await chrome.tabs.query(query);
    return tab;
  } catch (error) {
    log.debug('tab query failed', query, error);
    return undefined;
  }
}

/**
 * Whether the remembered tab is still ShotDock's preview page and safe to reuse.
 *
 * ShotDock asks for no host permissions, so `url` is only populated for tabs it
 * has access to — its own pages. That asymmetry is exactly what makes this
 * useful: a readable URL that is no longer the preview page means the user has
 * navigated that tab somewhere of their own, and it is no longer ours to steer.
 * An unreadable URL says nothing, so it keeps today's behaviour and reuses it.
 */
async function isPreviewTab(tabId: number, previewUrl: string): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    const current = tab.pendingUrl ?? tab.url;
    if (!current) return true;
    return current.split('#')[0] === previewUrl;
  } catch {
    // The tab is gone; the caller opens a fresh one.
    return false;
  }
}

/** Whether a ShotDock popup is open — the only context that can reach the clipboard. */
async function popupIsOpen(): Promise<boolean> {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.POPUP],
    });
    return contexts.length > 0;
  } catch {
    // If we cannot tell, assume there is one: a needless pause is a far smaller
    // cost than a clipboard write cut off halfway.
    return true;
  }
}

/**
 * Brings a tab to the front and waits for it to paint — captureVisibleTab reads
 * the composited frame, which a freshly activated tab does not have yet.
 */
async function focusTab(tabId: number): Promise<chrome.tabs.Tab | undefined> {
  try {
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab?.windowId !== undefined) {
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
    }
    await sleep(TAB_SWITCH_SETTLE_MS);
    return tab ?? undefined;
  } catch (error) {
    log.debug('could not switch back to the captured page', error);
    return undefined;
  }
}
