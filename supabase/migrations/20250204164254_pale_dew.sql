/*
  # Fix meal planner schema

  1. Changes
    - Recreate meal planning tables with correct structure
    - Add proper RLS policies
    - Ensure all required columns exist

  2. Tables
    - meal_plans
    - meal_plan_recipes
    - grocery_lists
    - grocery_items

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS grocery_items CASCADE;
DROP TABLE IF EXISTS grocery_lists CASCADE;
DROP TABLE IF EXISTS meal_plan_recipes CASCADE;
DROP TABLE IF EXISTS meal_plans CASCADE;

-- Create meal_plans table
CREATE TABLE meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  start_date date NOT NULL,
  days integer NOT NULL CHECK (days >= 1 AND days <= 14),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create meal_plan_recipes table
CREATE TABLE meal_plan_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id uuid REFERENCES meal_plans ON DELETE CASCADE,
  recipe_id uuid REFERENCES recipes ON DELETE CASCADE,
  day_number integer NOT NULL CHECK (day_number >= 1 AND day_number <= 14),
  meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  UNIQUE (meal_plan_id, day_number, meal_type)
);

-- Create grocery_lists table
CREATE TABLE grocery_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id uuid REFERENCES meal_plans ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create grocery_items table
CREATE TABLE grocery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grocery_list_id uuid REFERENCES grocery_lists ON DELETE CASCADE,
  name text NOT NULL,
  amount decimal,
  unit text,
  checked boolean DEFAULT false,
  is_custom boolean DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_items ENABLE ROW LEVEL SECURITY;

-- Policies for meal_plans
CREATE POLICY "Users can manage their meal plans"
  ON meal_plans FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policies for meal_plan_recipes
CREATE POLICY "Users can manage their meal plan recipes"
  ON meal_plan_recipes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_id
      AND meal_plans.user_id = auth.uid()
    )
  );

-- Policies for grocery_lists
CREATE POLICY "Users can manage their grocery lists"
  ON grocery_lists FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policies for grocery_items
CREATE POLICY "Users can manage their grocery items"
  ON grocery_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grocery_lists
      WHERE grocery_lists.id = grocery_list_id
      AND grocery_lists.user_id = auth.uid()
    )
  );