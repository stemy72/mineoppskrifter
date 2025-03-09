-- Drop existing constraint and function
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS valid_source_url;
DROP FUNCTION IF EXISTS is_valid_url;

-- Create improved URL validation function
CREATE OR REPLACE FUNCTION is_valid_url(url text)
RETURNS boolean AS $$
BEGIN
  -- Allow null or empty URLs
  IF url IS NULL OR url = '' THEN
    RETURN true;
  END IF;

  -- Basic URL validation
  RETURN url ~ '^https?://.+';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add improved URL validation constraint
ALTER TABLE recipes
ADD CONSTRAINT valid_source_url
CHECK (is_valid_url(source_url));

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT valid_source_url ON recipes IS 'Ensures source_url is either null, empty, or a valid http/https URL';