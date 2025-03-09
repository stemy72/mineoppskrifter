-- Drop existing materialized view if exists
DROP MATERIALIZED VIEW IF EXISTS recipe_summaries;

-- Recreate materialized view with proper ownership
CREATE MATERIALIZED VIEW recipe_summaries AS
SELECT 
  r.id,
  r.title,
  r.description,
  r.created_at,
  r.user_id,
  array_remove(array_agg(DISTINCT rt.tag_id), NULL) as tag_ids,
  EXISTS (
    SELECT 1 FROM shared_recipes sr 
    WHERE sr.recipe_id = r.id AND sr.is_public = true
  ) as is_public
FROM recipes r
LEFT JOIN recipe_tags rt ON r.id = rt.recipe_id
GROUP BY r.id, r.title, r.description, r.created_at, r.user_id;

-- Create indexes on materialized view
CREATE INDEX idx_recipe_summaries_user 
ON recipe_summaries (user_id, created_at DESC);

CREATE INDEX idx_recipe_summaries_public 
ON recipe_summaries (id) 
WHERE is_public = true;

-- Grant necessary permissions
GRANT SELECT ON recipe_summaries TO authenticated;

-- Now we can run the image migration
SELECT * FROM migrate_recipe_images('nuxdebclrfaugeoaxqwa');