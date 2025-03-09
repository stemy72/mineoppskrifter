/*
  # Fix favorite functionality policies

  1. Changes
    - Fix infinite recursion in RLS policies
    - Simplify favorite update policy
    - Add proper indexes for performance

  2. Security
    - Enable RLS policies for favorite status updates
    - Restrict favorite updates to recipe owners
*/

-- Add index for favorite sorting if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_recipes_favorite_sort 
ON recipes (user_id, is_favorite DESC, created_at DESC);

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can update is_favorite status" ON recipes;
DROP POLICY IF EXISTS "Users can update their own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update favorite status" ON recipes;

-- Create a single, clear policy for updating recipes
CREATE POLICY "Users can update their own recipes"
ON recipes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create a separate policy for viewing recipes
CREATE POLICY "Users can view their own recipes"
ON recipes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);