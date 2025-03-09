/*
  # Add isSection column to ingredients table

  1. Changes
    - Add isSection boolean column to ingredients table with default false
    - Add comment explaining the column's purpose
    - Add index for better performance when querying sections
*/

-- Add isSection column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'ingredients' 
    AND column_name = 'is_section'
  ) THEN
    ALTER TABLE ingredients 
    ADD COLUMN is_section boolean DEFAULT false;
  END IF;
END $$;

-- Add comment explaining the column
COMMENT ON COLUMN ingredients.is_section IS 'Indicates if this ingredient is a section header for grouping ingredients';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_ingredients_is_section ON ingredients(is_section);