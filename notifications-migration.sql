-- In-App Notifications Table
-- Run this in the Supabase SQL Editor

CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'green',  -- 'green', 'yellow', 'red'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT DEFAULT '/dashboard',
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast unread lookups
CREATE INDEX idx_notifications_unread ON public.notifications(is_read, created_at DESC);

-- Permissive RLS (custom auth, not Supabase Auth)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on notifications"
  ON public.notifications FOR ALL
  USING (true)
  WITH CHECK (true);
