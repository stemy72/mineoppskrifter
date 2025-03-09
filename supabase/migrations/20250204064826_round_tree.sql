/*
  # Update tags table unique constraint

  1. Changes
    - Remove the unique constraint on name column
    - Add a unique constraint on (name, user_id) combination
    - This allows different users to have tags with the same name
    - But prevents a single user from having duplicate tag names

  2. Security
    - Maintains existing RLS policies
*/

-- Drop the existing unique constraint on name
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_key;

-- Add a new unique constraint on name and user_id combination
ALTER TABLE tags 
ADD CONSTRAINT tags_name_user_id_key UNIQUE (name, user_id);