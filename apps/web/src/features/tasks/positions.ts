/**
 * Compute a float position to insert an item at `index` within an ordered
 * list (the moved item already removed). Midpoint strategy → O(1) writes.
 */
export function positionForIndex(orderedPositions: number[], index: number): number {
  if (orderedPositions.length === 0) return 1000;
  if (index <= 0) return orderedPositions[0] / 2;
  if (index >= orderedPositions.length) {
    return orderedPositions[orderedPositions.length - 1] + 1000;
  }
  return (orderedPositions[index - 1] + orderedPositions[index]) / 2;
}

/** Smallest gap before float precision makes midpoints unsafe → time to rebalance. */
export const MIN_POSITION_GAP = 0.0001;

/** True when any adjacent pair is too close to split further (drag ordering should rebalance). */
export function needsRebalance(orderedPositions: number[]): boolean {
  for (let i = 1; i < orderedPositions.length; i++) {
    if (Math.abs(orderedPositions[i] - orderedPositions[i - 1]) < MIN_POSITION_GAP) return true;
  }
  return false;
}

/** Evenly spaced positions (1000, 2000, …) to reset ordering after a rebalance. */
export function rebalancedPositions(count: number, step = 1000): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * step);
}
