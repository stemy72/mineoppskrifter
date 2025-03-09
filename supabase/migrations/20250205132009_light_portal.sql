/*
  # Add Recipe Author Relationship

  1. Changes
    - Add foreign key relationship between recipes.user_id and profiles.id (if not exists)
    - Add index on recipes.user_id for better query performance (if not exists)
    
  2. Security
    - Maintain existing RLS policies
*/

DO $$ 
BEGIN
  -- Check if the foreign key constraint exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'recipes_user_id_fkey'
    AND table_name = 'recipes'
  ) THEN
    -- Add foreign key relationship if it doesn't exist
    ALTER TABLE recipes
    ADD CONSTRAINT recipes_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);

-- Update the table comment
COMMENT ON TABLE recipes IS 'Collection of user recipes with author relationship to profiles';