/**
 * Fixed and sticky elements are the reason naive full-page screenshots look
 * broken: a sticky header re-renders into every frame and marches down the
 * finished image.
 *
 * ShotDock keeps them for the first frame — where they genuinely belong — and
 * hides them for the rest. Every mutation is recorded so the page can be put
 * back exactly as it was, even if the capture fails midway.
 */

interface HiddenElement {
  element: HTMLElement;
  /** The inline value we overwrote, so restore is exact rather than approximate. */
  previousValue: string;
  previousPriority: string;
}

/** Elements smaller than this in both axes are not worth touching (badges, dots). */
const MIN_SIGNIFICANT_SIZE = 24;

export class FixedElementManager {
  private hidden: HiddenElement[] = [];

  hideAll(): number {
    if (this.hidden.length > 0) return this.hidden.length;

    for (const element of collectCandidates()) {
      this.hidden.push({
        element,
        previousValue: element.style.getPropertyValue('visibility'),
        previousPriority: element.style.getPropertyPriority('visibility'),
      });
      // `visibility` rather than `display`, so the page's layout is untouched and
      // nothing reflows while we are mid-capture.
      element.style.setProperty('visibility', 'hidden', 'important');
    }
    return this.hidden.length;
  }

  restoreAll(): void {
    for (const record of this.hidden) {
      const { element, previousValue, previousPriority } = record;
      if (previousValue) {
        element.style.setProperty('visibility', previousValue, previousPriority);
      } else {
        element.style.removeProperty('visibility');
      }
      // Drop the style attribute entirely if we were the only thing in it.
      if (element.getAttribute('style') === '') element.removeAttribute('style');
    }
    this.hidden = [];
  }

  get isHiding(): boolean {
    return this.hidden.length > 0;
  }
}

function collectCandidates(): HTMLElement[] {
  const candidates: HTMLElement[] = [];
  const viewportHeight = window.innerHeight;

  // Walked once per capture, and `getComputedStyle` is the only way to know an
  // element's position — so the list is iterated in place rather than copied into
  // an array first, which on a very large document is a real allocation.
  const elements = document.body?.querySelectorAll<HTMLElement>('*');
  for (const element of elements ?? []) {
    const style = window.getComputedStyle(element);
    const position = style.position;
    if (position !== 'fixed' && position !== 'sticky') continue;
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;

    const rect = element.getBoundingClientRect();
    if (rect.width < MIN_SIGNIFICANT_SIZE && rect.height < MIN_SIGNIFICANT_SIZE) continue;

    // A sticky element that spans most of the page isn't a floating overlay,
    // it's a layout column (a sticky sidebar wrapper). Hiding it would blank
    // real content, so leave it alone — only its short, pinned children stick.
    if (position === 'sticky' && rect.height > viewportHeight * 0.9) continue;

    candidates.push(element);
  }

  // Hide outermost-first: a nested fixed child inherits its parent's visibility,
  // so skipping descendants keeps the restore list small.
  return candidates.filter(
    (element) => !candidates.some((other) => other !== element && other.contains(element)),
  );
}
