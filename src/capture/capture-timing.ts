import { MIN_CAPTURE_INTERVAL_MS } from '../shared/constants';

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Paces calls to chrome.tabs.captureVisibleTab, which Chrome caps at two per
 * second. Firing faster doesn't just get throttled — it throws, and a thrown
 * capture in the middle of a 40-frame page costs far more than the wait.
 */
export class RateLimiter {
  private nextSlot = 0;
  private lastSeen = 0;

  constructor(private readonly intervalMs: number = MIN_CAPTURE_INTERVAL_MS) {}

  /**
   * Records that a call is being made right now, so the next slot is measured
   * from the call that actually happened rather than from the slot that was
   * reserved for it.
   *
   * This is what keeps the quota honest when a caller runs late — a paused
   * capture, or a page that took longer to settle than the interval. Without it,
   * a reservation made long before its call would leave the following slot
   * already open, and two captures could land inside the same second.
   */
  mark(): void {
    const now = Date.now();
    this.lastSeen = now;
    this.nextSlot = Math.max(this.nextSlot, now + this.intervalMs);
  }

  /**
   * Reserves the next slot *synchronously* and resolves when it opens.
   *
   * Claiming the slot before awaiting is what makes the wait safe to overlap with
   * other work: a caller can start the pacing clock, go and scroll the page, and
   * still be guaranteed its turn — and two concurrent callers get consecutive
   * slots rather than the same one.
   */
  acquire(): Promise<void> {
    const now = Date.now();
    // The wall clock can move backwards under the feet of a long capture; without
    // this, one such jump would park every remaining frame until it caught up.
    // Compared against the last time observed, not against the queue depth — a
    // queue several slots deep is the normal case here, not a symptom.
    if (now < this.lastSeen) this.nextSlot = now;
    this.lastSeen = now;

    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + this.intervalMs;
    return slot > now ? sleep(slot - now) : Promise.resolve();
  }

  reset(): void {
    this.nextSlot = 0;
    this.lastSeen = 0;
  }
}

/** Rejects if `promise` hasn't settled in time, so one wedged step can't hang a session. */
export function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
