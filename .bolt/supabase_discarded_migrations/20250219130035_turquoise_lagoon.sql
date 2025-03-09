-- Drop existing function and trigger
DROP TRIGGER IF EXISTS set_profile_username_trigger ON profiles;
DROP FUNCTION IF EXISTS set_profile_username();
DROP FUNCTION IF EXISTS generate_username(text);

-- Create new function to set username as email
CREATE OR REPLACE FUNCTION set_profile_username()
RETURNS trigger AS $$
DECLARE
  user_email text;
BEGIN
  -- Get email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Set username to email
  NEW.username := user_email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER set_profile_username_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_profile_username();

-- Update existing profiles to use email as username
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN 
    SELECT p.id, u.email 
    FROM profiles p 
    JOIN auth.users u ON u.id = p.id 
    WHERE p.username IS NULL OR p.username != u.email
  LOOP
    UPDATE profiles 
    SET username = profile_record.email
    WHERE id = profile_record.id;
  END LOOP;
END $$;

-- Update comment to reflect new behavior
COMMENT ON COLUMN profiles.username IS 'User''s email address, automatically set from auth.users';