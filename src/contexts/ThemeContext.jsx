import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'warehouse-theme';
const ThemeContext = createContext(null);

const systemTheme = () => (
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
);

const readTheme = () => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'light';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(readTheme);
  const resolvedTheme = theme === 'system' ? systemTheme() : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.style.colorScheme = resolvedTheme;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', resolvedTheme === 'dark' ? '#0f172a' : '#2563eb');
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [resolvedTheme, theme]);

  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setTheme((current) => current);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme: () => setTheme((current) => (current === 'dark' || (current === 'system' && resolvedTheme === 'dark') ? 'light' : 'dark')),
  }), [theme, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
