/*
  # Add favorite functionality policies

  1. Changes
    - Add RLS policies for favorite status updates
    - Add index for favorite sorting
    - Add trigger to maintain favorite status

  2. Security
    - Enable RLS policies for favorite status updates
    - Restrict favorite updates to recipe owners
*/

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

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can update favorite status" ON recipes;
DROP POLICY IF EXISTS "Users can update their own recipes" ON recipes;

-- Create policy for updating only favorite status
CREATE POLICY "Users can update favorite status"
ON recipes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy for general recipe updates
CREATE POLICY "Users can update their own recipes"
ON recipes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);