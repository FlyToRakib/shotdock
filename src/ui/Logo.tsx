import { BRAND_INK, BRAND_LIME } from '../shared/constants';

/**
 * The ShotDock mark, matching public/icons — one glyph across the toolbar, the
 * popup header and the preview tab.
 *
 * Drawn in the literal brand pair rather than in theme tokens, exactly as the
 * PNG on the toolbar is. Against the graphite ground of every ShotDock surface
 * the backing square melts into the page and the lime camera stands alone,
 * which is the mark as intended.
 */
export function Logo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="5.4" fill={BRAND_INK} />
      {/* Viewfinder hump, then the body. */}
      <path d="M9.9 6.4h4.2l1 2.5H8.9l1-2.5Z" fill={BRAND_LIME} />
      <rect x="3.6" y="8.5" width="16.8" height="10.4" rx="2.2" fill={BRAND_LIME} />
      <circle cx="12" cy="13.7" r="3.4" stroke={BRAND_INK} strokeWidth="1.5" />
      {/* Highlight inside the lens, the way a real one catches light. */}
      <path
        d="M10.5 12.5a2.1 2.1 0 0 0-.55 1.4"
        stroke={BRAND_INK}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <circle cx="6.5" cy="11.3" r="0.85" fill={BRAND_INK} />
    </svg>
  );
}
