/*
  # Make tags global across all users

  1. Changes
    - Remove user_id constraint from tags table
    - Update policies to allow all users to access tags
    - Add migration to handle existing tags
  2. Security
    - Update RLS policies for tags and recipe_tags
*/

-- First, create a temporary table to store unique tag names
CREATE TEMPORARY TABLE unique_tags AS
SELECT DISTINCT ON (lower(name)) 
  id,
  name,
  created_at
FROM tags
ORDER BY lower(name), created_at;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own tags" ON tags;
DROP POLICY IF EXISTS "Users can create their own tags" ON tags;
DROP POLICY IF EXISTS "Users can update their own tags" ON tags;
DROP POLICY IF EXISTS "Users can delete their own tags" ON tags;

-- Drop the unique constraint that includes user_id
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_user_id_key;

-- Add a new unique constraint on name only
ALTER TABLE tags ADD CONSTRAINT tags_name_key UNIQUE (name);

-- Remove the user_id column reference to auth.users
ALTER TABLE tags DROP COLUMN IF EXISTS user_id;

-- Create new policies for global tags
CREATE POLICY "Tags are viewable by all authenticated users"
  ON tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tags"
  ON tags FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tags"
  ON tags FOR DELETE
  TO authenticated
  USING (true);

-- Clear the tags table
TRUNCATE tags CASCADE;

-- Reinsert the unique tags
INSERT INTO tags (id, name, created_at)
SELECT id, name, created_at FROM unique_tags;

-- Drop the temporary table
DROP TABLE unique_tags;

-- Update recipe_tags policies
DROP POLICY IF EXISTS "Users can view recipe tags" ON recipe_tags;
DROP POLICY IF EXISTS "Users can manage tags for their recipes" ON recipe_tags;

CREATE POLICY "Users can view all recipe tags"
  ON recipe_tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage tags for their recipes"
  ON recipe_tags FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM recipes
    WHERE recipes.id = recipe_tags.recipe_id
    AND recipes.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete tags from their recipes"
  ON recipe_tags FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM recipes
    WHERE recipes.id = recipe_tags.recipe_id
    AND recipes.user_id = auth.uid()
  ));