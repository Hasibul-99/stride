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
