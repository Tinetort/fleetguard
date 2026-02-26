-- Phase 7: Compliance Migration
-- Add signature and crew identity columns to rig_checks

ALTER TABLE public.rig_checks ADD COLUMN IF NOT EXISTS signature_data_url TEXT;
ALTER TABLE public.rig_checks ADD COLUMN IF NOT EXISTS crew_last_name TEXT;
