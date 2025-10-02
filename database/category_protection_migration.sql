-- =====================================================
-- Category Protection Migration
-- Run this after backing up your database
-- =====================================================

BEGIN;

-- Create function to prevent category deletion when in use
CREATE OR REPLACE FUNCTION prevent_category_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if category is used in items table
    IF EXISTS (SELECT 1 FROM items WHERE category = OLD.name) THEN
        RAISE EXCEPTION 'Cannot delete category "%" because it is used by existing items', OLD.name;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent category deletion
DROP TRIGGER IF EXISTS prevent_category_deletion_trigger ON categories;
CREATE TRIGGER prevent_category_deletion_trigger
    BEFORE DELETE ON categories
    FOR EACH ROW EXECUTE FUNCTION prevent_category_deletion();

-- Create view for category usage tracking
CREATE OR REPLACE VIEW category_usage AS
SELECT
    c.id,
    c.name,
    c.description,
    COUNT(i.id) as item_count,
    COUNT(l.id) as location_count,
    CASE
        WHEN COUNT(i.id) > 0 OR COUNT(l.id) > 0 THEN true
        ELSE false
    END as is_in_use,
    c.created_at,
    c.updated_at
FROM categories c
LEFT JOIN items i ON i.category = c.name
LEFT JOIN locations l ON l.category_id = c.id
GROUP BY c.id, c.name, c.description, c.created_at, c.updated_at;

-- Grant access to the view for authenticated users
GRANT SELECT ON category_usage TO authenticated;

COMMIT;