import { describe, expect, it } from 'vitest';
import { formatTimeAgo } from '../../src/utils/time';

const NOW = new Date('2026-01-01T12:00:00Z').getTime();
const ago = (seconds: number) => formatTimeAgo(NOW - seconds * 1000, NOW);

describe('formatTimeAgo', () => {
  it('calls anything under a minute "just now"', () => {
    expect(ago(0)).toBe('just now');
    expect(ago(44)).toBe('just now');
  });

  it('counts minutes, hours and days', () => {
    expect(ago(60)).toBe('1m ago');
    expect(ago(45 * 60)).toBe('45m ago');
    expect(ago(2 * 3600)).toBe('2h ago');
    expect(ago(3 * 86_400)).toBe('3d ago');
  });

  it('never reads as being in the future when clocks disagree', () => {
    expect(formatTimeAgo(NOW + 5000, NOW)).toBe('just now');
  });
});
