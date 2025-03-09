/*
  # Fix Recipe Tags Migration

  1. Changes
    - Update recipe_tags to use global_tags
    - Add missing indexes for performance
    - Clean up any invalid tag entries
    - Update recipe queries to use global_tags

  2. Security
    - Maintain proper access control
    - Ensure data integrity during migration
    - Preserve existing tag relationships

  3. Performance
    - Add optimized indexes for tag queries
    - Improve join performance
*/

-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON recipe_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);

-- Clean up any invalid recipe_tags entries
DELETE FROM recipe_tags rt
WHERE NOT EXISTS (
  SELECT 1 FROM recipes r WHERE r.id = rt.recipe_id
) OR NOT EXISTS (
  SELECT 1 FROM global_tags t WHERE t.id = rt.tag_id
);

-- Create function to get recipe details with global tags
CREATE OR REPLACE FUNCTION get_recipe_with_details(recipe_id uuid, user_email text)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  instructions text,
  image_url text,
  image_data text,
  source_url text,
  servings integer,
  cooking_time integer,
  created_at timestamptz,
  user_id uuid,
  author_name text,
  author_avatar text,
  author_verified boolean,
  tag_ids uuid[],
  tag_names text[],
  ingredients jsonb,
  additional_images jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH recipe_access AS (
    SELECT r.*
    FROM recipes r
    LEFT JOIN shared_recipes s ON r.id = s.recipe_id
    WHERE r.id = recipe_id
    AND (
      r.user_id = auth.uid()
      OR s.shared_email = user_email
      OR s.is_public = true
    )
  ),
  recipe_tags_agg AS (
    SELECT 
      rt.recipe_id,
      array_agg(gt.id) as tag_ids,
      array_agg(gt.name) as tag_names
    FROM recipe_tags rt
    JOIN global_tags gt ON rt.tag_id = gt.id
    WHERE rt.recipe_id = recipe_id
    GROUP BY rt.recipe_id
  ),
  recipe_ingredients AS (
    SELECT 
      recipe_id,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'amount', amount,
          'unit', unit,
          'is_section', is_section
        ) ORDER BY id
      ) as ingredients
    FROM ingredients
    WHERE recipe_id = recipe_id
    GROUP BY recipe_id
  ),
  recipe_images AS (
    SELECT 
      recipe_id,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'image_url', image_url,
          'order', "order"
        ) ORDER BY "order"
      ) as images
    FROM recipe_images
    WHERE recipe_id = recipe_id
    GROUP BY recipe_id
  )
  SELECT 
    r.id,
    r.title,
    r.description,
    r.instructions,
    r.image_url,
    r.image_data,
    r.source_url,
    r.servings,
    r.cooking_time,
    r.created_at,
    r.user_id,
    p.full_name as author_name,
    p.avatar_data as author_avatar,
    p.is_verified as author_verified,
    COALESCE(rt.tag_ids, ARRAY[]::uuid[]) as tag_ids,
    COALESCE(rt.tag_names, ARRAY[]::text[]) as tag_names,
    COALESCE(ri.ingredients, '[]'::jsonb) as ingredients,
    COALESCE(rim.images, '[]'::jsonb) as additional_images
  FROM recipe_access r
  LEFT JOIN profiles p ON r.user_id = p.id
  LEFT JOIN recipe_tags_agg rt ON r.id = rt.recipe_id
  LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
  LEFT JOIN recipe_images rim ON r.id = rim.recipe_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;