import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, getCurrentUserProfile } from '../lib/supabase';

const AuthContext = createContext({});

const INVALID_SESSION_ERROR_CODES = new Set([
  'bad_jwt',
  'refresh_token_already_used',
  'refresh_token_not_found',
  'session_not_found',
]);

const isInvalidSessionError = (error) => {
  if (INVALID_SESSION_ERROR_CODES.has(error?.code)) return true;

  return /invalid (?:refresh )?token|jwt (?:is )?(?:expired|invalid)|session (?:is )?not found/i
    .test(error?.message || '');
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const clearAuthState = () => {
      if (!isMounted) return;
      setUser(null);
      setProfile(null);
      setLoading(false);
    };

    const signOutLocally = async () => {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    };

    const handleAuthStateChange = async (event, session) => {
      console.log('Auth event:', event, 'Session:', !!session);

      if (event === 'SIGNED_OUT' || !session?.user) {
        clearAuthState();
        return;
      }

      // A password sign-in validates the profile in signIn() so it can return
      // an actionable error to the login form without issuing a duplicate query.
      if (event === 'SIGNED_IN') {
        console.log('SIGNED_IN event - skipping (handled by signIn function)');
        return;
      }

      try {
        const userProfile = await getCurrentUserProfile(session.user);

        if (!userProfile || userProfile.status !== 'active') {
          console.log('Profile inactive or not found, signing out locally');
          await signOutLocally();
          clearAuthState();
          return;
        }

        if (!isMounted) return;
        setUser(session.user);
        setProfile(userProfile);
        setLoading(false);
      } catch (error) {
        console.error('Error resolving authenticated user profile:', error);

        if (isInvalidSessionError(error)) {
          try {
            await signOutLocally();
          } catch (signOutError) {
            console.error('Error clearing invalid local session:', signOutError);
          }
        }

        clearAuthState();
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        void handleAuthStateChange(event, session);
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    try {
      console.log('Starting sign in...');
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Auth result:', { success: !!authData.session, error: authError });

      if (authError) throw authError;

      // Check user status immediately after successful authentication
      console.log('Checking user profile...');
      const userProfile = await getCurrentUserProfile(authData.user);
      console.log('Profile fetched:', userProfile);

      if (!userProfile) {
        console.log('No profile found');
        throw new Error('User profile not found. Please contact administrator.');
      }

      console.log('Profile status:', userProfile.status);

      if (userProfile.status !== 'active') {
        console.log('Profile is not active');
        const statusMessage = userProfile.status === 'inactive'
          ? 'Your account is currently inactive and cannot be used for login.'
          : `Your account status is "${userProfile.status}" and cannot be used for login.`;
        throw new Error(`${statusMessage} Please contact your administrator to activate your account before attempting to log in.`);
      }

      // Only set user and profile if everything is valid
      console.log('Setting user and profile - login successful');
      setUser(authData.user);
      setProfile(userProfile);
      
      return { data: authData, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      // Clear only this browser's session without revoking other active devices.
      await supabase.auth.signOut({ scope: 'local' });
      setUser(null);
      setProfile(null);
      return { data: null, error };
    }
  }, []);

  const signUp = useCallback(async (email, password, userData) => {
    try {
      console.log('Signing up with userData:', userData);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: userData.name,
            username: userData.username,
            role: userData.role,
            status: userData.status,
          },
        },
      });

      if (error) throw error;

      console.log('Signup successful:', data);
      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;

      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }, []);

  const updateProfile = useCallback(async (updates) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      return { data, error: null };
    } catch (error) {
      console.error('Update profile error:', error);
      return { data: null, error };
    }
  }, [user?.id]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    isAdmin: profile?.role === 'admin' || user?.user_metadata?.role === 'admin',
    isAuthenticated: !!user && !!profile && profile.status === 'active',
  }), [user, profile, loading, signIn, signUp, signOut, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
