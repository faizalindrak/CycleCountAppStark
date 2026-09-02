import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  user: { id: 'admin-1', email: 'admin@example.com', user_metadata: { name: 'Admin' } },
  profile: { role: 'admin', status: 'active' },
  signOut: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../lib/supabase', () => {
  const query = () => {
    const chain = {
      select: () => chain,
      order: () => chain,
      eq: () => chain,
      in: () => chain,
      range: () => chain,
      then: (resolve) => resolve({ data: [], error: null }),
    };
    return chain;
  };
  return {
    supabase: {
      from: vi.fn(query),
      channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn(), })),
      removeChannel: vi.fn(),
    },
    checkCategoryUsage: vi.fn(),
    checkLocationUsage: vi.fn(),
    softDeleteLocation: vi.fn(),
    reactivateLocation: vi.fn(),
  };
});

import BacklogReport from '../components/BacklogReport';
import MaterialFifoLayout from '../features/material-fifo/components/MaterialFifoLayout';

const renderAt = (path, element) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="*" element={element} /></Routes>
  </MemoryRouter>,
);

describe('workspace visual redesign hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('adminDashboardData', JSON.stringify({
      sessions: [], items: [], itemGroups: [], categories: [], locations: [], users: [], timestamp: Date.now(),
    }));
  });

  it('exposes the refreshed Report Backlog shell without changing primary labels', async () => {
    renderAt('/report-backlog', <BacklogReport />);
    expect(await screen.findByTestId('backlog-report-page')).toHaveClass('wms-page-shell');
    expect(screen.getByText('Report Backlog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simpan Transaksi Backlog/i })).toBeInTheDocument();
  });

  it('exposes the refreshed Material FIFO shell and global actions', () => {
    renderAt('/material-fifo/overview', (
      <MaterialFifoLayout context={{}} openInbound={vi.fn()} openOutbound={vi.fn()} />
    ));
    expect(screen.getByTestId('material-fifo-shell')).toHaveClass('wms-page-shell');
    expect(screen.getByRole('button', { name: /Barang Masuk/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Barang Keluar/i })).toBeInTheDocument();
  });

});
