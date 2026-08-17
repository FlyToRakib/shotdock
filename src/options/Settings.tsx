import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, getSettings, resetSettings, updateSettings } from '../shared/settings';
import type { CaptureDelay, DefaultAction, ImageFormat, Settings } from '../shared/types';
import { Footer } from '../ui/Footer';
import { Header } from '../ui/Header';

type Panel = 'settings' | 'privacy';

const PANELS: { key: Panel; label: string }[] = [
  { key: 'settings', label: 'Settings' },
  { key: 'privacy', label: 'Privacy' },
];

function panelFromHash(): Panel {
  return window.location.hash === '#privacy' ? 'privacy' : 'settings';
}

/** Settings stay short on purpose: every row here is a decision the user must make. */
export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [panel, setPanel] = useState<Panel>(panelFromHash);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  // The hash keeps each panel linkable, and the browser's back button honest.
  useEffect(() => {
    const sync = () => setPanel(panelFromHash());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    void updateSettings({ [key]: value } as Partial<Settings>).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
    });
  };

  return (
    <div className="sd-shell">
      <Header page>
        <nav className="sd-header__nav">
          {PANELS.map(({ key, label }) => (
            <a
              key={key}
              href={`#${key}`}
              className={`sd-nav-link${panel === key ? ' is-active' : ''}`}
              onClick={() => setPanel(key)}
            >
              {label}
            </a>
          ))}
        </nav>
      </Header>

      <div className="sd-page-wrapper">
        <main className="sd-settings">
          <h1 className="sd-sr-only">ShotDock settings</h1>

          <div className={`sd-panel${panel === 'settings' ? ' is-active' : ''}`}>
            <div className="sd-body-text">
              ShotDock captures, stitches and encodes every screenshot inside your browser. Use the
              global shortcuts Alt+Shift+S for a full page and Alt+Shift+V for the visible area.
            </div>

            <section className="sd-card">
              <h2>Capture</h2>

              <Row label="Default action" hint="What happens when you open ShotDock">
                <select
                  value={settings.defaultAction}
                  onChange={(event) => update('defaultAction', event.target.value as DefaultAction)}
                >
                  <option value="ask">Ask every time</option>
                  <option value="full-page">Full Page</option>
                  <option value="visible">Visible Area</option>
                </select>
              </Row>

              <Row label="Default format">
                <select
                  value={settings.format}
                  onChange={(event) => update('format', event.target.value as ImageFormat)}
                >
                  <option value="png">PNG — lossless</option>
                  <option value="jpeg">JPG — smaller files</option>
                </select>
              </Row>

              {settings.format === 'jpeg' && (
                <Row label="JPEG quality">
                  <div className="sd-range">
                    <input
                      type="range"
                      min={40}
                      max={100}
                      step={5}
                      value={settings.jpegQuality}
                      onChange={(event) => update('jpegQuality', Number(event.target.value))}
                    />
                    <span>{settings.jpegQuality}%</span>
                  </div>
                </Row>
              )}

              <Row
                label="Capture delay"
                hint="How long to wait for a page to settle before each frame"
              >
                <select
                  value={settings.captureDelay}
                  onChange={(event) => update('captureDelay', event.target.value as CaptureDelay)}
                >
                  <option value="auto">Auto — detect when the page is ready</option>
                  <option value="fast">Fast — for simple pages</option>
                  <option value="thorough">Thorough — for heavy, lazy-loading pages</option>
                </select>
              </Row>

              <Toggle
                label="Handle sticky elements"
                hint="Keeps fixed headers in the first section and hides them afterwards"
                checked={settings.handleFixedElements}
                onChange={(value) => update('handleFixedElements', value)}
              />
              <Toggle
                label="Seam detection"
                hint="Aligns sections by comparing pixels when a page shifts mid-capture"
                checked={settings.seamDetection}
                onChange={(value) => update('seamDetection', value)}
              />
              <Toggle
                label="Restore scroll position"
                hint="Returns the page to where you left it"
                checked={settings.restoreScrollPosition}
                onChange={(value) => update('restoreScrollPosition', value)}
              />
            </section>

            <section className="sd-card">
              <h2>After capture</h2>
              <Toggle
                label="Show preview"
                hint="Shows a thumbnail of the last capture in the ShotDock popup"
                checked={settings.showPreview}
                onChange={(value) => update('showPreview', value)}
              />
              <Toggle
                label="Open in a new tab"
                hint="Automatically open the screenshot in a new tab after capture, at full size"
                checked={settings.openInNewTab}
                onChange={(value) => update('openInNewTab', value)}
              />
              <Toggle
                label="Download automatically"
                checked={settings.autoDownload}
                onChange={(value) => update('autoDownload', value)}
              />
              <Toggle
                label="Copy automatically"
                hint="Needs the ShotDock window open to reach the clipboard"
                checked={settings.autoCopy}
                onChange={(value) => update('autoCopy', value)}
              />
            </section>

            <section className="sd-card">
              <h2>Shortcuts</h2>
              <p>
                Full Page and Visible Area have keyboard shortcuts. Change them on Chrome's
                shortcuts page.
              </p>
              <button
                type="button"
                className="sd-btn"
                onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
              >
                Open keyboard shortcuts
              </button>
            </section>

            <div className="sd-save-row">
              <button
                type="button"
                className="sd-btn"
                onClick={() => void resetSettings().then(() => setSettings(DEFAULT_SETTINGS))}
              >
                Reset to defaults
              </button>
              <span className={`sd-status${saved ? '' : ' is-hidden'}`}>Settings saved!</span>
            </div>
          </div>

          <div className={`sd-panel${panel === 'privacy' ? ' is-active' : ''}`}>
            <div className="sd-body-text">
              ShotDock is built so there is nothing to trust it with. Everything below is a
              statement about what the extension does not do.
            </div>

            <section className="sd-card">
              <h2>Nothing leaves your browser</h2>
              <p>
                ShotDock captures, stitches and encodes every screenshot inside your browser. There
                is no screenshot server, no upload, no account and no analytics on page contents. It
                asks for access to a tab only at the moment you capture it.
              </p>
            </section>

            <section className="sd-card">
              <h2>What is stored</h2>
              <p>
                Your preferences sync through your browser profile. The last capture is held in
                memory so the popup and the preview tab can show it, and it is replaced the next
                time you capture something.
              </p>
            </section>
          </div>
        </main>
      </div>

      <Footer page />
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sd-row">
      <div className="sd-row__label">
        <span>{label}</span>
        {hint && <span className="sd-hint">{hint}</span>}
      </div>
      <div className="sd-row__control">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="sd-row sd-row--toggle">
      <div className="sd-row__label">
        <span>{label}</span>
        {hint && <span className="sd-hint">{hint}</span>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
