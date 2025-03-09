/*
  # Fix favorite functionality

  1. Changes
    - Add RLS policies for favorite status updates
    - Add trigger to handle favorite status changes
    - Add index for favorite status sorting
    - Grant necessary permissions

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Add index for favorite status sorting if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_recipes_favorite_sort 
ON recipes (user_id, is_favorite DESC, created_at DESC);

-- Create policy for updating favorite status
CREATE POLICY "Users can update favorite status of their recipes"
ON recipes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND (
    -- Only allow updating is_favorite column
    (xmax::text::int != 0 AND (OLD.* IS DISTINCT FROM NEW.*))
    AND (
      OLD.is_favorite IS DISTINCT FROM NEW.is_favorite
      AND OLD.title = NEW.title
      AND OLD.description = NEW.description
      AND OLD.instructions = NEW.instructions
      AND OLD.image_url = NEW.image_url
      AND OLD.source_url = NEW.source_url
      AND OLD.servings = NEW.servings
      AND OLD.cooking_time = NEW.cooking_time
      AND OLD.user_id = NEW.user_id
    )
  )
);

-- Create function to handle favorite status changes
CREATE OR REPLACE FUNCTION handle_favorite_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure only is_favorite can be updated
  IF OLD.* IS DISTINCT FROM NEW.* THEN
    IF OLD.is_favorite IS DISTINCT FROM NEW.is_favorite
       AND OLD.title = NEW.title
       AND OLD.description = NEW.description
       AND OLD.instructions = NEW.instructions
       AND OLD.image_url = NEW.image_url
       AND OLD.source_url = NEW.source_url
       AND OLD.servings = NEW.servings
       AND OLD.cooking_time = NEW.cooking_time
       AND OLD.user_id = NEW.user_id THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Only is_favorite status can be updated';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for favorite status updates
CREATE TRIGGER handle_favorite_update_trigger
  BEFORE UPDATE OF is_favorite ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION handle_favorite_update();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_favorite_update() TO authenticated;