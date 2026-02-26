-- Fix RLS for push_subscriptions
-- The app uses custom JWT auth (not Supabase Auth), so auth.uid() is always null
-- We need permissive policies for the anon key

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Managers can read all subscriptions for pushing" ON public.push_subscriptions;

-- Create permissive policies
CREATE POLICY "Allow all operations on push_subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);
