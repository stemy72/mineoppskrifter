-- Create function to create recipe
CREATE OR REPLACE FUNCTION create_recipe(
  p_title text,
  p_description text,
  p_instructions text,
  p_image_data text,
  p_source_url text,
  p_servings integer,
  p_cooking_time integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipe_id uuid;
BEGIN
  -- Validate required fields
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Recipe title is required';
  END IF;

  IF p_instructions IS NULL OR length(trim(p_instructions)) = 0 THEN
    RAISE EXCEPTION 'Recipe instructions are required';
  END IF;

  -- Validate image data
  IF NOT is_valid_image_data(p_image_data) THEN
    RAISE EXCEPTION 'Invalid image data format';
  END IF;

  -- Create recipe
  INSERT INTO recipes (
    title,
    description,
    instructions,
    image_data,
    source_url,
    servings,
    cooking_time,
    user_id,
    created_at,
    updated_at
  ) VALUES (
    trim(p_title),
    trim(p_description),
    trim(p_instructions),
    p_image_data,
    NULLIF(trim(p_source_url), ''),
    p_servings,
    p_cooking_time,
    auth.uid(),
    now(),
    now()
  )
  RETURNING id INTO v_recipe_id;

  RETURN v_recipe_id;
END;
$$;

-- Create function to update recipe
CREATE OR REPLACE FUNCTION update_recipe(
  p_recipe_id uuid,
  p_title text,
  p_description text,
  p_instructions text,
  p_image_data text,
  p_source_url text,
  p_servings integer,
  p_cooking_time integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM recipes
    WHERE id = p_recipe_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Recipe not found or access denied';
  END IF;

  -- Validate required fields
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Recipe title is required';
  END IF;

  IF p_instructions IS NULL OR length(trim(p_instructions)) = 0 THEN
    RAISE EXCEPTION 'Recipe instructions are required';
  END IF;

  -- Validate image data
  IF NOT is_valid_image_data(p_image_data) THEN
    RAISE EXCEPTION 'Invalid image data format';
  END IF;

  -- Update recipe
  UPDATE recipes
  SET
    title = trim(p_title),
    description = trim(p_description),
    instructions = trim(p_instructions),
    image_data = p_image_data,
    source_url = NULLIF(trim(p_source_url), ''),
    servings = p_servings,
    cooking_time = p_cooking_time,
    updated_at = now()
  WHERE id = p_recipe_id
  AND user_id = auth.uid();
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_recipe TO authenticated;
GRANT EXECUTE ON FUNCTION update_recipe TO authenticated;

-- Add comments
COMMENT ON FUNCTION create_recipe IS 'Creates a new recipe with validation and security checks';
COMMENT ON FUNCTION update_recipe IS 'Updates an existing recipe with validation and security checks';