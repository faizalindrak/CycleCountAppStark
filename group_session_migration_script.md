# Group Session Migration Script

This file contains the SQL commands to implement the group session feature in the cycle count application.

## Migration Up Script

```sql
-- Create group_sessions table
CREATE TABLE group_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Create group_session_users table
CREATE TABLE group_session_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  assigned_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_session_id, user_id)
);

-- Create group_session_items table
CREATE TABLE group_session_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  assigned_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_session_id, item_id)
);

-- Create indexes for performance
CREATE INDEX idx_group_sessions_session_id ON group_sessions(session_id);
CREATE INDEX idx_group_sessions_created_by ON group_sessions(created_by);
CREATE INDEX idx_group_session_users_group_session_id ON group_session_users(group_session_id);
CREATE INDEX idx_group_session_users_user_id ON group_session_users(user_id);
CREATE INDEX idx_group_session_items_group_session_id ON group_session_items(group_session_id);
CREATE INDEX idx_group_session_items_item_id ON group_session_items(item_id);

-- Enable Row Level Security (RLS)
ALTER TABLE group_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_session_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_session_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for group_sessions
CREATE POLICY "Users can view group sessions in their assigned sessions" ON group_sessions
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM session_users WHERE user_id = auth.uid()
      UNION
      SELECT id FROM sessions WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can manage group sessions" ON group_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for group_session_users
CREATE POLICY "Users can view their group session assignments" ON group_session_users
  FOR SELECT USING (
    user_id = auth.uid() OR
    assigned_by = auth.uid() OR
    group_session_id IN (
      SELECT gs.id FROM group_sessions gs
      JOIN sessions s ON gs.session_id = s.id
      WHERE s.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can manage group session user assignments" ON group_session_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for group_session_items
CREATE POLICY "Users can view group session items in their assigned sessions" ON group_session_items
  FOR SELECT USING (
    group_session_id IN (
      SELECT gsu.group_session_id FROM group_session_users gsu WHERE gsu.user_id = auth.uid()
      UNION
      SELECT gs.id FROM group_sessions gs
      JOIN sessions s ON gs.session_id = s.id
      WHERE s.created_by = auth.uid()
    )
  );

CREATE POLICY "Admins can manage group session items" ON group_session_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

## Migration Down Script

```sql
-- Drop tables in reverse order to handle foreign key constraints
DROP TABLE IF EXISTS group_session_items;
DROP TABLE IF EXISTS group_session_users;
DROP TABLE IF EXISTS group_sessions;
```

## Usage Instructions

1. **Run the migration up script** in your Supabase SQL editor or through the Supabase CLI
2. **Verify the tables are created** with the correct structure and policies
3. **Test the RLS policies** by logging in as different user types (admin vs counter)
4. **Proceed with application code changes** once the database schema is confirmed working

## Post-Migration Steps

1. Update your application code to use the new group session tables
2. Test the complete workflow from admin creating group sessions to counters using them
3. Update any existing data if needed (though this migration is additive and shouldn't affect existing functionality)
4. Consider running analytics on the new tables to ensure they're working correctly

## Troubleshooting

If you encounter issues:

1. **Check RLS policies** - Ensure users have appropriate permissions
2. **Verify foreign key relationships** - Make sure referenced tables exist
3. **Test with simple queries** first before implementing complex logic
4. **Check indexes** - Ensure performance is adequate for your data size