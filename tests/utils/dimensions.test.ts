import { describe, expect, it } from 'vitest';
import { planOutputParts, widthScaleFactor } from '../../src/utils/dimensions';
import { MAX_CANVAS_DIMENSION, MIN_PART_AREA, PART_AREA_BUDGET } from '../../src/shared/constants';

/** Sums the parts back up — the property that actually matters to the user. */
const coverage = (parts: { y: number; height: number }[]) =>
  parts.reduce((total, part) => total + part.height, 0);

describe('planOutputParts', () => {
  it('keeps an ordinary page in a single image', () => {
    expect(planOutputParts(1920, 8000, { maxArea: PART_AREA_BUDGET.high })).toEqual([
      { y: 0, height: 8000 },
    ]);
  });

  it('covers the page exactly when it does have to split, with no gap or overlap', () => {
    const parts = planOutputParts(2000, 50_000, { maxArea: 20_000_000 });

    expect(parts.length).toBeGreaterThan(1);
    expect(coverage(parts)).toBe(50_000);
    // Each part must start where the previous one ended. A seam either way is a
    // visible band of duplicated or missing page.
    for (let i = 1; i < parts.length; i += 1) {
      expect(parts[i].y).toBe(parts[i - 1].y + parts[i - 1].height);
    }
    expect(parts[0].y).toBe(0);
  });

  it('splits a taller page on a better machine than on a weaker one', () => {
    const width = 3840; // 1920 CSS px at devicePixelRatio 2.
    const onLow = planOutputParts(width, 40_000, { maxArea: PART_AREA_BUDGET.low });
    const onHigh = planOutputParts(width, 40_000, { maxArea: PART_AREA_BUDGET.high });

    expect(onHigh.length).toBeLessThan(onLow.length);
    expect(coverage(onLow)).toBe(coverage(onHigh));
  });

  it('holds every part inside both the area and the per-side limit', () => {
    for (const maxArea of Object.values(PART_AREA_BUDGET)) {
      const width = 3840;
      for (const part of planOutputParts(width, 200_000, { maxArea })) {
        expect(part.height).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION);
        expect(width * part.height).toBeLessThanOrEqual(maxArea);
      }
    }
  });

  it('is bounded by the per-side maximum even when the area budget would allow more', () => {
    // A narrow page divides the area budget into a height no canvas can hold.
    const parts = planOutputParts(100, 400_000, { maxArea: PART_AREA_BUDGET.high });

    expect(parts[0].height).toBe(MAX_CANVAS_DIMENSION);
    expect(coverage(parts)).toBe(400_000);
  });

  it('still terminates at the retry ladder floor on an absurdly wide page', () => {
    // The worst case the ladder can reach: smallest budget, widest allowed page.
    const parts = planOutputParts(MAX_CANVAS_DIMENSION, 30_000, { maxArea: MIN_PART_AREA });

    expect(parts.every((part) => part.height >= 1)).toBe(true);
    expect(coverage(parts)).toBe(30_000);
  });

  it('defaults to the budget this machine was measured for', () => {
    const budgets: number[] = Object.values(PART_AREA_BUDGET);
    const [first] = planOutputParts(4000, 1_000_000);

    // Whichever tier the test runner detects as, the plan has to respect it.
    expect(budgets.some((budget) => first.height === Math.floor(budget / 4000))).toBe(true);
  });
});

describe('widthScaleFactor', () => {
  it('leaves every realistic page completely untouched', () => {
    for (const width of [1280, 1920, 3840, 7680]) expect(widthScaleFactor(width)).toBe(1);
  });

  it('scales an impossibly wide page down to exactly the per-side limit', () => {
    const width = MAX_CANVAS_DIMENSION * 3;

    expect(Math.round(width * widthScaleFactor(width))).toBe(MAX_CANVAS_DIMENSION);
  });
});
