/*
  # Add image data storage for recipes
  
  1. Changes
    - Add image_data column to recipes table
    - Add validation function for base64 images
    - Add constraint for image data validation
    
  2. Notes
    - Preserves existing image_url for backward compatibility
    - New recipes should use image_data instead of image_url
*/

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

-- Create function to validate base64 image data
CREATE OR REPLACE FUNCTION is_valid_base64_image(data text)
RETURNS boolean AS $$
BEGIN
  RETURN data IS NULL OR (
    data LIKE 'data:image/%' AND
    data LIKE ';base64,%'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraint for image data validation
ALTER TABLE recipes
ADD CONSTRAINT valid_image_data
CHECK (is_valid_base64_image(image_data));