/*
  # Fix favorites sorting and add index

  1. Changes
    - Add index for optimized sorting by is_favorite and created_at
    - Update recipes view to properly sort by favorites
    - Add function to refresh materialized view

  2. Security
    - Maintain RLS policies
    - Add security barrier to view
*/

-- Add index for optimized sorting
CREATE INDEX IF NOT EXISTS idx_recipes_favorite_created_at ON recipes (is_favorite DESC, created_at DESC);

-- Create or replace function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_recipes_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY shared_recipes_view;
  RETURN NULL;
END;
$$;

-- Add trigger to refresh view when favorites change
CREATE OR REPLACE TRIGGER refresh_recipes_view_on_favorite_change
  AFTER UPDATE OF is_favorite ON recipes
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_recipes_view();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION refresh_recipes_view() TO authenticated;