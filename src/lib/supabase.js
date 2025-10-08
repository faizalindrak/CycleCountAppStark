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
            role: userData.role || 'counter',
            status: userData.status || 'inactive' // Make sure status is set
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

// Helper function to check category usage before deletion
export const checkCategoryUsage = async (categoryId) => {
  try {
    // Get category name
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('name')
      .eq('id', categoryId)
      .single();

    if (categoryError) throw categoryError;

    // Check if category is used in items
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, item_name, sku')
      .eq('category', category.name);

    if (itemsError) throw itemsError;

    // Check if category has locations
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select('id, name')
      .eq('category_id', categoryId);

    if (locationsError) throw locationsError;

    return {
      category: category.name,
      itemCount: items?.length || 0,
      locationCount: locations?.length || 0,
      items: items || [],
      locations: locations || [],
      canDelete: items.length === 0 && locations.length === 0
    };
  } catch (error) {
    console.error('Error checking category usage:', error);
    throw error;
  }
};

// Helper function to check location usage before modification
export const checkLocationUsage = async (locationId) => {
  try {
    // Check if location has count data
    const { data: counts, error: countsError } = await supabase
      .from('counts')
      .select('id, session_id, item_id, counted_qty, timestamp')
      .eq('location_id', locationId);

    if (countsError) throw countsError;

    // Get location details
    const { data: location, error: locationError } = await supabase
      .from('locations')
      .select('id, name, category_id, is_active')
      .eq('id', locationId)
      .single();

    if (locationError) throw locationError;

    // Get category name
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('name')
      .eq('id', location.category_id)
      .single();

    if (categoryError) throw categoryError;

    return {
      location: location.name,
      category: category.name,
      countRecords: counts?.length || 0,
      sessions: [...new Set(counts?.map(c => c.session_id) || [])],
      isActive: location.is_active,
      canModify: counts.length === 0,
      counts: counts || []
    };
  } catch (error) {
    console.error('Error checking location usage:', error);
    throw error;
  }
};

// Helper function to soft delete location
export const softDeleteLocation = async (locationId, userId) => {
  try {
    const { data, error } = await supabase
      .rpc('soft_delete_location', {
        location_id_param: locationId,
        user_id_param: userId
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error soft deleting location:', error);
    throw error;
  }
};

// Helper function to reactivate location
export const reactivateLocation = async (locationId) => {
  try {
    const { data, error } = await supabase
      .rpc('reactivate_location', {
        location_id_param: locationId
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error reactivating location:', error);
    throw error;
  }
};

// =====================================================
// REPORT STATUS RAW MATERIAL HELPERS
// =====================================================

// Helper function to get all report status records with optional filtering
export const getReportStatusRecords = async (filters = {}) => {
  try {
    let query = supabase
      .from('report_status_raw_mat')
      .select('*');

    // Apply filters
    if (filters.date_input) {
      query = query.eq('date_input', filters.date_input);
    }

    if (filters.inventory_status) {
      query = query.eq('inventory_status', filters.inventory_status);
    }

    if (filters.follow_up_status) {
      query = query.eq('follow_up_status', filters.follow_up_status);
    }

    if (filters.user_report) {
      query = query.eq('user_report', filters.user_report);
    }

    // Order by creation date (newest first)
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching report status records:', error);
    throw error;
  }
};

// Helper function to create a new report status record
export const createReportStatusRecord = async (recordData) => {
  try {
    const { data, error } = await supabase
      .from('report_status_raw_mat')
      .insert([recordData])
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error creating report status record:', error);
    throw error;
  }
};

// Helper function to update a report status record
export const updateReportStatusRecord = async (recordId, updateData) => {
  try {
    const { data, error } = await supabase
      .from('report_status_raw_mat')
      .update(updateData)
      .eq('id', recordId)
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error updating report status record:', error);
    throw error;
  }
};

// Helper function to delete a report status record
export const deleteReportStatusRecord = async (recordId) => {
  try {
    const { data, error } = await supabase
      .from('report_status_raw_mat')
      .delete()
      .eq('id', recordId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting report status record:', error);
    throw error;
  }
};

// Helper function to get report status statistics
export const getReportStatusStats = async (date_input) => {
  try {
    let query = supabase
      .from('report_status_raw_mat')
      .select('inventory_status, follow_up_status');

    if (date_input) {
      query = query.eq('date_input', date_input);
    }

    const { data, error } = await query;

    if (error) throw error;

    const stats = {
      total: data.length,
      by_inventory_status: {
        kritis: data.filter(item => item.inventory_status === 'kritis').length,
        over: data.filter(item => item.inventory_status === 'over').length
      },
      by_follow_up_status: {
        open: data.filter(item => item.follow_up_status === 'open').length,
        on_progress: data.filter(item => item.follow_up_status === 'on_progress').length,
        closed: data.filter(item => item.follow_up_status === 'closed').length
      }
    };

    return stats;
  } catch (error) {
    console.error('Error fetching report status stats:', error);
    throw error;
  }
};