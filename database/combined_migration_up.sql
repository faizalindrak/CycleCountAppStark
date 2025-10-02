-- =====================================================
-- Combined Database Migration File
-- Includes all database additions and changes
-- Generated from multiple migration files
-- =====================================================

-- =====================================================
-- Base Schema Migration (from migration_up.sql)
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
    CREATE TYPE user_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive');
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
    role user_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add status column if it doesn't exist (for existing databases)
DO $$ BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status user_status NOT NULL DEFAULT 'inactive';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Update existing profiles to use 'user' role instead of 'counter'
UPDATE public.profiles SET role = 'user' WHERE role = 'counter';

-- Set existing users to active status (assuming they were active before)
UPDATE public.profiles SET status = 'active' WHERE status = 'inactive';

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

COMMIT;

-- =====================================================
-- Additional Migrations
-- =====================================================

-- Add internal_product_code column to items table
-- Maximum 20 characters, unique, non-null, contains product codes like JI4ACO-GCAS17BK04
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS internal_product_code VARCHAR(20) UNIQUE NOT NULL;

-- Create index for performance on internal_product_code searches
CREATE INDEX IF NOT EXISTS idx_items_internal_product_code ON items(internal_product_code);

-- Add check constraint to ensure internal_product_code is not empty
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'items_internal_product_code_not_empty'
    ) THEN
        ALTER TABLE public.items
        ADD CONSTRAINT items_internal_product_code_not_empty
        CHECK (LENGTH(TRIM(internal_product_code)) > 0);
    END IF;
END $$;

-- Add check constraint to ensure internal_product_code is max 20 characters
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'items_internal_product_code_max_length'
    ) THEN
        ALTER TABLE public.items
        ADD CONSTRAINT items_internal_product_code_max_length
        CHECK (LENGTH(internal_product_code) <= 20);
    END IF;
END $$;

-- Add counted_qty_calculation column to store mathematical expressions
ALTER TABLE public.counts
ADD COLUMN counted_qty_calculation TEXT;

-- Add comment to explain the column purpose
COMMENT ON COLUMN public.counts.counted_qty_calculation IS 'Stores the mathematical expression used to calculate the counted quantity (e.g., "5*10+5*20")';

-- Create index for the new column for potential future queries
CREATE INDEX IF NOT EXISTS idx_counts_calculation ON public.counts USING gin (to_tsvector('english', counted_qty_calculation)) TABLESPACE pg_default;

-- Create function to prevent category deletion when in use
CREATE OR REPLACE FUNCTION prevent_category_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if category is used in items table
    IF EXISTS (SELECT 1 FROM items WHERE category = OLD.name) THEN
        RAISE EXCEPTION 'Cannot delete category "%" because it is used by existing items', OLD.name;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent category deletion
DROP TRIGGER IF EXISTS prevent_category_deletion_trigger ON categories;
CREATE TRIGGER prevent_category_deletion_trigger
    BEFORE DELETE ON categories
    FOR EACH ROW EXECUTE FUNCTION prevent_category_deletion();

-- Create view for category usage tracking
CREATE OR REPLACE VIEW category_usage AS
SELECT
    c.id,
    c.name,
    c.description,
    COUNT(i.id) as item_count,
    COUNT(l.id) as location_count,
    CASE
        WHEN COUNT(i.id) > 0 OR COUNT(l.id) > 0 THEN true
        ELSE false
    END as is_in_use,
    c.created_at,
    c.updated_at
FROM categories c
LEFT JOIN items i ON i.category = c.name
LEFT JOIN locations l ON l.category_id = c.id
GROUP BY c.id, c.name, c.description, c.created_at, c.updated_at;

-- Grant access to the view for authenticated users
GRANT SELECT ON category_usage TO authenticated;

-- Add soft delete columns to locations table
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES auth.users(id);

-- Create index for active locations
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active, category_id);

-- Create function to check if location has count data
CREATE OR REPLACE FUNCTION location_has_count_data(location_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM counts
        WHERE location_id = location_id_param
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to prevent location deletion when it has count data
CREATE OR REPLACE FUNCTION prevent_location_deletion_with_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if location has count data
    IF location_has_count_data(OLD.id) THEN
        RAISE EXCEPTION 'Cannot delete location "%" because it has associated count data. Use soft delete instead.', OLD.name;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent hard deletion of locations with count data
DROP TRIGGER IF EXISTS prevent_location_deletion_with_counts_trigger ON locations;
CREATE TRIGGER prevent_location_deletion_with_counts_trigger
    BEFORE DELETE ON locations
    FOR EACH ROW EXECUTE FUNCTION prevent_location_deletion_with_counts();

-- Create function to soft delete location
CREATE OR REPLACE FUNCTION soft_delete_location(
    location_id_param UUID,
    user_id_param UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    has_counts BOOLEAN;
BEGIN
    -- Check if location has count data
    SELECT location_has_count_data(location_id_param) INTO has_counts;

    IF has_counts THEN
        -- Soft delete: mark as inactive
        UPDATE locations
        SET
            is_active = false,
            deactivated_at = NOW(),
            deactivated_by = user_id_param,
            updated_at = NOW()
        WHERE id = location_id_param AND is_active = true;

        RETURN true;
    ELSE
        -- Hard delete: actually remove the record
        DELETE FROM locations WHERE id = location_id_param;
        RETURN true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to reactivate location
CREATE OR REPLACE FUNCTION reactivate_location(location_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE locations
    SET
        is_active = true,
        deactivated_at = NULL,
        deactivated_by = NULL,
        updated_at = NOW()
    WHERE id = location_id_param AND is_active = false;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for location usage tracking
CREATE OR REPLACE VIEW location_usage AS
SELECT
    l.id,
    l.name,
    l.category_id,
    l.is_active,
    l.deactivated_at,
    l.deactivated_by,
    c.name as category_name,
    COUNT(co.id) as count_records,
    COUNT(DISTINCT co.session_id) as sessions_with_counts,
    CASE
        WHEN COUNT(co.id) > 0 THEN true
        ELSE false
    END as has_count_data,
    l.created_at,
    l.updated_at
FROM locations l
LEFT JOIN categories c ON l.category_id = c.id
LEFT JOIN counts co ON l.id = co.location_id
GROUP BY l.id, l.name, l.category_id, l.is_active, l.deactivated_at, l.deactivated_by, c.name, l.created_at, l.updated_at;

-- Grant access to the view for authenticated users
GRANT SELECT ON location_usage TO authenticated;

-- Update counts table foreign key to RESTRICT instead of CASCADE
-- First drop the existing constraint
ALTER TABLE counts DROP CONSTRAINT IF EXISTS counts_location_id_fkey;

-- Add new constraint with RESTRICT
ALTER TABLE counts
ADD CONSTRAINT counts_location_id_fkey
FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT;

-- Create index for location usage queries
CREATE INDEX IF NOT EXISTS idx_counts_location_session ON counts(location_id, session_id);

-- =====================================================
-- HOTFIX: Fix Infinite Recursion in RLS Policies
-- =====================================================

-- CREATE HELPER FUNCTION (in public schema)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
   user_role text;
BEGIN
   -- First try JWT claims
   IF auth.jwt() ->> 'role' = 'admin' OR
      auth.jwt() -> 'user_metadata' ->> 'role' = 'admin' OR
      auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' THEN
     RETURN true;
   END IF;

   -- Fallback to profiles table query
   SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
   RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FIX ADMIN POLICIES (Replace queries with function calls)

-- PROFILES: Fix admin policy
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles" ON profiles
    FOR ALL USING (public.is_admin());

-- CATEGORIES: Fix admin policy
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories" ON categories
    FOR ALL USING (public.is_admin());

-- LOCATIONS: Fix admin policy
DROP POLICY IF EXISTS "Admins can manage locations" ON locations;
CREATE POLICY "Admins can manage locations" ON locations
    FOR ALL USING (public.is_admin());

-- ITEMS: Fix admin policy
DROP POLICY IF EXISTS "Admins can manage items" ON items;
CREATE POLICY "Admins can manage items" ON items
    FOR ALL USING (public.is_admin());

-- SESSIONS: Fix admin policies
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

DROP POLICY IF EXISTS "Admins can manage all sessions" ON sessions;
CREATE POLICY "Admins can manage all sessions" ON sessions
    FOR ALL USING (public.is_admin());

-- SESSION_USERS: Fix admin policies
DROP POLICY IF EXISTS "Users can view their session assignments" ON session_users;
CREATE POLICY "Users can view their session assignments" ON session_users
    FOR SELECT USING (
        user_id = auth.uid() OR
        public.is_admin()
    );

DROP POLICY IF EXISTS "Admins can manage session assignments" ON session_users;
CREATE POLICY "Admins can manage session assignments" ON session_users
    FOR ALL USING (public.is_admin());

-- SESSION_ITEMS: Fix admin policies
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

DROP POLICY IF EXISTS "Admins can manage session items" ON session_items;
CREATE POLICY "Admins can manage session items" ON session_items
    FOR ALL USING (public.is_admin());

-- COUNTS: Fix admin policies
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

DROP POLICY IF EXISTS "Admins can manage all counts" ON counts;
CREATE POLICY "Admins can manage all counts" ON counts
    FOR ALL USING (public.is_admin());