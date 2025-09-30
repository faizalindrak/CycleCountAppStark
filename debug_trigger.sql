-- =====================================================
-- Debug Script for Signup Trigger Issues
-- =====================================================

-- Step 1: Check if trigger exists and is enabled
SELECT
    t.tgname as trigger_name,
    c.relname as table_name,
    t.tgenabled as is_enabled,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
LEFT JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'users' AND t.tgname = 'on_auth_user_created';

-- Step 2: Check if function exists
SELECT
    proname as function_name,
    prokind as function_type,
    prosecdef as is_security_definer,
    proowner as function_owner
FROM pg_proc
WHERE proname = 'handle_new_user_signup';

-- Step 3: Check current permissions on profiles table
SELECT
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'profiles'
ORDER BY grantee, privilege_type;

-- Step 4: Check if we can manually insert a test profile
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
BEGIN
    RAISE NOTICE 'Testing manual profile insert with ID: %', test_user_id;

    -- Try to insert a test profile
    INSERT INTO public.profiles (id, name, username, role, status)
    VALUES (
        test_user_id,
        'Test User',
        'testuser',
        'counter'::user_role,
        'active'::user_status
    );

    RAISE NOTICE 'Manual insert successful';

    -- Clean up
    DELETE FROM public.profiles WHERE id = test_user_id;
    RAISE NOTICE 'Test cleanup completed';

END $$;

-- Step 5: Check auth.users table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND table_schema = 'auth'
ORDER BY ordinal_position;

-- Step 6: Test trigger function permissions
DO $$
BEGIN
    RAISE NOTICE 'Testing trigger function permissions...';

    -- Check if we can access auth.users table
    IF EXISTS (
        SELECT 1 FROM auth.users LIMIT 1
    ) THEN
        RAISE NOTICE 'SUCCESS: Can access auth.users table';
    ELSE
        RAISE NOTICE 'WARNING: Cannot access auth.users table';
    END IF;

    -- Check if we can insert into profiles table
    IF HAS_TABLE_PRIVILEGE('public.profiles', 'INSERT') THEN
        RAISE NOTICE 'SUCCESS: Has INSERT privilege on profiles table';
    ELSE
        RAISE NOTICE 'ERROR: No INSERT privilege on profiles table';
    END IF;

END $$;