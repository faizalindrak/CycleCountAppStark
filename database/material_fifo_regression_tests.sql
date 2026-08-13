\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF NOT condition THEN
        RAISE EXCEPTION 'ASSERTION FAILED: %', message;
    END IF;
END;
$$;

CREATE TEMP TABLE fifo_test_context AS
SELECT
    gen_random_uuid() AS active_user_id,
    gen_random_uuid() AS inactive_user_id,
    gen_random_uuid() AS raw_item_id,
    gen_random_uuid() AS non_raw_item_id,
    gen_random_uuid() AS request_in_1,
    gen_random_uuid() AS request_in_2,
    gen_random_uuid() AS request_in_3,
    gen_random_uuid() AS request_out_fifo,
    gen_random_uuid() AS request_out_manual;

INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
)
SELECT active_user_id, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'fifo-active@example.test',
       crypt('test-password', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       '{}'::jsonb, now(), now()
FROM fifo_test_context
UNION ALL
SELECT inactive_user_id, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'fifo-inactive@example.test',
       crypt('test-password', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       '{}'::jsonb, now(), now()
FROM fifo_test_context;

INSERT INTO public.profiles (id, name, username, role, status)
SELECT active_user_id, 'FIFO Active Test', 'fifo_active_test', 'user', 'active'
FROM fifo_test_context
UNION ALL
SELECT inactive_user_id, 'FIFO Inactive Test', 'fifo_inactive_test', 'user', 'inactive'
FROM fifo_test_context;

INSERT INTO public.items (
    id, sku, item_code, item_name, category, uom,
    internal_product_code, created_by
)
SELECT raw_item_id, 'RM-FIFO-TEST', 'RM-CODE', 'Raw FIFO Test',
       'Raw Material', 'KG', 'RM-INTERNAL', active_user_id
FROM fifo_test_context
UNION ALL
SELECT non_raw_item_id, 'FG-FIFO-TEST', 'FG-CODE', 'Finished FIFO Test',
       'Finished Goods', 'PCS', 'FG-INTERNAL', active_user_id
FROM fifo_test_context;

SELECT set_config('request.jwt.claim.sub', active_user_id::text, true),
       set_config(
           'request.jwt.claims',
           jsonb_build_object('sub', active_user_id, 'role', 'authenticated')::text,
           true
       )
FROM fifo_test_context;

SET LOCAL ROLE authenticated;

SELECT pg_temp.assert_true(
    (public.receive_material_fifo(
        (SELECT raw_item_id FROM fifo_test_context),
        'A1.1', 10.0000, DATE '2026-08-01', 'oldest',
        (SELECT request_in_1 FROM fifo_test_context)
    )->>'stock_after')::numeric = 10.0000,
    'first inbound must produce stock 10'
);

SELECT public.receive_material_fifo(
    (SELECT raw_item_id FROM fifo_test_context),
    'A2.1', 5.0000, DATE '2026-08-02', 'second',
    (SELECT request_in_2 FROM fifo_test_context)
);
SELECT public.receive_material_fifo(
    (SELECT raw_item_id FROM fifo_test_context),
    'A1.1', 8.0000, DATE '2026-08-03', 'newest',
    (SELECT request_in_3 FROM fifo_test_context)
);

SELECT pg_temp.assert_true(
    jsonb_array_length((public.preview_material_fifo_issue(
        (SELECT raw_item_id FROM fifo_test_context), 12.0000, 'FIFO', NULL
    )->'allocations')) = 2,
    'FIFO preview must span the two oldest lots'
);

SELECT public.issue_material_fifo(
    (SELECT raw_item_id FROM fifo_test_context), 12.0000, 'FIFO', NULL,
    DATE '2026-08-12', 'fifo issue',
    (SELECT request_out_fifo FROM fifo_test_context), NULL
);

SELECT pg_temp.assert_true(
    (public.issue_material_fifo(
        (SELECT raw_item_id FROM fifo_test_context), 12.0000, 'FIFO', NULL,
        DATE '2026-08-12', 'retry',
        (SELECT request_out_fifo FROM fifo_test_context), NULL
    )->>'replayed')::boolean,
    'repeated request ID must replay'
);

SELECT pg_temp.assert_true(
    (SELECT count(*) FROM public.material_fifo_transactions
     WHERE request_id = (SELECT request_out_fifo FROM fifo_test_context)) = 1,
    'repeated request ID must not duplicate transactions'
);

SELECT public.issue_material_fifo(
    (SELECT raw_item_id FROM fifo_test_context), 2.0000, 'MANUAL', 'A1.1',
    DATE '2026-08-12', 'manual issue',
    (SELECT request_out_manual FROM fifo_test_context), NULL
);

SELECT pg_temp.assert_true(
    NOT EXISTS (
        SELECT 1
        FROM public.material_fifo_allocations allocation
        JOIN public.material_fifo_lots lot ON lot.id = allocation.lot_id
        WHERE allocation.transaction_id = (
            SELECT id FROM public.material_fifo_transactions
            WHERE request_id = (SELECT request_out_manual FROM fifo_test_context)
        )
          AND upper(lot.location) <> 'A1.1'
    ),
    'manual issue must use only the selected location'
);

DO $$
DECLARE
    stock_before numeric;
    stock_after numeric;
    error_message text;
BEGIN
    SELECT sum(remaining_qty) INTO stock_before FROM public.material_fifo_lots;
    BEGIN
        PERFORM public.issue_material_fifo(
            (SELECT raw_item_id FROM fifo_test_context), 999.0000,
            'FIFO', NULL, DATE '2026-08-12', 'must fail',
            gen_random_uuid(), NULL
        );
        RAISE EXCEPTION 'expected insufficient stock failure';
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
        PERFORM pg_temp.assert_true(
            position('MF_INSUFFICIENT_STOCK:' in error_message) = 1,
            'insufficient stock must return a stable error code'
        );
    END;
    SELECT sum(remaining_qty) INTO stock_after FROM public.material_fifo_lots;
    PERFORM pg_temp.assert_true(
        stock_before = stock_after,
        'failed issue must not mutate lot balances'
    );
END;
$$;

SELECT pg_temp.assert_true(
    (SELECT stock_qty FROM public.material_fifo_stock_view
     WHERE item_id = (SELECT raw_item_id FROM fifo_test_context)) =
    (SELECT coalesce(sum(remaining_qty), 0)
     FROM public.material_fifo_lots
     WHERE item_id = (SELECT raw_item_id FROM fifo_test_context)),
    'stock view must equal the remaining lot sum'
);

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', inactive_user_id::text, true),
       set_config(
           'request.jwt.claims',
           jsonb_build_object('sub', inactive_user_id, 'role', 'authenticated')::text,
           true
       )
FROM fifo_test_context;
SET LOCAL ROLE authenticated;
DO $$
DECLARE error_message text;
BEGIN
    BEGIN
        PERFORM public.preview_material_fifo_issue(
            (SELECT raw_item_id FROM fifo_test_context), 1.0000, 'FIFO', NULL
        );
        RAISE EXCEPTION 'expected inactive user failure';
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
        PERFORM pg_temp.assert_true(
            position('MF_INACTIVE_USER:' in error_message) = 1,
            'inactive user must return MF_INACTIVE_USER'
        );
    END;
END;
$$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', active_user_id::text, true),
       set_config(
           'request.jwt.claims',
           jsonb_build_object('sub', active_user_id, 'role', 'authenticated')::text,
           true
       )
FROM fifo_test_context;
SET LOCAL ROLE authenticated;
DO $$
DECLARE error_message text;
BEGIN
    BEGIN
        PERFORM public.preview_material_fifo_issue(
            (SELECT non_raw_item_id FROM fifo_test_context), 1.0000, 'FIFO', NULL
        );
        RAISE EXCEPTION 'expected non Raw Material failure';
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
        PERFORM pg_temp.assert_true(
            position('MF_NOT_RAW_MATERIAL:' in error_message) = 1,
            'non Raw Material item must return MF_NOT_RAW_MATERIAL'
        );
    END;
END;
$$;
RESET ROLE;

ROLLBACK;
