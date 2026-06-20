import { describe, it, expect } from 'vitest';
import { positionForIndex, needsRebalance, rebalancedPositions } from './positions';

describe('positionForIndex', () => {
  it('returns a default when the list is empty', () => {
    expect(positionForIndex([], 0)).toBe(1000);
  });

  it('inserts before the first item (half of first)', () => {
    expect(positionForIndex([1000, 2000], 0)).toBe(500);
  });

  it('appends after the last item (last + 1000)', () => {
    expect(positionForIndex([1000, 2000], 2)).toBe(3000);
  });

  it('inserts between two neighbours (midpoint)', () => {
    expect(positionForIndex([1000, 2000], 1)).toBe(1500);
  });

  it('keeps the new position strictly between its neighbours', () => {
    const pos = positionForIndex([1000, 1001], 1);
    expect(pos).toBeGreaterThan(1000);
    expect(pos).toBeLessThan(1001);
  });
});

describe('needsRebalance', () => {
  it('is false for well-spaced positions', () => {
    expect(needsRebalance([1000, 2000, 3000])).toBe(false);
  });

  it('is true when a gap collapses below the threshold', () => {
    expect(needsRebalance([1000, 1000.00001, 2000])).toBe(true);
  });

  it('handles trivial lists', () => {
    expect(needsRebalance([])).toBe(false);
    expect(needsRebalance([1000])).toBe(false);
  });
});

describe('rebalancedPositions', () => {
  it('produces evenly spaced, increasing positions', () => {
    expect(rebalancedPositions(3)).toEqual([1000, 2000, 3000]);
    expect(needsRebalance(rebalancedPositions(50))).toBe(false);
  });
});
