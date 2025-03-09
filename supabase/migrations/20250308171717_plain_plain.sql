/*
  # Fix Recipe Relationships

  1. Changes
    - Add proper foreign key relationship between recipe_tags and global_tags
    - Rename recipe_images alias to match table name
    - Add indexes for better query performance

  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- First ensure recipe_tags table exists and has correct structure
CREATE TABLE IF NOT EXISTS recipe_tags (
    recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES global_tags(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (recipe_id, tag_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON recipe_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_composite ON recipe_tags(recipe_id, tag_id);

-- Enable RLS on recipe_tags
ALTER TABLE recipe_tags ENABLE ROW LEVEL SECURITY;

-- Create policies for recipe_tags
DO $$ BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can manage tags for their recipes" ON recipe_tags;
  DROP POLICY IF EXISTS "Users can view recipe tags" ON recipe_tags;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies
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

-- Ensure recipe_images table exists with correct structure
CREATE TABLE IF NOT EXISTS recipe_images (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    "order" integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT recipe_images_pkey PRIMARY KEY (id),
    CONSTRAINT valid_image_url CHECK (image_url ~ '^https?:\/\/.+'),
    CONSTRAINT order_range CHECK ("order" >= 0 AND "order" <= 4)
);

-- Create index for recipe_images
CREATE INDEX IF NOT EXISTS idx_recipe_images_recipe_id ON recipe_images(recipe_id);

-- Create unique constraint to limit images per recipe
CREATE UNIQUE INDEX IF NOT EXISTS max_images_per_recipe ON recipe_images(recipe_id, "order");

-- Enable RLS on recipe_images
ALTER TABLE recipe_images ENABLE ROW LEVEL SECURITY;

-- Create policies for recipe_images
DO $$ BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can manage their recipe images" ON recipe_images;
  DROP POLICY IF EXISTS "Users can view recipe images" ON recipe_images;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies
CREATE POLICY "Users can manage their recipe images"
ON recipe_images
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM recipes
        WHERE recipes.id = recipe_images.recipe_id
        AND recipes.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM recipes
        WHERE recipes.id = recipe_images.recipe_id
        AND recipes.user_id = auth.uid()
    )
);

CREATE POLICY "Users can view recipe images"
ON recipe_images
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM recipes
        WHERE recipes.id = recipe_images.recipe_id
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