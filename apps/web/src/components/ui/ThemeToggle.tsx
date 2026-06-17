import { useEffect, useState } from 'react';

const KEY = 'tb-theme';

export function applyStoredTheme() {
  const t = localStorage.getItem(KEY);
  document.documentElement.classList.toggle('dark', t === 'dark');
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem(KEY) === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(KEY, dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="rounded-control px-2 py-1 text-base"
      title="Toggle theme"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
