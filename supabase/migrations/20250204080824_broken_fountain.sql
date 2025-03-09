/*
  # Update sharing system to use emails

  1. Changes
    - Add shared_email column to shared_recipes table
    - Update policies to work with emails instead of user IDs
    - Add index on shared_email for better performance

  2. Security
    - Update RLS policies to handle email-based sharing
*/

-- Add shared_email column
ALTER TABLE shared_recipes
ADD COLUMN shared_email text;

-- Add index for better performance
CREATE INDEX idx_shared_recipes_email ON shared_recipes(shared_email);

-- Update policies for shared_recipes
DROP POLICY IF EXISTS "Users can view recipes shared with them" ON shared_recipes;
CREATE POLICY "Users can view recipes shared with them"
  ON shared_recipes FOR SELECT
  TO authenticated
  USING (
    shared_email = auth.jwt()->>'email' OR
    shared_by = auth.uid() OR
    is_public = true
  );

-- Update recipes policies
DROP POLICY IF EXISTS "Users can view recipes shared with them" ON recipes;
CREATE POLICY "Users can view recipes shared with them"
  ON recipes FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    id IN (
      SELECT recipe_id FROM shared_recipes
      WHERE shared_email = auth.jwt()->>'email' OR is_public = true
    )
  );