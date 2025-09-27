# Warehouse Cycle Count App

A modern warehouse cycle counting application built with React, Vite, Tailwind CSS, and Supabase.

## Features

- **User Authentication**: Role-based authentication (Admin/Counter)
- **Session Management**: Create and manage cycle count sessions
- **Item Management**: Manage warehouse items with categories and locations
- **Real-time Counting**: Count items with location tracking
- **Reporting**: Export count data to CSV
- **Responsive Design**: Mobile-friendly interface

## Database Schema

### Tables to create in Supabase:

#### 1. `profiles` table
```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'counter')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### 2. `items` table
```sql
CREATE TABLE items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  uom TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view items" ON items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage items" ON items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### 3. `categories` table
```sql
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view categories" ON categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage categories" ON categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### 4. `locations` table
```sql
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, category_id)
);

-- Enable RLS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view locations" ON locations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage locations" ON locations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### 5. `sessions` table
```sql
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('daily', 'monthly', 'onetime')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view sessions" ON sessions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage sessions" ON sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### 6. `session_items` table (junction table)
```sql
CREATE TABLE session_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, item_id)
);

-- Enable RLS
ALTER TABLE session_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view session items" ON session_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage session items" ON session_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### 7. `session_users` table (junction table)
```sql
CREATE TABLE session_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- Enable RLS
ALTER TABLE session_users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their assigned sessions" ON session_users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all session users" ON session_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage session users" ON session_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### 8. `counts` table
```sql
CREATE TABLE counts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  location_id UUID REFERENCES locations(id),
  counted_qty INTEGER NOT NULL CHECK (counted_qty >= 0),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE counts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view counts for their sessions" ON counts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM session_users
      WHERE session_id = counts.session_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert counts for their sessions" ON counts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM session_users
      WHERE session_id = counts.session_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own counts" ON counts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all counts" ON counts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all counts" ON counts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### Indexes for Performance

```sql
-- Profiles
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_role ON profiles(role);

-- Items
CREATE INDEX idx_items_sku ON items(sku);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_item_code ON items(item_code);

-- Sessions
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_type ON sessions(type);
CREATE INDEX idx_sessions_created_date ON sessions(created_date);

-- Session Items
CREATE INDEX idx_session_items_session_id ON session_items(session_id);
CREATE INDEX idx_session_items_item_id ON session_items(item_id);

-- Session Users
CREATE INDEX idx_session_users_session_id ON session_users(session_id);
CREATE INDEX idx_session_users_user_id ON session_users(user_id);

-- Counts
CREATE INDEX idx_counts_session_id ON counts(session_id);
CREATE INDEX idx_counts_item_id ON counts(item_id);
CREATE INDEX idx_counts_user_id ON counts(user_id);
CREATE INDEX idx_counts_timestamp ON counts(timestamp);
```

### Functions and Triggers

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Setup Instructions

1. Create a new Supabase project
2. Run the SQL commands above in your Supabase SQL editor
3. Copy your project URL and anon key from Supabase dashboard
4. Create a `.env.local` file with:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
5. Install dependencies: `npm install`
6. Start development server: `npm run dev`

## Initial Data (Optional)

After setting up the database, you can insert some initial data:

```sql
-- Create admin user (you'll need to create this through the app after signup)
-- The first user to sign up should be made an admin manually in the profiles table

-- Insert sample categories
INSERT INTO categories (name) VALUES
  ('Electronics'),
  ('Components'),
  ('Tools'),
  ('Raw Materials');

-- Insert sample locations
INSERT INTO locations (name, category_id)
SELECT 'Rack A1', id FROM categories WHERE name = 'Electronics'
UNION ALL
SELECT 'Shelf B2', id FROM categories WHERE name = 'Electronics'
UNION ALL
SELECT 'Bin C3', id FROM categories WHERE name = 'Electronics'
UNION ALL
SELECT 'Pallet D4', id FROM categories WHERE name = 'Components'
UNION ALL
SELECT 'Bay E5', id FROM categories WHERE name = 'Components'
UNION ALL
SELECT 'Tool Cabinet F6', id FROM categories WHERE name = 'Tools'
UNION ALL
SELECT 'Workbench G7', id FROM categories WHERE name = 'Tools'
UNION ALL
SELECT 'Tank H8', id FROM categories WHERE name = 'Raw Materials'
UNION ALL
SELECT 'Drum I9', id FROM categories WHERE name = 'Raw Materials';

-- Insert sample items
INSERT INTO items (sku, item_code, item_name, uom, category, tags) VALUES
  ('SKU001', 'IC001', 'Widget A', 'PCS', 'Electronics', ARRAY['fragile', 'high-value']),
  ('SKU002', 'IC002', 'Component B', 'KG', 'Components', ARRAY['bulk', 'heavy']),
  ('SKU003', 'IC003', 'Tool C', 'PCS', 'Tools', ARRAY['metal', 'durable']),
  ('SKU004', 'IC004', 'Material D', 'M', 'Raw Materials', ARRAY['liquid', 'hazardous']),
  ('SKU005', 'IC005', 'Device E', 'PCS', 'Electronics', ARRAY['smart', 'wireless']);
```

## Environment Variables

Create a `.env.local` file in the root directory:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Features Overview

- **Authentication**: Secure login with role-based access control
- **Admin Dashboard**: Manage items, users, sessions, categories, and locations
- **Session Management**: Create cycle count sessions and assign users
- **Real-time Counting**: Count items with location tracking
- **Export Functionality**: Download count reports as CSV
- **Responsive Design**: Works on desktop and mobile devices