-- Smart Rig Check: Web Push Notifications Migration (Phase 6)

CREATE TABLE public.push_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS Policies for push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions" 
  ON public.push_subscriptions FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can read all subscriptions for pushing" 
  ON public.push_subscriptions FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager'));
