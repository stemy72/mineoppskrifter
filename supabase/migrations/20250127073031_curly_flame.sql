/*
  # Add tag deletion policy

  1. Changes
    - Add policy to allow authenticated users to delete tags
    - This is needed to support tag deletion functionality in the recipe form

  2. Security
    - Only authenticated users can delete tags
    - Tags can be deleted by any authenticated user since they are shared resources
*/

-- Add policy for tag deletion
CREATE POLICY "Authenticated users can delete tags"
  ON tags FOR DELETE 
  TO authenticated
  USING (true);