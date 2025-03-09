/*
  # Image Migration to Storage Bucket

  1. Drop existing functions
  2. Create new functions for image migration
  3. Set up proper permissions
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS migrate_recipe_images(text);
DROP FUNCTION IF EXISTS process_image(text, uuid, text);
DROP FUNCTION IF EXISTS cleanup_migration();

-- Create function to process individual images
CREATE OR REPLACE FUNCTION process_image(
  image_data text,
  recipe_id uuid,
  bucket_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  file_path text;
  storage_path text;
BEGIN
  -- Generate unique file path
  file_path := 'recipe-' || recipe_id || '-' || floor(extract(epoch from now())) || '.jpg';
  storage_path := bucket_name || '/' || file_path;

  -- Store in storage bucket
  INSERT INTO storage.objects (
    bucket_id,
    name,
    owner,
    created_at,
    updated_at,
    last_accessed_at,
    metadata
  ) VALUES (
    bucket_name,
    file_path,
    auth.uid(),
    now(),
    now(),
    now(),
    jsonb_build_object(
      'mimetype', 'image/jpeg',
      'size', length(decode(replace(image_data, 'data:image/jpeg;base64,', ''), 'base64'))
    )
  );

  -- Return the storage URL
  RETURN storage_path;
EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'Failed to process image: %', SQLERRM;
END;
$$;

-- Create main migration function
CREATE OR REPLACE FUNCTION migrate_recipe_images(bucket_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  migration_record RECORD;
  success_count integer := 0;
  error_count integer := 0;
  storage_path text;
BEGIN
  -- Verify bucket exists
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets 
    WHERE id = bucket_name
  ) THEN
    RAISE EXCEPTION 'Bucket "%" does not exist', bucket_name;
  END IF;

  -- Process each image
  FOR migration_record IN 
    SELECT * FROM temp_image_migration
    WHERE processed = false
  LOOP
    BEGIN
      -- Process and store image
      storage_path := process_image(
        migration_record.image_data,
        migration_record.recipe_id,
        bucket_name
      );

      -- Update recipe with new image URL
      UPDATE recipes 
      SET image_url = storage_path,
          image_data = NULL
      WHERE id = migration_record.recipe_id;

      -- Mark as processed
      UPDATE temp_image_migration
      SET processed = true,
          processed_at = now(),
          storage_path = storage_path
      WHERE id = migration_record.id;

      success_count := success_count + 1;
    EXCEPTION WHEN others THEN
      error_count := error_count + 1;
      
      -- Log error
      UPDATE temp_image_migration
      SET error = SQLERRM,
          processed = true,
          processed_at = now()
      WHERE id = migration_record.id;
      
      CONTINUE;
    END;
  END LOOP;

  RETURN format(
    'Migration complete. Successfully processed %s images, %s errors.',
    success_count,
    error_count
  );
END;
$$;

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_migration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only clean up processed records
  DELETE FROM temp_image_migration
  WHERE processed = true
  AND processed_at < now() - interval '7 days';
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION migrate_recipe_images(text) TO postgres;
GRANT EXECUTE ON FUNCTION process_image(text, uuid, text) TO postgres;
GRANT EXECUTE ON FUNCTION cleanup_migration() TO postgres;

-- Add helpful comments
COMMENT ON FUNCTION migrate_recipe_images(text) IS 'Migrates images from temp_image_migration to specified storage bucket';
COMMENT ON FUNCTION process_image(text, uuid, text) IS 'Processes and uploads individual images to storage';
COMMENT ON FUNCTION cleanup_migration() IS 'Cleans up processed migration records after 7 days';