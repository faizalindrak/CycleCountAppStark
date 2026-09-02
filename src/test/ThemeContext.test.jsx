import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

const Probe = () => {
  const { resolvedTheme, toggleTheme } = useTheme();
  return <button type="button" onClick={toggleTheme}>{resolvedTheme}</button>;
};

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('persists a dark/light choice and applies it to the document root', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('light');

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('warehouse-theme')).toBe('dark');
  });
});
