/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // CSS-variable-based theme. Design tokens defined in Phase 10.
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--color-primary-foreground)',
        },
      },
      borderRadius: {
        control: '6px',
        card: '10px',
        modal: '14px',
      },
    },
  },
  plugins: [],
};
