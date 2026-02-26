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
      users (username)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  // Normalize Supabase join results
  const entries = (rigChecks || []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    type: r.answers?.fuel_level ? 'eos' : 'rig_check',
    rig_number: Array.isArray(r.vehicles) ? r.vehicles[0]?.rig_number : r.vehicles?.rig_number || '—',
    username: Array.isArray(r.users) ? r.users[0]?.username : r.users?.username || '—',
    crew_last_name: r.crew_last_name || null,
    severity: r.ai_damage_severity,
    damage_notes: r.damage_notes,
    ai_notes: r.ai_analysis_notes,
    has_signature: !!r.signature_data_url,
    missing_items: r.answers?.missing_items || [],
  }))

  return <AuditLogClient entries={entries} />
}
