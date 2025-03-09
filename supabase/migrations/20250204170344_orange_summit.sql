/*
  # Add grocery list finalization fields
  
  1. Changes
    - Add finalized status to grocery_lists
    - Add finalized_at timestamp
    - Add start_date and end_date for date range tracking
    - Add name field for better list identification
*/

ALTER TABLE grocery_lists
ADD COLUMN finalized boolean DEFAULT false,
ADD COLUMN finalized_at timestamptz,
ADD COLUMN start_date date,
ADD COLUMN end_date date,
ADD COLUMN name text;

-- Update existing grocery lists to set dates from meal plans
UPDATE grocery_lists gl
SET 
  start_date = mp.start_date,
  end_date = mp.start_date + (mp.days - 1) * INTERVAL '1 day',
  name = 'Grocery List for ' || to_char(mp.start_date, 'Mon DD') || ' - ' || to_char(mp.start_date + (mp.days - 1) * INTERVAL '1 day', 'Mon DD, YYYY')
FROM meal_plans mp
WHERE gl.meal_plan_id = mp.id;

-- Make dates required for future lists
ALTER TABLE grocery_lists
ALTER COLUMN start_date SET NOT NULL,
ALTER COLUMN end_date SET NOT NULL,
ALTER COLUMN name SET NOT NULL;