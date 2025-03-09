/*
  # Recipe Sharing Permissions Update

  1. Changes
    - Add policy to ensure users can only share their own recipes
    - Update shared_recipes policies for better access control
    - Add indexes for better query performance

  2. Security
    - Restrict sharing to recipe owners only
    - Maintain existing access control for shared recipes
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can share their own recipes" ON shared_recipes;

-- Create new policy with ownership check
CREATE POLICY "Users can share their own recipes"
  ON shared_recipes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_id
      AND recipes.user_id = auth.uid()
    )
    AND shared_by = auth.uid()
  );

-- Add policy for updating shared recipes
CREATE POLICY "Users can update their shared recipes"
  ON shared_recipes FOR UPDATE
  TO authenticated
  USING (shared_by = auth.uid())
  WITH CHECK (shared_by = auth.uid());

-- Add policy for deleting shared recipes
CREATE POLICY "Users can delete their shared recipes"
  ON shared_recipes FOR DELETE
  TO authenticated
  USING (shared_by = auth.uid());

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shared_recipes_recipe_id ON shared_recipes(recipe_id);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_shared_by ON shared_recipes(shared_by);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_shared_email ON shared_recipes(shared_email);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_is_public ON shared_recipes(is_public);

-- Add comment explaining the sharing rules
COMMENT ON TABLE shared_recipes IS 'Stores recipe sharing information. Users can only share recipes they own.';