import type { CaptureResult } from '../shared/types';
import { formatBytes, formatDimensions } from '../utils/dimensions';

interface Props {
  result: CaptureResult;
  /** Rendered alongside the size, so "when" is read in the same glance as "what". */
  age?: string;
}

export function Preview({ result, age }: Props) {
  const totalBytes = result.parts.reduce((sum, part) => sum + part.byteSize, 0);
  const multiPart = result.parts.length > 1;

  return (
    <div className="sd-preview">
      <div className="sd-preview__meta">
        <span className="sd-preview__host">{result.hostname}</span>
        <span className="sd-preview__dims">
          {result.type === 'full-page' ? 'Full page' : 'Visible area'} ·{' '}
          {formatDimensions(result.width, result.height)} · {formatBytes(totalBytes)}
          {age && ` · ${age}`}
        </span>
      </div>

      {result.previewDataUrl ? (
        <div className="sd-preview__frame">
          <img src={result.previewDataUrl} alt={`Screenshot of ${result.hostname}`} />
        </div>
      ) : (
        <div className="sd-preview__frame sd-preview__frame--empty">Preview turned off</div>
      )}

      {/* Terser than the preview tab's wording on purpose: the popup has a 600px
          ceiling, and the full explanation is one click away. */}
      {multiPart && (
        <p className="sd-note">
          Split into {result.parts.length} sections — downloading saves all of them.
        </p>
      )}
      {result.truncated && (
        <p className="sd-note sd-note--warn">
          The page kept growing, so the image stops partway down.
        </p>
      )}
    </div>
  );
}
