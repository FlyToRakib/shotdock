import type { ReactNode } from 'react';
import { APP_LINKS } from './links';
import { Logo } from './Logo';

interface Props {
  /** Renders the taller sticky bar used by the full-page surfaces. */
  page?: boolean;
  /** Navigation, shown between the brand and the Degird credit. */
  children?: ReactNode;
  /** Adds the cog. Only the popup has somewhere to send the user. */
  onOpenSettings?: () => void;
}

/**
 * The global header, shared by the popup, the settings page and the preview tab:
 * brand, optional navigation, the Degird credit, then the cog.
 */
export function Header({ page = false, children, onOpenSettings }: Props) {
  return (
    <header className={`sd-header${page ? ' sd-header--page' : ''}`}>
      <span className="sd-logo">
        <Logo size={page ? 20 : 16} />
        ShotDock
      </span>

      {children}

      <span className="sd-powered-by">
        POWERED BY{' '}
        <a
          className="sd-degird-link"
          href={APP_LINKS.degirdHome}
          target="_blank"
          rel="noreferrer"
        >
          DEGIRD
        </a>
      </span>

      {onOpenSettings && (
        <button
          type="button"
          className="sd-icon-btn"
          title="Settings"
          aria-label="Settings"
          onClick={onOpenSettings}
        >
          <GearIcon />
        </button>
      )}
    </header>
  );
}

/** The family's cog: a stroked ring of lobes around a hub, drawn at 24× scale. */
function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
