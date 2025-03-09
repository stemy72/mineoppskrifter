-- Add image_data column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'recipes' 
    AND column_name = 'image_data'
  ) THEN
    ALTER TABLE recipes ADD COLUMN image_data text;
  END IF;
END $$;

-- Add comment explaining the column
COMMENT ON COLUMN recipes.image_data IS 'Base64 encoded image data for recipe photos';

-- Drop existing constraint if it exists
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS valid_image_data;

-- Create function to validate base64 image data
CREATE OR REPLACE FUNCTION is_valid_base64_image(data text)
RETURNS boolean AS $$
BEGIN
  -- Allow null values
  IF data IS NULL THEN
    RETURN true;
  END IF;

  -- Check for valid data URL format with image MIME type
  RETURN (
    data LIKE 'data:image/jpeg;base64,%' OR
    data LIKE 'data:image/png;base64,%' OR
    data LIKE 'data:image/gif;base64,%' OR
    data LIKE 'data:image/webp;base64,%'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraint for image data validation
ALTER TABLE recipes
ADD CONSTRAINT valid_image_data
CHECK (is_valid_base64_image(image_data));