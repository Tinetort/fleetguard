-- ================================================================
-- PERMISSIVE RLS POLICIES FOR MVP TESTING
-- Run this in Supabase SQL Editor to remove permission errors
-- during development/testing phase.
-- ================================================================

-- Drop all existing restrictive policies
DROP POLICY IF EXISTS "Everyone can view users" ON public.users;
DROP POLICY IF EXISTS "Managers can update users" ON public.users;
DROP POLICY IF EXISTS "Everyone can view vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Managers can manage vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Everyone can view active checklists" ON public.checklists;
DROP POLICY IF EXISTS "Managers can manage checklists" ON public.checklists;
DROP POLICY IF EXISTS "Server can manage checklists" ON public.checklists;
DROP POLICY IF EXISTS "Managers can view all rig checks" ON public.rig_checks;
DROP POLICY IF EXISTS "EMTs can view own checks" ON public.rig_checks;
DROP POLICY IF EXISTS "Everyone can submit checks" ON public.rig_checks;
DROP POLICY IF EXISTS "Allow public inserts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;

-- ================================================================
-- FULLY PERMISSIVE POLICIES (allow ALL for ALL users, anon included)
-- Safe for MVP testing, tighten before production!
-- ================================================================

CREATE POLICY "mvp_allow_all_users"
  ON public.users FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "mvp_allow_all_vehicles"
  ON public.vehicles FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "mvp_allow_all_checklists"
  ON public.checklists FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "mvp_allow_all_rig_checks"
  ON public.rig_checks FOR ALL USING (true) WITH CHECK (true);

-- Storage policies (also permissive)
CREATE POLICY "mvp_storage_insert"
  ON storage.objects FOR INSERT WITH CHECK (true);

CREATE POLICY "mvp_storage_select"
  ON storage.objects FOR SELECT USING (true);

CREATE POLICY "mvp_storage_update"
  ON storage.objects FOR UPDATE USING (true);

-- ================================================================
-- ALSO: Activate the most recently created checklist automatically
-- (in case you deployed one before this fix)
-- ================================================================
UPDATE public.checklists SET is_active = false WHERE true;
UPDATE public.checklists SET is_active = true
  WHERE id = (SELECT id FROM public.checklists ORDER BY created_at DESC LIMIT 1);
