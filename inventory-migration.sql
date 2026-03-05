-- ================================================================
-- Inventory (Warehouse) Management Migration
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1. Feature toggle on organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS inventory_enabled BOOLEAN DEFAULT false;

-- 2. Inventory items catalog
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  unit TEXT DEFAULT 'pcs',
  quantity INTEGER NOT NULL DEFAULT 0,
  low_threshold INTEGER DEFAULT 10,
  critical_threshold INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Inventory transactions log
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  user_name TEXT NOT NULL,
  shift_type TEXT,                   -- 'start_of_shift' | 'end_of_shift' | 'manual_restock' | 'manual_adjust'
  change INTEGER NOT NULL,           -- Negative = taken, positive = restocked
  quantity_after INTEGER NOT NULL,   -- Snapshot of quantity after transaction
  vehicle_id UUID REFERENCES public.vehicles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_org ON public.inventory_items(org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(org_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_org ON public.inventory_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_item ON public.inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_user ON public.inventory_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_created ON public.inventory_transactions(org_id, created_at DESC);

-- 5. RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Permissive policies for MVP (matching existing pattern)
DROP POLICY IF EXISTS "inventory_items_select" ON public.inventory_items;
CREATE POLICY "inventory_items_select" ON public.inventory_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "inventory_items_insert" ON public.inventory_items;
CREATE POLICY "inventory_items_insert" ON public.inventory_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "inventory_items_update" ON public.inventory_items;
CREATE POLICY "inventory_items_update" ON public.inventory_items FOR UPDATE USING (true);

DROP POLICY IF EXISTS "inventory_items_delete" ON public.inventory_items;
CREATE POLICY "inventory_items_delete" ON public.inventory_items FOR DELETE USING (true);

DROP POLICY IF EXISTS "inventory_txn_select" ON public.inventory_transactions;
CREATE POLICY "inventory_txn_select" ON public.inventory_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "inventory_txn_insert" ON public.inventory_transactions;
CREATE POLICY "inventory_txn_insert" ON public.inventory_transactions FOR INSERT WITH CHECK (true);
