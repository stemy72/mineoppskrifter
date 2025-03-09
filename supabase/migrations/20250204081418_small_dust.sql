/*
  # Add policies for shared recipe ingredients

  1. Changes
    - Add policy to allow viewing ingredients for shared recipes
    - Update existing ingredients policy to include shared recipes access

  2. Security
    - Users can view ingredients for recipes shared with them
    - Users can view ingredients for public recipes
*/

-- Drop existing policy for ingredients
DROP POLICY IF EXISTS "Users can manage ingredients for their recipes" ON ingredients;

-- Create new policies for ingredients
CREATE POLICY "Users can manage their own recipe ingredients"
  ON ingredients FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM recipes
    WHERE recipes.id = ingredients.recipe_id
    AND recipes.user_id = auth.uid()
  ));

CREATE POLICY "Users can view ingredients for shared recipes"
  ON ingredients FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM recipes
    JOIN shared_recipes ON recipes.id = shared_recipes.recipe_id
    WHERE recipes.id = ingredients.recipe_id
    AND (
      shared_recipes.shared_email = auth.jwt()->>'email'
      OR shared_recipes.is_public = true
    )
  ));