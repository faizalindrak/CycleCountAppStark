# Group Session Feature Design Document

## Overview
This document outlines the implementation of group sessions within the cycle count application. Group sessions allow administrators to organize items within a session into logical groups and assign specific counters to these groups.

## Database Schema Changes

### New Tables

#### 1. `group_sessions`
```sql
CREATE TABLE group_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX idx_group_sessions_session_id ON group_sessions(session_id);
CREATE INDEX idx_group_sessions_created_by ON group_sessions(created_by);
```

#### 2. `group_session_users`
```sql
CREATE TABLE group_session_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  assigned_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_session_id, user_id)
);

-- Indexes
CREATE INDEX idx_group_session_users_group_session_id ON group_session_users(group_session_id);
CREATE INDEX idx_group_session_users_user_id ON group_session_users(user_id);
```

#### 3. `group_session_items`
```sql
CREATE TABLE group_session_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  assigned_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_session_id, item_id)
);

-- Indexes
CREATE INDEX idx_group_session_items_group_session_id ON group_session_items(group_session_id);
CREATE INDEX idx_group_session_items_item_id ON group_session_items(item_id);
```

## Modified Tables

### Update `sessions` table (if needed)
No changes required to existing sessions table.

## Database Migration Script

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

## Application Flow

### Admin Flow
1. Admin creates a session (existing functionality)
2. Admin creates group sessions within the session
3. Admin assigns items to group sessions
4. Admin assigns counters to group sessions

### Counter Flow
1. Counter selects a session (existing functionality)
2. Counter sees available group sessions they're assigned to
3. Counter selects a group session
4. Counter sees only items assigned to that group session
5. Counter counts items within the group session

## UI Components Needed

### New Components
1. **GroupSessionManager** - Admin interface for managing group sessions
2. **GroupSessionSelection** - Counter interface for selecting group sessions

### Modified Components
1. **AdminDashboard** - Add group session management tab
2. **SessionSelection** - Show group sessions for counters
3. **ItemsList** - Filter items based on selected group session
4. **App.jsx** - Handle group session selection flow

## API Endpoints Needed

### Group Session Management
- `GET /group-sessions?session_id={id}` - List group sessions in a session
- `POST /group-sessions` - Create new group session
- `PUT /group-sessions/{id}` - Update group session
- `DELETE /group-sessions/{id}` - Delete group session

### Group Session User Assignment
- `POST /group-session-users` - Assign user to group session
- `DELETE /group-session-users` - Remove user from group session

### Group Session Item Assignment
- `POST /group-session-items` - Assign item to group session
- `DELETE /group-session-items` - Remove item from group session

## Implementation Steps

1. **Database Setup**
   - Run migration script to create new tables
   - Set up RLS policies for security

2. **Backend Logic**
   - Create helper functions in supabase.js for group session operations
   - Update existing queries to work with group sessions

3. **Admin Interface**
   - Add group session management to AdminDashboard
   - Create GroupSessionManager component
   - Update session creation/editing to include group sessions

4. **Counter Interface**
   - Update SessionSelection to show group sessions
   - Create GroupSessionSelection component
   - Modify ItemsList to filter by group session

5. **Testing**
   - Test complete workflow from admin to counter
   - Verify data integrity and security

## Benefits

1. **Better Organization** - Items can be logically grouped within sessions
2. **Improved Efficiency** - Counters only see relevant items
3. **Flexible Assignment** - One counter can work on multiple group sessions
4. **Scalability** - Supports large sessions with many items and counters
5. **Security** - Proper RLS ensures users only see assigned data

## Future Enhancements

1. **Bulk Operations** - Bulk assign items/users to group sessions
2. **Progress Tracking** - Track completion at group session level
3. **Reporting** - Generate reports by group session
4. **Templates** - Save group session templates for reuse