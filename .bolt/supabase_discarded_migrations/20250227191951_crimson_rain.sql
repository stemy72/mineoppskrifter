/*
  # Fix Shared Recipes Functionality

  1. New Functions
    - `get_shared_recipes`: Returns recipes shared with the current user
    - `get_recipe_with_details`: Returns detailed recipe information with author details
  
  2. Security
    - Functions use row-level security for proper access control
    - Only return recipes the user has permission to view
*/

-- Create function to get shared recipes
CREATE OR REPLACE FUNCTION get_shared_recipes(user_email text)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  image_url text,
  image_data text,
  created_at timestamptz,
  user_id uuid,
  author_name text,
  author_avatar text,
  author_verified boolean,
  tag_ids uuid[],
  tag_names text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.id,
    r.title,
    r.description,
    r.image_url,
    r.image_data,
    r.created_at,
    r.user_id,
    p.full_name as author_name,
    p.avatar_data as author_avatar,
    p.is_verified as author_verified,
    COALESCE(
      (SELECT array_agg(rt.tag_id)
       FROM recipe_tags rt
       WHERE rt.recipe_id = r.id), 
      ARRAY[]::uuid[]
    ) as tag_ids,
    COALESCE(
      (SELECT array_agg(t.name)
       FROM recipe_tags rt
       JOIN tags t ON rt.tag_id = t.id
       WHERE rt.recipe_id = r.id),
      ARRAY[]::text[]
    ) as tag_names
  FROM recipes r
  JOIN shared_recipes sr ON r.id = sr.recipe_id
  LEFT JOIN profiles p ON r.user_id = p.id
  WHERE sr.shared_email = user_email
     OR sr.is_public = true
  ORDER BY r.created_at DESC;
$$;

-- Create function to get recipe details with author info
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
  ingredients json,
  additional_images json
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
    COALESCE(
      (SELECT array_agg(rt.tag_id)
       FROM recipe_tags rt
       WHERE rt.recipe_id = r.id),
      ARRAY[]::uuid[]
    ) as tag_ids,
    COALESCE(
      (SELECT array_agg(t.name)
       FROM recipe_tags rt
       JOIN tags t ON rt.tag_id = t.id
       WHERE rt.recipe_id = r.id),
      ARRAY[]::text[]
    ) as tag_names,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', i.id,
          'name', i.name,
          'amount', i.amount,
          'unit', i.unit,
          'is_section', i.is_section
        )
       )
       FROM ingredients i
       WHERE i.recipe_id = r.id),
      '[]'::json
    ) as ingredients,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', ri.id,
          'image_url', ri.image_url,
          'order', ri."order"
        )
       )
       FROM recipe_images ri
       WHERE ri.recipe_id = r.id
       ORDER BY ri."order"),
      '[]'::json
    ) as additional_images
  FROM recipes r
  LEFT JOIN profiles p ON r.user_id = p.id
  WHERE r.id = recipe_id
  AND (
    r.user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM shared_recipes sr 
      WHERE sr.recipe_id = r.id 
      AND (sr.shared_email = user_email OR sr.is_public = true)
    )
  );
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_shared_recipes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recipe_with_details(uuid, text) TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_shared_recipes IS 'Returns recipes shared with the specified user email';
COMMENT ON FUNCTION get_recipe_with_details IS 'Returns detailed recipe information with author details';