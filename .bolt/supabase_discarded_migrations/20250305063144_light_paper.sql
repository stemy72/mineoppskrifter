-- Fix issue with materialized view refresh

-- Drop and recreate the materialized view with proper indexing for concurrent refresh
DROP MATERIALIZED VIEW IF EXISTS shared_recipes_view CASCADE;

-- Recreate functions that depend on the view
DROP FUNCTION IF EXISTS get_shared_recipes_with_tags;

-- Create the materialized view with a proper unique index
CREATE MATERIALIZED VIEW shared_recipes_view AS
SELECT 
  r.id,
  r.title,
  r.description,
  r.image_url,
  r.image_data,
  r.created_at,
  r.user_id,
  r.is_favorite,
  p.full_name as author_name,
  p.avatar_data as author_avatar,
  COALESCE(p.is_verified, false) as author_verified,
  sr.shared_email,
  sr.is_public,
  sr.id AS shared_recipe_id, -- Add this as a unique identifier
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

-- Create a simple, robust unique index for concurrent refresh
CREATE UNIQUE INDEX idx_shared_recipes_view_pk ON shared_recipes_view(shared_recipe_id);

-- Create additional indexes for query performance
CREATE INDEX idx_shared_recipes_view_shared_email ON shared_recipes_view(shared_email);
CREATE INDEX idx_shared_recipes_view_is_public ON shared_recipes_view(is_public);
CREATE INDEX idx_shared_recipes_view_tag_ids ON shared_recipes_view USING GIN(tag_ids);

-- Recreate function to use the view
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
  is_favorite boolean,
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
    srv.is_favorite,
    srv.tag_ids,
    srv.tag_names
  FROM shared_recipes_view srv
  WHERE (srv.shared_email = user_email OR srv.is_public = true)
    AND (tag_filter IS NULL OR srv.tag_ids && tag_filter)
  ORDER BY srv.created_at DESC;
$$;

-- Recreate function for refreshing the view - with proper error handling
CREATE OR REPLACE FUNCTION refresh_shared_recipes_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    -- Try to refresh concurrently
    REFRESH MATERIALIZED VIEW CONCURRENTLY shared_recipes_view;
  EXCEPTION WHEN OTHERS THEN
    -- If concurrent refresh fails, fall back to regular refresh
    REFRESH MATERIALIZED VIEW shared_recipes_view;
  END;
  RETURN NULL;
END;
$$;

-- Recreate triggers to refresh the view
DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_recipe_change ON recipes;
DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_shared_recipe_change ON shared_recipes;
DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_tag_change ON recipe_tags;
DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_profile_change ON profiles;

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
GRANT SELECT ON shared_recipes_view TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_shared_recipes_with_tags(text, uuid[]) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION refresh_shared_recipes_view() TO authenticated, anon, service_role;

-- Do the initial refresh
REFRESH MATERIALIZED VIEW shared_recipes_view;

-- Make sure favorite updating permissions are set up correctly
DO $$ 
BEGIN
  -- Ensure is_favorite column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'recipes' AND column_name = 'is_favorite'
  ) THEN
    ALTER TABLE recipes ADD COLUMN is_favorite BOOLEAN DEFAULT false;
    
    CREATE INDEX idx_recipes_is_favorite ON recipes(user_id, is_favorite);
  END IF;

  -- Create policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'recipes' AND policyname = 'Users can update is_favorite status of their recipes'
  ) THEN
    CREATE POLICY "Users can update is_favorite status of their recipes"
      ON recipes FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Grant specific column permission
GRANT UPDATE(is_favorite) ON recipes TO authenticated;