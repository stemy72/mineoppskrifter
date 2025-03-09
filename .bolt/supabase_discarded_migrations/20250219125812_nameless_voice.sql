-- Add username column to profiles
ALTER TABLE profiles
ADD COLUMN username text UNIQUE;

-- Create function to generate username from email
CREATE OR REPLACE FUNCTION generate_username(email text)
RETURNS text AS $$
DECLARE
  base_username text;
  final_username text;
  counter integer := 0;
BEGIN
  -- Extract part before @ and remove special characters
  base_username := lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9]', '', 'g'));
  
  -- Initial try with base username
  final_username := base_username;
  
  -- Keep trying with incremented numbers until we find a unique username
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter::text;
  END LOOP;
  
  RETURN final_username;
END;
$$ LANGUAGE plpgsql;

-- Update existing profiles with usernames
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN 
    SELECT p.id, u.email 
    FROM profiles p 
    JOIN auth.users u ON u.id = p.id 
    WHERE p.username IS NULL
  LOOP
    UPDATE profiles 
    SET username = generate_username(profile_record.email)
    WHERE id = profile_record.id;
  END LOOP;
END $$;

-- Create trigger to set username for new profiles
CREATE OR REPLACE FUNCTION set_profile_username()
RETURNS trigger AS $$
DECLARE
  user_email text;
BEGIN
  -- Get email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Set username if not already set
  IF NEW.username IS NULL THEN
    NEW.username := generate_username(user_email);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER set_profile_username_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_profile_username();

-- Add comment explaining username field
COMMENT ON COLUMN profiles.username IS 'Auto-generated unique username from email, read-only';