/*
  # Create Temporary Migration Table
  
  Creates the temp_image_migration table and populates it with existing image data
*/

-- Drop existing table if it exists
DROP TABLE IF EXISTS temp_image_migration CASCADE;

-- Create temp_image_migration table
CREATE TABLE temp_image_migration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES recipes(id) ON DELETE CASCADE,
  image_data text NOT NULL,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  storage_path text,
  error text,
  created_at timestamptz DEFAULT now()
);

-- Add comments
COMMENT ON TABLE temp_image_migration IS 'Temporary table for tracking image migration progress';
COMMENT ON COLUMN temp_image_migration.image_data IS 'Base64 encoded image data from recipes table';
COMMENT ON COLUMN temp_image_migration.processed IS 'Whether the image has been processed';
COMMENT ON COLUMN temp_image_migration.storage_path IS 'Path where the image was stored in the bucket';
COMMENT ON COLUMN temp_image_migration.error IS 'Error message if processing failed';

-- Enable RLS
ALTER TABLE temp_image_migration ENABLE ROW LEVEL SECURITY;

-- Create policy for admins
CREATE POLICY "Admins can manage temp_image_migration"
ON temp_image_migration
FOR ALL
TO postgres
USING (true)
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_temp_image_migration_recipe_id 
ON temp_image_migration(recipe_id);

CREATE INDEX idx_temp_image_migration_processed 
ON temp_image_migration(processed);

-- Insert existing image data
INSERT INTO temp_image_migration (recipe_id, image_data)
SELECT id, image_data
FROM recipes
WHERE image_data IS NOT NULL
AND image_data != ''
AND NOT EXISTS (
  SELECT 1 FROM temp_image_migration 
  WHERE recipe_id = recipes.id
);