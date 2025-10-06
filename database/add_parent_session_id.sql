-- =====================================================
-- Add Parent Session ID for Recurring Session Sync
-- Created: 2025-10-06
-- Description: Adds parent_session_id to link recurring sessions
-- =====================================================

BEGIN;

-- Add parent_session_id column to sessions table
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS parent_session_id UUID REFERENCES sessions(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_sessions_parent_session_id ON sessions(parent_session_id);

COMMIT;