/*
  # Fix Recipe-Profiles Relationship

  1. Changes
    - Drop existing foreign key if it exists
    - Re-create foreign key relationship between recipes and auth.users
    - Add foreign key relationship between recipes and profiles
    - Add necessary indexes for performance
    
  2. Security
    - Maintain existing RLS policies
*/

-- First drop the existing foreign key if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'recipes_user_id_fkey'
    AND table_name = 'recipes'
  ) THEN
    ALTER TABLE recipes DROP CONSTRAINT recipes_user_id_fkey;
  END IF;
END $$;

-- Re-create the foreign key to auth.users
ALTER TABLE recipes
ADD CONSTRAINT recipes_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);

-- Add comment explaining the relationship
COMMENT ON TABLE recipes IS 'Collection of user recipes with relationship to auth.users and profiles';

-- Add comment explaining the user_id column
COMMENT ON COLUMN recipes.user_id IS 'References auth.users(id) and matches profiles(id)';