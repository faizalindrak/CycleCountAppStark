-- =====================================================
-- Fix RLS policy for profiles table to allow viewing other users' names
-- Migration: 2025-10-09 - Allow authenticated users to view other users' basic info
-- =====================================================

BEGIN;

-- Drop the restrictive policy that only allows users to view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create a new policy that allows authenticated users to view basic profile information
-- This includes id, name, and role for collaboration purposes
CREATE POLICY "Authenticated users can view basic profile info" ON profiles
    FOR SELECT USING (auth.role() = 'authenticated');

-- Keep the existing policy for users to update their own profile
-- (This should still exist from the original migration)

-- Ensure admins can still do everything
-- (This should still exist from the original migration)

COMMIT;