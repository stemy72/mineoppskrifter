-- Create function to delete recipe
CREATE OR REPLACE FUNCTION delete_recipe(p_recipe_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM recipes
    WHERE id = p_recipe_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Recipe not found or access denied';
  END IF;

  -- Delete recipe (will cascade to ingredients and tags)
  DELETE FROM recipes
  WHERE id = p_recipe_id
  AND user_id = auth.uid();
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION delete_recipe TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_recipe IS 'Deletes a recipe with security checks and cascading deletion of related data';