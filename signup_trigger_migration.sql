-- =====================================================
-- Supabase Signup Trigger Migration
-- Created: 2025-09-30
-- Description: Creates trigger to automatically add new signups to profiles table
-- =====================================================

BEGIN;

-- =====================================================
-- TRIGGER FUNCTION
-- =====================================================

-- Function to handle new user signup and create profile
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
    user_username TEXT;
    user_role TEXT;
    user_status TEXT;
BEGIN
    -- Log the incoming user data for debugging
    RAISE LOG 'Creating profile for user: %, email: %, metadata type: %, metadata: %',
        NEW.id, NEW.email, jsonb_typeof(NEW.raw_user_meta_data), NEW.raw_user_meta_data;

    -- Extract user metadata from auth.users with multiple fallback strategies
    user_name := COALESCE(
        NEW.raw_user_meta_data ->> 'name',
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'display_name',
        NEW.raw_user_meta_data ->> 'first_name',
        NEW.raw_user_meta_data ->> 'given_name',
        split_part(NEW.email, '@', 1), -- Use email prefix as fallback
        'User'
    );

    user_username := COALESCE(
        NEW.raw_user_meta_data ->> 'username',
        NEW.raw_user_meta_data ->> 'user_name',
        NEW.raw_user_meta_data ->> 'preferred_username',
        NEW.raw_user_meta_data ->> 'nickname',
        split_part(NEW.email, '@', 1), -- Use email prefix as fallback
        'user_' || substring(NEW.id::text from 1 for 8) -- Use first 8 chars of UUID as fallback
    );

    user_role := COALESCE(
        NEW.raw_user_meta_data ->> 'role',
        NEW.raw_user_meta_data ->> 'user_role',
        NEW.raw_user_meta_data ->> 'account_type',
        'counter' -- Default role for cycle count app
    );

    user_status := COALESCE(
        NEW.raw_user_meta_data ->> 'status',
        NEW.raw_user_meta_data ->> 'user_status',
        NEW.raw_user_meta_data ->> 'state',
        'active' -- Default status
    );

    -- Log extracted values for debugging
    RAISE LOG 'Extracted values - name: %, username: %, role: %, status: %',
        user_name, user_username, user_role, user_status;

    -- Log before insert
    RAISE LOG 'Attempting to insert profile: id=%, name=%, username=%, role=%, status=%',
        NEW.id, user_name, user_username, user_role, user_status;

    -- Insert into profiles table
    INSERT INTO public.profiles (id, name, username, role, status)
    VALUES (
        NEW.id,
        user_name,
        user_username,
        user_role::user_role,
        user_status::user_status
    )
    ON CONFLICT (id) DO NOTHING; -- In case profile already exists

    -- Verify the insert worked
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
        RAISE LOG 'Successfully created profile for user: %', NEW.id;
    ELSE
        RAISE LOG 'WARNING: Profile insert did not result in a visible record for user: %', NEW.id;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the user creation
        RAISE WARNING 'Error creating profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER
-- =====================================================

-- Drop trigger if exists (for clean migrations)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;

-- Create trigger that fires after a new user is inserted into auth.users
-- Use SECURITY DEFINER to ensure proper permissions
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();

-- =====================================================
-- GRANTS AND SECURITY
-- =====================================================

-- Ensure the trigger function has necessary permissions
-- Grant usage on auth schema for trigger function
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- Grant necessary permissions on public schema and profiles table
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.profiles TO anon, authenticated, service_role;

-- Grant execute permission on the trigger function
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO anon, authenticated, service_role;

-- Ensure the trigger function can access auth.users table
-- The SECURITY DEFINER ensures it runs with the privileges of the function creator
ALTER FUNCTION public.handle_new_user_signup() SECURITY DEFINER;

-- Additional permissions to ensure the function can read from auth.users
GRANT SELECT ON auth.users TO anon, authenticated, service_role;

COMMIT;