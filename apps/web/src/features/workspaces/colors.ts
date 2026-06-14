import type { ProjectColor } from '@teamboard/shared';

/** 12-color palette → 500-level hex for dots/strips (Tailwind palette values). */
export const COLOR_HEX: Record<ProjectColor, string> = {
  slate: '#64748b',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  pink: '#ec4899',
};
