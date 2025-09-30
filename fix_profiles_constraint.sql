-- =====================================================
-- Fix Profiles Foreign Key Constraint
-- Created: 2025-09-30
-- Description: Makes the foreign key constraint deferrable to allow triggers to work
-- =====================================================

BEGIN;

-- Drop the existing foreign key constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Add the deferrable foreign key constraint
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- Verify the constraint was added correctly
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
LEFT JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'profiles'
AND tc.constraint_type = 'FOREIGN KEY';

COMMIT;