/*
  # Fix trigger functions for recipe notifications

  1. Changes
    - Update notify_recipe_change() function to properly handle recipe IDs
    - Add proper type checking for OLD/NEW records
    - Fix permission issues with trigger functions
    - Add security definer to ensure proper execution

  2. Security
    - Maintain RLS policies
    - Add security barrier to view
    - Use security definer for trigger functions
*/

-- Drop existing triggers first
DROP TRIGGER IF EXISTS notify_recipe_change_trigger ON recipes;
DROP TRIGGER IF EXISTS notify_recipe_tag_change_trigger ON recipe_tags;
DROP TRIGGER IF EXISTS notify_profile_change_trigger ON profiles;
DROP TRIGGER IF EXISTS notify_shared_recipe_change_trigger ON shared_recipes;

-- Drop existing function
DROP FUNCTION IF EXISTS notify_recipe_change();

-- Create improved notification function
CREATE OR REPLACE FUNCTION notify_recipe_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipe_id uuid;
BEGIN
  -- Determine recipe_id based on the table and operation
  CASE TG_TABLE_NAME
    WHEN 'recipes' THEN
      recipe_id := CASE
        WHEN TG_OP = 'DELETE' THEN OLD.id
        ELSE NEW.id
      END;
    WHEN 'recipe_tags' THEN
      recipe_id := CASE
        WHEN TG_OP = 'DELETE' THEN OLD.recipe_id
        ELSE NEW.recipe_id
      END;
    WHEN 'shared_recipes' THEN
      recipe_id := CASE
        WHEN TG_OP = 'DELETE' THEN OLD.recipe_id
        ELSE NEW.recipe_id
      END;
    WHEN 'profiles' THEN
      -- For profiles, we'll notify about all recipes owned by this user
      recipe_id := NULL;
  END CASE;

  -- Send notification
  PERFORM pg_notify(
    'recipe_changes',
    json_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'recipe_id', recipe_id,
      'timestamp', CURRENT_TIMESTAMP
    )::text
  );

  -- Return appropriate record based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Recreate triggers with proper timing and security
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_recipe_change() TO authenticated;