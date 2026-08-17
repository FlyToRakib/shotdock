import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  shortcut?: string;
  icon: ReactNode;
  variant?: 'primary' | 'secondary';
  /** Drops the description and shortcut — for the result screen, where the choice is already known. */
  compact?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function CaptureButton({
  title,
  description,
  shortcut,
  icon,
  variant = 'secondary',
  compact = false,
  onClick,
  disabled,
}: Props) {
  return (
    <button
      type="button"
      className={`sd-capture sd-capture--${variant}${compact ? ' sd-capture--compact' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="sd-capture__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sd-capture__text">
        <span className="sd-capture__title">{title}</span>
        {description && !compact && <span className="sd-capture__description">{description}</span>}
      </span>
      {shortcut && !compact && <kbd className="sd-capture__shortcut">{shortcut}</kbd>}
    </button>
  );
}
