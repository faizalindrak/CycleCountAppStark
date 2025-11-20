-- Migration for Item Groups feature
-- This migration creates tables to support item groups functionality

-- Create item_groups table
CREATE TABLE IF NOT EXISTS public.item_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create item_group_items junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.item_group_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_group_id UUID NOT NULL REFERENCES item_groups(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(item_group_id, item_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_item_groups_created_by ON public.item_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_item_groups_name ON public.item_groups(name);
CREATE INDEX IF NOT EXISTS idx_item_group_items_group_id ON public.item_group_items(item_group_id);
CREATE INDEX IF NOT EXISTS idx_item_group_items_item_id ON public.item_group_items(item_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.item_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_group_items ENABLE ROW LEVEL SECURITY;

-- Create policies for item_groups
-- Allow authenticated users to read all item groups
CREATE POLICY "Allow authenticated users to read item groups"
    ON public.item_groups
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert item groups
CREATE POLICY "Allow authenticated users to insert item groups"
    ON public.item_groups
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Allow users to update their own item groups
CREATE POLICY "Allow users to update their own item groups"
    ON public.item_groups
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by);

-- Allow users to delete their own item groups
CREATE POLICY "Allow users to delete their own item groups"
    ON public.item_groups
    FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by);

-- Create policies for item_group_items
-- Allow authenticated users to read all item group items
CREATE POLICY "Allow authenticated users to read item group items"
    ON public.item_group_items
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert item group items
CREATE POLICY "Allow authenticated users to insert item group items"
    ON public.item_group_items
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update item group items
CREATE POLICY "Allow authenticated users to update item group items"
    ON public.item_group_items
    FOR UPDATE
    TO authenticated
    USING (true);

-- Allow authenticated users to delete item group items
CREATE POLICY "Allow authenticated users to delete item group items"
    ON public.item_group_items
    FOR DELETE
    TO authenticated
    USING (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_item_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER item_groups_updated_at
    BEFORE UPDATE ON public.item_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_item_groups_updated_at();
