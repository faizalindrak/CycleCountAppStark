-- =====================================================
-- Fix RLS policy for follow-up status updates
-- Migration: 2025-10-09 - Allow any user to update follow-up status
-- =====================================================

BEGIN;

-- Drop the existing restrictive update policy
DROP POLICY IF EXISTS "Users can update their own reports" ON report_status_raw_mat;

-- Create a new policy that allows any authenticated user to update follow-up status
CREATE POLICY "Users can update follow-up status" ON report_status_raw_mat
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

COMMIT;