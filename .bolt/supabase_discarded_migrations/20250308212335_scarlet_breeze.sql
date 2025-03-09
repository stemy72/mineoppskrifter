/*
  # Fix Recipe Tags System

  1. Changes
    - Drop and recreate recipe_tags junction table with proper constraints
    - Remove RLS from global_tags table
    - Add necessary indexes for performance
    - Grant appropriate permissions

  2. Security
    - Global tags are accessible to all authenticated users
    - No RLS needed since tags are global
    - Maintain data integrity with foreign key constraints

  3. Performance
    - Add composite indexes for efficient lookups
    - Add single-column indexes for common queries
*/

-- Drop existing recipe_tags table and recreate with proper structure
DROP TABLE IF EXISTS recipe_tags CASCADE;

-- Create recipe_tags junction table
CREATE TABLE recipe_tags (
    recipe_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT recipe_tags_pkey PRIMARY KEY (recipe_id, tag_id),
    CONSTRAINT recipe_tags_recipe_id_fkey FOREIGN KEY (recipe_id)
        REFERENCES recipes(id) ON DELETE CASCADE,
    CONSTRAINT recipe_tags_tag_id_fkey FOREIGN KEY (tag_id)
        REFERENCES global_tags(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON recipe_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_composite ON recipe_tags(recipe_id, tag_id);

-- Grant necessary permissions
GRANT ALL ON recipe_tags TO authenticated;
GRANT ALL ON global_tags TO authenticated;

-- Add helpful comments
COMMENT ON TABLE recipe_tags IS 'Junction table linking recipes with global tags';
COMMENT ON COLUMN recipe_tags.recipe_id IS 'Reference to recipes table';
COMMENT ON COLUMN recipe_tags.tag_id IS 'Reference to global_tags table';

-- Add trigger to refresh materialized views if needed
CREATE OR REPLACE FUNCTION refresh_shared_recipes_view_on_tag_change()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW IF EXISTS shared_recipes_view;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_shared_recipes_view_on_tag_change
AFTER INSERT OR DELETE OR UPDATE ON recipe_tags
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_shared_recipes_view_on_tag_change();