-- =====================================================
-- Add Session Repeat and Time Window Fields Migration
-- Created: 2025-10-02
-- Description: Adds fields for repeatable sessions and time windows
-- =====================================================

BEGIN;

-- Add new columns to sessions table
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS repeat_type TEXT CHECK (repeat_type IN ('one_time', 'daily', 'weekly', 'monthly')),
ADD COLUMN IF NOT EXISTS repeat_days TEXT[], -- Array of days (e.g., ['monday', 'wednesday'] for weekly, or ['1', '15'] for monthly)
ADD COLUMN IF NOT EXISTS repeat_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS session_date DATE; -- Specific date for the session (for recurring sessions)

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_sessions_session_date ON sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_repeat_type ON sessions(repeat_type);

-- Update RLS policies to include new fields (no changes needed as they inherit from table policies)

COMMIT;