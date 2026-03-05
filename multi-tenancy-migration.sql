-- ================================================================
-- Multi-Tenancy Migration: Organizations + org_id
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,  -- for URL-friendly org identifier
  org_type org_type DEFAULT 'ems',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS (will add proper policies in Phase 3)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "temp_allow_all_organizations"
  ON public.organizations FOR ALL USING (true) WITH CHECK (true);

-- 2. Create default organization for existing data
INSERT INTO public.organizations (id, name, slug, org_type)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default', 'ems')
  ON CONFLICT (id) DO NOTHING;

-- 3. Add org_id to all tables
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.rig_checks ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.end_of_shift_reports ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

-- 4. Backfill: assign all existing records to the default org
UPDATE public.users SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.vehicles SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.rig_checks SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.checklists SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.end_of_shift_reports SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.notifications SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.push_subscriptions SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- 5. Make org_id NOT NULL after backfill
ALTER TABLE public.users ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.vehicles ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.rig_checks ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.checklists ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.end_of_shift_reports ALTER COLUMN org_id SET NOT NULL;
-- notifications and push_subscriptions can stay nullable for now

-- 6. Add email column to users (for Supabase Auth migration)
-- This will store the Supabase Auth email, linked to auth.users.id
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_org ON public.users(org_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_org ON public.vehicles(org_id);
CREATE INDEX IF NOT EXISTS idx_rig_checks_org ON public.rig_checks(org_id);
CREATE INDEX IF NOT EXISTS idx_checklists_org ON public.checklists(org_id);
CREATE INDEX IF NOT EXISTS idx_eos_org ON public.end_of_shift_reports(org_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
