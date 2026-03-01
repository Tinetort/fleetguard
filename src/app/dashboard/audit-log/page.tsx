import { createClient } from '@/../utils/supabase/server'
import AuditLogClient from './audit-log-client'

export default async function AuditLogPage() {
  const supabase = await createClient()

  // Fetch all rig checks with vehicle and user info
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
      vehicles (rig_number),
      users (username, first_name, last_name)
    `)
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
    .order('created_at', { ascending: false })
    .limit(100)

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

  const entries = [...rigCheckEntries, ...eosEntries].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return <AuditLogClient entries={entries} />
}
