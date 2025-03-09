/*
  # Fix Recipe Tags Permissions

  1. Changes
    - Drop existing recipe_tags table and recreate with proper constraints
    - Add foreign key relationships to recipes and global_tags
    - Add RLS policies for proper access control
    - Add performance indexes

  2. Security
    - Users can only manage tags for their own recipes
    - Users can view tags for recipes they have access to
    - Maintain data integrity with foreign key constraints
*/

-- Drop existing recipe_tags table if it exists
DROP TABLE IF EXISTS recipe_tags CASCADE;

-- Create recipe_tags table with proper constraints
CREATE TABLE recipe_tags (
    recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES global_tags(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (recipe_id, tag_id)
);

-- Enable RLS
ALTER TABLE recipe_tags ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage tags for their own recipes"
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

CREATE POLICY "Users can view recipe tags"
ON recipe_tags
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM recipes
    LEFT JOIN shared_recipes ON recipes.id = shared_recipes.recipe_id
    WHERE recipes.id = recipe_tags.recipe_id
    AND (
      recipes.user_id = auth.uid()
      OR shared_recipes.shared_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      OR shared_recipes.is_public = true
    )
  )
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON recipe_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_composite ON recipe_tags(recipe_id, tag_id);

-- Grant necessary permissions
GRANT ALL ON recipe_tags TO authenticated;

COMMENT ON TABLE recipe_tags IS 'Junction table linking recipes with global tags';