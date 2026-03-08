-- Map Feature Migration
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Unit number for vehicles (dispatchers use unit numbers, not rig numbers)
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS unit_number TEXT;

-- 2. GPS coordinates on vehicles (updated by EMT browser during shift)
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

-- 3. Base location for organization (map default center)
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS base_lat DOUBLE PRECISION;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS base_lng DOUBLE PRECISION;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS base_address TEXT;

-- 4. Custom map points (hospitals, stations, frequent destinations)
CREATE TABLE IF NOT EXISTS public.map_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'hospital', -- 'hospital' | 'station' | 'frequent' | 'custom'
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_map_points_org ON public.map_points(org_id);

-- 5. Enable RLS on map_points
ALTER TABLE public.map_points ENABLE ROW LEVEL SECURITY;

-- Permissive MVP policy (same pattern as other tables)
CREATE POLICY "Allow all for authenticated users" ON public.map_points
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Add to realtime publication (vehicles already in publication)
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_points;
