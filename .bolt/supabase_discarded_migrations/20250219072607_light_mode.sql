/*
  # Optimize Recipe Sharing System

  1. Changes
    - Add indexes for performance
    - Add helper functions
    - Update security policies
    - Add validation triggers

  2. Security
    - Proper RLS enforcement
    - Ownership validation
    - Email-based sharing
    - Public recipe handling
*/

-- Create function to validate recipe ownership before sharing
CREATE OR REPLACE FUNCTION validate_recipe_share()
RETURNS trigger AS $$
BEGIN
  -- Check if user owns the recipe
  IF NOT EXISTS (
    SELECT 1 FROM recipes
    WHERE id = NEW.recipe_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only share recipes that you own';
  END IF;

  -- Set shared_by to current user
  NEW.shared_by = auth.uid();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for share validation
CREATE TRIGGER validate_recipe_share_trigger
  BEFORE INSERT ON shared_recipes
  FOR EACH ROW
  EXECUTE FUNCTION validate_recipe_share();

-- Create function to check recipe access
CREATE OR REPLACE FUNCTION has_recipe_access(recipe_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM recipes r
    LEFT JOIN shared_recipes sr ON r.id = sr.recipe_id
    WHERE r.id = recipe_id
    AND (
      r.user_id = auth.uid() OR
      sr.shared_email = auth.jwt()->>'email' OR
      sr.is_public = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create optimized view for shared recipes
CREATE OR REPLACE VIEW shared_recipes_view AS
SELECT 
  r.id,
  r.title,
  r.description,
  r.image_url,
  r.image_data,
  r.created_at,
  r.user_id,
  sr.shared_email,
  sr.is_public,
  array_remove(array_agg(DISTINCT rt.tag_id), NULL) as tag_ids
FROM recipes r
LEFT JOIN shared_recipes sr ON r.id = sr.recipe_id
LEFT JOIN recipe_tags rt ON r.id = rt.recipe_id
WHERE has_recipe_access(r.id)
GROUP BY r.id, r.title, r.description, r.image_url, r.image_data, r.created_at, r.user_id, sr.shared_email, sr.is_public;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shared_recipes_recipe_id ON shared_recipes(recipe_id);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_shared_email ON shared_recipes(shared_email);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_is_public ON shared_recipes(is_public);
CREATE INDEX IF NOT EXISTS idx_shared_recipes_shared_by ON shared_recipes(shared_by);

-- Update RLS policies
ALTER TABLE shared_recipes ENABLE ROW LEVEL SECURITY;

-- Policy for viewing shared recipes
CREATE POLICY "View shared recipes"
  ON shared_recipes
  FOR SELECT
  TO authenticated
  USING (
    shared_email = auth.jwt()->>'email' OR
    is_public = true OR
    shared_by = auth.uid()
  );

-- Policy for sharing recipes
CREATE POLICY "Share recipes"
  ON shared_recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shared_by = auth.uid()
  );

-- Policy for managing shares
CREATE POLICY "Manage shared recipes"
  ON shared_recipes
  FOR DELETE
  TO authenticated
  USING (shared_by = auth.uid());

-- Grant access to view
GRANT SELECT ON shared_recipes_view TO authenticated;

-- Add comments
COMMENT ON FUNCTION validate_recipe_share IS 'Validates recipe ownership before sharing';
COMMENT ON FUNCTION has_recipe_access IS 'Checks if user has access to a recipe';
COMMENT ON VIEW shared_recipes_view IS 'Optimized view for shared recipes with access control';