/*
  # Fix Recipe Sharing System

  1. Changes
    - Add indexes for performance
    - Add validation trigger
    - Update RLS policies
    - Fix function naming conflicts

  2. Security
    - Proper RLS enforcement
    - Ownership validation
    - Email-based sharing
    - Public recipe handling
*/

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shared_recipes_recipe_id ON shared_recipes(recipe_id);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_shared_email ON shared_recipes(shared_email);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_is_public ON shared_recipes(is_public);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_shared_by ON shared_recipes(shared_by);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON recipe_tags(tag_id);

-- Create function to validate recipe ownership before sharing
CREATE OR REPLACE FUNCTION validate_recipe_share_trigger()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM recipes
    WHERE id = NEW.recipe_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only share recipes that you own';
  END IF;

  -- Set shared_by to current user
  NEW.shared_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for ownership validation
DROP TRIGGER IF EXISTS validate_recipe_share ON shared_recipes;
CREATE TRIGGER validate_recipe_share
  BEFORE INSERT ON shared_recipes
  FOR EACH ROW
  EXECUTE FUNCTION validate_recipe_share_trigger();

-- Drop existing policies
DROP POLICY IF EXISTS "Users can share their own recipes" ON shared_recipes;
DROP POLICY IF EXISTS "Users can view recipes shared with them" ON shared_recipes;
DROP POLICY IF EXISTS "Users can manage their shared recipes" ON shared_recipes;
DROP POLICY IF EXISTS "View shared recipes" ON shared_recipes;
DROP POLICY IF EXISTS "Share recipes" ON shared_recipes;
DROP POLICY IF EXISTS "Manage shared recipes" ON shared_recipes;

-- Create new policies for shared_recipes
CREATE POLICY "View shared recipes"
  ON shared_recipes
  FOR SELECT
  TO authenticated
  USING (
    shared_email = auth.jwt()->>'email' OR
    is_public = true OR
    shared_by = auth.uid()
  );

CREATE POLICY "Share own recipes"
  ON shared_recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Ownership check is handled by trigger

CREATE POLICY "Manage shared recipes"
  ON shared_recipes
  FOR DELETE
  TO authenticated
  USING (shared_by = auth.uid());

-- Update recipes policies
DROP POLICY IF EXISTS "Users can view recipes shared with them" ON recipes;

CREATE POLICY "View shared recipes"
  ON recipes
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    id IN (
      SELECT recipe_id 
      FROM shared_recipes
      WHERE shared_email = auth.jwt()->>'email' 
      OR is_public = true
    )
  );

-- Add comments
COMMENT ON FUNCTION validate_recipe_share_trigger IS 'Validates recipe ownership and sets shared_by field';
COMMENT ON INDEX idx_shared_recipes_recipe_id IS 'Index for faster recipe lookups in shared_recipes';
COMMENT ON INDEX idx_shared_recipes_shared_email IS 'Index for faster email-based sharing lookups';
COMMENT ON INDEX idx_shared_recipes_is_public IS 'Index for faster public recipe lookups';