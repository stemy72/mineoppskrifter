/*
  # Create Shared Recipes View

  1. Changes
    - Create materialized view for shared recipes
    - Add refresh function and triggers
    - Add indexes for better performance

  2. Security
    - Ensure proper access control through RLS
    - Maintain data privacy
*/

-- Create materialized view for shared recipes
CREATE MATERIALIZED VIEW IF NOT EXISTS shared_recipes_view AS
SELECT DISTINCT
    r.id,
    r.title,
    r.description,
    r.instructions,
    r.image_url,
    r.image_data,
    r.source_url,
    r.servings,
    r.cooking_time,
    r.created_at,
    r.user_id,
    p.full_name as author_name,
    p.avatar_data as author_avatar,
    p.is_verified as author_verified,
    sr.shared_email,
    sr.is_public,
    array_agg(DISTINCT rt.tag_id) FILTER (WHERE rt.tag_id IS NOT NULL) as tag_ids,
    array_agg(DISTINCT gt.name) FILTER (WHERE gt.name IS NOT NULL) as tag_names
FROM recipes r
LEFT JOIN profiles p ON r.user_id = p.id
LEFT JOIN shared_recipes sr ON r.id = sr.recipe_id
LEFT JOIN recipe_tags rt ON r.id = rt.recipe_id
LEFT JOIN global_tags gt ON rt.tag_id = gt.id
WHERE sr.shared_email IS NOT NULL OR sr.is_public = true
GROUP BY 
    r.id,
    r.title,
    r.description,
    r.instructions,
    r.image_url,
    r.image_data,
    r.source_url,
    r.servings,
    r.cooking_time,
    r.created_at,
    r.user_id,
    p.full_name,
    p.avatar_data,
    p.is_verified,
    sr.shared_email,
    sr.is_public;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shared_recipes_view_created_at ON shared_recipes_view(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_view_shared_email ON shared_recipes_view(shared_email);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_view_is_public ON shared_recipes_view(is_public);

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_shared_recipes_view()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY shared_recipes_view;
    RETURN NULL;
END;
$$;

-- Create function to refresh the view when tags change
CREATE OR REPLACE FUNCTION refresh_shared_recipes_view_on_tag_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY shared_recipes_view;
    RETURN NULL;
END;
$$;

-- Create function to refresh the view when profile changes
CREATE OR REPLACE FUNCTION refresh_shared_recipes_view_on_profile_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY shared_recipes_view;
    RETURN NULL;
END;
$$;

-- Create function to refresh the view when shared recipe changes
CREATE OR REPLACE FUNCTION refresh_shared_recipes_view_on_shared_recipe_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY shared_recipes_view;
    RETURN NULL;
END;
$$;

-- Create triggers to refresh the view
DO $$ BEGIN
    -- Drop existing triggers if they exist
    DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_recipe_change ON recipes;
    DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_tag_change ON recipe_tags;
    DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_profile_change ON profiles;
    DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_shared_recipe_change ON shared_recipes;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Create new triggers
CREATE TRIGGER refresh_shared_recipes_view_on_recipe_change
    AFTER INSERT OR UPDATE OR DELETE ON recipes
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_shared_recipes_view();

CREATE TRIGGER refresh_shared_recipes_view_on_tag_change
    AFTER INSERT OR DELETE OR UPDATE ON recipe_tags
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_shared_recipes_view_on_tag_change();

CREATE TRIGGER refresh_shared_recipes_view_on_profile_change
    AFTER UPDATE ON profiles
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_shared_recipes_view_on_profile_change();

CREATE TRIGGER refresh_shared_recipes_view_on_shared_recipe_change
    AFTER INSERT OR DELETE OR UPDATE ON shared_recipes
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_shared_recipes_view_on_shared_recipe_change();

-- Do initial refresh of the view
REFRESH MATERIALIZED VIEW CONCURRENTLY shared_recipes_view;