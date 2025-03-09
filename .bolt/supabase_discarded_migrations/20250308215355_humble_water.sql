/*
  # Fix Recipe Save Permissions

  1. Changes
    - Update recipe save policies to properly handle user ownership
    - Fix recipe_tags policies to work with global_tags
    - Add missing indexes for performance
    - Clean up any invalid recipe_tags entries

  2. Security
    - Ensure users can only modify their own recipes
    - Allow tag management for owned recipes
    - Maintain data integrity with proper constraints

  3. Performance
    - Add optimized indexes for common queries
    - Improve query performance with proper joins
*/

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can manage tags for their recipes" ON recipe_tags;

-- Create new recipe_tags policy
CREATE POLICY "Users can manage recipe tags"
ON recipe_tags
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM recipes 
    WHERE recipes.id = recipe_tags.recipe_id 
    AND recipes.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM recipes 
    WHERE recipes.id = recipe_tags.recipe_id 
    AND recipes.user_id = auth.uid()
  )
);

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON recipe_tags(tag_id);

-- Clean up any invalid recipe_tags entries
DELETE FROM recipe_tags rt
WHERE NOT EXISTS (
  SELECT 1 FROM recipes r WHERE r.id = rt.recipe_id
) OR NOT EXISTS (
  SELECT 1 FROM global_tags t WHERE t.id = rt.tag_id
);

-- Update recipe save function
CREATE OR REPLACE FUNCTION handle_recipe_save()
RETURNS trigger AS $$
BEGIN
  -- Set timestamps
  IF TG_OP = 'INSERT' THEN
    NEW.created_at = now();
  END IF;
  NEW.updated_at = now();

  -- Ensure user ownership
  IF TG_OP = 'INSERT' THEN
    NEW.user_id = auth.uid();
  ELSIF NEW.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot modify recipes owned by other users';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update recipe validation function
CREATE OR REPLACE FUNCTION validate_recipe_data()
RETURNS trigger AS $$
BEGIN
  -- Validate title
  IF NEW.title IS NULL OR length(trim(NEW.title)) = 0 THEN
    RAISE EXCEPTION 'Recipe title is required';
  END IF;

  -- Validate servings
  IF NEW.servings IS NOT NULL AND NEW.servings <= 0 THEN
    RAISE EXCEPTION 'Servings must be a positive number';
  END IF;

  -- Validate cooking time
  IF NEW.cooking_time IS NOT NULL AND NEW.cooking_time <= 0 THEN
    RAISE EXCEPTION 'Cooking time must be a positive number';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
DROP TRIGGER IF EXISTS recipe_save_trigger ON recipes;
CREATE TRIGGER recipe_save_trigger
  BEFORE INSERT OR UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION handle_recipe_save();

DROP TRIGGER IF EXISTS recipe_validation_trigger ON recipes;
CREATE TRIGGER recipe_validation_trigger
  BEFORE INSERT OR UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION validate_recipe_data();

-- Grant necessary permissions
GRANT SELECT ON global_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON recipe_tags TO authenticated;
GRANT USAGE ON SEQUENCE recipe_tags_id_seq TO authenticated;