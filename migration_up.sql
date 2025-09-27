-- =====================================================
-- CycleCountAppStark Database Migration - UP
-- Created: 2025-09-27
-- Description: Initial schema setup with RLS policies
-- =====================================================

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS AND DOMAINS
-- =====================================================

-- Create enum types for better data integrity
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'counter');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('draft', 'active', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE session_type AS ENUM ('inventory');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLES
-- =====================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'counter',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations table
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items table
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    item_code TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL, -- Denormalized for performance
    uom TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type session_type NOT NULL DEFAULT 'inventory',
    status session_status NOT NULL DEFAULT 'draft',
    created_date TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session users assignment table
CREATE TABLE IF NOT EXISTS public.session_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

-- Session items table
CREATE TABLE IF NOT EXISTS public.session_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, item_id)
);

-- Counts table
CREATE TABLE IF NOT EXISTS public.counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    counted_qty INTEGER NOT NULL CHECK (counted_qty >= 0),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_locations_category_id ON locations(category_id);
CREATE INDEX IF NOT EXISTS idx_items_created_by ON items(created_by);
CREATE INDEX IF NOT EXISTS idx_sessions_created_by ON sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_session_users_session_id ON session_users(session_id);
CREATE INDEX IF NOT EXISTS idx_session_users_user_id ON session_users(user_id);
CREATE INDEX IF NOT EXISTS idx_session_items_session_id ON session_items(session_id);
CREATE INDEX IF NOT EXISTS idx_session_items_item_id ON session_items(item_id);
CREATE INDEX IF NOT EXISTS idx_counts_session_id ON counts(session_id);
CREATE INDEX IF NOT EXISTS idx_counts_item_id ON counts(item_id);
CREATE INDEX IF NOT EXISTS idx_counts_location_id ON counts(location_id);
CREATE INDEX IF NOT EXISTS idx_counts_user_id ON counts(user_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_items_sku ON items(sku);
CREATE INDEX IF NOT EXISTS idx_items_item_name ON items USING gin(to_tsvector('english', item_name));
CREATE INDEX IF NOT EXISTS idx_items_tags ON items USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_sessions_status_created_date ON sessions(status, created_date DESC);
CREATE INDEX IF NOT EXISTS idx_counts_session_timestamp ON counts(session_id, timestamp DESC);

-- Partial indexes for active sessions
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(created_date DESC) WHERE status = 'active';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE counts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- PROFILES POLICIES
-- Users can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Admins can do everything on profiles (using JWT metadata to avoid recursion)
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles" ON profiles
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'admin' OR
        auth.jwt() -> 'user_metadata' ->> 'role' = 'admin' OR
        auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    );

-- CATEGORIES POLICIES (Public read for authenticated users)
DROP POLICY IF EXISTS "Authenticated users can view categories" ON categories;
CREATE POLICY "Authenticated users can view categories" ON categories
    FOR SELECT USING (auth.role() = 'authenticated');

-- Admins can manage categories
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories" ON categories
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'admin' OR
        auth.jwt() -> 'user_metadata' ->> 'role' = 'admin' OR
        auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    );

-- LOCATIONS POLICIES (Public read for authenticated users)
DROP POLICY IF EXISTS "Authenticated users can view locations" ON locations;
CREATE POLICY "Authenticated users can view locations" ON locations
    FOR SELECT USING (auth.role() = 'authenticated');

-- Admin helper function to check JWT role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.jwt() ->> 'role' = 'admin' OR
         auth.jwt() -> 'user_metadata' ->> 'role' = 'admin' OR
         auth.jwt() -> 'app_metadata' ->> 'role' = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admins can manage locations
DROP POLICY IF EXISTS "Admins can manage locations" ON locations;
CREATE POLICY "Admins can manage locations" ON locations
    FOR ALL USING (public.is_admin());

-- ITEMS POLICIES (Public read for authenticated users)
DROP POLICY IF EXISTS "Authenticated users can view items" ON items;
CREATE POLICY "Authenticated users can view items" ON items
    FOR SELECT USING (auth.role() = 'authenticated');

-- Admins can manage items
DROP POLICY IF EXISTS "Admins can manage items" ON items;
CREATE POLICY "Admins can manage items" ON items
    FOR ALL USING (public.is_admin());

-- SESSIONS POLICIES
-- Users can view sessions they created or are assigned to
DROP POLICY IF EXISTS "Users can view assigned or created sessions" ON sessions;
CREATE POLICY "Users can view assigned or created sessions" ON sessions
    FOR SELECT USING (
        auth.uid() = created_by OR
        EXISTS (
            SELECT 1 FROM session_users su
            WHERE su.session_id = sessions.id AND su.user_id = auth.uid()
        ) OR
        public.is_admin()
    );

-- Users can create sessions (will be restricted by app logic)
DROP POLICY IF EXISTS "Authenticated users can create sessions" ON sessions;
CREATE POLICY "Authenticated users can create sessions" ON sessions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = created_by);

-- Users can update sessions they created
DROP POLICY IF EXISTS "Users can update sessions they created" ON sessions;
CREATE POLICY "Users can update sessions they created" ON sessions
    FOR UPDATE USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- Admins can manage all sessions
DROP POLICY IF EXISTS "Admins can manage all sessions" ON sessions;
CREATE POLICY "Admins can manage all sessions" ON sessions
    FOR ALL USING (public.is_admin());

-- SESSION_USERS POLICIES
-- Users can view their own assignments
DROP POLICY IF EXISTS "Users can view their session assignments" ON session_users;
CREATE POLICY "Users can view their session assignments" ON session_users
    FOR SELECT USING (
        user_id = auth.uid() OR
        public.is_admin()
    );

-- Admins can manage session assignments
DROP POLICY IF EXISTS "Admins can manage session assignments" ON session_users;
CREATE POLICY "Admins can manage session assignments" ON session_users
    FOR ALL USING (public.is_admin());

-- SESSION_ITEMS POLICIES
-- Users can view session items for sessions they have access to
DROP POLICY IF EXISTS "Users can view session items for accessible sessions" ON session_items;
CREATE POLICY "Users can view session items for accessible sessions" ON session_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.id = session_items.session_id AND (
                s.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM session_users su
                    WHERE su.session_id = s.id AND su.user_id = auth.uid()
                ) OR
                public.is_admin()
            )
        )
    );

-- Admins can manage session items
DROP POLICY IF EXISTS "Admins can manage session items" ON session_items;
CREATE POLICY "Admins can manage session items" ON session_items
    FOR ALL USING (public.is_admin());

-- COUNTS POLICIES
-- Users can view counts for sessions they have access to
DROP POLICY IF EXISTS "Users can view counts for accessible sessions" ON counts;
CREATE POLICY "Users can view counts for accessible sessions" ON counts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.id = counts.session_id AND (
                s.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM session_users su
                    WHERE su.session_id = s.id AND su.user_id = auth.uid()
                ) OR
                public.is_admin()
            )
        )
    );

-- Users can insert counts for sessions they are assigned to
DROP POLICY IF EXISTS "Users can insert counts for assigned sessions" ON counts;
CREATE POLICY "Users can insert counts for assigned sessions" ON counts
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM session_users su
            WHERE su.session_id = counts.session_id AND su.user_id = auth.uid()
        )
    );

-- Users can update their own counts
DROP POLICY IF EXISTS "Users can update their own counts" ON counts;
CREATE POLICY "Users can update their own counts" ON counts
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admins can manage all counts
DROP POLICY IF EXISTS "Admins can manage all counts" ON counts;
CREATE POLICY "Admins can manage all counts" ON counts
    FOR ALL USING (public.is_admin());

-- =====================================================
-- INITIAL DATA (Optional - for testing)
-- =====================================================

-- Insert default admin user if not exists (this would be done through signup)
-- Note: This is handled by the application signup process

COMMIT;