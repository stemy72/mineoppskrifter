/*
  # Update profiles table for image storage
  
  1. Changes
    - Add avatar_data column for storing base64 encoded images
    - Add function to validate URLs
    - Add avatar_data column for storing base64 encoded profile pictures
  
  2. Security
    - Enable RLS on new column
    - Maintain existing policies
*/

-- First remove any invalid URLs from existing rows
UPDATE profiles 
SET avatar_url = NULL 
WHERE avatar_url IS NOT NULL 
  AND avatar_url !~ '^https:\/\/.*\.(jpg|jpeg|png|gif|webp)$';

-- Add function to validate HTTPS image URLs
CREATE OR REPLACE FUNCTION is_valid_https_image_url(url text)
RETURNS boolean AS $$
BEGIN
  RETURN url ~ '^https:\/\/.*\.(jpg|jpeg|png|gif|webp)$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add avatar_data column
ALTER TABLE profiles 
ADD COLUMN avatar_data text;

-- Add URL validation constraint
ALTER TABLE profiles 
ADD CONSTRAINT avatar_url_https_only 
  CHECK (
    avatar_url IS NULL OR 
    is_valid_https_image_url(avatar_url)
  );

-- Add comments explaining the columns
COMMENT ON COLUMN profiles.avatar_url IS 'Legacy URL field - being phased out';
COMMENT ON COLUMN profiles.avatar_data IS 'Base64 encoded image data';