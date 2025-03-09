/*
  # Add Missing Favorites Column

  1. New Columns
    - Add is_favorite column to recipes table
    
  2. Indexes
    - Add index for efficient filtering by favorite status
    
  3. Description
    - Adds support for marking recipes as favorites and sorting by favorite status
*/

-- Check if the is_favorite column already exists
DO $$ 
BEGIN
  -- Add is_favorite column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'recipes' AND column_name = 'is_favorite'
  ) THEN
    ALTER TABLE recipes ADD COLUMN is_favorite BOOLEAN DEFAULT false;
    
    -- Add index for efficient filtering of favorite recipes
    CREATE INDEX idx_recipes_is_favorite ON recipes(user_id, is_favorite);
    
    -- Add comment explaining the column
    COMMENT ON COLUMN recipes.is_favorite IS 'Indicates if the recipe is marked as favorite by the user';
  END IF;
END $$;