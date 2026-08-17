import { STABILIZE_BUDGET_MS } from '../shared/constants';
import type { CaptureDelay } from '../shared/types';

/**
 * Scrolling and settling. Two jobs:
 *  1. move the page and report where it *actually* landed (browsers clamp, and
 *     scroll-snap or smooth-scroll CSS can land somewhere else entirely);
 *  2. wait until the page stops moving — but no longer than it has to.
 */

const raf = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function scrollToPosition(x: number, y: number): { x: number; y: number } {
  window.scrollTo({ left: x, top: y, behavior: 'instant' as ScrollBehavior });
  return { x: Math.round(window.scrollX), y: Math.round(window.scrollY) };
}

interface StabilitySample {
  height: number;
  width: number;
  scrollY: number;
  pendingImages: number;
}

function sample(): StabilitySample {
  return {
    height: document.documentElement.scrollHeight,
    width: document.documentElement.scrollWidth,
    scrollY: Math.round(window.scrollY),
    pendingImages: countPendingImages(),
  };
}

/**
 * Only images intersecting the viewport matter — the rest can load later.
 *
 * Sampled every 40ms while a frame settles, so it walks the live collection by
 * index instead of copying it, and reads geometry only for images that are still
 * loading — on an image-heavy page that is the difference between a handful of
 * layout reads per sample and one for every image on the page.
 */
function countPendingImages(): number {
  let pending = 0;
  const viewportHeight = window.innerHeight;
  const images = document.images;
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    if (image.complete) continue;
    const rect = image.getBoundingClientRect();
    if (rect.bottom < -viewportHeight || rect.top > viewportHeight * 2) continue;
    pending++;
  }
  return pending;
}

const equal = (a: StabilitySample, b: StabilitySample): boolean =>
  a.height === b.height &&
  a.width === b.width &&
  a.scrollY === b.scrollY &&
  a.pendingImages === b.pendingImages;

/**
 * Waits for two consecutive identical samples, bounded by the delay budget.
 * Simple pages fall through in a couple of frames; lazy-loading pages get the
 * time they need without a blanket worst-case delay on every frame.
 */
export async function waitForStability(delay: CaptureDelay): Promise<number> {
  // The injected script can outlive the extension update that changed this set,
  // so an unrecognised delay settles on the default rather than throwing.
  const budget = STABILIZE_BUDGET_MS[delay] ?? STABILIZE_BUDGET_MS.auto;
  const started = performance.now();

  await raf();
  await raf();

  let previous = sample();
  for (;;) {
    const elapsed = performance.now() - started;
    if (elapsed >= budget.max) break;

    await sleep(40);
    const current = sample();
    if (equal(previous, current) && current.pendingImages === 0 && elapsed >= budget.min) break;
    previous = current;
  }

  return Math.round(performance.now() - started);
}
