import { describe, expect, it } from 'vitest';
import { planCapture } from '../../src/capture/capture-planner';
import { FRAME_OVERLAP_PX } from '../../src/shared/constants';
import type { PageMetrics } from '../../src/shared/types';

const metrics = (overrides: Partial<PageMetrics> = {}): PageMetrics => ({
  pageWidth: 1440,
  pageHeight: 12000,
  viewportWidth: 1440,
  viewportHeight: 900,
  devicePixelRatio: 1,
  scrollX: 0,
  scrollY: 0,
  ...overrides,
});

describe('planCapture', () => {
  it('captures a page shorter than the viewport in a single frame', () => {
    const plan = planCapture(metrics({ pageHeight: 500 }));

    expect(plan.positions).toEqual([{ index: 0, x: 0, y: 0, row: 0, col: 0 }]);
    expect(plan.rows).toBe(1);
    expect(plan.columns).toBe(1);
    // Output is cropped to the content, not padded out to the viewport.
    expect(plan.captureHeight).toBe(500);
  });

  it('steps by viewport minus overlap so the stitcher always has slack', () => {
    const plan = planCapture(metrics({ pageHeight: 12000 }));
    const step = 900 - FRAME_OVERLAP_PX;

    expect(plan.positions[0].y).toBe(0);
    expect(plan.positions[1].y).toBe(step);
    expect(plan.positions[2].y).toBe(step * 2);
  });

  it('clamps the last stop to the maximum scroll offset', () => {
    const plan = planCapture(metrics({ pageHeight: 2000 }));
    const last = plan.positions[plan.positions.length - 1];

    expect(last.y).toBe(2000 - 900);
    // …and never plans a stop the browser would clamp anyway.
    for (const position of plan.positions) expect(position.y).toBeLessThanOrEqual(1100);
  });

  it('covers every pixel of the page across consecutive frames', () => {
    const plan = planCapture(metrics({ pageHeight: 7321 }));

    let covered = 0;
    for (const position of plan.positions) {
      expect(position.y).toBeLessThanOrEqual(covered);
      covered = position.y + plan.viewportHeight;
    }
    expect(covered).toBeGreaterThanOrEqual(plan.captureHeight);
  });

  it('does not add a redundant final frame when the page divides evenly', () => {
    // maxScroll lands exactly on a step boundary.
    const step = 900 - FRAME_OVERLAP_PX;
    const plan = planCapture(metrics({ pageHeight: step * 3 + 900 }));
    const ys = plan.positions.map((position) => position.y);

    expect(new Set(ys).size).toBe(ys.length);
    expect(ys[ys.length - 1]).toBe(step * 3);
  });

  it('trims the scrollbar strip when the page is not genuinely wider', () => {
    // documentElement.clientWidth excludes the scrollbar; innerWidth includes it.
    const plan = planCapture(metrics({ pageWidth: 1425, viewportWidth: 1440 }));

    expect(plan.columns).toBe(1);
    expect(plan.captureWidth).toBe(1425);
  });

  it('plans a grid for pages genuinely wider than the viewport', () => {
    const plan = planCapture(metrics({ pageWidth: 2400, viewportWidth: 1000, pageHeight: 1800 }));

    expect(plan.columns).toBeGreaterThan(1);
    expect(plan.captureWidth).toBe(2400);
    expect(plan.positions.length).toBe(plan.rows * plan.columns);

    // Row-major order keeps the stitcher's incremental cropping valid.
    const indices = plan.positions.map((position) => position.row * plan.columns + position.col);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it('stops short of a bottomless page rather than capturing forever', () => {
    const plan = planCapture(metrics({ pageHeight: 5_000_000 }), { maxFrames: 50 });

    expect(plan.truncated).toBe(true);
    expect(plan.positions.length).toBeLessThanOrEqual(50);
    // The reported output height matches what was actually planned.
    expect(plan.captureHeight).toBe(plan.positions[plan.positions.length - 1].y + 900);
  });

  it('plans a bottomless page in bounded time, not just to a bounded result', () => {
    // The stops used to all be generated and only then thrown away, so a page
    // reporting an absurd height built millions of them first.
    const started = Date.now();
    const plan = planCapture(metrics({ pageHeight: 2_000_000_000 }), { maxFrames: 400 });

    expect(plan.truncated).toBe(true);
    expect(plan.positions.length).toBe(400);
    expect(Date.now() - started).toBeLessThan(250);
  });

  it('refuses to propagate nonsense geometry from the page', () => {
    const plan = planCapture(
      metrics({ pageHeight: Number.NaN, pageWidth: Number.POSITIVE_INFINITY }),
    );

    expect(Number.isFinite(plan.captureWidth)).toBe(true);
    expect(Number.isFinite(plan.captureHeight)).toBe(true);
    expect(plan.captureWidth).toBeGreaterThan(0);
    expect(plan.captureHeight).toBeGreaterThan(0);
    expect(plan.positions.length).toBeGreaterThan(0);
  });

  it('survives a degenerate viewport without looping forever', () => {
    const plan = planCapture(metrics({ viewportHeight: 1, pageHeight: 4000 }), { maxFrames: 100 });

    expect(plan.positions.length).toBeGreaterThan(0);
    expect(plan.positions.length).toBeLessThanOrEqual(100);
  });
});
