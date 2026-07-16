import { createContext } from 'react';

export type ColorTheme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: ColorTheme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

