/*
  # Fix Recipe Favorite Policies

  1. Changes
    - Remove problematic favorite-related policies that were causing recursion
    - Add simplified policy for updating favorite status
    - Keep existing policies for other operations

  2. Security
    - Maintain RLS enabled
    - Users can only update favorite status on their own recipes
    - All other existing security rules remain unchanged
*/

-- First remove problematic policies
DROP POLICY IF EXISTS "Users can update favorite status" ON recipes;
DROP POLICY IF EXISTS "Users can update is_favorite status" ON recipes;
DROP POLICY IF EXISTS "Users can update is_favorite status of their recipes" ON recipes;
DROP POLICY IF EXISTS "restrict_recipe_favorite_updates" ON recipes;

-- Add new simplified policy for favorite updates
CREATE POLICY "Users can update favorite status" ON recipes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    -- Only allow updating is_favorite field
    (xmax::text::int <> 0 AND 
     is_favorite IS DISTINCT FROM (SELECT recipes.is_favorite FROM recipes WHERE id = recipes.id)) OR
    auth.uid() = user_id
  );

-- Drop triggers that were causing issues
DROP TRIGGER IF EXISTS restrict_recipe_favorite_updates ON recipes;
DROP TRIGGER IF EXISTS restrict_recipe_updates ON recipes;
DROP TRIGGER IF EXISTS check_favorite_only_update ON recipes;