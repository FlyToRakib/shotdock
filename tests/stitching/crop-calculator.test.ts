import { describe, expect, it } from 'vitest';
import { planCapture } from '../../src/capture/capture-planner';
import {
  computeDrawOps,
  shiftSource,
  type CropOptions,
  type FrameGeometry,
} from '../../src/stitching/crop-calculator';
import type { PageMetrics } from '../../src/shared/types';

/** Builds the frames a real capture would produce for the given page. */
function framesFor(metrics: PageMetrics, scale = 1) {
  const plan = planCapture(metrics);
  const frames: FrameGeometry[] = plan.positions.map((position) => ({
    index: position.index,
    row: position.row,
    col: position.col,
    x: position.x,
    y: position.y,
  }));
  const options: CropOptions = {
    viewportWidth: plan.viewportWidth,
    viewportHeight: plan.viewportHeight,
    outputWidth: Math.round(plan.captureWidth * scale),
    outputHeight: Math.round(plan.captureHeight * scale),
    scale,
  };
  return { frames, options, plan };
}

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

describe('computeDrawOps', () => {
  it('tiles the output with no gaps and no double-drawn rows', () => {
    const { frames, options } = framesFor(metrics());
    const ops = computeDrawOps(frames, options);

    let expectedTop = 0;
    for (const op of ops) {
      expect(op.dy).toBe(expectedTop);
      expectedTop = op.dy + op.sh;
    }
    expect(expectedTop).toBe(options.outputHeight);
  });

  it('reads each frame from the offset implied by its destination', () => {
    const { frames, options } = framesFor(metrics());
    const ops = computeDrawOps(frames, options);

    for (const op of ops) {
      const frame = frames[op.index];
      expect(op.sy).toBe(op.dy - Math.round(frame.y * options.scale));
      expect(op.sy).toBeGreaterThanOrEqual(0);
    }
  });

  it('holds the invariant at a 2x device pixel ratio', () => {
    const { frames, options } = framesFor(metrics({ pageHeight: 7321 }), 2);
    const ops = computeDrawOps(frames, options);

    let expectedTop = 0;
    for (const op of ops) {
      expect(op.dy).toBe(expectedTop);
      expectedTop += op.sh;
    }
    expect(expectedTop).toBe(options.outputHeight);
  });

  it('handles a fractional scale without drifting', () => {
    const { frames, options } = framesFor(metrics({ pageHeight: 5000 }), 1.25);
    const ops = computeDrawOps(frames, options);

    const bottom = ops.reduce((total, op) => total + op.sh, 0);
    expect(bottom).toBe(options.outputHeight);
  });

  it('crops the final frame to the page instead of overshooting', () => {
    const { frames, options } = framesFor(metrics({ pageHeight: 2000 }));
    const ops = computeDrawOps(frames, options);
    const last = ops[ops.length - 1];

    expect(last.dy + last.sh).toBe(2000);
    expect(last.sh).toBeLessThan(900);
  });

  it('tiles a wide page across columns as well as rows', () => {
    const { frames, options, plan } = framesFor(
      metrics({ pageWidth: 2400, viewportWidth: 1000, pageHeight: 1800 }),
    );
    const ops = computeDrawOps(frames, options);

    for (let row = 0; row < plan.rows; row++) {
      const rowOps = ops.filter((op) => op.row === row);
      let expectedLeft = 0;
      for (const op of rowOps) {
        expect(op.dx).toBe(expectedLeft);
        expectedLeft = op.dx + op.sw;
      }
      expect(expectedLeft).toBe(options.outputWidth);
      // Every frame in a row shares one destination band.
      expect(new Set(rowOps.map((op) => op.dy)).size).toBe(1);
    }
  });

  it('discards the overlapping part of each frame rather than drawing it twice', () => {
    const frames: FrameGeometry[] = [
      { index: 0, row: 0, col: 0, x: 0, y: 0 },
      { index: 1, row: 1, col: 0, x: 0, y: 200 },
    ];
    const ops = computeDrawOps(frames, {
      viewportWidth: 1000,
      viewportHeight: 900,
      outputWidth: 1000,
      outputHeight: 1100,
      scale: 1,
    });

    // Frame 1 covers page rows 200–1100, but 200–900 is already on the canvas.
    expect(ops[1].sy).toBe(700);
    expect(ops[1].dy).toBe(900);
    expect(ops[1].sh).toBe(200);
  });

  it('trusts the frame when it lands past the region already covered', () => {
    // The page grew mid-capture, so the scroll landed lower than planned and
    // there is no overlap to dedupe — the frame owns its own position.
    const frames: FrameGeometry[] = [
      { index: 0, row: 0, col: 0, x: 0, y: 0 },
      { index: 1, row: 1, col: 0, x: 0, y: 1000 },
    ];
    const ops = computeDrawOps(frames, {
      viewportWidth: 1000,
      viewportHeight: 900,
      outputWidth: 1000,
      outputHeight: 1900,
      scale: 1,
    });

    expect(ops[1].sy).toBe(0);
    expect(ops[1].dy).toBe(1000);
    expect(ops[1].sh).toBe(900);
  });

  it('drops frames that would add nothing', () => {
    const frames: FrameGeometry[] = [
      { index: 0, row: 0, col: 0, x: 0, y: 0 },
      { index: 1, row: 1, col: 0, x: 0, y: 100 }, // fully inside frame 0's coverage
    ];
    const ops = computeDrawOps(frames, {
      viewportWidth: 1000,
      viewportHeight: 900,
      outputWidth: 1000,
      outputHeight: 900,
      scale: 1,
    });

    expect(ops).toHaveLength(1);
  });
});

describe('shiftSource', () => {
  const op = { index: 1, row: 1, col: 0, sx: 0, sy: 64, sw: 100, sh: 800, dx: 0, dy: 836 };

  it('moves the source window without moving the destination', () => {
    const shifted = shiftSource(op, -3, 900);
    expect(shifted.sy).toBe(61);
    expect(shifted.dy).toBe(op.dy);
    expect(shifted.sh).toBe(op.sh);
  });

  it('never reads outside the source bitmap', () => {
    expect(shiftSource(op, -500, 900).sy).toBe(0);
    expect(shiftSource(op, 500, 900).sy).toBe(100);
  });
});
