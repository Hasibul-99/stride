import { useState } from 'react';
import { formatMinutes, parseDurationToMinutes } from '@teamboard/shared';
import { cn } from '@/lib/utils';

interface Props {
  /** Current value in minutes (null = unset). */
  minutes: number | null;
  /** Fires on blur with the parsed minutes (or null when cleared). */
  onCommit: (minutes: number | null) => void;
  label?: string;
}

/**
 * Free-text time-estimate field. Accepts "1h 30m" / "90m" / "1.5h" / "45".
 * On blur it parses → minutes and calls onCommit; unparseable text shows an error.
 */
export function TimeEstimateInput({ minutes, onCommit, label = 'Time estimate' }: Props) {
  const [text, setText] = useState(formatMinutes(minutes));
  const [error, setError] = useState(false);

  function commit() {
    const trimmed = text.trim();
    if (trimmed === '') {
      setError(false);
      onCommit(null);
      return;
    }
    const parsed = parseDurationToMinutes(trimmed);
    if (parsed === null) {
      setError(true);
      return;
    }
    setError(false);
    setText(formatMinutes(parsed));
    onCommit(parsed);
  }

  return (
    <div>
      <input
        aria-label={label}
        aria-invalid={error}
        value={text}
        placeholder="e.g. 1h 30m"
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(false);
        }}
        onBlur={commit}
        className={cn(
          'w-full rounded-control border bg-surface px-3 py-2 outline-none focus:border-primary',
          error ? 'border-danger' : 'border-border',
        )}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          Enter a duration like “1h 30m”, “90m”, or “1.5h”.
        </p>
      )}
    </div>
  );
}
