import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  user: { email: 'operator@example.com', user_metadata: { name: 'Operator Gudang' } },
  profile: { role: 'admin', status: 'active' },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mocks.user,
    profile: mocks.profile,
    signOut: mocks.signOut,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

import Home from '../components/Home';

describe('Home dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the WMS visual system with animated navigation cards', () => {
    render(<Home />);

    expect(screen.getAllByText('WMS').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getAllByText('Warehouse Management System')).toHaveLength(2);
    expect(screen.getByTestId('dashboard-watermark')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buka Cycle Count/i })).toHaveClass('hover:-translate-y-1');
    expect(screen.getByRole('button', { name: /Buka Material FIFO/i })).toHaveClass('hover:-translate-y-1');
    expect(screen.getByText('Operator Gudang')).toBeInTheDocument();
  });

  it('keeps dashboard card routes and logout action available', async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole('button', { name: /Buka Material FIFO/i }));
    expect(mocks.navigate).toHaveBeenCalledWith('/material-fifo');

    await user.click(screen.getByRole('button', { name: /Keluar/i }));
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });
});
