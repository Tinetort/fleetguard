-- Phase 8: Shift Lifecycle Migration
-- Track which vehicle is on an active shift and who started it

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS on_shift_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS on_shift_by TEXT,
  ADD COLUMN IF NOT EXISTS on_shift_rig_check_id UUID REFERENCES public.rig_checks(id) ON DELETE SET NULL;
