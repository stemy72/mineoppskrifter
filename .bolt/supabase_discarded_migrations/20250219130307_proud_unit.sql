-- Add is_verified column to profiles
ALTER TABLE profiles
ADD COLUMN is_verified boolean DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN profiles.is_verified IS 'Indicates if the user''s profile has been verified';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified ON profiles(is_verified);

-- Update existing profiles
UPDATE profiles
SET is_verified = false
WHERE is_verified IS NULL;

-- Add RLS policy for is_verified
CREATE POLICY "Users can view profile verification status"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Add function to verify profiles (admin only)
CREATE OR REPLACE FUNCTION verify_profile(profile_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only allow superusers to verify profiles
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'is_admin' = 'true'
  ) THEN
    RAISE EXCEPTION 'Only administrators can verify profiles';
  END IF;

  UPDATE profiles
  SET is_verified = true
  WHERE id = profile_id;
END;
$$;