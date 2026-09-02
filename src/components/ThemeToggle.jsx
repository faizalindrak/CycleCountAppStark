import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = () => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      title={isDark ? 'Mode terang' : 'Mode gelap'}
      className="fixed bottom-5 left-5 z-[90] inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-white/95 text-blue-700 shadow-xl shadow-blue-200/40 backdrop-blur transition hover:-translate-y-1 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-300 dark:shadow-slate-950/40 dark:hover:bg-slate-700"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
};

export default ThemeToggle;
