import { describe, expect, it } from 'vitest';
import { findBestVerticalOffset, toGrayscale } from '../../src/stitching/overlap-detector';

const WIDTH = 32;
const ROWS = 8;
const MAX_SHIFT = 12;

/** Deterministic pseudo-texture, so a match at the right offset is unambiguous. */
const pixel = (x: number, y: number): number => (x * 37 + y * 91) % 251;

function reference(): number[] {
  const data: number[] = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < WIDTH; x++) data.push(pixel(x, y));
  return data;
}

/** The same texture, offset by `shift` rows within the search window. */
function candidate(shift: number): number[] {
  const height = ROWS + MAX_SHIFT * 2;
  const data: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < WIDTH; x++) {
      data.push(pixel(x, y - MAX_SHIFT - shift));
    }
  }
  return data;
}

describe('findBestVerticalOffset', () => {
  it('recovers a page that shifted down by 4 pixels', () => {
    const match = findBestVerticalOffset(reference(), candidate(4), WIDTH, ROWS, MAX_SHIFT);

    expect(match.shift).toBe(4);
    expect(match.score).toBe(0);
    expect(match.confident).toBe(true);
  });

  it('recovers a page that shifted up', () => {
    const match = findBestVerticalOffset(reference(), candidate(-6), WIDTH, ROWS, MAX_SHIFT);

    expect(match.shift).toBe(-6);
    expect(match.confident).toBe(true);
  });

  it('reports no correction when the planned alignment is already right', () => {
    const match = findBestVerticalOffset(reference(), candidate(0), WIDTH, ROWS, MAX_SHIFT);

    expect(match.shift).toBe(0);
    expect(match.confident).toBe(false);
  });

  it('refuses to correct on noise it cannot explain', () => {
    const noise: number[] = [];
    for (let i = 0; i < WIDTH * (ROWS + MAX_SHIFT * 2); i++) noise.push((i * 7919) % 256);

    const match = findBestVerticalOffset(reference(), noise, WIDTH, ROWS, MAX_SHIFT);
    // Any "best" match here is coincidence, and must not be applied.
    expect(match.confident).toBe(false);
  });

  it('distrusts a match sitting on the edge of the search window', () => {
    const match = findBestVerticalOffset(
      reference(),
      candidate(MAX_SHIFT),
      WIDTH,
      ROWS,
      MAX_SHIFT,
    );

    expect(match.shift).toBe(MAX_SHIFT);
    // The true offset may well be further out, so the correction is withheld.
    expect(match.confident).toBe(false);
  });
});

describe('toGrayscale', () => {
  it('collapses RGBA to one luminance sample per column step', () => {
    const rgba = new Uint8ClampedArray([
      255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255,
    ]);
    const gray = toGrayscale(rgba, 4, 1, 2);

    expect(gray.width).toBe(2);
    expect(gray.height).toBe(1);
    expect(gray.data[0]).toBeGreaterThan(240); // white
    expect(gray.data[1]).toBeLessThan(120); // red
  });
});
