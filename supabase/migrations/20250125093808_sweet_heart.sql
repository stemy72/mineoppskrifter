/*
  # Add tags functionality

  1. New Tables
    - `tags`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `created_at` (timestamp)
    - `recipe_tags`
      - `recipe_id` (uuid, references recipes)
      - `tag_id` (uuid, references tags)
      - Primary key is (recipe_id, tag_id)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create recipe_tags junction table
CREATE TABLE IF NOT EXISTS recipe_tags (
  recipe_id uuid REFERENCES recipes ON DELETE CASCADE,
  tag_id uuid REFERENCES tags ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);

-- Enable RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_tags ENABLE ROW LEVEL SECURITY;

-- Policies for tags
CREATE POLICY "Tags are viewable by all authenticated users"
  ON tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies for recipe_tags
CREATE POLICY "Users can view recipe tags"
  ON recipe_tags FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM recipes
    WHERE recipes.id = recipe_tags.recipe_id
    AND recipes.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage tags for their recipes"
  ON recipe_tags FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM recipes
    WHERE recipes.id = recipe_tags.recipe_id
    AND recipes.user_id = auth.uid()
  ));