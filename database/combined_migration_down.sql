-- =====================================================
-- Combined Database Migration DOWN
-- Rollback all database additions and changes
-- Generated from multiple migration files
-- =====================================================

BEGIN;

-- =====================================================
-- REVERSE ADDITIONAL MIGRATIONS (in reverse order)
-- =====================================================

-- Reverse hotfix_rls_recursion.sql
-- The policies are updated, but since base down drops all policies, no need to reverse specifically

-- Reverse location_soft_delete_migration.sql
-- Drop additional functions
DROP FUNCTION IF EXISTS reactivate_location(UUID);
DROP FUNCTION IF EXISTS soft_delete_location(UUID, UUID);
DROP FUNCTION IF EXISTS prevent_location_deletion_with_counts();
DROP FUNCTION IF EXISTS location_has_count_data(UUID);

-- Drop triggers
DROP TRIGGER IF EXISTS prevent_location_deletion_with_counts_trigger ON locations;

-- Drop views
DROP VIEW IF EXISTS location_usage;

-- Drop additional indexes
DROP INDEX IF EXISTS idx_counts_location_session;
DROP INDEX IF EXISTS idx_locations_active;

-- Drop additional columns
ALTER TABLE locations DROP COLUMN IF EXISTS deactivated_by;
ALTER TABLE locations DROP COLUMN IF EXISTS deactivated_at;
ALTER TABLE locations DROP COLUMN IF EXISTS is_active;

-- Restore foreign key to CASCADE (original from migration_up.sql)
ALTER TABLE counts DROP CONSTRAINT IF EXISTS counts_location_id_fkey;
ALTER TABLE counts
ADD CONSTRAINT counts_location_id_fkey
FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;

-- Reverse category_protection_migration.sql
-- Drop trigger
DROP TRIGGER IF EXISTS prevent_category_deletion_trigger ON categories;

-- Drop function
DROP FUNCTION IF EXISTS prevent_category_deletion();

-- Drop view
DROP VIEW IF EXISTS category_usage;

-- Reverse add_counted_qty_calculation_column.sql
-- Drop index
DROP INDEX IF EXISTS idx_counts_calculation;

-- Drop column
ALTER TABLE counts DROP COLUMN IF EXISTS counted_qty_calculation;

-- Reverse add_internal_product_code_column.sql
-- Drop constraints
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_internal_product_code_max_length;
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_internal_product_code_not_empty;

-- Drop index
DROP INDEX IF EXISTS idx_items_internal_product_code;

-- Drop column
ALTER TABLE items DROP COLUMN IF EXISTS internal_product_code;

-- Reverse add_user_status_column.sql
-- The status column is added in base migration, so no need to reverse separately

-- =====================================================
-- BASE MIGRATION DOWN (from migration_down.sql)
-- =====================================================

-- =====================================================
-- DROP POLICIES (in reverse order)
-- =====================================================

-- COUNTS POLICIES
DROP POLICY IF EXISTS "Admins can manage all counts" ON counts;
DROP POLICY IF EXISTS "Users can update their own counts" ON counts;
DROP POLICY IF EXISTS "Users can insert counts for assigned sessions" ON counts;
DROP POLICY IF EXISTS "Users can view counts for accessible sessions" ON counts;

-- SESSION_ITEMS POLICIES
DROP POLICY IF EXISTS "Admins can manage session items" ON session_items;
DROP POLICY IF EXISTS "Users can view session items for accessible sessions" ON session_items;

-- SESSION_USERS POLICIES
DROP POLICY IF EXISTS "Admins can manage session assignments" ON session_users;
DROP POLICY IF EXISTS "Users can view their session assignments" ON session_users;

-- SESSIONS POLICIES
DROP POLICY IF EXISTS "Admins can manage all sessions" ON sessions;
DROP POLICY IF EXISTS "Users can update sessions they created" ON sessions;
DROP POLICY IF EXISTS "Authenticated users can create sessions" ON sessions;
DROP POLICY IF EXISTS "Users can view assigned or created sessions" ON sessions;

-- ITEMS POLICIES
DROP POLICY IF EXISTS "Admins can manage items" ON items;
DROP POLICY IF EXISTS "Authenticated users can view items" ON items;

-- LOCATIONS POLICIES
DROP POLICY IF EXISTS "Admins can manage locations" ON locations;
DROP POLICY IF EXISTS "Authenticated users can view locations" ON locations;

-- CATEGORIES POLICIES
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can view categories" ON categories;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- =====================================================
-- DROP TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
DROP TRIGGER IF EXISTS update_items_updated_at ON items;
DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;

-- =====================================================
-- DROP FUNCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- =====================================================
-- DROP INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_sessions_active;
DROP INDEX IF EXISTS idx_counts_session_timestamp;
DROP INDEX IF EXISTS idx_items_tags;
DROP INDEX IF EXISTS idx_items_item_name;
DROP INDEX IF EXISTS idx_items_sku;
DROP INDEX IF EXISTS idx_counts_user_id;
DROP INDEX IF EXISTS idx_counts_location_id;
DROP INDEX IF EXISTS idx_counts_item_id;
DROP INDEX IF EXISTS idx_counts_session_id;
DROP INDEX IF EXISTS idx_session_items_item_id;
DROP INDEX IF EXISTS idx_session_items_session_id;
DROP INDEX IF EXISTS idx_session_users_user_id;
DROP INDEX IF EXISTS idx_session_users_session_id;
DROP INDEX IF EXISTS idx_sessions_created_by;
DROP INDEX IF EXISTS idx_items_created_by;
DROP INDEX IF EXISTS idx_locations_category_id;
DROP INDEX IF EXISTS idx_profiles_id;

-- =====================================================
-- DROP TABLES (in reverse dependency order)
-- =====================================================

DROP TABLE IF EXISTS counts;
DROP TABLE IF EXISTS session_items;
DROP TABLE IF EXISTS session_users;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS profiles;

-- =====================================================
-- DROP ENUMS
-- =====================================================

DROP TYPE IF EXISTS session_type;
DROP TYPE IF EXISTS session_status;
DROP TYPE IF EXISTS user_status;
DROP TYPE IF EXISTS user_role;

-- =====================================================
-- DROP EXTENSIONS (optional - only if not used elsewhere)
-- =====================================================

-- Note: Extensions are not dropped as they might be used by other schemas
-- DROP EXTENSION IF EXISTS "uuid-ossp";
-- DROP EXTENSION IF EXISTS "pgcrypto";

COMMIT;