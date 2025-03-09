/*
  # Simplify Favorite Toggle

  1. New Functionality
    - Create policy to explicitly allow authenticated users to update is_favorite column

  2. Security
    - Add explicit policy for is_favorite column update
    - Grant specific column-level permissions

  This migration simplifies the favorite toggling by using direct column updates
  instead of RPC functions. This is more stable and avoids issues with RPC caching.
*/

-- Ensure is_favorite column exists
DO $$ 
BEGIN
  -- Ensure is_favorite column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'recipes' AND column_name = 'is_favorite'
  ) THEN
    ALTER TABLE recipes ADD COLUMN is_favorite BOOLEAN DEFAULT false;
    
    CREATE INDEX idx_recipes_is_favorite ON recipes(user_id, is_favorite);
  END IF;

  -- Create policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'recipes' AND policyname = 'Users can update is_favorite status of their recipes'
  ) THEN
    CREATE POLICY "Users can update is_favorite status of their recipes"
      ON recipes FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Grant specific column permission - be explicit about it
GRANT UPDATE(is_favorite) ON recipes TO authenticated;

-- Drop the RPC function if it exists - we'll use direct column updates instead
DROP FUNCTION IF EXISTS update_recipe_favorite(UUID, BOOLEAN);