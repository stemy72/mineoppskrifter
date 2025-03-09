/*
  # Fix shared recipes view permissions

  1. Changes
    - Grant proper permissions on shared_recipes_view to authenticated users
    - Set up RLS policies for shared recipes access
    - Grant execute permissions on refresh functions
    - Fix ownership and permissions chain

  2. Security
    - Ensures authenticated users can only access shared recipes they have permission to view
    - Maintains data isolation between users
    - Follows principle of least privilege
*/

-- First revoke any existing permissions to start clean
REVOKE ALL ON shared_recipes_view FROM authenticated;
REVOKE ALL ON FUNCTION refresh_shared_recipes_view() FROM authenticated;
REVOKE ALL ON FUNCTION refresh_shared_recipes_view_on_tag_change() FROM authenticated;
REVOKE ALL ON FUNCTION refresh_shared_recipes_view_on_profile_change() FROM authenticated;
REVOKE ALL ON FUNCTION refresh_shared_recipes_view_on_shared_recipe_change() FROM authenticated;

-- Grant SELECT permission on shared_recipes_view to authenticated users
GRANT SELECT ON shared_recipes_view TO authenticated;

-- Grant EXECUTE permission on refresh functions to postgres role
GRANT EXECUTE ON FUNCTION refresh_shared_recipes_view() TO postgres;
GRANT EXECUTE ON FUNCTION refresh_shared_recipes_view_on_tag_change() TO postgres;
GRANT EXECUTE ON FUNCTION refresh_shared_recipes_view_on_profile_change() TO postgres;
GRANT EXECUTE ON FUNCTION refresh_shared_recipes_view_on_shared_recipe_change() TO postgres;

-- Set ownership of materialized view to postgres role
ALTER MATERIALIZED VIEW shared_recipes_view OWNER TO postgres;

-- Create security definer wrapper functions for refreshing the view
CREATE OR REPLACE FUNCTION public.refresh_shared_recipes_view_wrapper()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM refresh_shared_recipes_view();
END;
$$;

-- Grant execute on wrapper function to authenticated users
GRANT EXECUTE ON FUNCTION public.refresh_shared_recipes_view_wrapper() TO authenticated;

-- Update triggers to use wrapper function
DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_recipe_change ON recipes;
CREATE TRIGGER refresh_shared_recipes_view_on_recipe_change
  AFTER INSERT OR DELETE OR UPDATE ON recipes
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_shared_recipes_view_wrapper();

DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_tag_change ON recipe_tags;
CREATE TRIGGER refresh_shared_recipes_view_on_tag_change
  AFTER INSERT OR DELETE OR UPDATE ON recipe_tags
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_shared_recipes_view_wrapper();

DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_profile_change ON profiles;
CREATE TRIGGER refresh_shared_recipes_view_on_profile_change
  AFTER UPDATE ON profiles
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_shared_recipes_view_wrapper();

DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_shared_recipe_change ON shared_recipes;
CREATE TRIGGER refresh_shared_recipes_view_on_shared_recipe_change
  AFTER INSERT OR DELETE OR UPDATE ON shared_recipes
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_shared_recipes_view_wrapper();

-- Refresh the view to apply changes
REFRESH MATERIALIZED VIEW shared_recipes_view;