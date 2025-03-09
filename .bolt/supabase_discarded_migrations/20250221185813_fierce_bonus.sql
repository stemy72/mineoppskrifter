-- Create function to validate recipe data
CREATE OR REPLACE FUNCTION validate_recipe_data()
RETURNS trigger AS $$
BEGIN
  -- Validate required fields
  IF NEW.title IS NULL OR length(trim(NEW.title)) = 0 THEN
    RAISE EXCEPTION 'Recipe title is required';
  END IF;

  IF NEW.instructions IS NULL OR length(trim(NEW.instructions)) = 0 THEN
    RAISE EXCEPTION 'Recipe instructions are required';
  END IF;

  -- Validate numeric fields
  IF NEW.servings IS NOT NULL AND NEW.servings <= 0 THEN
    RAISE EXCEPTION 'Servings must be a positive number';
  END IF;

  IF NEW.cooking_time IS NOT NULL AND NEW.cooking_time <= 0 THEN
    RAISE EXCEPTION 'Cooking time must be a positive number';
  END IF;

  -- Validate URLs
  IF NEW.source_url IS NOT NULL AND NOT is_valid_url(NEW.source_url) THEN
    RAISE EXCEPTION 'Invalid source URL format';
  END IF;

  -- Set user_id if not provided
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  -- Set timestamps
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for recipe validation
DROP TRIGGER IF EXISTS validate_recipe_data_trigger ON recipes;
CREATE TRIGGER validate_recipe_data_trigger
  BEFORE INSERT OR UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION validate_recipe_data();

-- Create function to handle recipe imports
CREATE OR REPLACE FUNCTION import_recipe(
  title text,
  description text,
  instructions text,
  servings integer,
  cooking_time integer,
  image_data text,
  source_url text DEFAULT NULL,
  tag_ids uuid[] DEFAULT NULL
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_recipe_id uuid;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Insert recipe
  INSERT INTO recipes (
    title,
    description,
    instructions,
    servings,
    cooking_time,
    image_data,
    source_url,
    user_id
  ) VALUES (
    title,
    description,
    instructions,
    servings,
    cooking_time,
    image_data,
    source_url,
    auth.uid()
  )
  RETURNING id INTO new_recipe_id;

  -- Add tags if provided
  IF tag_ids IS NOT NULL AND array_length(tag_ids, 1) > 0 THEN
    INSERT INTO recipe_tags (recipe_id, tag_id)
    SELECT new_recipe_id, unnest(tag_ids);
  END IF;

  RETURN new_recipe_id;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION import_recipe TO authenticated;

-- Add comments
COMMENT ON FUNCTION validate_recipe_data IS 'Validates recipe data before insert or update';
COMMENT ON FUNCTION import_recipe IS 'Securely imports a new recipe with optional tags';

-- Create policy for recipe imports
DROP POLICY IF EXISTS "Users can import recipes" ON recipes;
CREATE POLICY "Users can import recipes"
  ON recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    user_id IS NULL
  );

-- Create index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_recipes_title_user 
ON recipes (user_id, lower(title))
WHERE user_id IS NOT NULL;