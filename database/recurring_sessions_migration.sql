-- =====================================================
-- RECURRING SESSIONS MIGRATION
-- Adds support for recurring and scheduled cycle count sessions
-- =====================================================

BEGIN;

-- =====================================================
-- 1. UPDATE SESSION_STATUS ENUM
-- =====================================================

-- Add new status values to session_status enum
DO $$ BEGIN
    ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'closed';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE session_status ADD VALUE IF NOT EXISTS 'scheduled';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 2. ADD COLUMNS TO SESSIONS TABLE
-- =====================================================

-- Add recurring and scheduling columns
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS is_recurring_template BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurring_config JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS parent_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS auto_closed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS scheduled_date DATE DEFAULT NULL;

-- Add comments to explain columns
COMMENT ON COLUMN public.sessions.is_recurring_template IS 'True if this session is a master template for recurring sessions';
COMMENT ON COLUMN public.sessions.is_scheduled IS 'True if this is a one-time scheduled session';
COMMENT ON COLUMN public.sessions.recurring_config IS 'JSON config: {type: "daily"|"weekly"|"monthly", days: [0-6], dates: [1-31]}';
COMMENT ON COLUMN public.sessions.valid_from IS 'Timestamp when session can start receiving data';
COMMENT ON COLUMN public.sessions.valid_until IS 'Timestamp when session auto-closes';
COMMENT ON COLUMN public.sessions.parent_session_id IS 'Reference to master template session (for generated sessions)';
COMMENT ON COLUMN public.sessions.auto_closed_at IS 'Timestamp when session was automatically closed';
COMMENT ON COLUMN public.sessions.scheduled_date IS 'Date when this session is scheduled for';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_recurring_template ON sessions(is_recurring_template) WHERE is_recurring_template = true;
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_date ON sessions(scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_parent_id ON sessions(parent_session_id) WHERE parent_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_valid_times ON sessions(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_sessions_status_scheduled ON sessions(status, scheduled_date) WHERE status = 'scheduled';

-- =====================================================
-- 3. CREATE RECURRING_SESSION_LOGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.recurring_session_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    generated_session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'generated',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(master_session_id, scheduled_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recurring_logs_master ON recurring_session_logs(master_session_id);
CREATE INDEX IF NOT EXISTS idx_recurring_logs_generated ON recurring_session_logs(generated_session_id);
CREATE INDEX IF NOT EXISTS idx_recurring_logs_date ON recurring_session_logs(scheduled_date);

-- Add comments
COMMENT ON TABLE public.recurring_session_logs IS 'Tracks generated sessions from recurring templates';
COMMENT ON COLUMN public.recurring_session_logs.status IS 'Status: generated, activated, closed';

-- Enable RLS
ALTER TABLE recurring_session_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recurring_session_logs
DROP POLICY IF EXISTS "Admins can view recurring logs" ON recurring_session_logs;
CREATE POLICY "Admins can view recurring logs" ON recurring_session_logs
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage recurring logs" ON recurring_session_logs;
CREATE POLICY "Admins can manage recurring logs" ON recurring_session_logs
    FOR ALL USING (public.is_admin());

-- =====================================================
-- 4. CREATE FUNCTION: create_session_from_template
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_session_from_template(
    p_master_session_id UUID,
    p_scheduled_date DATE,
    p_valid_from TIMESTAMPTZ,
    p_valid_until TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
    v_new_session_id UUID;
    v_master_session RECORD;
    v_session_name TEXT;
BEGIN
    -- Get master session details
    SELECT * INTO v_master_session
    FROM sessions
    WHERE id = p_master_session_id AND is_recurring_template = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Master session not found or not a recurring template';
    END IF;

    -- Generate session name with date
    v_session_name := v_master_session.name || ' - ' || TO_CHAR(p_scheduled_date, 'DD/MM/YYYY');

    -- Create new session
    INSERT INTO sessions (
        name,
        type,
        status,
        created_by,
        parent_session_id,
        is_scheduled,
        scheduled_date,
        valid_from,
        valid_until
    ) VALUES (
        v_session_name,
        v_master_session.type,
        'scheduled', -- Initially scheduled, will be activated later
        v_master_session.created_by,
        p_master_session_id,
        true,
        p_scheduled_date,
        p_valid_from,
        p_valid_until
    )
    RETURNING id INTO v_new_session_id;

    -- Copy session users
    INSERT INTO session_users (session_id, user_id)
    SELECT v_new_session_id, user_id
    FROM session_users
    WHERE session_id = p_master_session_id;

    -- Copy session items
    INSERT INTO session_items (session_id, item_id)
    SELECT v_new_session_id, item_id
    FROM session_items
    WHERE session_id = p_master_session_id;

    -- Log the generation
    INSERT INTO recurring_session_logs (
        master_session_id,
        generated_session_id,
        scheduled_date,
        status
    ) VALUES (
        p_master_session_id,
        v_new_session_id,
        p_scheduled_date,
        'generated'
    );

    RETURN v_new_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_session_from_template IS 'Creates a new session from a recurring template';

-- =====================================================
-- 5. CREATE FUNCTION: activate_scheduled_sessions
-- =====================================================

CREATE OR REPLACE FUNCTION public.activate_scheduled_sessions()
RETURNS TABLE(session_id UUID, session_name TEXT) AS $$
BEGIN
    -- Update sessions that should be active today
    UPDATE sessions
    SET status = 'active'
    WHERE status = 'scheduled'
        AND scheduled_date = CURRENT_DATE
        AND valid_from <= NOW();

    -- Update logs
    UPDATE recurring_session_logs
    SET status = 'activated'
    WHERE generated_session_id IN (
        SELECT id FROM sessions
        WHERE status = 'active'
            AND scheduled_date = CURRENT_DATE
    );

    -- Return activated sessions
    RETURN QUERY
    SELECT id, name
    FROM sessions
    WHERE status = 'active'
        AND scheduled_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.activate_scheduled_sessions IS 'Activates sessions scheduled for today';

-- =====================================================
-- 6. CREATE FUNCTION: auto_close_expired_sessions
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_close_expired_sessions()
RETURNS TABLE(session_id UUID, session_name TEXT) AS $$
BEGIN
    -- Update sessions that have expired
    UPDATE sessions
    SET status = 'closed',
        auto_closed_at = NOW()
    WHERE status = 'active'
        AND valid_until IS NOT NULL
        AND valid_until < NOW();

    -- Update logs
    UPDATE recurring_session_logs
    SET status = 'closed'
    WHERE generated_session_id IN (
        SELECT id FROM sessions
        WHERE status = 'closed'
            AND auto_closed_at IS NOT NULL
    );

    -- Return closed sessions
    RETURN QUERY
    SELECT id, name
    FROM sessions
    WHERE status = 'closed'
        AND auto_closed_at IS NOT NULL
        AND auto_closed_at > NOW() - INTERVAL '1 minute'; -- Recently closed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_close_expired_sessions IS 'Auto-closes sessions that have passed their valid_until time';

-- =====================================================
-- 7. CREATE FUNCTION: generate_recurring_sessions
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_recurring_sessions(
    p_master_session_id UUID,
    p_days_ahead INTEGER DEFAULT 30
)
RETURNS TABLE(generated_count INTEGER, dates_generated DATE[]) AS $$
DECLARE
    v_master_session RECORD;
    v_current_date DATE;
    v_end_date DATE;
    v_config JSONB;
    v_recurrence_type TEXT;
    v_days INTEGER[];
    v_dates INTEGER[];
    v_day_of_week INTEGER;
    v_day_of_month INTEGER;
    v_should_generate BOOLEAN;
    v_new_session_id UUID;
    v_valid_from TIMESTAMPTZ;
    v_valid_until TIMESTAMPTZ;
    v_count INTEGER := 0;
    v_generated_dates DATE[] := ARRAY[]::DATE[];
    v_existing_session UUID;
BEGIN
    -- Get master session
    SELECT * INTO v_master_session
    FROM sessions
    WHERE id = p_master_session_id AND is_recurring_template = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Master session not found or not a recurring template';
    END IF;

    -- Get recurring config
    v_config := v_master_session.recurring_config;
    v_recurrence_type := v_config->>'type';

    -- Parse days/dates from config
    IF v_config ? 'days' THEN
        v_days := ARRAY(SELECT jsonb_array_elements_text(v_config->'days')::INTEGER);
    END IF;

    IF v_config ? 'dates' THEN
        v_dates := ARRAY(SELECT jsonb_array_elements_text(v_config->'dates')::INTEGER);
    END IF;

    -- Set date range
    v_current_date := CURRENT_DATE;
    v_end_date := CURRENT_DATE + p_days_ahead;

    -- Loop through dates
    WHILE v_current_date <= v_end_date LOOP
        v_should_generate := false;

        -- Check if session already exists for this date
        SELECT id INTO v_existing_session
        FROM sessions
        WHERE parent_session_id = p_master_session_id
            AND scheduled_date = v_current_date
        LIMIT 1;

        -- Only generate if not exists
        IF v_existing_session IS NULL THEN
            -- Determine if we should generate based on recurrence type
            CASE v_recurrence_type
                WHEN 'daily' THEN
                    v_should_generate := true;

                WHEN 'weekly' THEN
                    v_day_of_week := EXTRACT(DOW FROM v_current_date)::INTEGER; -- 0=Sunday, 6=Saturday
                    IF v_days IS NOT NULL AND v_day_of_week = ANY(v_days) THEN
                        v_should_generate := true;
                    END IF;

                WHEN 'monthly' THEN
                    v_day_of_month := EXTRACT(DAY FROM v_current_date)::INTEGER;
                    IF v_dates IS NOT NULL AND v_day_of_month = ANY(v_dates) THEN
                        v_should_generate := true;
                    END IF;

                ELSE
                    RAISE EXCEPTION 'Invalid recurrence type: %', v_recurrence_type;
            END CASE;

            -- Generate session if criteria met
            IF v_should_generate THEN
                -- Calculate valid_from and valid_until for the scheduled date
                -- Extract time from master session's valid_from/valid_until
                v_valid_from := v_current_date::TIMESTAMP + (v_master_session.valid_from::TIME);
                v_valid_until := v_current_date::TIMESTAMP + (v_master_session.valid_until::TIME);

                -- Create session from template
                v_new_session_id := create_session_from_template(
                    p_master_session_id,
                    v_current_date,
                    v_valid_from,
                    v_valid_until
                );

                v_count := v_count + 1;
                v_generated_dates := array_append(v_generated_dates, v_current_date);
            END IF;
        END IF;

        -- Move to next day
        v_current_date := v_current_date + 1;
    END LOOP;

    -- Return results
    RETURN QUERY SELECT v_count, v_generated_dates;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.generate_recurring_sessions IS 'Generates recurring sessions for the next N days based on template config';

-- =====================================================
-- 8. CREATE FUNCTION: update_future_sessions_from_template
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_future_sessions_from_template(
    p_master_session_id UUID
)
RETURNS TABLE(updated_count INTEGER, session_ids UUID[]) AS $$
DECLARE
    v_master_session RECORD;
    v_future_session RECORD;
    v_count INTEGER := 0;
    v_session_ids UUID[] := ARRAY[]::UUID[];
BEGIN
    -- Get master session
    SELECT * INTO v_master_session
    FROM sessions
    WHERE id = p_master_session_id AND is_recurring_template = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Master session not found or not a recurring template';
    END IF;

    -- Loop through future sessions
    FOR v_future_session IN
        SELECT id, scheduled_date
        FROM sessions
        WHERE parent_session_id = p_master_session_id
            AND scheduled_date >= CURRENT_DATE
            AND status IN ('scheduled', 'active')
    LOOP
        -- Delete existing session_users
        DELETE FROM session_users WHERE session_id = v_future_session.id;

        -- Copy session_users from master
        INSERT INTO session_users (session_id, user_id)
        SELECT v_future_session.id, user_id
        FROM session_users
        WHERE session_id = p_master_session_id;

        -- Delete existing session_items
        DELETE FROM session_items WHERE session_id = v_future_session.id;

        -- Copy session_items from master
        INSERT INTO session_items (session_id, item_id)
        SELECT v_future_session.id, item_id
        FROM session_items
        WHERE session_id = p_master_session_id;

        -- Update valid_from and valid_until times (keep date, update time)
        UPDATE sessions
        SET valid_from = v_future_session.scheduled_date::TIMESTAMP + (v_master_session.valid_from::TIME),
            valid_until = v_future_session.scheduled_date::TIMESTAMP + (v_master_session.valid_until::TIME)
        WHERE id = v_future_session.id;

        v_count := v_count + 1;
        v_session_ids := array_append(v_session_ids, v_future_session.id);
    END LOOP;

    -- Return results
    RETURN QUERY SELECT v_count, v_session_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_future_sessions_from_template IS 'Updates future sessions when master template is modified';

-- =====================================================
-- 9. UPDATE RLS POLICIES
-- =====================================================

-- Update sessions SELECT policy to hide scheduled sessions from regular users
DROP POLICY IF EXISTS "Users can view assigned or created sessions" ON sessions;
CREATE POLICY "Users can view assigned or created sessions" ON sessions
    FOR SELECT USING (
        -- Admins can see all
        public.is_admin() OR
        -- Regular users can only see non-scheduled OR sessions for today
        (
            (auth.uid() = created_by OR
            EXISTS (
                SELECT 1 FROM session_users su
                WHERE su.session_id = sessions.id AND su.user_id = auth.uid()
            ))
            AND
            (status != 'scheduled' OR scheduled_date = CURRENT_DATE)
        )
    );

-- Prevent inserting counts to closed or time-invalid sessions
DROP POLICY IF EXISTS "Users can insert counts for assigned sessions" ON counts;
CREATE POLICY "Users can insert counts for assigned sessions" ON counts
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM session_users su
            JOIN sessions s ON s.id = su.session_id
            WHERE su.session_id = counts.session_id
                AND su.user_id = auth.uid()
                AND s.status NOT IN ('closed', 'completed', 'cancelled', 'scheduled')
                AND (s.valid_from IS NULL OR s.valid_from <= NOW())
                AND (s.valid_until IS NULL OR s.valid_until >= NOW())
        )
    );

-- =====================================================
-- 10. GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.create_session_from_template TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_scheduled_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_close_expired_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_recurring_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_future_sessions_from_template TO authenticated;

COMMIT;

-- =====================================================
-- ROLLBACK SCRIPT (for reference, DO NOT RUN)
-- =====================================================
/*
BEGIN;

-- Drop functions
DROP FUNCTION IF EXISTS public.update_future_sessions_from_template;
DROP FUNCTION IF EXISTS public.generate_recurring_sessions;
DROP FUNCTION IF EXISTS public.auto_close_expired_sessions;
DROP FUNCTION IF EXISTS public.activate_scheduled_sessions;
DROP FUNCTION IF EXISTS public.create_session_from_template;

-- Drop table
DROP TABLE IF EXISTS public.recurring_session_logs;

-- Remove columns from sessions
ALTER TABLE public.sessions
DROP COLUMN IF EXISTS scheduled_date,
DROP COLUMN IF EXISTS auto_closed_at,
DROP COLUMN IF EXISTS parent_session_id,
DROP COLUMN IF EXISTS valid_until,
DROP COLUMN IF EXISTS valid_from,
DROP COLUMN IF EXISTS recurring_config,
DROP COLUMN IF EXISTS is_scheduled,
DROP COLUMN IF EXISTS is_recurring_template;

COMMIT;
*/
