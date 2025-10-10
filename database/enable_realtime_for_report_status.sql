-- Enable Realtime for report_status_raw_mat table
ALTER PUBLICATION supabase_realtime ADD TABLE report_status_raw_mat;

-- Enable Realtime for profiles table
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Enable Realtime for items table
ALTER PUBLICATION supabase_realtime ADD TABLE items;

-- Set up Row Level Security (RLS) policies for real-time subscriptions
-- These policies ensure users can only subscribe to changes they're allowed to see

-- Policy for report_status_raw_mat table
-- Users can see all report status records (assuming this is the intended behavior)
-- Adjust as needed based on your security requirements
CREATE POLICY "Users can subscribe to report_status_raw_mat changes" ON report_status_raw_mat
FOR SELECT USING (true);

-- Policy for profiles table
-- Users can see all profiles (for name display purposes)
-- Adjust as needed based on your security requirements
CREATE POLICY "Users can subscribe to profiles changes" ON profiles
FOR SELECT USING (true);

-- Policy for items table
-- Users can see all items (for category display purposes)
-- Adjust as needed based on your security requirements
CREATE POLICY "Users can subscribe to items changes" ON items
FOR SELECT USING (true);