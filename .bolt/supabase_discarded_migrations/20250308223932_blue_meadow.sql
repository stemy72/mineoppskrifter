/*
  # Fix trigger functions for shared recipes view

  1. Changes
    - Replace materialized view with regular view for real-time updates
    - Update trigger functions to handle row-level changes
    - Fix permission issues with trigger functions
    - Add proper security barriers

  2. Security
    - Maintain RLS policies
    - Add security barrier to view
    - Use security definer for trigger functions
*/

-- Drop existing triggers
DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_recipe_change ON recipes;
DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_tag_change ON recipe_tags;
DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_profile_change ON profiles;
DROP TRIGGER IF EXISTS refresh_shared_recipes_view_on_shared_recipe_change ON shared_recipes;

-- Drop existing functions
DROP FUNCTION IF EXISTS refresh_shared_recipes_view();
DROP FUNCTION IF EXISTS refresh_shared_recipes_view_on_tag_change();
DROP FUNCTION IF EXISTS refresh_shared_recipes_view_on_profile_change();
DROP FUNCTION IF EXISTS refresh_shared_recipes_view_on_shared_recipe_change();

-- Drop existing materialized view
DROP MATERIALIZED VIEW IF EXISTS shared_recipes_view;

-- Create regular view instead of materialized view
CREATE OR REPLACE VIEW shared_recipes_view
WITH (security_barrier = true)
AS
  SELECT DISTINCT ON (r.id)
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
    sr.is_public,
    ARRAY_AGG(DISTINCT rt.tag_id) FILTER (WHERE rt.tag_id IS NOT NULL) as tag_ids,
    ARRAY_AGG(DISTINCT gt.name) FILTER (WHERE gt.name IS NOT NULL) as tag_names
  FROM recipes r
  LEFT JOIN profiles p ON r.user_id = p.id
  LEFT JOIN shared_recipes sr ON r.id = sr.recipe_id
  LEFT JOIN recipe_tags rt ON r.id = rt.recipe_id
  LEFT JOIN global_tags gt ON rt.tag_id = gt.id
  WHERE sr.is_public = true OR EXISTS (
    SELECT 1 FROM shared_recipes sr2
    WHERE sr2.recipe_id = r.id
    AND sr2.shared_email = current_user
  )
  GROUP BY r.id, r.title, r.description, r.image_url, r.image_data, r.created_at,
           r.user_id, p.full_name, p.avatar_data, p.is_verified, sr.is_public;

-- Grant access to authenticated users
GRANT SELECT ON shared_recipes_view TO authenticated;

-- Create notification function for recipe changes
CREATE OR REPLACE FUNCTION notify_recipe_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_notify(
    'recipe_changes',
    json_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'recipe_id', 
      CASE
        WHEN TG_OP = 'DELETE' THEN OLD.id
        ELSE NEW.id
      END
    )::text
  );
  RETURN NULL;
END;
$$;

-- Create triggers for real-time updates
CREATE TRIGGER notify_recipe_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON recipes
FOR EACH ROW
EXECUTE FUNCTION notify_recipe_change();

CREATE TRIGGER notify_recipe_tag_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON recipe_tags
FOR EACH ROW
EXECUTE FUNCTION notify_recipe_change();

CREATE TRIGGER notify_profile_change_trigger
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION notify_recipe_change();

CREATE TRIGGER notify_shared_recipe_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON shared_recipes
FOR EACH ROW
EXECUTE FUNCTION notify_recipe_change();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION notify_recipe_change() TO authenticated;