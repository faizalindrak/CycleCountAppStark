-- Add counted_qty_calculation column to store mathematical expressions
ALTER TABLE public.counts
ADD COLUMN counted_qty_calculation TEXT;

-- Add comment to explain the column purpose
COMMENT ON COLUMN public.counts.counted_qty_calculation IS 'Stores the mathematical expression used to calculate the counted quantity (e.g., "5*10+5*20")';

-- Create index for the new column for potential future queries
CREATE INDEX IF NOT EXISTS idx_counts_calculation ON public.counts USING gin (to_tsvector('english', counted_qty_calculation)) TABLESPACE pg_default;