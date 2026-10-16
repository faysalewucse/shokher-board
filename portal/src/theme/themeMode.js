import { createContext, useContext } from 'react';

export const THEME_STORAGE_KEY = 'shokherboard.theme';

export const ThemeModeContext = createContext({ mode: 'light', toggle: () => {}, setMode: () => {} });

export const useThemeMode = () => useContext(ThemeModeContext);

export function readStoredMode() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function storeMode(mode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* storage unavailable — the choice just won't persist */
  }
}
