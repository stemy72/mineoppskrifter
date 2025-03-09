/*
  # Recipe Image Storage Configuration

  1. Storage Configuration
    - Configure recipe-images bucket
    - Set up RLS policies
    - Add image URL tracking

  2. Security
    - Enable RLS on storage bucket
    - Add policies for authenticated users
    - Validate file types and sizes
*/

-- Create recipe_images storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES (
  'recipe-images',
  'recipe-images',
  true -- Make bucket public for easy image access
) ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for uploading images
CREATE POLICY "Users can upload recipe images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recipe-images' AND
  (CASE
    WHEN RIGHT(name, 4) = '.jpg' THEN octet_length(file) <= 5242880
    WHEN RIGHT(name, 5) = '.jpeg' THEN octet_length(file) <= 5242880
    WHEN RIGHT(name, 4) = '.png' THEN octet_length(file) <= 5242880
    WHEN RIGHT(name, 5) = '.webp' THEN octet_length(file) <= 5242880
    ELSE false
  END)
);

-- Policy for reading images
CREATE POLICY "Anyone can read recipe images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'recipe-images');

-- Policy for deleting images
CREATE POLICY "Users can delete their recipe images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'recipe-images' AND
  auth.uid() = owner
);

-- Add comments
COMMENT ON TABLE storage.objects IS 'Recipe images are stored in the recipe-images bucket';