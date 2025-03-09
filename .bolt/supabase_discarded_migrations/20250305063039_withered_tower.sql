-- Fix favorite persistence issues

-- First check if triggers need updating
DO $$ 
BEGIN
  -- Update get_recipe_with_details function to include is_favorite
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_recipe_with_details') THEN
    -- Redefine the function to include is_favorite
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
      is_favorite boolean,
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
        r.is_favorite,
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
    
    -- Grant execute permissions
    GRANT EXECUTE ON FUNCTION get_recipe_with_details(uuid, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION get_recipe_with_details(uuid, text) TO anon;
    GRANT EXECUTE ON FUNCTION get_recipe_with_details(uuid, text) TO service_role;
  END IF;
  
  -- Update the materialized view to include is_favorite if it exists
  IF EXISTS (
    SELECT 1 FROM pg_matviews WHERE matviewname = 'shared_recipes_view'
  ) THEN
    -- Check if is_favorite exists in recipes table but not in the view
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'recipes' AND column_name = 'is_favorite'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shared_recipes_view' AND column_name = 'is_favorite'
    ) THEN
      -- Drop the view and recreate it with is_favorite
      DROP MATERIALIZED VIEW IF EXISTS shared_recipes_view CASCADE;
      
      CREATE MATERIALIZED VIEW shared_recipes_view AS
      SELECT 
        r.id,
        r.title,
        r.description,
        r.image_url,
        r.image_data,
        r.created_at,
        r.user_id,
        r.is_favorite,
        p.full_name as author_name,
        p.avatar_data as author_avatar,
        COALESCE(p.is_verified, false) as author_verified,
        sr.shared_email,
        sr.is_public,
        ARRAY(
          SELECT rt.tag_id
          FROM recipe_tags rt
          WHERE rt.recipe_id = r.id
        ) as tag_ids,
        ARRAY(
          SELECT t.name
          FROM recipe_tags rt
          JOIN tags t ON rt.tag_id = t.id
          WHERE rt.recipe_id = r.id
        ) as tag_names
      FROM recipes r
      JOIN shared_recipes sr ON r.id = sr.recipe_id
      LEFT JOIN profiles p ON r.user_id = p.id;
      
      -- Create unique index to enable concurrent refresh
      CREATE UNIQUE INDEX idx_shared_recipes_view_unique 
      ON shared_recipes_view(id, COALESCE(shared_email, ''));
      
      -- Create indexes for efficient filtering
      CREATE INDEX idx_shared_recipes_view_shared_email 
      ON shared_recipes_view(shared_email);
      
      CREATE INDEX idx_shared_recipes_view_is_public 
      ON shared_recipes_view(is_public);
      
      -- Create GIN index for tag_ids array to enable efficient tag filtering
      CREATE INDEX idx_shared_recipes_view_tag_ids 
      ON shared_recipes_view USING GIN(tag_ids);
      
      -- Explicitly grant permissions to materialized view
      GRANT SELECT ON shared_recipes_view TO authenticated;
      GRANT SELECT ON shared_recipes_view TO anon;
      GRANT SELECT ON shared_recipes_view TO service_role;
      
      -- Update get_shared_recipes_with_tags function to include is_favorite
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
        is_favorite boolean,
        tag_ids uuid[],
        tag_names text[]
      )
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$
        SELECT 
          srv.id,
          srv.title,
          srv.description,
          srv.image_url,
          srv.image_data,
          srv.created_at,
          srv.user_id,
          srv.author_name,
          srv.author_avatar,
          srv.author_verified,
          srv.is_favorite,
          srv.tag_ids,
          srv.tag_names
        FROM shared_recipes_view srv
        WHERE (srv.shared_email = user_email OR srv.is_public = true)
          AND (tag_filter IS NULL OR srv.tag_ids && tag_filter)
        ORDER BY srv.created_at DESC;
      $$;
      
      -- Grant execute permissions
      GRANT EXECUTE ON FUNCTION get_shared_recipes_with_tags(text, uuid[]) TO authenticated;
      GRANT EXECUTE ON FUNCTION get_shared_recipes_with_tags(text, uuid[]) TO anon;
      GRANT EXECUTE ON FUNCTION get_shared_recipes_with_tags(text, uuid[]) TO service_role;
      
      -- Perform initial refresh of the view
      REFRESH MATERIALIZED VIEW shared_recipes_view;
    END IF;
  END IF;
END $$;

-- Add an explicit policy for updating is_favorite column
CREATE POLICY IF NOT EXISTS "Users can update is_favorite status of their recipes"
  ON recipes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grant additional permissions to ensure users can update the column
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
GRANT UPDATE(is_favorite) ON recipes TO authenticated;