import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
  user: { id: 'user-1', email: 'operator@example.com', user_metadata: { name: 'Operator Gudang' } },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user, signOut: mocks.signOut }),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

import SessionSelection from '../components/SessionSelection';

const session = {
  id: 'session-1',
  name: 'Sesi Pagi',
  type: 'one-time',
  status: 'active',
  scheduled_date: null,
  valid_from: null,
  valid_until: null,
  is_recurring_template: false,
};

describe('SessionSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const profileQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'user-1', role: 'admin' }, error: null }) })),
      })),
    };
    const sessionsQuery = {
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [session], error: null }),
        })),
      })),
    };
    mocks.from.mockImplementation((table) => (table === 'profiles' ? profileQuery : sessionsQuery));
  });

  it('renders the lively WMS session selection layout', async () => {
    render(<SessionSelection />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pilih Sesi Cycle Count' })).toBeInTheDocument());
    expect(screen.getByText('Warehouse Management System')).toBeInTheDocument();
    expect(screen.getByText('1 sesi aktif')).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveClass('hover:-translate-y-1');
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('keeps session navigation and shell actions available', async () => {
    const user = userEvent.setup();
    render(<SessionSelection />);

    await user.click(await screen.findByRole('button', { name: 'Buka sesi Sesi Pagi' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/counting/session-1');

    await user.click(screen.getByRole('button', { name: 'Kembali ke dashboard' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/home');
  });
});
