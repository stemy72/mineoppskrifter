/*
  # Shared Recipes View Implementation

  1. New View
    - `shared_recipes_view` - Materialized view for efficient shared recipe queries
    - Includes recipe details, author information, and tag arrays
  
  2. New Functions
    - `get_shared_recipes_with_tags` - Function to retrieve shared recipes with tag filtering
    - `refresh_shared_recipes_view` - Function to refresh the materialized view
  
  3. New Trigger
    - Automatically refreshes the view when relevant tables change
*/

-- Create materialized view for shared recipes
CREATE MATERIALIZED VIEW IF NOT EXISTS shared_recipes_view AS
SELECT 
  r.id,
  r.title,
  r.description,
  r.image_url,
  r.image_data,
  r.created_at,
  r.user_id,
  p.full_name as author_name,
  p.avatar_data as author_avatar,
  p.is_verified as author_verified,
  sr.shared_email,
  sr.is_public,
  ARRAY(
    SELECT rt.tag_id
    FROM recipe_tags rt
    WHERE rt.recipe_id = r.id
  ) as tag_ids,
  ARRAY(
    SELECT t.name
    FROM recipe_tags rt
    JOIN tags t ON rt.tag_id = t.id
    WHERE rt.recipe_id = r.id
  ) as tag_names
FROM recipes r
JOIN shared_recipes sr ON r.id = sr.recipe_id
LEFT JOIN profiles p ON r.user_id = p.id;

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_shared_recipes_view_shared_email 
ON shared_recipes_view(shared_email);

CREATE INDEX IF NOT EXISTS idx_shared_recipes_view_is_public 
ON shared_recipes_view(is_public);

-- Create GIN index for tag_ids array to enable efficient tag filtering
CREATE INDEX IF NOT EXISTS idx_shared_recipes_view_tag_ids 
ON shared_recipes_view USING GIN(tag_ids);

-- Function to get shared recipes with optional tag filtering
CREATE OR REPLACE FUNCTION get_shared_recipes_with_tags(
  user_email text,
  tag_filter uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  image_url text,
  image_data text,
  created_at timestamptz,
  user_id uuid,
  author_name text,
  author_avatar text,
  author_verified boolean,
  tag_ids uuid[],
  tag_names text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    srv.id,
    srv.title,
    srv.description,
    srv.image_url,
    srv.image_data,
    srv.created_at,
    srv.user_id,
    srv.author_name,
    srv.author_avatar,
    srv.author_verified,
    srv.tag_ids,
    srv.tag_names
  FROM shared_recipes_view srv
  WHERE (srv.shared_email = user_email OR srv.is_public = true)
    AND (tag_filter IS NULL OR srv.tag_ids && tag_filter)
  ORDER BY srv.created_at DESC;
$$;

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_shared_recipes_view()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY shared_recipes_view;
  RETURN NULL;
END;
$$;

-- Create triggers to refresh the view when relevant tables change
CREATE TRIGGER refresh_shared_recipes_view_on_recipe_change
AFTER INSERT OR UPDATE OR DELETE ON recipes
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_shared_recipes_view();

CREATE TRIGGER refresh_shared_recipes_view_on_shared_recipe_change
AFTER INSERT OR UPDATE OR DELETE ON shared_recipes
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_shared_recipes_view();

CREATE TRIGGER refresh_shared_recipes_view_on_tag_change
AFTER INSERT OR UPDATE OR DELETE ON recipe_tags
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_shared_recipes_view();

CREATE TRIGGER refresh_shared_recipes_view_on_profile_change
AFTER UPDATE ON profiles
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_shared_recipes_view();

-- Grant necessary permissions
GRANT SELECT ON shared_recipes_view TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_recipes_with_tags(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_shared_recipes_view() TO authenticated;

-- Add comments
COMMENT ON MATERIALIZED VIEW shared_recipes_view IS 'Pre-computed view of shared recipes with author and tag information';
COMMENT ON FUNCTION get_shared_recipes_with_tags IS 'Returns recipes shared with the specified user email, with optional tag filtering';
COMMENT ON FUNCTION refresh_shared_recipes_view IS 'Refreshes the shared_recipes_view materialized view';