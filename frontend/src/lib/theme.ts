import type { ColorTheme } from '../context/theme-context';

export const themeStorageKey = 'mepco-color-theme';

export function applyTheme(theme: ColorTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function initializeTheme(): void {
  const savedTheme = window.localStorage.getItem(themeStorageKey);
  const theme = savedTheme === 'light' || savedTheme === 'dark'
    ? savedTheme
    : typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  applyTheme(theme);
}
