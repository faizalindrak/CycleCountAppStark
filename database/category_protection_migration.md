# Category Protection Implementation Plan

## Problem Analysis
Categories that are already used in items can currently be deleted, creating orphaned references in the items table. This needs to be prevented at both database and application levels.

## Current Database Structure
- `categories` table: stores category information
- `items` table: has a `category` field (TEXT) that stores category names (denormalized)
- `locations` table: has `category_id` foreign key to categories table with `ON DELETE RESTRICT`
- The locations table already has protection against deleting categories that have locations

## Solution Design

### 1. Database-Level Protection
Since the items table uses denormalized category names instead of foreign keys, we need to implement protection using:

**Option A: Trigger-based Protection**
```sql
-- Function to check if category is used in items before deletion
CREATE OR REPLACE FUNCTION prevent_category_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if category is used in items table
    IF EXISTS (SELECT 1 FROM items WHERE category = OLD.name) THEN
        RAISE EXCEPTION 'Cannot delete category "%" because it is used by existing items', OLD.name;
    END IF;

    -- Check if category has associated locations (already protected by FK constraint)
    -- This is handled by the existing foreign key constraint on locations.category_id

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent category deletion when in use
DROP TRIGGER IF EXISTS prevent_category_deletion_trigger ON categories;
CREATE TRIGGER prevent_category_deletion_trigger
    BEFORE DELETE ON categories
    FOR EACH ROW EXECUTE FUNCTION prevent_category_deletion();
```

**Option B: View-based Validation**
Create a view that shows category usage for application-level checking:
```sql
-- View to track category usage
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
    END as is_in_use
FROM categories c
LEFT JOIN items i ON i.category = c.name
LEFT JOIN locations l ON l.category_id = c.id
GROUP BY c.id, c.name, c.description;
```

### 2. Application-Level Protection
Add validation in the AdminDashboard before allowing category deletion:

```javascript
// Function to check category usage before deletion
const checkCategoryUsage = async (categoryId) => {
    try {
        // Get category name
        const { data: category, error: categoryError } = await supabase
            .from('categories')
            .select('name')
            .eq('id', categoryId)
            .single();

        if (categoryError) throw categoryError;

        // Check if category is used in items
        const { data: items, error: itemsError } = await supabase
            .from('items')
            .select('id, item_name, sku')
            .eq('category', category.name);

        if (itemsError) throw itemsError;

        // Check if category has locations
        const { data: locations, error: locationsError } = await supabase
            .from('locations')
            .select('id, name')
            .eq('category_id', categoryId);

        if (locationsError) throw locationsError;

        return {
            category: category.name,
            itemCount: items?.length || 0,
            locationCount: locations?.length || 0,
            items: items || [],
            locations: locations || [],
            canDelete: items.length === 0 && locations.length === 0
        };
    } catch (error) {
        console.error('Error checking category usage:', error);
        throw error;
    }
};

// Enhanced delete handler with usage checking
const handleDeleteCategory = async (categoryId) => {
    try {
        const usage = await checkCategoryUsage(categoryId);

        if (!usage.canDelete) {
            const message = `Cannot delete category "${usage.category}" because it is currently in use:\n\n` +
                (usage.itemCount > 0 ? `• Used by ${usage.itemCount} item(s)\n` : '') +
                (usage.locationCount > 0 ? `• Has ${usage.locationCount} location(s)\n` : '') +
                `\nPlease reassign or remove these dependencies before deleting the category.`;

            alert(message);
            return;
        }

        if (window.confirm(`Are you sure you want to delete the category "${usage.category}"?`)) {
            const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', categoryId);

            if (error) throw error;

            await fetchCategories();
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        alert('Error deleting category: ' + error.message);
    }
};
```

### 3. UI Enhancements
Add visual indicators and warnings in the AdminDashboard:

```jsx
// Enhanced category display with usage indicators
<div className="grid gap-6 md:grid-cols-2 mt-6">
    {categories.map((category) => {
        const itemCount = getCategoryItemCount(category.name);
        const locationCount = getCategoryLocationCount(category.id);
        const isInUse = itemCount > 0 || locationCount > 0;

        return (
            <div key={category.id} className={`bg-white p-4 rounded-lg shadow ${isInUse ? 'border-l-4 border-orange-500' : ''}`}>
                <div className="flex justify-between items-center border-b pb-2 mb-3">
                    <div>
                        <h4 className="font-bold text-gray-800">{category.name}</h4>
                        {isInUse && (
                            <div className="flex items-center gap-4 mt-1">
                                {itemCount > 0 && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                        {itemCount} item(s)
                                    </span>
                                )}
                                {locationCount > 0 && (
                                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                        {locationCount} location(s)
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => handleEditCategory(category)}
                            className="text-blue-500 hover:text-blue-700"
                            title="Edit Category"
                        >
                            <Edit className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className={`hover:text-red-700 ${isInUse ? 'text-gray-400 cursor-not-allowed' : 'text-red-500'}`}
                            title={isInUse ? 'Cannot delete category that is in use' : 'Delete Category'}
                            disabled={isInUse}
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                {/* Rest of category display */}
            </div>
        );
    })}
</div>
```

## Implementation Steps

### Step 1: Database Migration
Create and run the migration script to add database-level protection.

### Step 2: Backend Function
Add the `checkCategoryUsage` function to the supabase.js utilities.

### Step 3: UI Updates
Update the AdminDashboard CategoriesManager component with:
- Category usage checking
- Visual indicators for categories in use
- Enhanced delete confirmation with usage details
- Disabled delete buttons for categories in use

### Step 4: Testing
Test various scenarios:
- Delete category with no dependencies ✅
- Delete category with items only ❌
- Delete category with locations only ❌
- Delete category with both items and locations ❌
- Bulk operations and edge cases

## Migration Script

```sql
-- Category Protection Migration
-- Run this after backing up your database

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
```

## Benefits of This Approach

1. **Database-level Protection**: Prevents accidental deletion at the lowest level
2. **Application-level Validation**: Provides user-friendly error messages and guidance
3. **UI Feedback**: Visual indicators help users understand why categories cannot be deleted
4. **Comprehensive Coverage**: Protects against both item references and location dependencies
5. **Backward Compatibility**: Works with existing data structure (denormalized categories)
6. **Performance**: Efficient queries with proper indexing

## Rollback Plan

If needed, the migration can be reversed:

```sql
DROP TRIGGER IF EXISTS prevent_category_deletion_trigger ON categories;
DROP FUNCTION IF EXISTS prevent_category_deletion();
DROP VIEW IF EXISTS category_usage;