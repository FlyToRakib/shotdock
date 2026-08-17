import { describe, expect, it } from 'vitest';
import { detectDeviceTier, partAreaBudget } from '../../src/utils/device-tier';
import { MIN_PART_AREA, PART_AREA_BUDGET } from '../../src/shared/constants';

describe('detectDeviceTier', () => {
  it('reads reported memory, which is the signal that actually matters', () => {
    expect(detectDeviceTier({ deviceMemory: 0.5 })).toBe('low');
    expect(detectDeviceTier({ deviceMemory: 2 })).toBe('low');
    expect(detectDeviceTier({ deviceMemory: 4 })).toBe('medium');
    // Chrome caps the reported value at 8, so this is every machine above 4 GB.
    expect(detectDeviceTier({ deviceMemory: 8 })).toBe('high');
  });

  it('falls back to core count without ever guessing upward', () => {
    expect(detectDeviceTier({ hardwareConcurrency: 2 })).toBe('low');
    // Cores say nothing reliable about RAM, so a big core count must not buy the
    // largest budget — the most an unknown machine can earn is the middle tier.
    expect(detectDeviceTier({ hardwareConcurrency: 32 })).toBe('medium');
  });

  it('settles on the middle tier when the machine reports nothing at all', () => {
    expect(detectDeviceTier({})).toBe('medium');
  });

  it('ignores nonsense values rather than deriving a tier from them', () => {
    expect(detectDeviceTier({ deviceMemory: 0 })).toBe('medium');
    expect(detectDeviceTier({ deviceMemory: Number.NaN })).toBe('medium');
    expect(detectDeviceTier({ deviceMemory: -8, hardwareConcurrency: 1 })).toBe('low');
  });
});

describe('partAreaBudget', () => {
  it('grows with the tier and stays above the retry ladder floor', () => {
    const low = partAreaBudget('low');
    const medium = partAreaBudget('medium');
    const high = partAreaBudget('high');

    expect(low).toBeLessThan(medium);
    expect(medium).toBeLessThan(high);
    expect(low).toBeGreaterThan(MIN_PART_AREA);
  });

  it('keeps weak hardware on exactly the budget it had before tiering existed', () => {
    // Raising this is the one change that could regress a low-memory machine, so
    // it is pinned rather than left to drift with the other two.
    expect(partAreaBudget('low')).toBe(40_000_000);
    expect(PART_AREA_BUDGET.low).toBe(40_000_000);
  });

  it('stays within the memory each tier is named for', () => {
    // 4 bytes per pixel. A budget that outruns the machine's RAM is a blank
    // screenshot, so the arithmetic is worth asserting rather than assuming.
    expect(partAreaBudget('low') * 4).toBeLessThanOrEqual(256 * 1024 * 1024);
    expect(partAreaBudget('high') * 4).toBeLessThanOrEqual(768 * 1024 * 1024);
  });
});
