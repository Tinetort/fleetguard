DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Managers can view all profiles and update" ON public.users;

-- Allow all authenticated users to read public.users (this prevents infinite recursion when other policies check roles)
CREATE POLICY "Everyone can view users" 
  ON public.users FOR SELECT 
  TO authenticated 
  USING (true);

-- Managers can update users (but we use auth.uid() directly without a subquery to avoid recursion if possible, or just rely on the read policy breaking the loop)
CREATE POLICY "Managers can update users"
  ON public.users FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager'));
