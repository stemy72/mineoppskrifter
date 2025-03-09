-- Drop existing function and constraint
DROP FUNCTION IF EXISTS is_valid_image_data CASCADE;
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS valid_image_data;

-- Create improved image validation function
CREATE OR REPLACE FUNCTION is_valid_image_data(data text)
RETURNS boolean AS $$
BEGIN
  -- Allow null values
  IF data IS NULL THEN
    RETURN true;
  END IF;

  -- Strict validation for JPEG base64 data
  RETURN (
    data LIKE 'data:image/jpeg;base64,%' AND
    length(replace(data, 'data:image/jpeg;base64,', '')) > 0 AND
    length(replace(data, 'data:image/jpeg;base64,', '')) <= 700000 -- ~500KB in base64
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add improved constraint
ALTER TABLE recipes
ADD CONSTRAINT valid_image_data
CHECK (is_valid_image_data(image_data));

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT valid_image_data ON recipes IS 'Ensures image_data is either null or valid base64 JPEG data under 500KB';