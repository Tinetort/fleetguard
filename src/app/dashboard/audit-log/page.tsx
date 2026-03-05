import { createClient as createAdminClientFn } from '@supabase/supabase-js'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AuditLogClient from './audit-log-client'

// Use admin client so RLS doesn't block managers from reading rig_checks
function getAdminSupabase() {
  return createAdminClientFn(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function AuditLogPage() {
  // Bug #2 fix: enforce role check
  const session = await getSession()
  if (!session || (session.role !== 'manager' && session.role !== 'director')) {
    redirect('/dashboard')
  }

  const supabase = getAdminSupabase()

  // Fetch all rig checks with vehicle and user info
  // Bug #1 fix: use explicit FK hint for vehicles join
  const { data: rigChecks } = await supabase
    .from('rig_checks')
    .select(`
      id, 
      created_at, 
      damage_notes, 
      ai_damage_severity, 
      ai_analysis_notes,
      crew_last_name,
      signature_data_url,
      answers,
      vehicles!rig_checks_vehicle_id_fkey (rig_number),
      users (username, first_name, last_name)
    `)
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  // Fetch all end of shift reports
  const { data: eosReports } = await supabase
    .from('end_of_shift_reports')
    .select(`
      id,
      created_at,
      fuel_level,
      cleanliness_rating,
      restock_needed,
      vehicle_condition,
      notes,
      crew_last_name,
      vehicles (rig_number),
      users (username, first_name, last_name)
    `)
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  // Fetch admin audit log entries
  const { data: auditEntries } = await supabase
    .from('audit_log')
    .select('*')
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })
    .limit(200)

  // Normalize Supabase join results
  const rigCheckEntries = (rigChecks || []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    type: 'rig_check' as const,
    rig_number: Array.isArray(r.vehicles) ? r.vehicles[0]?.rig_number : r.vehicles?.rig_number || '—',
    username: Array.isArray(r.users) 
      ? (r.users[0]?.first_name ? `${r.users[0].first_name} ${r.users[0].last_name || ''}`.trim() : r.users[0]?.username) 
      : (r.users?.first_name ? `${r.users.first_name} ${r.users.last_name || ''}`.trim() : r.users?.username || '—'),
    crew_last_name: r.crew_last_name || null,
    severity: r.ai_damage_severity,
    damage_notes: r.damage_notes,
    ai_notes: r.ai_analysis_notes,
    has_signature: !!r.signature_data_url,
    missing_items: r.answers?.missing_items || [],
    handoff_disputed: r.answers?.handoff_disputed || false,
    handoff_dispute_notes: r.answers?.handoff_dispute_notes || null,
  }))

  const eosEntries = (eosReports || []).map((e: any) => ({
    id: e.id,
    created_at: e.created_at,
    type: 'eos' as const,
    rig_number: Array.isArray(e.vehicles) ? e.vehicles[0]?.rig_number : e.vehicles?.rig_number || '—',
    username: Array.isArray(e.users) 
      ? (e.users[0]?.first_name ? `${e.users[0].first_name} ${e.users[0].last_name || ''}`.trim() : e.users[0]?.username) 
      : (e.users?.first_name ? `${e.users.first_name} ${e.users.last_name || ''}`.trim() : e.users?.username || '—'),
    crew_last_name: e.crew_last_name || null,
    severity: (e.vehicle_condition && e.vehicle_condition.trim().length > 0) || (e.restock_needed && e.restock_needed.length > 0) ? 'yellow' : 'green',
    damage_notes: e.vehicle_condition || e.notes || null,
    ai_notes: null,
    has_signature: false,
    missing_items: e.restock_needed || [],
  }))

  // Convert admin audit entries into the same combined timeline
  const adminEntries = (auditEntries || []).map((a: any) => ({
    id: a.id,
    created_at: a.created_at,
    type: 'admin' as const,
    rig_number: a.target_label || '—',
    username: a.actor_name,
    crew_last_name: null,
    severity: null,
    damage_notes: null,
    ai_notes: null,
    has_signature: false,
    missing_items: [],
    admin_action: a.action,
    admin_details: a.details,
  }))

  const entries = [...rigCheckEntries, ...eosEntries, ...adminEntries].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return <AuditLogClient entries={entries} />
}
