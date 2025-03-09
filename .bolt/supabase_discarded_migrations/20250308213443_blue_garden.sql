/*
  # Create Shared Recipes View

  1. Changes
    - Create materialized view for shared recipes
    - Add indexes for performance
    - Add refresh function and triggers

  2. Performance
    - Use materialized view for faster access
    - Add indexes on commonly queried columns
    - Include necessary columns to avoid joins

  3. Security
    - View respects existing RLS policies
    - Only shows recipes that are either:
      * Public
      * Shared directly with user
      * Owned by user
*/

-- Create the materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS shared_recipes_view AS
SELECT DISTINCT
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
    EXISTS (
        SELECT 1 FROM shared_recipes s 
        WHERE s.recipe_id = r.id AND s.is_public = true
    ) as is_public,
    ARRAY_AGG(DISTINCT rt.tag_id) FILTER (WHERE rt.tag_id IS NOT NULL) as tag_ids,
    ARRAY_AGG(DISTINCT gt.name) FILTER (WHERE gt.name IS NOT NULL) as tag_names
FROM recipes r
LEFT JOIN profiles p ON r.user_id = p.id
LEFT JOIN recipe_tags rt ON r.id = rt.recipe_id
LEFT JOIN global_tags gt ON rt.tag_id = gt.id
GROUP BY 
    r.id,
    r.title,
    r.description,
    r.image_url,
    r.image_data,
    r.created_at,
    r.user_id,
    p.full_name,
    p.avatar_data,
    p.is_verified;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shared_recipes_view_created_at ON shared_recipes_view(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_view_is_public ON shared_recipes_view(is_public);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_view_user_id ON shared_recipes_view(user_id);

-- Function to get shared recipes with optional tag filtering
CREATE OR REPLACE FUNCTION get_shared_recipes_with_tags(
    user_email text,
    tag_filter uuid[] DEFAULT NULL
)
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
    is_public boolean,
    tag_ids uuid[],
    tag_names text[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        v.*
    FROM shared_recipes_view v
    WHERE 
        -- Recipe is public
        v.is_public = true
        -- Or shared directly with user
        OR EXISTS (
            SELECT 1 FROM shared_recipes s
            WHERE s.recipe_id = v.id
            AND s.shared_email = user_email
        )
        -- Or owned by user
        OR EXISTS (
            SELECT 1 FROM auth.users u
            WHERE u.id = v.user_id
            AND u.email = user_email
        )
        -- And matches tag filter if provided
        AND (
            tag_filter IS NULL
            OR v.tag_ids && tag_filter
        )
    ORDER BY v.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_shared_recipes_view()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY shared_recipes_view;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Initial refresh of the materialized view
REFRESH MATERIALIZED VIEW shared_recipes_view;