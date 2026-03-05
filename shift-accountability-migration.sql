-- Shift Accountability Migration
-- 1. Add customizable categories to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS shift_issue_categories JSONB DEFAULT '["Expired Meds", "Dirty Cab", "Low O₂", "Dead Battery", "Missing Equipment", "Other"]'::jsonb;

-- 2. Creates the shift_issues table for tracking issues reported by incoming crews
CREATE TABLE IF NOT EXISTS public.shift_issues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  
  -- WHO reported the issue (incoming crew)
  reporter_id UUID REFERENCES public.users(id),
  reporter_name TEXT NOT NULL,
  rig_check_id UUID REFERENCES public.rig_checks(id),
  
  -- WHICH vehicle
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  
  -- WHO is responsible (previous crew)
  previous_crew_name TEXT,
  previous_eos_id UUID REFERENCES public.end_of_shift_reports(id),
  
  -- WHAT is the issue
  category TEXT NOT NULL,             -- 'expired_meds', 'dirty_cab', 'low_o2', 'dead_battery', 'missing_equipment', 'other'
  description TEXT,                   -- EMT's text description
  photo_url TEXT,                     -- Photo of the issue
  fuel_level TEXT,                    -- 'empty', 'quarter', 'half', 'three_quarter', 'full'
  
  -- AI ANALYSIS
  ai_analysis TEXT,                   -- AI description of the photo
  ai_severity TEXT DEFAULT 'moderate', -- 'minor', 'moderate', 'severe'
  
  -- MANAGER DECISION
  status TEXT DEFAULT 'pending',      -- 'pending' | 'approved' | 'rejected'
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shift_issues_org ON public.shift_issues(org_id);
CREATE INDEX IF NOT EXISTS idx_shift_issues_vehicle ON public.shift_issues(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_shift_issues_status ON public.shift_issues(status);
CREATE INDEX IF NOT EXISTS idx_shift_issues_reporter ON public.shift_issues(reporter_id);

-- RLS
ALTER TABLE public.shift_issues ENABLE ROW LEVEL SECURITY;

-- Permissive policies for MVP (matching existing pattern)
DROP POLICY IF EXISTS "shift_issues_select" ON public.shift_issues;
CREATE POLICY "shift_issues_select" ON public.shift_issues FOR SELECT USING (true);

DROP POLICY IF EXISTS "shift_issues_insert" ON public.shift_issues;
CREATE POLICY "shift_issues_insert" ON public.shift_issues FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "shift_issues_update" ON public.shift_issues;
CREATE POLICY "shift_issues_update" ON public.shift_issues FOR UPDATE USING (true);
