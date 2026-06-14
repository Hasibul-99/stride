/**
 * Parse human estimate strings into minutes.
 * Accepts "1h 30m", "90m", "2h", "1.5h", "45". Returns null if unparseable.
 */
export function parseDurationToMinutes(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  // Bare number → minutes.
  if (/^\d+(\.\d+)?$/.test(text)) {
    return Math.round(parseFloat(text));
  }

  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*h/);
  const minMatch = text.match(/(\d+(?:\.\d+)?)\s*m/);
  if (!hourMatch && !minMatch) return null;

  const hours = hourMatch ? parseFloat(hourMatch[1]) : 0;
  const mins = minMatch ? parseFloat(minMatch[1]) : 0;
  return Math.round(hours * 60 + mins);
}

/** Format minutes as "1h 30m" / "45m" / "2h". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
