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
          setUser(session.user);
          setProfile(null); // initially null
          setLoading(false);

          // Fetch profile asynchronously
          getCurrentUserProfile().then(userProfile => {
            setProfile(userProfile);
          }).catch(error => {
            console.error('Error fetching user profile:', error);
          });
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(prevUser => {
          const newAuthUser = session?.user;

          // When a user is logged in
          if (newAuthUser) {
            // Check if the user is different from the previous one
            if (prevUser?.id !== newAuthUser.id) {
              // If it's a different user, reset profile and fetch the new one
              setProfile(null);
              getCurrentUserProfile().then(userProfile => {
                setProfile(userProfile);
              }).catch(error => {
                console.error('Error fetching user profile for new user:', error);
              });
              return newAuthUser;
            }
            // If it's the same user, no need to do anything with the profile
            return prevUser;
          }

          // When a user is logged out
          setProfile(null);
          return null;
        });

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check user status after successful authentication
      const userProfile = await getCurrentUserProfile();

      if (!userProfile) {
        // If no profile found, sign out and throw error
        await supabase.auth.signOut();
        throw new Error('User profile not found. Please contact administrator.');
      }

      if (userProfile.status !== 'active') {
        // If user status is not active, sign out and throw error
        await supabase.auth.signOut();
        const statusMessage = userProfile.status === 'inactive'
          ? 'Your account is currently inactive and cannot be used for login.'
          : `Your account status is "${userProfile.status}" and cannot be used for login.`;
        throw new Error(`${statusMessage} Please contact your administrator to activate your account before attempting to log in.`);
      }

      // Profile will be set by the auth state change listener
      return { data, error: null };
    } catch (error) {
      // Don't log the error here, let the LoginForm handle it
      return { data: null, error };
    }
  }, []);

  const signUp = useCallback(async (email, password, userData) => {
    try {
      console.log('Signing up with userData:', userData); // Debug log

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

      console.log('Signup successful:', data); // Debug log
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
    isAuthenticated: !!user,
  }), [user, profile, loading, signIn, signUp, signOut, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};