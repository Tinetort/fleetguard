-- Manager Approval Gate for Red Vehicles
-- Run this in Supabase SQL Editor

-- Step 1: Add columns
ALTER TABLE public.vehicles 
  ADD COLUMN IF NOT EXISTS pending_approval BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_approval_data JSONB DEFAULT NULL;

-- Step 2: Update the trigger to set pending_approval for red vehicles
CREATE OR REPLACE FUNCTION update_vehicle_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update last_checked for start-of-shift check
  IF NEW.shift_type = 'start_of_shift' OR NEW.shift_type IS NULL THEN
    UPDATE public.vehicles SET last_checked_at = NEW.created_at WHERE id = NEW.vehicle_id;
  END IF;

  -- Determine status based on AI assessment
  IF NEW.ai_damage_severity = 'red' OR (NEW.damage_notes IS NOT NULL AND TRIM(NEW.damage_notes) <> '' AND NEW.ai_damage_severity IS NULL) THEN
    UPDATE public.vehicles SET status = 'red'::vehicle_status WHERE id = NEW.vehicle_id;
  ELSIF NEW.ai_damage_severity = 'yellow' THEN
    UPDATE public.vehicles SET status = 'yellow'::vehicle_status WHERE id = NEW.vehicle_id;
  ELSE
    UPDATE public.vehicles SET status = 'green'::vehicle_status WHERE id = NEW.vehicle_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
