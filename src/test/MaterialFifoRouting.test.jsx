import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('Material FIFO navigation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Material FIFO for every active user and navigates to it', () => {
    render(<Home />);
    fireEvent.click(screen.getByRole('button', { name: /Buka Material FIFO/i }));
    expect(navigate).toHaveBeenCalledWith('/material-fifo');
  });
});
