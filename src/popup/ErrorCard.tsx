import type { CaptureErrorInfo } from '../shared/types';

interface Props {
  error: CaptureErrorInfo;
  onRetry: () => void;
  onDismiss: () => void;
}

/** Users see a cause and a way forward — never a stack trace, never "undefined". */
export function ErrorCard({ error, onRetry, onDismiss }: Props) {
  return (
    <div className="sd-error">
      <div className="sd-error__title">{error.title}</div>
      <p className="sd-error__message">{error.message}</p>
      <div className="sd-error__actions">
        {error.action === 'retry' && (
          <button type="button" className="sd-btn sd-btn--primary" onClick={onRetry}>
            Try again
          </button>
        )}
        <button type="button" className="sd-btn" onClick={onDismiss}>
          Back
        </button>
      </div>
    </div>
  );
}
