/*
  # Add source URL to recipes

  1. Changes
    - Add source_url column to recipes table
    - Add URL validation function
    - Add URL validation constraint
    - Add helpful comment
*/

-- Add source_url column
ALTER TABLE recipes
ADD COLUMN source_url text;

-- Create function to validate URLs
CREATE OR REPLACE FUNCTION is_valid_url(url text)
RETURNS boolean AS $$
BEGIN
  RETURN url IS NULL OR url ~ '^https?:\/\/.+';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add URL validation constraint
ALTER TABLE recipes
ADD CONSTRAINT valid_source_url
CHECK (is_valid_url(source_url));

-- Add comment explaining the column
COMMENT ON COLUMN recipes.source_url IS 'External reference URL for the recipe source';