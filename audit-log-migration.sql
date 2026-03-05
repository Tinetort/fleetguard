-- ═══════════════════════════════════════════════════════════
-- AUDIT LOG TABLE
-- Tracks all administrative and significant actions per org
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,          -- e.g. 'vehicle.status_changed', 'vehicle.shift_approved', 'vehicle.removed'
  target_type TEXT NOT NULL,     -- e.g. 'vehicle', 'user', 'shift'
  target_id UUID,               -- optional: ID of the affected entity
  target_label TEXT,             -- human readable: e.g. "Rig 08"
  details JSONB DEFAULT '{}',   -- any extra context (old_status, new_status, reason, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries by org + time
CREATE INDEX IF NOT EXISTS idx_audit_log_org_created ON audit_log(org_id, created_at DESC);

-- Index for filtering by action type
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Users can only see audit logs from their own organization
-- ═══════════════════════════════════════════════════════════

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Read policy: users see only their org's logs
CREATE POLICY "Users can view own org audit logs"
  ON audit_log FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Insert policy: service role inserts (server actions use service role key)
-- No insert policy needed for authenticated users since we insert via service role
