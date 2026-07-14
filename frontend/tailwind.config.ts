import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        'surface-elevated': 'var(--surface-elevated)',
        'surface-soft': 'var(--surface-soft)',
        brand: {
          deep: 'var(--brand-blue-deep)',
          DEFAULT: 'var(--brand-blue)',
          cyan: 'var(--brand-cyan)',
          red: 'var(--brand-red)',
          yellow: 'var(--brand-yellow)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 24px 80px rgba(18, 151, 239, 0.18)',
      },
    },
  },
  plugins: [],
} satisfies Config;

