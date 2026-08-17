import { describe, expect, it } from 'vitest';
import { RateLimiter, withTimeout } from '../../src/capture/capture-timing';

/**
 * captureVisibleTab is capped at two calls a second and *throws* past that, so
 * the pacing has to hold even when several waits are in flight at once — which
 * is exactly what the capture loop does to overlap pacing with scrolling.
 */
describe('RateLimiter', () => {
  it('lets the first call through immediately', async () => {
    const limiter = new RateLimiter(500);
    const started = Date.now();
    await limiter.acquire();
    expect(Date.now() - started).toBeLessThan(50);
  });

  it('spaces consecutive calls by the interval', async () => {
    const limiter = new RateLimiter(120);
    await limiter.acquire();
    const started = Date.now();
    await limiter.acquire();
    expect(Date.now() - started).toBeGreaterThanOrEqual(100);
  });

  it('hands overlapping callers consecutive slots rather than the same one', async () => {
    const limiter = new RateLimiter(80);
    const started = Date.now();

    // All three reserve up front, the way the capture loop claims its slot before
    // going off to scroll the page.
    const elapsed = await Promise.all(
      [limiter.acquire(), limiter.acquire(), limiter.acquire()].map((slot) =>
        slot.then(() => Date.now() - started),
      ),
    );

    expect(elapsed[0]).toBeLessThan(40);
    expect(elapsed[1]).toBeGreaterThanOrEqual(60);
    expect(elapsed[2]).toBeGreaterThanOrEqual(140);
  });

  it('measures the next slot from the call that happened, not the one reserved', async () => {
    // The case a reservation scheme gets wrong: a slot is claimed, the caller is
    // then held up past it — a paused capture, a slow-settling page — and the
    // call finally goes out late. The following slot must still be a full
    // interval after that call, or two captures land inside the same window.
    const limiter = new RateLimiter(120);
    await limiter.acquire();
    await new Promise((resolve) => setTimeout(resolve, 200)); // held up past the slot
    limiter.mark();

    const started = Date.now();
    await limiter.acquire();
    expect(Date.now() - started).toBeGreaterThanOrEqual(100);
  });

  it('recovers rather than stalling if the clock jumps backwards', async () => {
    const limiter = new RateLimiter(50);
    await limiter.acquire();

    const realNow = Date.now;
    Date.now = () => realNow() - 60 * 60 * 1000; // an hour into the past
    try {
      const started = realNow();
      await limiter.acquire();
      expect(realNow() - started).toBeLessThan(200);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('withTimeout', () => {
  it('passes a value through when it settles in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 500, () => new Error('late'))).resolves.toBe(
      'ok',
    );
  });

  it('rejects with the supplied error once the budget is spent', async () => {
    const stuck = new Promise<never>(() => undefined);
    await expect(withTimeout(stuck, 20, () => new Error('late'))).rejects.toThrow('late');
  });

  it('preserves the original rejection rather than the timeout', async () => {
    const failing = Promise.reject(new Error('the real cause'));
    await expect(withTimeout(failing, 500, () => new Error('late'))).rejects.toThrow(
      'the real cause',
    );
  });
});
