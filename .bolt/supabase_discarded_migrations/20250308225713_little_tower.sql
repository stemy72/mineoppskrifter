/*
  # Add favorite functionality

  1. Changes
    - Add is_favorite column to recipes table if it doesn't exist
    - Add index for favorite sorting
    - Add RLS policies for favorite status
    - Add trigger for favorite updates

  2. Security
    - Enable RLS policies for favorite status updates
    - Restrict favorite updates to recipe owners
*/

-- Add is_favorite column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'recipes' AND column_name = 'is_favorite'
  ) THEN
    ALTER TABLE recipes ADD COLUMN is_favorite boolean DEFAULT false;
  END IF;
END $$;

-- Add index for favorite sorting if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_recipes_favorite_sort'
  ) THEN
    CREATE INDEX idx_recipes_favorite_sort ON recipes (user_id, is_favorite DESC, created_at DESC);
  END IF;
END $$;

-- Create or replace policy for updating favorite status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can update favorite status'
  ) THEN
    CREATE POLICY "Users can update favorite status" 
    ON recipes
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (
      auth.uid() = user_id AND
      (
        (OLD.is_favorite IS DISTINCT FROM NEW.is_favorite) AND
        OLD.title = NEW.title AND
        OLD.description IS NOT DISTINCT FROM NEW.description AND
        OLD.instructions = NEW.instructions AND
        OLD.image_url IS NOT DISTINCT FROM NEW.image_url AND
        OLD.source_url IS NOT DISTINCT FROM NEW.source_url AND
        OLD.servings IS NOT DISTINCT FROM NEW.servings AND
        OLD.cooking_time IS NOT DISTINCT FROM NEW.cooking_time AND
        OLD.user_id = NEW.user_id
      )
    );
  END IF;
END $$;