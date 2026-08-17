import type { CaptureProgress, CaptureStatus } from '../shared/types';

interface Props {
  status: CaptureStatus;
  progress: CaptureProgress;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

/**
 * Real progress only — completed frames over planned frames. Stitching has no
 * meaningful percentage, so it says so rather than inventing one.
 */
export function Progress({ status, progress, onPause, onResume, onCancel }: Props) {
  const capturing = status === 'capturing' || status === 'paused';
  const percent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const indeterminate = !capturing;

  return (
    <div className="sd-progress">
      <div className="sd-progress__headline">
        {status === 'analyzing' && 'Analyzing page…'}
        {status === 'preparing' && 'Preparing page…'}
        {status === 'capturing' && 'Capturing page…'}
        {status === 'paused' && 'Capture paused'}
        {status === 'stitching' && 'Rendering final image…'}
      </div>

      <div
        className={`sd-bar${indeterminate ? ' sd-bar--indeterminate' : ''}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : percent}
      >
        <div className="sd-bar__fill" style={{ width: indeterminate ? '100%' : `${percent}%` }} />
      </div>

      <div className="sd-progress__meta">
        {capturing ? (
          <>
            <span className="sd-progress__percent">{percent}%</span>
            <span className="sd-progress__detail">{progress.detail}</span>
          </>
        ) : (
          <span className="sd-progress__detail">
            {status === 'stitching' ? 'Capture complete ✓' : progress.detail}
          </span>
        )}
      </div>

      <div className="sd-progress__actions">
        {status === 'capturing' && (
          <button type="button" className="sd-btn" onClick={onPause}>
            Pause
          </button>
        )}
        {status === 'paused' && (
          <button type="button" className="sd-btn sd-btn--primary" onClick={onResume}>
            Resume
          </button>
        )}
        <button type="button" className="sd-btn" onClick={onCancel} disabled={status === 'stitching'}>
          Cancel
        </button>
      </div>
    </div>
  );
}
