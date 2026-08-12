-- Material FIFO for Raw Material items
-- Safe to run repeatedly in Supabase SQL Editor.

BEGIN;

INSERT INTO public.categories (name, description)
SELECT 'Raw Material', 'Material FIFO category'
WHERE NOT EXISTS (
    SELECT 1 FROM public.categories
    WHERE lower(trim(name)) = 'raw material'
);

CREATE TABLE IF NOT EXISTS public.material_fifo_settings (
    item_id uuid PRIMARY KEY REFERENCES public.items(id) ON DELETE RESTRICT,
    min_qty numeric(20,4) NOT NULL CHECK (min_qty >= 0),
    max_qty numeric(20,4) NOT NULL CHECK (max_qty >= min_qty),
    remarks text,
    updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.material_fifo_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL UNIQUE,
    item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    transaction_type text NOT NULL CHECK (transaction_type IN ('IN', 'OUT')),
    issue_method text CHECK (issue_method IS NULL OR issue_method IN ('FIFO', 'MANUAL')),
    quantity numeric(20,4) NOT NULL CHECK (quantity > 0),
    transaction_date date NOT NULL,
    selected_location text,
    stock_before numeric(20,4) NOT NULL CHECK (stock_before >= 0),
    stock_after numeric(20,4) NOT NULL CHECK (stock_after >= 0),
    notes text,
    import_batch_id uuid,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.material_fifo_lots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    inbound_transaction_id uuid NOT NULL UNIQUE
        REFERENCES public.material_fifo_transactions(id) ON DELETE RESTRICT,
    location text NOT NULL CHECK (location ~ '^[A-Za-z]+[0-9]+\.[0-9]+$'),
    received_date date NOT NULL,
    initial_qty numeric(20,4) NOT NULL CHECK (initial_qty > 0),
    remaining_qty numeric(20,4) NOT NULL
        CHECK (remaining_qty >= 0 AND remaining_qty <= initial_qty),
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.material_fifo_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL
        REFERENCES public.material_fifo_transactions(id) ON DELETE RESTRICT,
    lot_id uuid NOT NULL REFERENCES public.material_fifo_lots(id) ON DELETE RESTRICT,
    quantity numeric(20,4) NOT NULL CHECK (quantity > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (transaction_id, lot_id)
);

CREATE INDEX IF NOT EXISTS idx_material_fifo_lots_issue
    ON public.material_fifo_lots(item_id, received_date, created_at, id)
    WHERE remaining_qty > 0;
CREATE INDEX IF NOT EXISTS idx_material_fifo_lots_location_issue
    ON public.material_fifo_lots(item_id, upper(location), received_date, created_at, id)
    WHERE remaining_qty > 0;
CREATE INDEX IF NOT EXISTS idx_material_fifo_transactions_history
    ON public.material_fifo_transactions(transaction_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_material_fifo_transactions_item
    ON public.material_fifo_transactions(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_material_fifo_allocations_transaction
    ON public.material_fifo_allocations(transaction_id);

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND status::text = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_raw_material(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.items
        WHERE id = p_item_id
          AND lower(trim(category)) = 'raw material'
    );
$$;

CREATE OR REPLACE FUNCTION public.material_fifo_stock(p_item_id uuid)
RETURNS numeric(20,4)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(sum(remaining_qty), 0)::numeric(20,4)
    FROM public.material_fifo_lots
    WHERE item_id = p_item_id;
$$;

CREATE OR REPLACE FUNCTION public.material_fifo_result(
    p_transaction_id uuid,
    p_replayed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'transaction_id', transaction_record.id,
        'request_id', transaction_record.request_id,
        'stock_before', transaction_record.stock_before,
        'stock_after', transaction_record.stock_after,
        'allocations', coalesce((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'lot_id', allocation.lot_id,
                    'location', lot.location,
                    'received_date', lot.received_date,
                    'quantity', allocation.quantity
                ) ORDER BY lot.received_date, lot.created_at, lot.id
            )
            FROM public.material_fifo_allocations allocation
            JOIN public.material_fifo_lots lot ON lot.id = allocation.lot_id
            WHERE allocation.transaction_id = transaction_record.id
        ), '[]'::jsonb),
        'replayed', p_replayed
    )
    FROM public.material_fifo_transactions transaction_record
    WHERE transaction_record.id = p_transaction_id;
$$;

CREATE OR REPLACE VIEW public.material_fifo_stock_view
WITH (security_invoker = true)
AS
SELECT
    item.id AS item_id,
    item.sku,
    item.item_code,
    item.internal_product_code,
    item.item_name,
    item.category,
    item.uom,
    settings.min_qty,
    settings.max_qty,
    settings.remarks,
    coalesce(sum(lot.remaining_qty), 0)::numeric(20,4) AS stock_qty,
    count(lot.id) FILTER (WHERE lot.remaining_qty > 0) AS lot_count,
    CASE
        WHEN settings.min_qty IS NULL OR settings.max_qty IS NULL THEN 'NOT_CONFIGURED'
        WHEN coalesce(sum(lot.remaining_qty), 0) <= settings.min_qty THEN 'CRITICAL'
        WHEN coalesce(sum(lot.remaining_qty), 0) > settings.max_qty THEN 'OVER'
        ELSE 'NORMAL'
    END AS fifo_status
FROM public.items item
LEFT JOIN public.material_fifo_settings settings ON settings.item_id = item.id
LEFT JOIN public.material_fifo_lots lot
    ON lot.item_id = item.id AND lot.remaining_qty > 0
WHERE lower(trim(item.category)) = 'raw material'
GROUP BY item.id, settings.item_id, settings.min_qty, settings.max_qty, settings.remarks;

CREATE OR REPLACE FUNCTION public.receive_material_fifo(
    p_item_id uuid,
    p_location text,
    p_quantity numeric,
    p_received_date date,
    p_notes text,
    p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    existing_transaction_id uuid;
    transaction_id uuid;
    user_id uuid := auth.uid();
    stock_before numeric(20,4);
    normalized_location text := upper(trim(p_location));
BEGIN
    IF NOT public.is_active_user() THEN
        RAISE EXCEPTION 'MF_INACTIVE_USER:User tidak aktif';
    END IF;
    IF NOT public.is_raw_material(p_item_id) THEN
        RAISE EXCEPTION 'MF_NOT_RAW_MATERIAL:SKU bukan kategori Raw Material';
    END IF;
    IF p_request_id IS NULL THEN
        RAISE EXCEPTION 'MF_INVALID_REQUEST:Request ID wajib diisi';
    END IF;

    SELECT id INTO existing_transaction_id
    FROM public.material_fifo_transactions
    WHERE request_id = p_request_id;
    IF existing_transaction_id IS NOT NULL THEN
        RETURN public.material_fifo_result(existing_transaction_id, true);
    END IF;

    IF normalized_location IS NULL
       OR normalized_location !~ '^[A-Z]+[0-9]+\.[0-9]+$' THEN
        RAISE EXCEPTION 'MF_INVALID_LOCATION:Gunakan format seperti A1.1';
    END IF;
    IF p_quantity IS NULL OR p_quantity <= 0 OR scale(p_quantity) > 4 THEN
        RAISE EXCEPTION 'MF_INVALID_QUANTITY:Qty harus positif dan maksimal 4 desimal';
    END IF;
    IF p_received_date IS NULL THEN
        RAISE EXCEPTION 'MF_INVALID_DATE:Tanggal masuk wajib diisi';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_item_id::text, 0));
    stock_before := public.material_fifo_stock(p_item_id);

    INSERT INTO public.material_fifo_transactions (
        request_id, item_id, transaction_type, quantity, transaction_date,
        stock_before, stock_after, notes, created_by
    ) VALUES (
        p_request_id, p_item_id, 'IN', p_quantity, p_received_date,
        stock_before, stock_before + p_quantity, nullif(trim(p_notes), ''), user_id
    ) RETURNING id INTO transaction_id;

    INSERT INTO public.material_fifo_lots (
        item_id, inbound_transaction_id, location, received_date,
        initial_qty, remaining_qty, created_by
    ) VALUES (
        p_item_id, transaction_id, normalized_location, p_received_date,
        p_quantity, p_quantity, user_id
    );

    RETURN public.material_fifo_result(transaction_id, false);
EXCEPTION
    WHEN unique_violation THEN
        SELECT id INTO existing_transaction_id
        FROM public.material_fifo_transactions WHERE request_id = p_request_id;
        IF existing_transaction_id IS NOT NULL THEN
            RETURN public.material_fifo_result(existing_transaction_id, true);
        END IF;
        RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_material_fifo_issue(
    p_item_id uuid,
    p_quantity numeric,
    p_issue_method text,
    p_location text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    method text := upper(trim(p_issue_method));
    normalized_location text := upper(trim(p_location));
    available_qty numeric(20,4);
    needed_qty numeric(20,4) := p_quantity;
    lot_record record;
    take_qty numeric(20,4);
    allocations jsonb := '[]'::jsonb;
BEGIN
    IF NOT public.is_active_user() THEN
        RAISE EXCEPTION 'MF_INACTIVE_USER:User tidak aktif';
    END IF;
    IF NOT public.is_raw_material(p_item_id) THEN
        RAISE EXCEPTION 'MF_NOT_RAW_MATERIAL:SKU bukan kategori Raw Material';
    END IF;
    IF p_quantity IS NULL OR p_quantity <= 0 OR scale(p_quantity) > 4 THEN
        RAISE EXCEPTION 'MF_INVALID_QUANTITY:Qty harus positif dan maksimal 4 desimal';
    END IF;
    IF method NOT IN ('FIFO', 'MANUAL') THEN
        RAISE EXCEPTION 'MF_INVALID_METHOD:Pilih FIFO atau MANUAL';
    END IF;
    IF method = 'MANUAL' AND coalesce(normalized_location, '') = '' THEN
        RAISE EXCEPTION 'MF_INVALID_LOCATION:Lokasi manual wajib dipilih';
    END IF;

    SELECT coalesce(sum(remaining_qty), 0)::numeric(20,4)
    INTO available_qty
    FROM public.material_fifo_lots
    WHERE item_id = p_item_id AND remaining_qty > 0
      AND (method = 'FIFO' OR upper(location) = normalized_location);

    IF available_qty < p_quantity THEN
        RAISE EXCEPTION 'MF_INSUFFICIENT_STOCK:Stok tersedia %, diminta %',
            available_qty, p_quantity;
    END IF;

    FOR lot_record IN
        SELECT id, location, received_date, remaining_qty, created_at
        FROM public.material_fifo_lots
        WHERE item_id = p_item_id AND remaining_qty > 0
          AND (method = 'FIFO' OR upper(location) = normalized_location)
        ORDER BY received_date, created_at, id
    LOOP
        EXIT WHEN needed_qty <= 0;
        take_qty := least(needed_qty, lot_record.remaining_qty);
        allocations := allocations || jsonb_build_array(jsonb_build_object(
            'lot_id', lot_record.id,
            'location', lot_record.location,
            'received_date', lot_record.received_date,
            'quantity', take_qty
        ));
        needed_qty := needed_qty - take_qty;
    END LOOP;

    RETURN jsonb_build_object(
        'stock_before', public.material_fifo_stock(p_item_id),
        'stock_after', public.material_fifo_stock(p_item_id) - p_quantity,
        'allocations', allocations
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_material_fifo(
    p_item_id uuid,
    p_quantity numeric,
    p_issue_method text,
    p_location text,
    p_transaction_date date,
    p_notes text,
    p_request_id uuid,
    p_import_batch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    method text := upper(trim(p_issue_method));
    normalized_location text := upper(trim(p_location));
    existing_transaction_id uuid;
    transaction_id uuid;
    user_id uuid := auth.uid();
    stock_before numeric(20,4);
    available_qty numeric(20,4);
    needed_qty numeric(20,4) := p_quantity;
    take_qty numeric(20,4);
    lot_record record;
BEGIN
    IF NOT public.is_active_user() THEN
        RAISE EXCEPTION 'MF_INACTIVE_USER:User tidak aktif';
    END IF;
    IF NOT public.is_raw_material(p_item_id) THEN
        RAISE EXCEPTION 'MF_NOT_RAW_MATERIAL:SKU bukan kategori Raw Material';
    END IF;
    IF p_request_id IS NULL THEN
        RAISE EXCEPTION 'MF_INVALID_REQUEST:Request ID wajib diisi';
    END IF;

    SELECT id INTO existing_transaction_id
    FROM public.material_fifo_transactions WHERE request_id = p_request_id;
    IF existing_transaction_id IS NOT NULL THEN
        RETURN public.material_fifo_result(existing_transaction_id, true);
    END IF;

    IF p_quantity IS NULL OR p_quantity <= 0 OR scale(p_quantity) > 4 THEN
        RAISE EXCEPTION 'MF_INVALID_QUANTITY:Qty harus positif dan maksimal 4 desimal';
    END IF;
    IF method NOT IN ('FIFO', 'MANUAL') THEN
        RAISE EXCEPTION 'MF_INVALID_METHOD:Pilih FIFO atau MANUAL';
    END IF;
    IF method = 'MANUAL' AND coalesce(normalized_location, '') = '' THEN
        RAISE EXCEPTION 'MF_INVALID_LOCATION:Lokasi manual wajib dipilih';
    END IF;
    IF p_transaction_date IS NULL THEN
        RAISE EXCEPTION 'MF_INVALID_DATE:Tanggal transaksi wajib diisi';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_item_id::text, 0));
    stock_before := public.material_fifo_stock(p_item_id);

    SELECT coalesce(sum(remaining_qty), 0)::numeric(20,4)
    INTO available_qty
    FROM public.material_fifo_lots
    WHERE item_id = p_item_id AND remaining_qty > 0
      AND (method = 'FIFO' OR upper(location) = normalized_location);

    IF available_qty < p_quantity THEN
        RAISE EXCEPTION 'MF_INSUFFICIENT_STOCK:Stok tersedia %, diminta %',
            available_qty, p_quantity;
    END IF;

    INSERT INTO public.material_fifo_transactions (
        request_id, item_id, transaction_type, issue_method, quantity,
        transaction_date, selected_location, stock_before, stock_after,
        notes, import_batch_id, created_by
    ) VALUES (
        p_request_id, p_item_id, 'OUT', method, p_quantity,
        p_transaction_date,
        CASE WHEN method = 'MANUAL' THEN normalized_location ELSE NULL END,
        stock_before, stock_before - p_quantity,
        nullif(trim(p_notes), ''), p_import_batch_id, user_id
    ) RETURNING id INTO transaction_id;

    FOR lot_record IN
        SELECT id, remaining_qty
        FROM public.material_fifo_lots
        WHERE item_id = p_item_id AND remaining_qty > 0
          AND (method = 'FIFO' OR upper(location) = normalized_location)
        ORDER BY received_date, created_at, id
        FOR UPDATE
    LOOP
        EXIT WHEN needed_qty <= 0;
        take_qty := least(needed_qty, lot_record.remaining_qty);
        UPDATE public.material_fifo_lots
        SET remaining_qty = remaining_qty - take_qty, updated_at = now()
        WHERE id = lot_record.id;
        INSERT INTO public.material_fifo_allocations(transaction_id, lot_id, quantity)
        VALUES (transaction_id, lot_record.id, take_qty);
        needed_qty := needed_qty - take_qty;
    END LOOP;

    RETURN public.material_fifo_result(transaction_id, false);
EXCEPTION
    WHEN unique_violation THEN
        SELECT id INTO existing_transaction_id
        FROM public.material_fifo_transactions WHERE request_id = p_request_id;
        IF existing_transaction_id IS NOT NULL THEN
            RETURN public.material_fifo_result(existing_transaction_id, true);
        END IF;
        RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_material_fifo_settings(
    p_item_id uuid,
    p_min_qty numeric,
    p_max_qty numeric,
    p_remarks text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE user_id uuid := auth.uid();
BEGIN
    IF NOT public.is_active_user() THEN
        RAISE EXCEPTION 'MF_INACTIVE_USER:User tidak aktif';
    END IF;
    IF NOT public.is_raw_material(p_item_id) THEN
        RAISE EXCEPTION 'MF_NOT_RAW_MATERIAL:SKU bukan kategori Raw Material';
    END IF;
    IF p_min_qty IS NULL OR p_max_qty IS NULL OR p_min_qty < 0 OR p_max_qty < p_min_qty
       OR scale(p_min_qty) > 4 OR scale(p_max_qty) > 4 THEN
        RAISE EXCEPTION 'MF_INVALID_MIN_MAX:MIN dan MAX tidak valid';
    END IF;

    INSERT INTO public.material_fifo_settings(
        item_id, min_qty, max_qty, remarks, updated_by
    ) VALUES (
        p_item_id, p_min_qty, p_max_qty, nullif(trim(p_remarks), ''), user_id
    )
    ON CONFLICT (item_id) DO UPDATE SET
        min_qty = excluded.min_qty,
        max_qty = excluded.max_qty,
        remarks = excluded.remarks,
        updated_by = excluded.updated_by,
        updated_at = now();

    RETURN (SELECT to_jsonb(setting) FROM public.material_fifo_settings setting
            WHERE setting.item_id = p_item_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_raw_material_item(
    p_sku text,
    p_item_code text,
    p_internal_product_code text,
    p_item_name text,
    p_uom text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    new_item public.items%rowtype;
    user_id uuid := auth.uid();
BEGIN
    IF NOT public.is_active_user() THEN
        RAISE EXCEPTION 'MF_INACTIVE_USER:User tidak aktif';
    END IF;
    IF coalesce(trim(p_sku), '') = '' OR coalesce(trim(p_item_code), '') = ''
       OR coalesce(trim(p_internal_product_code), '') = ''
       OR coalesce(trim(p_item_name), '') = '' OR coalesce(trim(p_uom), '') = '' THEN
        RAISE EXCEPTION 'MF_REQUIRED_FIELDS:Semua data master SKU wajib diisi';
    END IF;

    INSERT INTO public.items(
        sku, item_code, internal_product_code, item_name,
        category, uom, created_by
    ) VALUES (
        trim(p_sku), trim(p_item_code), trim(p_internal_product_code),
        trim(p_item_name), 'Raw Material', upper(trim(p_uom)), user_id
    ) RETURNING * INTO new_item;

    RETURN to_jsonb(new_item);
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'MF_DUPLICATE_IDENTIFIER:SKU, item code, atau internal product code sudah digunakan';
END;
$$;

ALTER TABLE public.material_fifo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_fifo_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_fifo_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_fifo_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS material_fifo_settings_active_read ON public.material_fifo_settings;
CREATE POLICY material_fifo_settings_active_read ON public.material_fifo_settings
    FOR SELECT TO authenticated USING (public.is_active_user());
DROP POLICY IF EXISTS material_fifo_transactions_active_read ON public.material_fifo_transactions;
CREATE POLICY material_fifo_transactions_active_read ON public.material_fifo_transactions
    FOR SELECT TO authenticated USING (public.is_active_user());
DROP POLICY IF EXISTS material_fifo_lots_active_read ON public.material_fifo_lots;
CREATE POLICY material_fifo_lots_active_read ON public.material_fifo_lots
    FOR SELECT TO authenticated USING (public.is_active_user());
DROP POLICY IF EXISTS material_fifo_allocations_active_read ON public.material_fifo_allocations;
CREATE POLICY material_fifo_allocations_active_read ON public.material_fifo_allocations
    FOR SELECT TO authenticated USING (public.is_active_user());

REVOKE ALL ON public.material_fifo_settings FROM anon, authenticated;
REVOKE ALL ON public.material_fifo_transactions FROM anon, authenticated;
REVOKE ALL ON public.material_fifo_lots FROM anon, authenticated;
REVOKE ALL ON public.material_fifo_allocations FROM anon, authenticated;
GRANT SELECT ON public.material_fifo_settings TO authenticated;
GRANT SELECT ON public.material_fifo_transactions TO authenticated;
GRANT SELECT ON public.material_fifo_lots TO authenticated;
GRANT SELECT ON public.material_fifo_allocations TO authenticated;
GRANT SELECT ON public.material_fifo_stock_view TO authenticated;

REVOKE ALL ON FUNCTION public.receive_material_fifo(uuid,text,numeric,date,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_material_fifo_issue(uuid,numeric,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_material_fifo(uuid,numeric,text,text,date,text,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_material_fifo_settings(uuid,numeric,numeric,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_raw_material_item(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_material_fifo(uuid,text,numeric,date,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_material_fifo_issue(uuid,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_material_fifo(uuid,numeric,text,text,date,text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_material_fifo_settings(uuid,numeric,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_raw_material_item(text,text,text,text,text) TO authenticated;

DO $$
DECLARE table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'material_fifo_settings', 'material_fifo_lots', 'material_fifo_transactions'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = table_name
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
        END IF;
    END LOOP;
END;
$$;

COMMIT;
