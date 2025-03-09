/*
  # Add foreign key from recipe_tags to global_tags

  1. Changes
    - Add foreign key constraint from recipe_tags.tag_id to global_tags.id
    - Add index on tag_id for better performance
    - Update existing policies to reflect global tags

  2. Security
    - Maintain existing RLS policies
    - Ensure proper cascading on delete
*/

-- Add foreign key constraint
ALTER TABLE recipe_tags
DROP CONSTRAINT IF EXISTS recipe_tags_tag_id_fkey,
ADD CONSTRAINT recipe_tags_tag_id_fkey 
FOREIGN KEY (tag_id) 
REFERENCES global_tags(id) 
ON DELETE CASCADE;

-- Add index for better join performance
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id 
ON recipe_tags(tag_id);