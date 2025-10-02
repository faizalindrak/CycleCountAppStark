-- =====================================================
-- Add internal_product_code column to items table
-- Migration: 2025-10-02 - Add internal product code for scanning
-- =====================================================

BEGIN;

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

COMMIT;