import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authCallback: null,
  getCurrentUserProfile: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  getCurrentUserProfile: mocks.getCurrentUserProfile,
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
  },
}));

import { AuthProvider, useAuth } from '../contexts/AuthContext';

const Probe = () => {
  const { loading, profile, signIn, signOut, user } = useAuth();
  return (
    <>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.id || 'none'}</span>
      <span data-testid="profile">{profile?.status || 'none'}</span>
      <button type="button" onClick={() => signIn('user@example.com', 'secret')}>Sign in</button>
      <button type="button" onClick={() => signOut()}>Sign out</button>
    </>
  );
};

const renderAuth = () => render(
  <AuthProvider>
    <Probe />
  </AuthProvider>,
);

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authCallback = null;
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.onAuthStateChange.mockImplementation((callback) => {
      mocks.authCallback = callback;
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes once from INITIAL_SESSION and passes its user to the profile helper', async () => {
    const user = { id: 'user-1' };
    const profile = { id: user.id, status: 'active', role: 'counter' };
    mocks.getCurrentUserProfile.mockResolvedValue(profile);
    renderAuth();

    await act(async () => {
      await mocks.authCallback('INITIAL_SESSION', { user });
    });

    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.getCurrentUserProfile).toHaveBeenCalledTimes(1);
    expect(mocks.getCurrentUserProfile).toHaveBeenCalledWith(user);
    expect(screen.getByTestId('user')).toHaveTextContent(user.id);
    expect(screen.getByTestId('profile')).toHaveTextContent('active');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('clears an invalid persisted session with a browser-local sign out', async () => {
    mocks.getCurrentUserProfile.mockRejectedValue({
      name: 'AuthApiError',
      status: 403,
      message: 'Forbidden',
    });
    renderAuth();

    await act(async () => {
      await mocks.authCallback('INITIAL_SESSION', { user: { id: 'user-1' } });
    });

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('signs out locally when the profile is inactive', async () => {
    mocks.getCurrentUserProfile.mockResolvedValue({
      id: 'user-1',
      status: 'inactive',
    });
    renderAuth();

    await act(async () => {
      await mocks.authCallback('INITIAL_SESSION', { user: { id: 'user-1' } });
    });

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('does not destroy the persisted session for a transient profile query error', async () => {
    mocks.getCurrentUserProfile.mockRejectedValue({
      code: 'PGRST000',
      message: 'database temporarily unavailable',
    });
    renderAuth();

    await act(async () => {
      await mocks.authCallback('INITIAL_SESSION', { user: { id: 'user-1' } });
    });

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('does not treat a profile-table 403 as an invalid auth session', async () => {
    mocks.getCurrentUserProfile.mockRejectedValue({
      name: 'PostgrestError',
      status: 403,
      code: '42501',
      message: 'permission denied for table profiles',
    });
    renderAuth();

    await act(async () => {
      await mocks.authCallback('INITIAL_SESSION', { user: { id: 'user-1' } });
    });

    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('passes the authenticated user to the profile helper during sign in', async () => {
    const user = { id: 'user-1' };
    const session = { user };
    mocks.signInWithPassword.mockResolvedValue({
      data: { user, session },
      error: null,
    });
    mocks.getCurrentUserProfile.mockResolvedValue({ id: user.id, status: 'active' });
    renderAuth();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent(user.id);
    });
    expect(mocks.getCurrentUserProfile).toHaveBeenCalledWith(user);
  });

  it('uses browser-local scope for an explicit sign out', async () => {
    renderAuth();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    });
  });
});
