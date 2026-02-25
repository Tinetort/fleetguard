-- ================================================================
-- FleetGuard Migration — Phase 1
-- Run this in Supabase SQL Editor AFTER mvp-rls-permissive.sql
-- ================================================================

-- New enum types
DO $$ BEGIN
  CREATE TYPE org_type AS ENUM ('ems', 'fire', 'police', 'fleet', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE shift_type AS ENUM ('start_of_shift', 'end_of_shift');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fuel_level AS ENUM ('empty', 'quarter', 'half', 'three_quarter', 'full');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add shift_type to rig_checks
ALTER TABLE public.rig_checks
  ADD COLUMN IF NOT EXISTS shift_type shift_type DEFAULT 'start_of_shift';

-- End of Shift Reports table
CREATE TABLE IF NOT EXISTS public.end_of_shift_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  emt_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  checklist_id UUID REFERENCES public.checklists(id) ON DELETE SET NULL,

  fuel_level fuel_level NOT NULL DEFAULT 'half',
  cleanliness_rating INTEGER CHECK (cleanliness_rating BETWEEN 1 AND 5),
  restock_needed JSONB DEFAULT '[]',       -- Array of item name strings
  vehicle_condition TEXT,                  -- Any new damage/issues noted
  notes TEXT,                              -- General end of shift notes
  signature_url TEXT,                      -- URL to e-signature image in Storage

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on new table (permissive for MVP)
ALTER TABLE public.end_of_shift_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mvp_allow_all_eos_reports"
  ON public.end_of_shift_reports FOR ALL USING (true) WITH CHECK (true);

-- Add org_type to users table (optional for tracking per-user org type)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS org_type org_type DEFAULT 'ems';

-- Add industry-specific label overrides to vehicles (optional per-client)
-- For now we handle labels client-side via presets.ts
-- This is enough for Phase 1

-- Update trigger: only update vehicle status for start-of-shift checks
CREATE OR REPLACE FUNCTION update_vehicle_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update last_checked for start-of-shift check
  IF NEW.shift_type = 'start_of_shift' OR NEW.shift_type IS NULL THEN
    UPDATE public.vehicles SET last_checked_at = NEW.created_at WHERE id = NEW.vehicle_id;
  END IF;

  -- Determine status based on AI assessment first, then fallback to manual notes
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

-- ================================================================
-- Enable Supabase Realtime for live dashboard updates
-- ================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.rig_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.end_of_shift_reports;
