-- Phase 3: RLS Production Policies for Multi-Tenancy

-- 1. Helper Functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.get_current_user_org()
RETURNS uuid AS $$
  SELECT org_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;


-- 2. Organizations Table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active orgs" ON public.organizations;
DROP POLICY IF EXISTS "Users view own organization" ON public.organizations;

-- Users can only see their own organization
CREATE POLICY "Users view own organization" ON public.organizations
  FOR SELECT USING (id = public.get_current_user_org());


-- 3. Users Table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view everyone" ON public.users;
DROP POLICY IF EXISTS "Users can view users in same org" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Users can view other users ONLY in their own organization
CREATE POLICY "Users can view users in same org" ON public.users
  FOR SELECT USING (org_id = public.get_current_user_org());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth_id = auth.uid());


-- 4. Vehicles Table
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Anyone can insert vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Anyone can update vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Vehicles scoped to org" ON public.vehicles;

CREATE POLICY "Vehicles scoped to org" ON public.vehicles
  FOR ALL USING (org_id = public.get_current_user_org());


-- 5. Checklists Table (Global & Org Scoped)
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view checklists" ON public.checklists;
DROP POLICY IF EXISTS "Anyone can modify checklists" ON public.checklists;
DROP POLICY IF EXISTS "View org checklists" ON public.checklists;
DROP POLICY IF EXISTS "Manage org checklists" ON public.checklists;

-- Users can view checklists for their org, plus global checklists (where org_id IS NULL)
CREATE POLICY "View org checklists" ON public.checklists
  FOR SELECT USING (org_id = public.get_current_user_org() OR org_id IS NULL);

-- Only managers/directors can insert/update checklists
CREATE POLICY "Manage org checklists" ON public.checklists
  FOR ALL USING (
    org_id = public.get_current_user_org() AND
    public.get_current_user_role() IN ('manager', 'director')
  );


-- 6. Rig Checks
ALTER TABLE public.rig_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view rig checks" ON public.rig_checks;
DROP POLICY IF EXISTS "Anyone can insert rig checks" ON public.rig_checks;
DROP POLICY IF EXISTS "Anyone can update rig checks" ON public.rig_checks;
DROP POLICY IF EXISTS "Rig checks scoped to org" ON public.rig_checks;
DROP POLICY IF EXISTS "Insert own rig checks" ON public.rig_checks;

-- Read: Managers/directors/dispatchers/mechanics see all in org. Field staff see all in org (for vehicle history).
CREATE POLICY "Rig checks scoped to org" ON public.rig_checks
  FOR SELECT USING (org_id = public.get_current_user_org());

-- Insert: Users can only insert rig checks for their own org
CREATE POLICY "Insert own rig checks" ON public.rig_checks
  FOR INSERT WITH CHECK (org_id = public.get_current_user_org() AND emt_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- Update: Managers, directors, and mechanics can update anywhere in org. Field staff can update own.
CREATE POLICY "Update rig checks" ON public.rig_checks
  FOR UPDATE USING (
    org_id = public.get_current_user_org() AND 
    (
      public.get_current_user_role() IN ('manager', 'director', 'mechanic') OR
      emt_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

-- 7. End of Shift Reports
ALTER TABLE public.end_of_shift_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view EOS reports" ON public.end_of_shift_reports;
DROP POLICY IF EXISTS "Anyone can insert EOS reports" ON public.end_of_shift_reports;
DROP POLICY IF EXISTS "EOS reports scoped to org" ON public.end_of_shift_reports;
DROP POLICY IF EXISTS "Insert own EOS report" ON public.end_of_shift_reports;

CREATE POLICY "EOS reports scoped to org" ON public.end_of_shift_reports
  FOR SELECT USING (org_id = public.get_current_user_org());

CREATE POLICY "Insert own EOS report" ON public.end_of_shift_reports
  FOR INSERT WITH CHECK (org_id = public.get_current_user_org() AND emt_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));


-- 8. Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Notifications scoped to org" ON public.notifications;
DROP POLICY IF EXISTS "Insert notifications" ON public.notifications;

CREATE POLICY "Notifications scoped to org" ON public.notifications
  FOR SELECT USING (org_id = public.get_current_user_org());

CREATE POLICY "Insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (org_id = public.get_current_user_org());

CREATE POLICY "Update notifications" ON public.notifications
  FOR UPDATE USING (org_id = public.get_current_user_org());


-- 9. Push Subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Push subscriptions scoped to user" ON public.push_subscriptions;

-- Users can only manage their own push subscriptions
CREATE POLICY "Push subscriptions scoped to user" ON public.push_subscriptions
  FOR ALL USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()) 
    AND org_id = public.get_current_user_org()
  );
