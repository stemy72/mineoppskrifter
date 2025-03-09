/*
  # Recipe Global Tags Relationship

  1. Changes
    - Drop existing recipe_tags table and related objects
    - Create new recipe_tags junction table linking recipes with global_tags
    - Add foreign key constraints and indexes
    - Add RLS policies for security

  2. New Tables
    - recipe_tags (junction table)
      - recipe_id (uuid, references recipes)
      - tag_id (uuid, references global_tags)

  3. Security
    - Enable RLS on recipe_tags
    - Add policies for managing recipe tags
    - Ensure proper access control
*/

-- Drop existing recipe_tags table and related objects
DROP TABLE IF EXISTS recipe_tags CASCADE;

-- Create new recipe_tags junction table
CREATE TABLE recipe_tags (
    recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES global_tags(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (recipe_id, tag_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX idx_recipe_tags_tag_id ON recipe_tags(tag_id);
CREATE INDEX idx_recipe_tags_composite ON recipe_tags(recipe_id, tag_id);

-- Enable RLS
ALTER TABLE recipe_tags ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage tags for their recipes"
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
        WHERE recipes.id = recipe_tags.recipe_id
        AND (
            recipes.user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM shared_recipes
                WHERE shared_recipes.recipe_id = recipes.id
                AND (
                    shared_recipes.shared_email = (auth.jwt() ->> 'email')
                    OR shared_recipes.is_public = true
                )
            )
        )
    )
);

-- Add comment
COMMENT ON TABLE recipe_tags IS 'Junction table linking recipes with global tags';

-- Create function to refresh materialized view when tags change
CREATE OR REPLACE FUNCTION refresh_shared_recipes_view_on_tag_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY shared_recipes_view;
    RETURN NULL;
END;
$$;

-- Create trigger to refresh view on tag changes
CREATE TRIGGER refresh_shared_recipes_view_on_tag_change
    AFTER INSERT OR DELETE OR UPDATE ON recipe_tags
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_shared_recipes_view_on_tag_change();

-- Example queries for reference:

/*
-- Add tags to a recipe
INSERT INTO recipe_tags (recipe_id, tag_id)
VALUES 
    ('recipe-uuid', 'tag-uuid-1'),
    ('recipe-uuid', 'tag-uuid-2');

-- Get all tags for a recipe
SELECT g.id, g.name
FROM recipe_tags rt
JOIN global_tags g ON g.id = rt.tag_id
WHERE rt.recipe_id = 'recipe-uuid';

-- Get all recipes with specific tags
SELECT r.*
FROM recipes r
JOIN recipe_tags rt ON r.id = rt.recipe_id
WHERE rt.tag_id IN ('tag-uuid-1', 'tag-uuid-2');

-- Remove a tag from a recipe
DELETE FROM recipe_tags
WHERE recipe_id = 'recipe-uuid'
AND tag_id = 'tag-uuid';
*/