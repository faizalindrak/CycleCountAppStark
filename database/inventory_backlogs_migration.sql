-- =====================================================
-- Inventory Backlog - paste this whole file into
-- Supabase Dashboard > SQL Editor, then click Run.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.inventory_backlogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    sku TEXT NOT NULL,
    item_name TEXT NOT NULL,
    uom TEXT,
    qty_backlog INTEGER NOT NULL CHECK (qty_backlog > 0),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supply_destination TEXT NOT NULL CHECK (length(trim(supply_destination)) > 0),
    backlog_notes TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_backlogs_transaction_date
    ON public.inventory_backlogs(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_backlogs_sku
    ON public.inventory_backlogs(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_backlogs_item_id
    ON public.inventory_backlogs(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_backlogs_created_by
    ON public.inventory_backlogs(created_by);

CREATE OR REPLACE FUNCTION public.update_inventory_backlogs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_backlogs_set_updated_at ON public.inventory_backlogs;
CREATE TRIGGER inventory_backlogs_set_updated_at
    BEFORE UPDATE ON public.inventory_backlogs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_inventory_backlogs_updated_at();

ALTER TABLE public.inventory_backlogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view inventory backlogs" ON public.inventory_backlogs;
CREATE POLICY "Authenticated users can view inventory backlogs"
    ON public.inventory_backlogs
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can insert their own inventory backlogs" ON public.inventory_backlogs;
CREATE POLICY "Users can insert their own inventory backlogs"
    ON public.inventory_backlogs
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their own inventory backlogs" ON public.inventory_backlogs;
CREATE POLICY "Users can update their own inventory backlogs"
    ON public.inventory_backlogs
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own inventory backlogs" ON public.inventory_backlogs;
CREATE POLICY "Users can delete their own inventory backlogs"
    ON public.inventory_backlogs
    FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by);

-- Enable Supabase Realtime once, without failing when already enabled.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'inventory_backlogs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_backlogs;
    END IF;
END $$;

COMMIT;
