-- Checklist Hierarchical + Vehicle Assignment Migration
-- 
-- Changes:
-- 1. Add vehicle_ids column to checklists (NULL = global / all vehicles)
-- 2. Drop the 'type' column constraint since we're removing PDF type
-- 3. No changes needed for questions column (already JSONB, new format is compatible)

-- Add vehicle_ids array column (NULL means "all vehicles" / global)
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS vehicle_ids UUID[] DEFAULT NULL;

-- Add a name column for better management (title already exists, but adding description)
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

-- Add restock_items for end-of-shift form (string array stored as JSONB)
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS restock_items JSONB DEFAULT NULL;

-- Index for looking up checklists by vehicle
CREATE INDEX IF NOT EXISTS idx_checklists_vehicle_ids ON public.checklists USING GIN (vehicle_ids);

-- Comment for clarity
COMMENT ON COLUMN public.checklists.vehicle_ids IS 'Array of vehicle UUIDs this checklist applies to. NULL means global (all vehicles).';
COMMENT ON COLUMN public.checklists.questions IS 'JSONB array of ChecklistCategory objects (hierarchical) or legacy string array.';
COMMENT ON COLUMN public.checklists.restock_items IS 'String array of restock items for end-of-shift form. NULL = use default list.';
