import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  user: { id: 'user-1', email: 'operator@example.com', user_metadata: { name: 'Operator Gudang' } },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user, signOut: mocks.signOut }),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from, channel: mocks.channel, removeChannel: mocks.removeChannel },
}));

vi.mock('../lib/deviceDetection', () => ({ isMobileDevice: () => false }));
vi.mock('../components/StatusModal', () => ({ default: () => null }));
vi.mock('../components/BulkFollowUpModal', () => ({ default: () => null }));
vi.mock('../components/ScanModal', () => ({ default: () => null }));
vi.mock('../components/StatusList', () => ({ default: ({ title, emptyMessage }) => <div data-testid="status-list"><h2>{title}</h2><p>{emptyMessage}</p></div> }));
vi.mock('../components/KanbanBoard', () => ({ default: () => <div data-testid="kanban-board" /> }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

import ReportStatus from '../components/ReportStatus';

describe('ReportStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.in = vi.fn(() => chain);
    chain.neq = vi.fn(() => chain);
    chain.or = vi.fn(() => Promise.resolve({ data: [], error: null }));
    chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue(chain);
    mocks.channel.mockImplementation(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({}),
    }));
  });

  it('renders the fresh WMS report workspace with clear status actions', async () => {
    render(<ReportStatus />);

    expect(await screen.findByTestId('report-status-shell')).toBeInTheDocument();
    expect(screen.getByText('Warehouse Management System')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Report Status Raw Material' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah Kritis' })).toHaveClass('hover:-translate-y-0.5');
    expect(screen.getByRole('button', { name: 'Tambah Over' })).toHaveClass('hover:-translate-y-0.5');
  });

  it('keeps home navigation and report menu actions available', async () => {
    const user = userEvent.setup();
    render(<ReportStatus />);

    await user.click(await screen.findByRole('button', { name: 'Kembali ke dashboard' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/home');

    await user.click(screen.getByRole('button', { name: 'Buka menu laporan' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});
