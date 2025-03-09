-- Add servings and cooking time columns to recipes table
ALTER TABLE recipes
ADD COLUMN servings integer,
ADD COLUMN cooking_time integer;

-- Add check constraints to ensure positive values
ALTER TABLE recipes
ADD CONSTRAINT valid_servings CHECK (servings IS NULL OR servings > 0),
ADD CONSTRAINT valid_cooking_time CHECK (cooking_time IS NULL OR cooking_time > 0);

-- Add comments for documentation
COMMENT ON COLUMN recipes.servings IS 'Number of servings the recipe yields';
COMMENT ON COLUMN recipes.cooking_time IS 'Total cooking time in minutes';