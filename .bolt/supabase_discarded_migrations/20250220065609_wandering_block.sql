/*
  # Consolidated Database Changes
  
  This migration combines and optimizes all changes while properly handling
  existing policies.

  1. Storage
    - Recipe images bucket
    - Storage policies with proper drops
    - RLS configuration
  
  2. Indexes
    - Optimized indexes for recipes
    - Hash index for titles
    - Composite indexes for tags
  
  3. Views and Functions
    - Recipe summaries materialized view
    - Recipe listing functions
    - View refresh trigger
*/

-- Create storage bucket for recipe images
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read recipe images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;

-- Create storage policies
CREATE POLICY "Users can upload recipe images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'recipe-images' AND
    (LOWER(storage.extension(name)) = ANY (ARRAY['jpg', 'jpeg', 'png', 'webp', 'gif']))
  );

CREATE POLICY "Anyone can read recipe images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'recipe-images');

CREATE POLICY "Users can update own images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'recipe-images' AND auth.uid()::text = owner)
  WITH CHECK (bucket_id = 'recipe-images' AND auth.uid()::text = owner);

CREATE POLICY "Users can delete own images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'recipe-images' AND auth.uid()::text = owner);

-- Create optimized indexes
DROP INDEX IF EXISTS idx_recipes_title_hash;
CREATE INDEX idx_recipes_title_hash 
ON recipes USING hash (title)
WHERE user_id IS NOT NULL;

DROP INDEX IF EXISTS idx_recipes_user_listing;
CREATE INDEX idx_recipes_user_listing 
ON recipes (user_id, created_at DESC)
INCLUDE (title, description)
WHERE user_id IS NOT NULL;

DROP INDEX IF EXISTS idx_recipes_shared_access;
CREATE INDEX idx_recipes_shared_access 
ON recipes (id)
INCLUDE (title, description, created_at, user_id)
WHERE EXISTS (
  SELECT 1 FROM shared_recipes 
  WHERE recipe_id = recipes.id
);

DROP INDEX IF EXISTS idx_recipes_public;
CREATE INDEX idx_recipes_public 
ON recipes (id, created_at)
WHERE EXISTS (
  SELECT 1 FROM shared_recipes 
  WHERE recipe_id = recipes.id 
  AND is_public = true
);

-- Create recipe tag indexes
DROP INDEX IF EXISTS idx_recipe_tags_lookup;
CREATE INDEX idx_recipe_tags_lookup 
ON recipe_tags (recipe_id, tag_id);

DROP INDEX IF EXISTS idx_recipe_tags_reverse;
CREATE INDEX idx_recipe_tags_reverse 
ON recipe_tags (tag_id, recipe_id);

-- Drop existing materialized view and related objects
DROP TRIGGER IF EXISTS refresh_recipe_summaries_trigger ON recipes;
DROP FUNCTION IF EXISTS refresh_recipe_summaries();
DROP MATERIALIZED VIEW IF EXISTS recipe_summaries;

-- Create materialized view for recipe summaries
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

-- Create function to refresh materialized view
CREATE FUNCTION refresh_recipe_summaries()
RETURNS trigger AS $$
BEGIN
  REFRESH MATERIALIZED VIEW recipe_summaries;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh materialized view
CREATE TRIGGER refresh_recipe_summaries_trigger
AFTER INSERT OR UPDATE OR DELETE ON recipes
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_recipe_summaries();

-- Drop existing functions
DROP FUNCTION IF EXISTS list_user_recipes(uuid, integer, integer, uuid[]);
DROP FUNCTION IF EXISTS list_shared_recipes(text, integer, integer, uuid[]);

-- Create optimized function for recipe listing
CREATE FUNCTION list_user_recipes(
  p_user_id uuid,
  p_limit integer DEFAULT 12,
  p_offset integer DEFAULT 0,
  p_tag_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  created_at timestamptz,
  tag_ids uuid[]
) 
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT 
    rs.id,
    rs.title,
    rs.description,
    rs.created_at,
    rs.tag_ids
  FROM recipe_summaries rs
  WHERE rs.user_id = p_user_id
  AND (
    p_tag_ids IS NULL 
    OR rs.tag_ids && p_tag_ids
  )
  ORDER BY rs.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Create optimized function for shared recipe listing
CREATE FUNCTION list_shared_recipes(
  p_user_email text,
  p_limit integer DEFAULT 12,
  p_offset integer DEFAULT 0,
  p_tag_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  created_at timestamptz,
  user_id uuid,
  tag_ids uuid[]
) 
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT DISTINCT ON (rs.id)
    rs.id,
    rs.title,
    rs.description,
    rs.created_at,
    rs.user_id,
    rs.tag_ids
  FROM recipe_summaries rs
  JOIN shared_recipes sr ON rs.id = sr.recipe_id
  WHERE sr.is_public = true 
  OR sr.shared_email = p_user_email
  AND (
    p_tag_ids IS NULL 
    OR rs.tag_ids && p_tag_ids
  )
  ORDER BY rs.id, rs.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Grant access to functions
GRANT EXECUTE ON FUNCTION list_user_recipes TO authenticated;
GRANT EXECUTE ON FUNCTION list_shared_recipes TO authenticated;

-- Add comments
COMMENT ON MATERIALIZED VIEW recipe_summaries IS 'Cached recipe data for faster queries';
COMMENT ON FUNCTION list_user_recipes IS 'Optimized function for listing user recipes';
COMMENT ON FUNCTION list_shared_recipes IS 'Optimized function for listing shared recipes';
COMMENT ON INDEX idx_recipes_title_hash IS 'Space-efficient hash index for recipe titles';
COMMENT ON INDEX idx_recipes_user_listing IS 'Efficient index for user recipe listing';
COMMENT ON INDEX idx_recipes_shared_access IS 'Index for shared recipe access';
COMMENT ON INDEX idx_recipes_public IS 'Index for public recipes';
COMMENT ON POLICY "Users can upload recipe images" ON storage.objects IS 'Allow authenticated users to upload images with valid extensions';
COMMENT ON POLICY "Anyone can read recipe images" ON storage.objects IS 'Allow public access to recipe images';
COMMENT ON POLICY "Users can update own images" ON storage.objects IS 'Allow users to update their own images';
COMMENT ON POLICY "Users can delete own images" ON storage.objects IS 'Allow users to delete their own images';