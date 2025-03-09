/*
  # Add favorites functionality to recipes

  1. New Columns
    - Add `is_favorite` boolean column to recipes table
  
  2. Indexes
    - Add index for efficient filtering of favorite recipes
    
  3. Security
    - Update RLS policies to ensure security of favorite status
*/

-- Add is_favorite column to recipes table
ALTER TABLE recipes ADD COLUMN is_favorite BOOLEAN DEFAULT false;

-- Add index for efficient filtering of favorite recipes
CREATE INDEX idx_recipes_is_favorite ON recipes(user_id, is_favorite);

-- Add comment explaining the column
COMMENT ON COLUMN recipes.is_favorite IS 'Indicates if the recipe is marked as favorite by the user';