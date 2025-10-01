import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, getCurrentUserProfile } from '../lib/supabase';

const AuthContext = createContext({});

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
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Check profile status before setting user
          const userProfile = await getCurrentUserProfile();
          
          if (!userProfile || userProfile.status !== 'active') {
            // Sign out immediately if inactive
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
          } else {
            setUser(session.user);
            setProfile(userProfile);
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('Error getting initial session:', error);
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, 'Session:', !!session);
        
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // Don't process auth changes during sign in - let signIn handle it
        if (event === 'SIGNED_IN') {
          console.log('SIGNED_IN event - skipping (handled by signIn function)');
          return;
        }

        // For other events, check profile
        if (session?.user) {
          try {
            const userProfile = await getCurrentUserProfile();
            
            if (!userProfile || userProfile.status !== 'active') {
              console.log('Profile inactive or not found, signing out');
              await supabase.auth.signOut();
              setUser(null);
              setProfile(null);
            } else {
              setUser(session.user);
              setProfile(userProfile);
            }
          } catch (error) {
            console.error('Error in auth state change:', error);
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
          }
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
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
      const userProfile = await getCurrentUserProfile();
      console.log('Profile fetched:', userProfile);

      if (!userProfile) {
        console.log('No profile found, signing out');
        await supabase.auth.signOut();
        throw new Error('User profile not found. Please contact administrator.');
      }

      console.log('Profile status:', userProfile.status);

      if (userProfile.status !== 'active') {
        console.log('Profile is not active, signing out');
        await supabase.auth.signOut();
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
      // Make sure to sign out on any error
      await supabase.auth.signOut();
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
      const { error } = await supabase.auth.signOut();
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