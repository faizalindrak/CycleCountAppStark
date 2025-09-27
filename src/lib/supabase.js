import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Helper function to handle Supabase errors
export const handleSupabaseError = (error) => {
  console.error('Supabase error:', error);
  if (error?.message) {
    throw new Error(error.message);
  }
  throw error;
};


// Helper function to get current user profile
export const getCurrentUserProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    // If profile doesn't exist, try to create it from user metadata
    if (error.code === 'PGRST116') { // No rows returned
      const userData = user.user_metadata;
      if (userData && userData.name && userData.username) {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([{
            id: user.id,
            name: userData.name,
            username: userData.username,
            role: userData.role || 'counter'
          }])
          .select()
          .single();

        if (insertError) {
          console.error('Error creating user profile:', insertError);
          return null;
        }

        return newProfile;
      }
    }
    console.error('Error fetching user profile:', error);
    return null;
  }

  return profile;
};