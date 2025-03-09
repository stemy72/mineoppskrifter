/*
  # Grant permissions for shared_recipes_view

  1. Changes
    - Grant SELECT permission on shared_recipes_view to authenticated users
    - Grant REFRESH permission on shared_recipes_view to authenticated users
    - Grant EXECUTE permission on refresh functions to authenticated users

  2. Security
    - Only grants necessary permissions for recipe sharing functionality
    - Maintains RLS policies for data access control
*/

-- Grant SELECT permission on shared_recipes_view to authenticated users
GRANT SELECT ON shared_recipes_view TO authenticated;

-- Grant REFRESH permission on shared_recipes_view to authenticated users
ALTER MATERIALIZED VIEW shared_recipes_view OWNER TO authenticated;

-- Grant EXECUTE permission on refresh functions to authenticated users
GRANT EXECUTE ON FUNCTION refresh_shared_recipes_view() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_shared_recipes_view_on_tag_change() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_shared_recipes_view_on_profile_change() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_shared_recipes_view_on_shared_recipe_change() TO authenticated;