-- Legg til sjekkbegrensninger for numeriske verdier, kun hvis de ikke eksisterer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'valid_servings'
    AND conrelid = 'recipes'::regclass
  ) THEN
    ALTER TABLE recipes
    ADD CONSTRAINT valid_servings 
    CHECK (servings IS NULL OR servings > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'valid_cooking_time'
    AND conrelid = 'recipes'::regclass
  ) THEN
    ALTER TABLE recipes
    ADD CONSTRAINT valid_cooking_time 
    CHECK (cooking_time IS NULL OR cooking_time > 0);
  END IF;
END $$;

-- Legg til sjekkbegrensning for rangeringer, kun hvis den ikke eksisterer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'valid_rating'
    AND conrelid = 'cooking_logs'::regclass
  ) THEN
    ALTER TABLE cooking_logs
    ADD CONSTRAINT valid_rating
    CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));
  END IF;
END $$;

-- Opprett funksjon for å validere bildedata, erstatter hvis den eksisterer
CREATE OR REPLACE FUNCTION is_valid_image_data(data text)
RETURNS boolean AS $$
BEGIN
  RETURN data IS NULL OR (
    data LIKE 'data:image/%' AND
    data LIKE '%;base64,%' AND
    (
      data LIKE 'data:image/jpeg%' OR
      data LIKE 'data:image/png%' OR
      data LIKE 'data:image/gif%' OR
      data LIKE 'data:image/webp%'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Legg til begrensning for bildedatavalidering, kun hvis den ikke eksisterer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'valid_image_data'
    AND conrelid = 'recipes'::regclass
  ) THEN
    ALTER TABLE recipes
    ADD CONSTRAINT valid_image_data
    CHECK (is_valid_image_data(image_data));
  END IF;
END $$;

-- Opprett funksjon for å validere URL-er, erstatter hvis den eksisterer
CREATE OR REPLACE FUNCTION is_valid_url(url text)
RETURNS boolean AS $$
BEGIN
  RETURN url IS NULL OR url ~ '^https?:\/\/.+';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Legg til URL-valideringsbegrensninger, kun hvis de ikke eksisterer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'valid_source_url'
    AND conrelid = 'recipes'::regclass
  ) THEN
    ALTER TABLE recipes
    ADD CONSTRAINT valid_source_url
    CHECK (is_valid_url(source_url));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'valid_image_url'
    AND conrelid = 'recipes'::regclass
  ) THEN
    ALTER TABLE recipes
    ADD CONSTRAINT valid_image_url
    CHECK (is_valid_url(image_url));
  END IF;
END $$;

-- Opprett indekser for vanlige spørringer, kun hvis de ikke eksisterer
CREATE INDEX IF NOT EXISTS idx_recipes_user_recent ON recipes (user_id, created_at DESC)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cooking_logs_recipe ON cooking_logs (recipe_id, cooked_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_recipes_lookup ON shared_recipes (recipe_id, shared_email)
WHERE shared_email IS NOT NULL;

-- Legg til kommentarer for dokumentasjon
COMMENT ON CONSTRAINT valid_servings ON recipes IS 'Sikrer at antall porsjoner er et positivt tall';
COMMENT ON CONSTRAINT valid_cooking_time ON recipes IS 'Sikrer at tilberedningstiden er et positivt tall';
COMMENT ON CONSTRAINT valid_rating ON cooking_logs IS 'Sikrer at rangering er mellom 1 og 5';
COMMENT ON CONSTRAINT valid_image_data ON recipes IS 'Validerer base64-bildedataformat';
COMMENT ON CONSTRAINT valid_source_url ON recipes IS 'Sikrer at kilde-URL er riktig formatert';
COMMENT ON CONSTRAINT valid_image_url ON recipes IS 'Sikrer at bilde-URL er riktig formatert';

-- Gi nødvendige tillatelser
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;