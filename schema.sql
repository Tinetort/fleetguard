-- Smart Rig Check Database Schema (Phase 2)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE vehicle_status AS ENUM ('green', 'yellow', 'red');
CREATE TYPE user_role AS ENUM ('emt', 'manager');
CREATE TYPE checklist_type AS ENUM ('pdf', 'manual');

-- Users table (Extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL, -- Login username
  recovery_email TEXT,           -- Optional for "Forgot Password"
  role user_role DEFAULT 'emt'::user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Vehicles table
CREATE TABLE public.vehicles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rig_number TEXT UNIQUE NOT NULL,
  status vehicle_status DEFAULT 'green'::vehicle_status NOT NULL,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Checklists table
-- Used by managers to define what needs to be checked
CREATE TABLE public.checklists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  type checklist_type NOT NULL,
  file_url TEXT,                 -- For PDF type
  questions JSONB,               -- For Manual type (Array of objects)
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Rig Checks table (Updated for AI & dynamic checklists)
CREATE TABLE public.rig_checks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
  emt_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  checklist_id UUID REFERENCES public.checklists(id) ON DELETE SET NULL,
  
  answers JSONB NOT NULL,        -- Stores responses to the dynamic checklist
  damage_notes TEXT,
  damage_photo_url TEXT,         -- URL to the photo deposited in Supabase Storage
  
  -- AI Analysis Fields
  ai_damage_severity vehicle_status, -- Gemini's assessment (green/yellow/red)
  ai_analysis_notes TEXT,            -- Gemini's reasoning
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

--
-- Trigger function to update vehicle status and last_checked_at 
--
CREATE OR REPLACE FUNCTION update_vehicle_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last checked timestamp
  UPDATE public.vehicles SET last_checked_at = NEW.created_at WHERE id = NEW.vehicle_id;
  
  -- Determine status based on AI assessment first, then fallback to manual notes
  IF NEW.ai_damage_severity = 'red' OR (NEW.damage_notes IS NOT NULL AND TRIM(NEW.damage_notes) <> '' AND NEW.ai_damage_severity IS NULL) THEN
    UPDATE public.vehicles SET status = 'red'::vehicle_status WHERE id = NEW.vehicle_id;
  ELSIF NEW.ai_damage_severity = 'yellow' THEN
    UPDATE public.vehicles SET status = 'yellow'::vehicle_status WHERE id = NEW.vehicle_id;
  ELSE
    UPDATE public.vehicles SET status = 'green'::vehicle_status WHERE id = NEW.vehicle_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_rig_check_insert
AFTER INSERT ON public.rig_checks
FOR EACH ROW
EXECUTE FUNCTION update_vehicle_status();

--
-- Row Level Security (RLS) Policies
--
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rig_checks ENABLE ROW LEVEL SECURITY;

-- Storage setup for PDF Checklists and Damage Photos
-- (Note: You'll need to create buckets 'checklists' and 'damage_photos' in the UI manually)


-- == Users ==
CREATE POLICY "Everyone can view users"
  ON public.users FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can update users"
  ON public.users FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager'));

-- == Vehicles ==
CREATE POLICY "Everyone can view vehicles"
  ON public.vehicles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage vehicles"
  ON public.vehicles FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager'));

-- == Checklists ==
CREATE POLICY "Everyone can view active checklists"
  ON public.checklists FOR SELECT TO authenticated USING (is_active = true);
  
CREATE POLICY "Managers can manage checklists"
  ON public.checklists FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager'));

-- == Rig Checks ==
CREATE POLICY "Managers can view all rig checks"
  ON public.rig_checks FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "EMTs can view own checks"
  ON public.rig_checks FOR SELECT USING (auth.uid() = emt_id);

CREATE POLICY "Everyone can submit checks"
  ON public.rig_checks FOR INSERT WITH CHECK (true);

-- Initial Mock Data (Optional, for testing)
INSERT INTO public.vehicles (rig_number, status) VALUES 
('Rig 43', 'green'),
('Rig 44', 'green'),
('Rig 12', 'red'),
('Rig 08', 'yellow');
