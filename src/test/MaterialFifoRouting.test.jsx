import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  user: { id: 'u1', email: 'user@example.com' },
  profile: { role: 'user', status: 'active' },
  loading: false,
  isAuthenticated: true,
  isAdmin: false,
  signOut: vi.fn(),
}));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

import Home from '../components/Home';
import MaterialFifoLayout from '../features/material-fifo/components/MaterialFifoLayout';

const LocationProbe = () => <span data-testid="pathname">{useLocation().pathname}</span>;

const renderFifoLayout = () => render(
  <MemoryRouter initialEntries={['/material-fifo/data']}>
    <Routes>
      <Route path="/material-fifo/*" element={
        <MaterialFifoLayout
          context={{}}
          openInbound={vi.fn()}
          openOutbound={vi.fn()}
          lastRefresh={new Date('2026-08-13T14:43:57')}
        />
      }>
        <Route path="data" element={<p>Data content</p>} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

describe('Material FIFO navigation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Material FIFO for every active user and navigates to it', () => {
    render(<Home />);
    fireEvent.click(screen.getByRole('button', { name: /Buka Material FIFO/i }));
    expect(navigate).toHaveBeenCalledWith('/material-fifo');
  });

  it('navigates between FIFO pages without nesting under the current page', () => {
    render(
      <MemoryRouter initialEntries={['/material-fifo/overview']}>
        <Routes>
          <Route path="/material-fifo/*" element={
            <MaterialFifoLayout context={{}} openInbound={vi.fn()} openOutbound={vi.fn()} />
          }>
            <Route path="overview" element={<><LocationProbe /><Outlet /></>} />
            <Route path="data" element={<LocationProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Data FIFO' }));
    expect(screen.getByTestId('pathname')).toHaveTextContent('/material-fifo/data');
  });

  it('renders the redesigned FIFO shell with accessible global actions', () => {
    renderFifoLayout();

    expect(screen.getByTestId('material-fifo-shell')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Data FIFO' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Barang Masuk/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Barang Keluar/i })).toBeInTheDocument();
    expect(screen.getByText(/Online.*Diperbarui/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buka menu' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens and closes the responsive navigation drawer', () => {
    renderFifoLayout();

    fireEvent.click(screen.getByRole('button', { name: 'Buka menu' }));
    expect(screen.getByRole('dialog', { name: 'Navigasi Material FIFO' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Navigasi Material FIFO' })).not.toBeInTheDocument();
  });
});
