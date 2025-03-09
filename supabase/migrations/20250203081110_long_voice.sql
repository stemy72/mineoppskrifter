/*
  # Add user ownership to tags

  1. Changes
    - Add user_id column to tags table
    - Update RLS policies to scope tags to their creators
    - Add foreign key constraint to auth.users

  2. Security
    - Enable RLS for tags table
    - Add policies for user-specific tag management
*/

-- Add user_id column to tags
ALTER TABLE tags 
ADD COLUMN user_id uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid();

-- Drop existing policies
DROP POLICY IF EXISTS "Tags are viewable by all authenticated users" ON tags;
DROP POLICY IF EXISTS "Authenticated users can create tags" ON tags;
DROP POLICY IF EXISTS "Authenticated users can delete tags" ON tags;

-- Create new policies for user-specific tag management
CREATE POLICY "Users can view their own tags"
  ON tags FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tags"
  ON tags FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own tags"
  ON tags FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Remove the default value after adding it
ALTER TABLE tags ALTER COLUMN user_id DROP DEFAULT;