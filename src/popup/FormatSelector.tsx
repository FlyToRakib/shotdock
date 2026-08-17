import { FORMATS } from '../output/format';
import type { ImageFormat } from '../shared/types';

interface Props {
  format: ImageFormat;
  quality: number;
  busy: boolean;
  onFormatChange: (format: ImageFormat) => void;
  onQualityChange: (quality: number) => void;
}

/** PNG has no quality control, so none is shown — one less thing to think about. */
export function FormatSelector({ format, quality, busy, onFormatChange, onQualityChange }: Props) {
  return (
    <div className="sd-format">
      <div className="sd-segmented" role="group" aria-label="Image format">
        {(Object.keys(FORMATS) as ImageFormat[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`sd-segmented__option${format === option ? ' is-active' : ''}`}
            aria-pressed={format === option}
            disabled={busy}
            onClick={() => onFormatChange(option)}
          >
            {FORMATS[option].label}
          </button>
        ))}
      </div>

      {FORMATS[format].supportsQuality ? (
        <label className="sd-quality">
          <span className="sd-quality__label">Quality</span>
          <input
            type="range"
            min={40}
            max={100}
            step={5}
            value={quality}
            disabled={busy}
            onChange={(event) => onQualityChange(Number(event.target.value))}
          />
          <span className="sd-quality__value">{quality}%</span>
        </label>
      ) : (
        <span className="sd-format__hint">{FORMATS[format].hint}</span>
      )}
    </div>
  );
}
