import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ConfigProvider } from 'antd';
import { buildAntdTheme } from './tokens';
import { ThemeModeContext, readStoredMode, storeMode } from './themeMode';
import MonoEmpty from '@/components/MonoEmpty';

const renderEmpty = (componentName) => (
  <MonoEmpty compact={componentName !== 'Table' && componentName !== 'List'} />
);

/**
 * Owns light/dark mode: sets `data-theme` on <html> (drives the CSS variables
 * in index.css), persists the choice, and feeds the matching antd theme to
 * both the React tree and antd's static holders (message.*, Modal.confirm).
 */
export default function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readStoredMode);
  const theme = useMemo(() => buildAntdTheme(mode), [mode]);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  useEffect(() => {
    // Static APIs (message.success, Modal.confirm) render outside the tree.
    ConfigProvider.config({
      holderRender: (node) => (
        <ConfigProvider theme={theme} renderEmpty={renderEmpty}>{node}</ConfigProvider>
      ),
    });
  }, [theme]);

  const setMode = useCallback((next) => {
    setModeState(next);
    storeMode(next);
  }, []);
  const toggle = useCallback(() => setMode(mode === 'dark' ? 'light' : 'dark'), [mode, setMode]);
  const ctx = useMemo(() => ({ mode, setMode, toggle }), [mode, setMode, toggle]);

  return (
    <ThemeModeContext.Provider value={ctx}>
      <ConfigProvider theme={theme} renderEmpty={renderEmpty}>
        {children}
      </ConfigProvider>
    </ThemeModeContext.Provider>
  );
}
