-- Drop existing functions if they exist to avoid conflicts
DROP FUNCTION IF EXISTS get_accessible_recipes(text);
DROP FUNCTION IF EXISTS get_shared_recipes(text);
DROP FUNCTION IF EXISTS get_recipe_with_details(uuid, text);
DROP VIEW IF EXISTS accessible_recipes_view;

-- Create view for accessible recipes
CREATE OR REPLACE VIEW accessible_recipes_view AS
SELECT 
  r.id,
  r.title,
  r.description,
  r.image_url,
  r.image_data,
  r.created_at,
  r.user_id,
  r.servings,
  r.cooking_time,
  r.source_url,
  p.full_name AS author_name,
  p.avatar_data AS author_avatar,
  p.is_verified AS author_verified,
  sr.is_public,
  sr.shared_email,
  array_remove(array_agg(DISTINCT rt.tag_id), NULL) as tag_ids,
  array_remove(array_agg(DISTINCT t.name), NULL) as tag_names
FROM recipes r
LEFT JOIN profiles p ON r.user_id = p.id
LEFT JOIN shared_recipes sr ON r.id = sr.recipe_id
LEFT JOIN recipe_tags rt ON r.id = rt.recipe_id
LEFT JOIN tags t ON rt.tag_id = t.id
GROUP BY 
  r.id, 
  r.title, 
  r.description, 
  r.image_url, 
  r.image_data, 
  r.created_at, 
  r.user_id,
  r.servings,
  r.cooking_time,
  r.source_url,
  p.full_name,
  p.avatar_data,
  p.is_verified,
  sr.is_public,
  sr.shared_email;

-- Create function to get all accessible recipes for a user
CREATE OR REPLACE FUNCTION get_accessible_recipes(user_email text)
RETURNS SETOF accessible_recipes_view
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM accessible_recipes_view
  WHERE 
    user_id = auth.uid() OR
    shared_email = user_email OR
    is_public = true
  ORDER BY created_at DESC;
$$;

-- Create function to get shared recipes for a user
CREATE OR REPLACE FUNCTION get_shared_recipes(user_email text)
RETURNS SETOF accessible_recipes_view
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM accessible_recipes_view
  WHERE 
    (shared_email = user_email OR is_public = true)
    AND user_id != auth.uid()
  ORDER BY created_at DESC;
$$;

-- Create function to get a single recipe with all details
CREATE OR REPLACE FUNCTION get_recipe_with_details(recipe_id uuid, user_email text)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  instructions text,
  image_url text,
  image_data text,
  created_at timestamptz,
  user_id uuid,
  servings integer,
  cooking_time integer,
  source_url text,
  author_name text,
  author_avatar text,
  author_verified boolean,
  is_public boolean,
  shared_email text,
  tag_ids uuid[],
  tag_names text[],
  ingredients jsonb,
  additional_images jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has access to this recipe
  IF NOT EXISTS (
    SELECT 1 FROM recipes r
    LEFT JOIN shared_recipes sr ON r.id = sr.recipe_id
    WHERE r.id = recipe_id
    AND (
      r.user_id = auth.uid() OR
      sr.shared_email = user_email OR
      sr.is_public = true
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    r.id,
    r.title,
    r.description,
    r.instructions,
    r.image_url,
    r.image_data,
    r.created_at,
    r.user_id,
    r.servings,
    r.cooking_time,
    r.source_url,
    p.full_name AS author_name,
    p.avatar_data AS author_avatar,
    p.is_verified AS author_verified,
    sr.is_public,
    sr.shared_email,
    array_remove(array_agg(DISTINCT rt.tag_id), NULL) as tag_ids,
    array_remove(array_agg(DISTINCT t.name), NULL) as tag_names,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'name', i.name,
          'amount', i.amount,
          'unit', i.unit,
          'is_section', i.is_section
        )
      )
      FROM ingredients i
      WHERE i.recipe_id = r.id
    ) AS ingredients,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ri.id,
          'image_url', ri.image_url,
          'order', ri.order
        )
      )
      FROM recipe_images ri
      WHERE ri.recipe_id = r.id
      ORDER BY ri.order
    ) AS additional_images
  FROM recipes r
  LEFT JOIN profiles p ON r.user_id = p.id
  LEFT JOIN shared_recipes sr ON r.id = sr.recipe_id
  LEFT JOIN recipe_tags rt ON r.id = rt.recipe_id
  LEFT JOIN tags t ON rt.tag_id = t.id
  WHERE r.id = recipe_id
  GROUP BY 
    r.id, 
    r.title, 
    r.description, 
    r.instructions,
    r.image_url, 
    r.image_data, 
    r.created_at, 
    r.user_id,
    r.servings,
    r.cooking_time,
    r.source_url,
    p.full_name,
    p.avatar_data,
    p.is_verified,
    sr.is_public,
    sr.shared_email;
END;
$$;

-- Create indexes to optimize view performance
CREATE INDEX IF NOT EXISTS idx_shared_recipes_composite_access 
ON shared_recipes(recipe_id, shared_email, is_public);

CREATE INDEX IF NOT EXISTS idx_recipes_user_created 
ON recipes(user_id, created_at DESC);

-- Grant necessary permissions
GRANT SELECT ON accessible_recipes_view TO authenticated;
GRANT EXECUTE ON FUNCTION get_accessible_recipes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_recipes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recipe_with_details(uuid, text) TO authenticated;

-- Add comments
COMMENT ON VIEW accessible_recipes_view IS 'View that joins recipes with related data for efficient access';
COMMENT ON FUNCTION get_accessible_recipes IS 'Returns all recipes a user has access to with optimized performance';
COMMENT ON FUNCTION get_shared_recipes IS 'Returns only recipes shared with the user by others';
COMMENT ON FUNCTION get_recipe_with_details IS 'Returns a single recipe with all details including ingredients and images';