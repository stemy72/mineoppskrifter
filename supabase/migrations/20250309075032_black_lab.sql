/*
  # Fix Recipe Policies

  1. Changes
    - Remove all existing recipe policies that may cause recursion
    - Add new simplified policies for CRUD operations
    - Remove problematic triggers

  2. Security
    - Maintain RLS enabled
    - Users can only manage their own recipes
    - Shared recipes remain accessible based on sharing rules
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can update favorite status" ON recipes;
DROP POLICY IF EXISTS "Users can update is_favorite status" ON recipes;
DROP POLICY IF EXISTS "Users can update is_favorite status of their recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update their own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update their recipes" ON recipes;
DROP POLICY IF EXISTS "Users can view their own recipes" ON recipes;
DROP POLICY IF EXISTS "View shared recipes" ON recipes;

-- Drop problematic triggers
DROP TRIGGER IF EXISTS restrict_recipe_favorite_updates ON recipes;
DROP TRIGGER IF EXISTS restrict_recipe_updates ON recipes;
DROP TRIGGER IF EXISTS check_favorite_only_update ON recipes;
DROP TRIGGER IF EXISTS handle_favorite_update_trigger ON recipes;
DROP TRIGGER IF EXISTS refresh_recipes_view_on_favorite_change ON recipes;
DROP TRIGGER IF EXISTS restrict_to_favorite_update ON recipes;

-- Create new simplified policies
CREATE POLICY "Users can create their own recipes" ON recipes
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes" ON recipes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes" ON recipes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view accessible recipes" ON recipes
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM shared_recipes
      WHERE shared_recipes.recipe_id = recipes.id
      AND (
        shared_recipes.shared_email = auth.jwt()->>'email' OR
        shared_recipes.is_public = true
      )
    )
  );