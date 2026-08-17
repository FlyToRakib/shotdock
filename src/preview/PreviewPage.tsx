import { useCallback, useEffect, useState } from 'react';
import { copyImageToClipboard } from '../output/clipboard';
import { downloadImage, filenameFor } from '../output/download';
import type { CaptureResult } from '../shared/types';
import { api } from '../ui/api';
import { loadCaptureImage } from '../ui/capture-image';
import { Header } from '../ui/Header';
import { formatBytes, formatDimensions } from '../utils/dimensions';
import { createLogger } from '../utils/logger';
import { formatTimeAgo } from '../utils/time';

const log = createLogger('preview-page');

type Status = 'loading' | 'ready' | 'empty' | 'failed';
type Zoom = 'fit' | 'actual';

interface LoadedPart {
  index: number;
  url: string;
}

/**
 * The full-size view of a finished capture.
 *
 * It copies the renderer's bytes into blobs of its own on load, so the page keeps
 * showing the screenshot the user opened it for even after the next capture has
 * replaced it in the background — a stale tab is far worse than a duplicated blob.
 */
export function PreviewPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [parts, setParts] = useState<LoadedPart[]>([]);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const created: string[] = [];
    // Synchronous, so a URL can never be created into an already-torn-down effect.
    const track = (url: string) => {
      if (disposed) URL.revokeObjectURL(url);
      else created.push(url);
      return url;
    };

    void (async () => {
      try {
        const session = await api.getState();
        if (disposed) return;
        if (session.status !== 'ready' || !session.result) {
          setStatus('empty');
          return;
        }

        setResult(session.result);
        document.title = `${session.result.hostname} — ShotDock`;

        const loaded: LoadedPart[] = [];
        for (const part of session.result.parts) {
          const blob = await loadCaptureImage(part.index);
          if (disposed) return;
          loaded.push({ index: part.index, url: track(URL.createObjectURL(blob)) });
        }
        setParts(loaded);
        setStatus('ready');
      } catch (error) {
        log.error('could not load the capture', error);
        if (!disposed) setStatus('failed');
      }
    })();

    return () => {
      disposed = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const download = useCallback(async () => {
    if (!result) return;
    setBusy(true);
    try {
      for (const part of parts) {
        await downloadImage(part.url, filenameFor(result, part.index));
      }
      setToast(parts.length > 1 ? `Saved ${parts.length} sections` : 'Saved to your ShotDock folder');
    } catch (error) {
      log.warn('download failed', error);
      setToast("Couldn't save the screenshot");
    } finally {
      setBusy(false);
    }
  }, [parts, result]);

  const copy = useCallback(async () => {
    if (!result || !parts[0]) return;
    setBusy(true);
    try {
      await copyImageToClipboard(parts[0].url, result.format);
      setToast(parts.length > 1 ? 'First section copied' : 'Screenshot copied');
    } catch (error) {
      log.warn('copy failed', error);
      setToast("Couldn't copy — try downloading instead");
    } finally {
      setBusy(false);
    }
  }, [parts, result]);

  const totalBytes = result?.parts.reduce((sum, part) => sum + part.byteSize, 0) ?? 0;

  return (
    <div className="sd-shell">
      {/* The screenshot's identity and controls ride *inside* the global header
          rather than in a bar of their own — two stacked bars read as two
          headers. Nothing here changes the shared Header; it is all passed
          through the slot it already exposes. */}
      <Header page>
        <div className="sd-page__toolbar">
          <div className="sd-page__meta">
            <span className="sd-page__host">{result?.hostname ?? 'No capture yet'}</span>
            {result && (
              <span className="sd-page__dims">
                {result.type === 'full-page' ? 'Full page' : 'Visible area'} ·{' '}
                {formatDimensions(result.width, result.height)} · {formatBytes(totalBytes)} ·{' '}
                {formatTimeAgo(result.createdAt)}
              </span>
            )}
          </div>

          <div className="sd-page__actions">
            {status === 'ready' && (
              <div className="sd-segmented" role="group" aria-label="Zoom">
                <button
                  type="button"
                  className={`sd-segmented__option${zoom === 'fit' ? ' is-active' : ''}`}
                  aria-pressed={zoom === 'fit'}
                  onClick={() => setZoom('fit')}
                >
                  Fit
                </button>
                <button
                  type="button"
                  className={`sd-segmented__option${zoom === 'actual' ? ' is-active' : ''}`}
                  aria-pressed={zoom === 'actual'}
                  onClick={() => setZoom('actual')}
                >
                  100%
                </button>
              </div>
            )}
            <button
              type="button"
              className="sd-btn"
              disabled={busy || status !== 'ready'}
              onClick={() => void copy()}
            >
              Copy
            </button>
            <button
              type="button"
              className="sd-btn sd-btn--primary"
              disabled={busy || status !== 'ready'}
              onClick={() => void download()}
            >
              Download
            </button>
          </div>
        </div>
      </Header>

      <main className={`sd-page__canvas sd-page__canvas--${zoom}`}>
        {status === 'loading' && <p className="sd-page__note">Loading your screenshot…</p>}

        {status === 'empty' && (
          <p className="sd-page__note">
            There's no capture to show. Open ShotDock from the toolbar to take one.
          </p>
        )}

        {status === 'failed' && (
          <p className="sd-page__note">
            ShotDock couldn't read the image — it may have been replaced by a newer capture. Take
            another screenshot to see it here.
          </p>
        )}

        {status === 'ready' &&
          parts.map((part) => (
            <img
              key={part.index}
              className="sd-page__image"
              src={part.url}
              // A full-page screenshot is a very large image to turn into pixels.
              // Decoding off the main thread keeps the toolbar responsive while it
              // happens, and sections below the fold wait until they are scrolled
              // to — which on a modest machine is most of them, most of the time.
              decoding="async"
              loading={part.index === 0 ? 'eager' : 'lazy'}
              alt={
                parts.length > 1
                  ? `Screenshot of ${result?.hostname}, section ${part.index + 1} of ${parts.length}`
                  : `Screenshot of ${result?.hostname}`
              }
            />
          ))}

        {status === 'ready' && parts.length > 1 && (
          <p className="sd-page__note">
            This page was too large for a single image, so it was split into {parts.length}{' '}
            sections. Downloading saves all of them.
          </p>
        )}

        {status === 'ready' && result?.truncated && (
          <p className="sd-page__note sd-page__note--warn">
            The page kept growing while ShotDock captured it, so the image stops partway down.
          </p>
        )}
      </main>

      {/* No footer here: the screenshot is the content, so the page ends with it. */}

      <div className="sd-toast-region" role="status" aria-live="polite">
        {toast && <div className="sd-toast sd-toast--page">✓ {toast}</div>}
      </div>
    </div>
  );
}

