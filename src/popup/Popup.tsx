import { useCallback, useEffect, useRef, useState } from 'react';
import { copyImageToClipboard } from '../output/clipboard';
import { DEFAULT_SETTINGS, getSettings } from '../shared/settings';
import type { CaptureType, ImageFormat, Settings } from '../shared/types';
import { api } from '../ui/api';
import { loadCaptureImage } from '../ui/capture-image';
import { Footer } from '../ui/Footer';
import { Header } from '../ui/Header';
import { formatTimeAgo } from '../utils/time';
import { CaptureButton } from './CaptureButton';
import { ErrorCard } from './ErrorCard';
import { FormatSelector } from './FormatSelector';
import { Preview } from './Preview';
import { Progress } from './Progress';
import { useSession } from './useSession';

export function Popup() {
  const { state, loaded } = useSession();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoStarted = useRef(false);
  const autoCopied = useRef<string | null>(null);

  useEffect(() => {
    void getSettings()
      .then(setSettings)
      .finally(() => setSettingsLoaded(true));
    void chrome.commands.getAll().then((commands) => {
      setShortcuts(
        Object.fromEntries(
          commands.filter((command) => command.name && command.shortcut).map((command) => [
            command.name as string,
            command.shortcut as string,
          ]),
        ),
      );
    });
  }, []);

  const start = useCallback((type: CaptureType) => {
    void api.startCapture(type).catch((error: Error) => setToast(error.message));
  }, []);

  // One-click capture: with a default action configured, opening ShotDock is the
  // whole interaction — no second click on a button the user already chose once.
  //
  // Both loads have to have landed first. Waiting only on the session state was a
  // race the settings usually lost, and the decision was then made against the
  // built-in default of "ask" — so the setting looked as though it did nothing.
  useEffect(() => {
    if (!loaded || !settingsLoaded || autoStarted.current) return;
    autoStarted.current = true;
    if (settings.defaultAction !== 'ask' && state.status === 'idle') start(settings.defaultAction);
  }, [loaded, settingsLoaded, settings.defaultAction, state.status, start]);

  const copy = useCallback(
    async (format: ImageFormat) => {
      try {
        setBusy(true);
        await copyImageToClipboard(await loadCaptureImage(0), format);
        setToast('Screenshot copied');
      } catch {
        setToast("Couldn't copy — try downloading instead");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const download = useCallback(async () => {
    try {
      setBusy(true);
      await api.download();
      setToast('Saved to your ShotDock folder');
    } catch {
      setToast("Couldn't save the screenshot");
    } finally {
      setBusy(false);
    }
  }, []);

  const result = state.result;

  // Auto-copy runs once per finished capture, never on a re-render or re-encode.
  useEffect(() => {
    if (!result || !settings.autoCopy || state.status !== 'ready') return;
    if (autoCopied.current === result.id) return;
    autoCopied.current = result.id;
    void copy(result.format);
  }, [result, settings.autoCopy, state.status, copy]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  // Keeps "just now" honest in a popup the user leaves open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const qualityTimer = useRef<number | null>(null);
  const changeFormat = (format: ImageFormat) => {
    setBusy(true);
    void api
      .setFormat(format, settings.jpegQuality)
      .catch(() => setToast("Couldn't change the format"))
      .finally(() => setBusy(false));
  };
  const changeQuality = (quality: number) => {
    setSettings((current) => ({ ...current, jpegQuality: quality }));
    if (qualityTimer.current) clearTimeout(qualityTimer.current);
    qualityTimer.current = window.setTimeout(() => {
      setBusy(true);
      void api
        .setFormat(result?.format ?? 'jpeg', quality)
        .catch(() => undefined)
        .finally(() => setBusy(false));
    }, 350);
  };

  const openFullSize = () => {
    void api.openPreview().catch(() => setToast("Couldn't open the preview tab"));
  };

  // Starting a capture already clears the previous one in the background, so the
  // two capture buttons behave identically whether or not a result is on screen.
  // They sit side by side rather than stacked: the popup has a 600px ceiling and
  // the result screen has to fit a thumbnail underneath them without scrolling.
  // On that screen they also lose their descriptions and shortcuts, which by
  // then need no explaining.
  const captureOptions = (compact: boolean) => (
    <div className="sd-home__pair">
      <CaptureButton
        variant="primary"
        title="Full Page"
        description="The entire page, top to bottom"
        shortcut={shortcuts['capture-full-page']}
        icon={<FullPageIcon />}
        compact={compact}
        onClick={() => start('full-page')}
      />
      <CaptureButton
        title="Visible Area"
        description="Just what's on screen"
        shortcut={shortcuts['capture-visible']}
        icon={<VisibleIcon />}
        compact={compact}
        onClick={() => start('visible')}
      />
    </div>
  );

  return (
    <div className="sd-app">
      <Header onOpenSettings={() => chrome.runtime.openOptionsPage()} />

      <main className="sd-main">
        {state.status === 'error' && state.error && (
          <ErrorCard
            error={state.error}
            onRetry={() => start(state.type ?? 'full-page')}
            onDismiss={() => void api.reset()}
          />
        )}

        {(state.status === 'analyzing' ||
          state.status === 'preparing' ||
          state.status === 'capturing' ||
          state.status === 'paused' ||
          state.status === 'stitching') && (
          <Progress
            status={state.status}
            progress={state.progress}
            onPause={() => void api.pause()}
            onResume={() => void api.resume()}
            onCancel={() => void api.cancel()}
          />
        )}

        {/* The capture options come first on purpose: after a capture the primary
            action is still "take another one", and the image below is history. */}
        {state.status === 'ready' && result && (
          <div className="sd-result">
            <div className="sd-home">
              <p className="sd-section-label">Take another screenshot</p>
              {captureOptions(true)}
            </div>

            <section className="sd-previous">
              <div className="sd-previous__head">
                <p className="sd-section-label">Previous capture</p>
                <button
                  type="button"
                  className="sd-btn sd-btn--ghost sd-previous__expand"
                  onClick={openFullSize}
                >
                  Open full size ↗
                </button>
              </div>
              <Preview result={result} age={formatTimeAgo(result.createdAt, now)} />
              <FormatSelector
                format={result.format}
                quality={settings.jpegQuality}
                busy={busy}
                onFormatChange={changeFormat}
                onQualityChange={changeQuality}
              />
              <div className="sd-result__actions">
                <button
                  type="button"
                  className="sd-btn"
                  disabled={busy}
                  onClick={() => void copy(result.format)}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="sd-btn sd-btn--primary"
                  disabled={busy}
                  onClick={() => void download()}
                >
                  Download
                </button>
              </div>
            </section>
          </div>
        )}

        {(state.status === 'idle' || state.status === 'cancelled') && (
          <div className="sd-home">
            <p className="sd-section-label">Capture</p>
            {captureOptions(false)}
            {state.status === 'cancelled' && <p className="sd-note">Last capture was cancelled.</p>}
          </div>
        )}
      </main>

      <Footer />

      {/* Announced, not just shown: copy and download report their outcome here
          and nowhere else, so a screen reader has to hear it. */}
      <div className="sd-toast-region" role="status" aria-live="polite">
        {toast && <div className="sd-toast">✓ {toast}</div>}
      </div>
    </div>
  );
}

function FullPageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 7h7M8.5 11h7M8.5 15h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function VisibleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 9.5h10M7 13.5h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
