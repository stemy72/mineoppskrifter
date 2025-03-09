/*
  # Fix Shared Recipes View Permissions

  1. Permissions
    - Grant proper permissions on the materialized view to authenticated users
    - Update triggers to use security definer context
  
  2. Purpose
    - Resolves "must be owner of materialized view shared_recipes_view" error
    - Ensures authenticated users can perform operations that might refresh the view
  
  3. Details
    - Drops and recreates triggers with SECURITY DEFINER
    - Explicitly grants permissions to public role
*/

-- Drop existing triggers
DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_recipe_change ON recipes;
DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_shared_recipe_change ON shared_recipes;
DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_tag_change ON recipe_tags;
DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_profile_change ON profiles;

-- Update function to use security definer
CREATE OR REPLACE FUNCTION refresh_shared_recipes_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY shared_recipes_view;
  RETURN NULL;
END;
$$;

-- Create triggers with proper security context
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

-- Explicitly grant permissions to materialized view
GRANT SELECT ON shared_recipes_view TO authenticated;
GRANT SELECT ON shared_recipes_view TO anon;
GRANT SELECT ON shared_recipes_view TO service_role;

-- Grant execute permissions on related functions
GRANT EXECUTE ON FUNCTION refresh_shared_recipes_view() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_shared_recipes_view() TO anon;
GRANT EXECUTE ON FUNCTION refresh_shared_recipes_view() TO service_role;
GRANT EXECUTE ON FUNCTION get_shared_recipes_with_tags(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_recipes_with_tags(text, uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION get_shared_recipes_with_tags(text, uuid[]) TO service_role;

-- Fix permissions for functions that might be affected by the same issue
DO $$ 
BEGIN
  -- Update get_recipe_with_details function to use security definer if it exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_recipe_with_details') THEN
    ALTER FUNCTION get_recipe_with_details(uuid, text)
    SECURITY DEFINER
    SET search_path = public;
    
    GRANT EXECUTE ON FUNCTION get_recipe_with_details(uuid, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION get_recipe_with_details(uuid, text) TO anon;
    GRANT EXECUTE ON FUNCTION get_recipe_with_details(uuid, text) TO service_role;
  END IF;
END $$;