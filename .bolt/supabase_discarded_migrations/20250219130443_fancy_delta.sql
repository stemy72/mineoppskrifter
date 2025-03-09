-- Create optimized indexes for shared recipes queries
CREATE INDEX IF NOT EXISTS idx_recipes_user_id_created_at ON recipes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_composite ON shared_recipes(recipe_id, shared_email, is_public);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_composite ON recipe_tags(recipe_id, tag_id);

-- Create materialized view for frequently accessed recipe data
CREATE MATERIALIZED VIEW recipe_summaries AS
SELECT 
  r.id,
  r.title,
  r.description,
  r.image_data,
  r.created_at,
  r.user_id,
  array_remove(array_agg(DISTINCT rt.tag_id), NULL) as tag_ids
FROM recipes r
LEFT JOIN recipe_tags rt ON r.id = rt.recipe_id
GROUP BY r.id, r.title, r.description, r.image_data, r.created_at, r.user_id;

-- Create index on materialized view
CREATE INDEX idx_recipe_summaries_user_id_created_at 
ON recipe_summaries(user_id, created_at DESC);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_recipe_summaries()
RETURNS trigger AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY recipe_summaries;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh materialized view
CREATE TRIGGER refresh_recipe_summaries_trigger
AFTER INSERT OR UPDATE OR DELETE ON recipes
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_recipe_summaries();

-- Add comments
COMMENT ON MATERIALIZED VIEW recipe_summaries IS 'Cached recipe data for faster queries';
COMMENT ON INDEX idx_recipes_user_id_created_at IS 'Optimized index for recipe listing by user';
COMMENT ON INDEX idx_shared_recipes_composite IS 'Composite index for shared recipe lookups';
COMMENT ON INDEX idx_recipe_tags_composite IS 'Composite index for recipe tag filtering';