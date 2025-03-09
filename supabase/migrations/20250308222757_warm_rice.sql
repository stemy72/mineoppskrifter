/*
  # Fix Recipe Tags Relationships

  1. Changes
    - Add foreign key constraint between recipe_tags and global_tags
    - Update existing recipe_tags table structure
    - Add indexes for better query performance
    
  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity with proper constraints
*/

-- Add foreign key constraint between recipe_tags and global_tags
ALTER TABLE recipe_tags
DROP CONSTRAINT IF EXISTS recipe_tags_tag_id_fkey,
ADD CONSTRAINT recipe_tags_tag_id_fkey 
FOREIGN KEY (tag_id) REFERENCES global_tags(id) ON DELETE CASCADE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON recipe_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_tag ON recipe_tags(recipe_id, tag_id);

-- Refresh existing policies
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can manage recipe tags" ON recipe_tags;
  DROP POLICY IF EXISTS "Users can manage tags for their own recipes" ON recipe_tags;
  
  -- Recreate policies with proper conditions
  CREATE POLICY "Users can manage recipe tags"
    ON recipe_tags
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM recipes 
        WHERE recipes.id = recipe_tags.recipe_id 
        AND recipes.user_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM recipes 
        WHERE recipes.id = recipe_tags.recipe_id 
        AND recipes.user_id = auth.uid()
      )
    );
END $$;