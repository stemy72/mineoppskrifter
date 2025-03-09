/*
  # Add support for multiple recipe images

  1. New Tables
    - `recipe_images`
      - `id` (uuid, primary key)
      - `recipe_id` (uuid, references recipes)
      - `image_url` (text)
      - `created_at` (timestamptz)
      - `order` (integer) for controlling image display order

  2. Security
    - Enable RLS on recipe_images table
    - Add policies for recipe owners
*/

-- Create recipe_images table
CREATE TABLE recipe_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES recipes ON DELETE CASCADE,
  image_url text NOT NULL,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_image_url CHECK (image_url ~ '^https?:\/\/.+'),
  CONSTRAINT max_images_per_recipe UNIQUE (recipe_id, "order"),
  CONSTRAINT order_range CHECK ("order" >= 0 AND "order" <= 4)
);

-- Enable RLS
ALTER TABLE recipe_images ENABLE ROW LEVEL SECURITY;

-- Create index for better performance
CREATE INDEX idx_recipe_images_recipe_id ON recipe_images(recipe_id);

-- Create policy for viewing images
CREATE POLICY "Users can view recipe images"
  ON recipe_images
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM recipes
    WHERE recipes.id = recipe_id
    AND (
      recipes.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM shared_recipes
        WHERE shared_recipes.recipe_id = recipes.id
        AND (
          shared_recipes.shared_email = auth.jwt()->>'email' OR
          shared_recipes.is_public = true
        )
      )
    )
  ));

-- Create policy for managing images
CREATE POLICY "Users can manage their recipe images"
  ON recipe_images
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM recipes
    WHERE recipes.id = recipe_id
    AND recipes.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM recipes
    WHERE recipes.id = recipe_id
    AND recipes.user_id = auth.uid()
  ));

-- Add comment
COMMENT ON TABLE recipe_images IS 'Additional images for recipes (up to 5 per recipe)';