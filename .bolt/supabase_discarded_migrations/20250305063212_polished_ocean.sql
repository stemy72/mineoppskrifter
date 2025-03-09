-- Create a stored procedure to handle favorite toggling without refreshing materialized views
CREATE OR REPLACE FUNCTION update_recipe_favorite(p_recipe_id UUID, p_is_favorite BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the is_favorite column directly
  UPDATE recipes
  SET is_favorite = p_is_favorite
  WHERE id = p_recipe_id
  AND user_id = auth.uid();
  
  -- No materialized view refresh needed here
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_recipe_favorite(UUID, BOOLEAN) TO authenticated;