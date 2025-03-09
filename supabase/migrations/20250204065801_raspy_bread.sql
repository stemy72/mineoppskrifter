/*
  # Add recipe sharing functionality

  1. New Tables
    - `shared_recipes`
      - `id` (uuid, primary key)
      - `recipe_id` (uuid, references recipes)
      - `shared_by` (uuid, references auth.users)
      - `shared_with` (uuid, references auth.users, nullable)
      - `is_public` (boolean)
      - `created_at` (timestamptz)

  2. Changes
    - Add sharing-related columns to recipes table
    - Update RLS policies to handle shared recipes

  3. Security
    - Enable RLS on shared_recipes table
    - Add policies for sharing and viewing shared recipes
*/

-- Add sharing-related columns to recipes table
ALTER TABLE recipes
ADD COLUMN is_public boolean DEFAULT false,
ADD COLUMN shared_count integer DEFAULT 0;

-- Create shared_recipes table
CREATE TABLE shared_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES recipes ON DELETE CASCADE,
  shared_by uuid REFERENCES auth.users NOT NULL,
  shared_with uuid REFERENCES auth.users,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE shared_recipes ENABLE ROW LEVEL SECURITY;

-- Policies for shared_recipes
CREATE POLICY "Users can share their own recipes"
  ON shared_recipes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_id
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view recipes shared with them"
  ON shared_recipes FOR SELECT
  TO authenticated
  USING (
    shared_with = auth.uid() OR
    shared_by = auth.uid() OR
    is_public = true
  );

-- Update recipes policies to allow viewing shared recipes
CREATE POLICY "Users can view recipes shared with them"
  ON recipes FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    id IN (
      SELECT recipe_id FROM shared_recipes
      WHERE shared_with = auth.uid() OR is_public = true
    )
  );

-- Function to update shared_count
CREATE OR REPLACE FUNCTION update_recipe_shared_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE recipes 
    SET shared_count = shared_count + 1
    WHERE id = NEW.recipe_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE recipes 
    SET shared_count = shared_count - 1
    WHERE id = OLD.recipe_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for shared_count
CREATE TRIGGER update_shared_count
AFTER INSERT OR DELETE ON shared_recipes
FOR EACH ROW
EXECUTE FUNCTION update_recipe_shared_count();