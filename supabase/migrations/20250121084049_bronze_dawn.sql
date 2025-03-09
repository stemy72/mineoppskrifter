/*
  # Fix cooking logs RLS policies

  1. Changes
    - Drop and recreate cooking logs policies with correct conditions
    - Add policy for users to view cooking logs for recipes they can access
    - Fix policy for creating cooking logs
*/

-- Drop existing policies for cooking_logs
DROP POLICY IF EXISTS "Users can view their cooking logs" ON cooking_logs;
DROP POLICY IF EXISTS "Users can create their cooking logs" ON cooking_logs;
DROP POLICY IF EXISTS "Users can update their cooking logs" ON cooking_logs;
DROP POLICY IF EXISTS "Users can delete their cooking logs" ON cooking_logs;

-- Create new policies for cooking_logs
CREATE POLICY "Users can view cooking logs for accessible recipes"
  ON cooking_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = cooking_logs.recipe_id
      AND (recipes.user_id = auth.uid() OR cooking_logs.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create cooking logs for accessible recipes"
  ON cooking_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = cooking_logs.recipe_id
    )
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can update their own cooking logs"
  ON cooking_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cooking logs"
  ON cooking_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);