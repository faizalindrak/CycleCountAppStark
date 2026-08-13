import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  })),
}));

const loadSupabaseModule = async () => {
  vi.resetModules();
  return import('../lib/supabase');
};

describe('getCurrentUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  it('uses the authenticated session user without requesting /auth/v1/user again', async () => {
    const user = { id: 'user-1', user_metadata: {} };
    mocks.getUser.mockResolvedValue({ data: { user } });
    const single = vi.fn().mockResolvedValue({
      data: { id: user.id, status: 'active' },
      error: null,
    });
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single })),
      })),
    });

    const { getCurrentUserProfile } = await loadSupabaseModule();
    const profile = await getCurrentUserProfile(user);

    expect(profile).toEqual({ id: user.id, status: 'active' });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('does not query profiles when the supplied session user has no id', async () => {
    const { getCurrentUserProfile } = await loadSupabaseModule();

    await expect(getCurrentUserProfile({ user_metadata: {} })).resolves.toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('propagates profile query errors instead of treating them as an inactive profile', async () => {
    const user = { id: 'user-1', user_metadata: {} };
    const queryError = { code: '42501', message: 'permission denied for table profiles' };
    mocks.getUser.mockResolvedValue({ data: { user } });
    const single = vi.fn().mockResolvedValue({ data: null, error: queryError });
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single })),
      })),
    });

    const { getCurrentUserProfile } = await loadSupabaseModule();

    await expect(getCurrentUserProfile(user)).rejects.toBe(queryError);
  });
});
