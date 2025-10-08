-- =====================================================
-- Create report_status_raw_mat table
-- Migration: 2025-10-08 - Add table for raw material status reporting
-- =====================================================

BEGIN;

-- Create enum types for follow up status and inventory status
DO $$ BEGIN
    CREATE TYPE follow_up_status_enum AS ENUM ('open', 'on_progress', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE inventory_status_enum AS ENUM ('kritis', 'over');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the report_status_raw_mat table
CREATE TABLE IF NOT EXISTS public.report_status_raw_mat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_input DATE NOT NULL DEFAULT CURRENT_DATE,
    sku TEXT NOT NULL,
    internal_product_code VARCHAR(20) NOT NULL,
    item_name TEXT NOT NULL,
    inventory_status inventory_status_enum NOT NULL,
    remarks TEXT,
    qty INTEGER,
    follow_up_status follow_up_status_enum NOT NULL DEFAULT 'open',
    user_report UUID NOT NULL REFERENCES auth.users(id),
    user_follow_up UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_report_status_raw_mat_date_input ON report_status_raw_mat(date_input DESC);
CREATE INDEX IF NOT EXISTS idx_report_status_raw_mat_inventory_status ON report_status_raw_mat(inventory_status);
CREATE INDEX IF NOT EXISTS idx_report_status_raw_mat_follow_up_status ON report_status_raw_mat(follow_up_status);
CREATE INDEX IF NOT EXISTS idx_report_status_raw_mat_user_report ON report_status_raw_mat(user_report);
CREATE INDEX IF NOT EXISTS idx_report_status_raw_mat_sku ON report_status_raw_mat(sku);
CREATE INDEX IF NOT EXISTS idx_report_status_raw_mat_internal_product_code ON report_status_raw_mat(internal_product_code);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_report_status_raw_mat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger for updated_at
DROP TRIGGER IF EXISTS update_report_status_raw_mat_updated_at_trigger ON report_status_raw_mat;
CREATE TRIGGER update_report_status_raw_mat_updated_at_trigger
    BEFORE UPDATE ON report_status_raw_mat
    FOR EACH ROW EXECUTE FUNCTION update_report_status_raw_mat_updated_at();

-- Enable RLS
ALTER TABLE report_status_raw_mat ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view all reports (for transparency)
DROP POLICY IF EXISTS "Authenticated users can view report status" ON report_status_raw_mat;
CREATE POLICY "Authenticated users can view report status" ON report_status_raw_mat
    FOR SELECT USING (auth.role() = 'authenticated');

-- Users can insert their own reports
DROP POLICY IF EXISTS "Users can insert their own reports" ON report_status_raw_mat;
CREATE POLICY "Users can insert their own reports" ON report_status_raw_mat
    FOR INSERT WITH CHECK (auth.uid() = user_report);

-- Users can update their own reports
DROP POLICY IF EXISTS "Users can update their own reports" ON report_status_raw_mat;
CREATE POLICY "Users can update their own reports" ON report_status_raw_mat
    FOR UPDATE USING (auth.uid() = user_report)
    WITH CHECK (auth.uid() = user_report);

-- Admins can manage all reports
DROP POLICY IF EXISTS "Admins can manage all reports" ON report_status_raw_mat;
CREATE POLICY "Admins can manage all reports" ON report_status_raw_mat
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'admin' OR
        auth.jwt() -> 'user_metadata' ->> 'role' = 'admin' OR
        auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    );

COMMIT;