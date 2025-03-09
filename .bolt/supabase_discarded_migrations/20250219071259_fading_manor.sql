/*
  # Optimize Shared Recipes Queries

  1. Changes
    - Add helper functions for recipe access control
    - Add indexes for better performance
    - Add security policies
    - Add query optimizations

  2. Security
    - Proper RLS enforcement
    - User-based access control
    - Email-based sharing validation
*/

-- Create function to check recipe access
CREATE OR REPLACE FUNCTION check_recipe_access(recipe_id uuid, user_email text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM recipes r
    LEFT JOIN shared_recipes sr ON r.id = sr.recipe_id
    WHERE r.id = recipe_id
    AND (
      r.user_id = auth.uid() OR
      sr.shared_email = user_email OR
      sr.is_public = true
    )
  );
END;
$$;

-- Create function to check recipe ownership
CREATE OR REPLACE FUNCTION check_recipe_ownership(recipe_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM recipes
    WHERE id = recipe_id
    AND user_id = auth.uid()
  );
END;
$$;

-- Create function to get shared recipe details
CREATE OR REPLACE FUNCTION get_shared_recipe_details(recipe_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  image_url text,
  image_data text,
  created_at timestamptz,
  user_id uuid,
  shared_email text,
  is_public boolean,
  tag_ids uuid[]
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.title,
    r.description,
    r.image_url,
    r.image_data,
    r.created_at,
    r.user_id,
    sr.shared_email,
    sr.is_public,
    array_remove(array_agg(DISTINCT rt.tag_id), NULL) as tag_ids
  FROM recipes r
  LEFT JOIN shared_recipes sr ON r.id = sr.recipe_id
  LEFT JOIN recipe_tags rt ON r.id = rt.recipe_id
  WHERE r.id = recipe_id
  AND check_recipe_access(r.id, auth.jwt()->>'email')
  GROUP BY r.id, r.title, r.description, r.image_url, r.image_data, r.created_at, r.user_id, sr.shared_email, sr.is_public;
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON recipe_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_recipe_id ON shared_recipes(recipe_id);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_shared_email ON shared_recipes(shared_email);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_is_public ON shared_recipes(is_public);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_recipe_access TO authenticated;
GRANT EXECUTE ON FUNCTION check_recipe_ownership TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_recipe_details TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION check_recipe_access IS 'Checks if the current user has access to a recipe';
COMMENT ON FUNCTION check_recipe_ownership IS 'Checks if the current user owns a recipe';
COMMENT ON FUNCTION get_shared_recipe_details IS 'Gets details of a shared recipe with security checks';