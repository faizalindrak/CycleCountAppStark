-- =====================================================
-- Test Script for Signup Trigger
-- Created: 2025-09-30
-- Description: Tests if the signup trigger is working correctly
-- =====================================================

-- This script tests the trigger function directly
-- Run this in your Supabase SQL editor or psql

-- =====================================================
-- Enhanced Test Script for Signup Trigger
-- =====================================================

DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_email TEXT := 'test@example.com';
    test_metadata JSONB := '{
        "name": "Test User",
        "username": "testuser",
        "role": "counter",
        "status": "active"
    }';
    profile_count_before INT;
    profile_count_after INT;
BEGIN
    RAISE NOTICE '=== STARTING TRIGGER TEST ===';
    RAISE NOTICE 'Test user_id: %', test_user_id;
    RAISE NOTICE 'Test email: %', test_email;
    RAISE NOTICE 'Test metadata: %', test_metadata;

    -- Count profiles before test
    SELECT COUNT(*) INTO profile_count_before FROM public.profiles;
    RAISE NOTICE 'Profiles before test: %', profile_count_before;

    -- Clean up any existing test data
    DELETE FROM public.profiles WHERE id = test_user_id;
    DELETE FROM auth.users WHERE id = test_user_id;

    -- Verify cleanup
    SELECT COUNT(*) INTO profile_count_after FROM public.profiles;
    RAISE NOTICE 'Profiles after cleanup: %', profile_count_after;

    -- Check if trigger exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'on_auth_user_created'
    ) THEN
        RAISE NOTICE 'ERROR: Trigger "on_auth_user_created" does not exist!';
        RAISE NOTICE 'Please check if the trigger was created properly in the migration.';
    ELSE
        RAISE NOTICE 'SUCCESS: Trigger "on_auth_user_created" exists';
    END IF;

    -- Check if trigger function exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'handle_new_user_signup'
    ) THEN
        RAISE NOTICE 'ERROR: Function "handle_new_user_signup" does not exist!';
    ELSE
        RAISE NOTICE 'SUCCESS: Function "handle_new_user_signup" exists';
    END IF;

    -- Insert test user (this should trigger the function)
    RAISE NOTICE 'Inserting test user into auth.users...';
    INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
    VALUES (
        test_user_id,
        test_email,
        test_metadata,
        NOW(),
        NOW()
    );

    -- Wait for trigger to execute
    PERFORM pg_sleep(2);

    -- Check if profile was created
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = test_user_id) THEN
        DECLARE
            created_profile RECORD;
        BEGIN
            SELECT * INTO created_profile FROM public.profiles WHERE id = test_user_id;

            RAISE NOTICE 'SUCCESS: Profile created successfully!';
            RAISE NOTICE 'Profile details:';
            RAISE NOTICE '  - ID: %', created_profile.id;
            RAISE NOTICE '  - Name: %', created_profile.name;
            RAISE NOTICE '  - Username: %', created_profile.username;
            RAISE NOTICE '  - Role: %', created_profile.role;
            RAISE NOTICE '  - Status: %', created_profile.status;
            RAISE NOTICE '  - Created: %', created_profile.created_at;

            -- Verify the data matches
            IF created_profile.name = 'Test User' AND
               created_profile.username = 'testuser' AND
               created_profile.role = 'counter' AND
               created_profile.status = 'active' THEN
                RAISE NOTICE 'SUCCESS: All profile data matches expected values!';
            ELSE
                RAISE NOTICE 'WARNING: Profile data does not match expected values';
            END IF;
        END;
    ELSE
        RAISE NOTICE 'FAILURE: Profile was not created by the trigger';

        -- Debug: Check what happened
        RAISE NOTICE 'Debugging information:';

        -- Check if user was actually inserted
        IF EXISTS (SELECT 1 FROM auth.users WHERE id = test_user_id) THEN
            DECLARE
                inserted_user RECORD;
            BEGIN
                SELECT * INTO inserted_user FROM auth.users WHERE id = test_user_id;
                RAISE NOTICE 'User was inserted: %', inserted_user;
                RAISE NOTICE 'User metadata: %', inserted_user.raw_user_meta_data;
            END;
        ELSE
            RAISE NOTICE 'User was not inserted into auth.users';
        END IF;

        -- Check PostgreSQL logs for errors
        RAISE NOTICE 'Check PostgreSQL logs for trigger errors';
    END IF;

    -- Clean up
    DELETE FROM public.profiles WHERE id = test_user_id;
    DELETE FROM auth.users WHERE id = test_user_id;

    -- Test 2: Direct function call test
    RAISE NOTICE '=== TESTING TRIGGER FUNCTION DIRECTLY ===';

    -- Create a test user for direct function testing
    INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
    VALUES (
        test_user_id,
        test_email || '2',
        test_metadata,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data;

    -- Test the trigger function directly (simulate trigger call)
    RAISE NOTICE 'Calling trigger function directly...';
    BEGIN
        -- Get the user record and call the function with it
        DECLARE
            test_user_record auth.users%ROWTYPE;
        BEGIN
            SELECT * INTO test_user_record FROM auth.users WHERE id = test_user_id;
            PERFORM public.handle_new_user_signup();
        END;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Error calling trigger function: %', SQLERRM;
    END;

    -- Check if profile was created
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = test_user_id) THEN
        DECLARE
            direct_profile RECORD;
        BEGIN
            SELECT * INTO direct_profile FROM public.profiles WHERE id = test_user_id;
            RAISE NOTICE 'SUCCESS: Direct function call created profile: %', direct_profile;
        END;
    ELSE
        RAISE NOTICE 'FAILURE: Direct function call did not create profile';
    END IF;

    -- Clean up
    DELETE FROM public.profiles WHERE id = test_user_id;
    DELETE FROM auth.users WHERE id = test_user_id;

    RAISE NOTICE '=== TEST COMPLETED ===';

END $$;