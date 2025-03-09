/*
  # Implement Recipe Save System

  1. Changes
    - Remove legacy tags table and related objects
    - Update recipe_tags to use global_tags exclusively
    - Add validation functions and triggers
    - Implement secure save operations
    - Clean up deprecated tag functionality

  2. Security
    - Enforce user ownership validation
    - Add RLS policies for recipe management
    - Validate data integrity constraints
    - Secure tag operations

  3. Performance
    - Add optimized indexes
    - Improve query performance
    - Enhance data validation efficiency
*/

-- Drop legacy tags table and related objects
DROP TABLE IF EXISTS tags CASCADE;

-- Drop obsolete functions and triggers
DROP FUNCTION IF EXISTS update_recipe_tags() CASCADE;
DROP FUNCTION IF EXISTS validate_tag_ownership() CASCADE;

-- Create function to validate recipe ownership
CREATE OR REPLACE FUNCTION validate_recipe_ownership()
RETURNS trigger AS $$
BEGIN
  -- Check if the user owns the recipe they're trying to modify
  IF NOT EXISTS (
    SELECT 1 FROM recipes 
    WHERE id = NEW.recipe_id 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only modify your own recipes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate recipe data
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

  -- Set default values
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create recipe save trigger
CREATE OR REPLACE FUNCTION handle_recipe_save()
RETURNS trigger AS $$
BEGIN
  -- Update timestamps
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at = now();
  END IF;

  -- Ensure user ownership
  IF TG_OP = 'INSERT' THEN
    NEW.user_id = auth.uid();
  ELSIF NEW.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot modify recipes owned by other users';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create recipe_tags validation trigger
CREATE OR REPLACE FUNCTION validate_recipe_tags()
RETURNS trigger AS $$
BEGIN
  -- Verify tag exists in global_tags
  IF NOT EXISTS (
    SELECT 1 FROM global_tags WHERE id = NEW.tag_id
  ) THEN
    RAISE EXCEPTION 'Invalid tag ID';
  END IF;

  -- Verify recipe ownership
  IF NOT EXISTS (
    SELECT 1 FROM recipes 
    WHERE id = NEW.recipe_id 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only add tags to your own recipes';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers
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

DROP TRIGGER IF EXISTS recipe_tags_validation_trigger ON recipe_tags;
CREATE TRIGGER recipe_tags_validation_trigger
  BEFORE INSERT OR UPDATE ON recipe_tags
  FOR EACH ROW
  EXECUTE FUNCTION validate_recipe_tags();

-- Update recipe_tags policies
DROP POLICY IF EXISTS "Users can manage tags for their recipes" ON recipe_tags;
CREATE POLICY "Users can manage tags for their recipes"
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

-- Add optimized indexes
CREATE INDEX IF NOT EXISTS idx_recipe_tags_composite 
  ON recipe_tags (recipe_id, tag_id);

CREATE INDEX IF NOT EXISTS idx_recipes_user_updated 
  ON recipes (user_id, updated_at DESC);

-- Grant necessary permissions
GRANT SELECT ON global_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON recipe_tags TO authenticated;

-- Clean up any orphaned recipe_tags
DELETE FROM recipe_tags rt
WHERE NOT EXISTS (
  SELECT 1 FROM recipes r WHERE r.id = rt.recipe_id
) OR NOT EXISTS (
  SELECT 1 FROM global_tags t WHERE t.id = rt.tag_id
);