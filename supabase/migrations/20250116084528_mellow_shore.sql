/*
  # Recipe Management Schema

  1. New Tables
    - `recipes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `title` (text)
      - `description` (text)
      - `instructions` (text)
      - `image_url` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `ingredients`
      - `id` (uuid, primary key)
      - `recipe_id` (uuid, references recipes)
      - `name` (text)
      - `amount` (decimal)
      - `unit` (text)
    
    - `cooking_logs`
      - `id` (uuid, primary key)
      - `recipe_id` (uuid, references recipes)
      - `user_id` (uuid, references auth.users)
      - `cooked_at` (timestamp)
      - `notes` (text)
      - `rating` (integer)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create recipes table
CREATE TABLE recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  title text NOT NULL,
  description text,
  instructions text,
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create ingredients table
CREATE TABLE ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES recipes ON DELETE CASCADE,
  name text NOT NULL,
  amount decimal,
  unit text
);

-- Create cooking_logs table
CREATE TABLE cooking_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES recipes ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users NOT NULL,
  cooked_at timestamptz DEFAULT now(),
  notes text,
  rating integer CHECK (rating >= 1 AND rating <= 5)
);

-- Enable RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooking_logs ENABLE ROW LEVEL SECURITY;

-- Policies for recipes
CREATE POLICY "Users can view their own recipes"
  ON recipes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recipes"
  ON recipes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes"
  ON recipes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes"
  ON recipes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for ingredients
CREATE POLICY "Users can manage ingredients for their recipes"
  ON ingredients FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM recipes
    WHERE recipes.id = ingredients.recipe_id
    AND recipes.user_id = auth.uid()
  ));

-- Policies for cooking_logs
CREATE POLICY "Users can view their cooking logs"
  ON cooking_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their cooking logs"
  ON cooking_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their cooking logs"
  ON cooking_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their cooking logs"
  ON cooking_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);