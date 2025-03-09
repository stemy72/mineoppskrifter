/*
  # Update global tags table

  1. Changes
    - Remove user_id column from global_tags table since tags are global values
    - Update policies to reflect global nature of tags
    - Add index on name for faster lookups

  2. Security
    - Enable RLS on global_tags table
    - Add policies for:
      - Select: All authenticated users can view global tags
      - Insert/Update/Delete: Only admin users can manage global tags
*/

-- Create global_tags table if it doesn't exist
CREATE TABLE IF NOT EXISTS global_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_global_tags_name ON global_tags(name);

-- Enable RLS
ALTER TABLE global_tags ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Global tags are viewable by all authenticated users"
  ON global_tags
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert global tags"
  ON global_tags
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT (raw_user_meta_data->>'is_admin')::boolean FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Only admins can update global tags"
  ON global_tags
  FOR UPDATE
  TO authenticated
  USING ((SELECT (raw_user_meta_data->>'is_admin')::boolean FROM auth.users WHERE id = auth.uid()))
  WITH CHECK ((SELECT (raw_user_meta_data->>'is_admin')::boolean FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Only admins can delete global tags"
  ON global_tags
  FOR DELETE
  TO authenticated
  USING ((SELECT (raw_user_meta_data->>'is_admin')::boolean FROM auth.users WHERE id = auth.uid()));