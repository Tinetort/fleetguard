import { createClient } from '@/../utils/supabase/server'
import DashboardClient from './dashboard-client'
import { getOrgLabels, getPendingShiftIssues } from '../actions'
import { getSession } from '@/lib/auth'

export const revalidate = 0

async function getInitialData() {
  const supabase = await createClient()
  const session = await getSession()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, rig_number, status, last_checked_at, in_service, on_shift_since, on_shift_by, pending_approval, pending_approval_data')
    .eq('org_id', session?.orgId)
    .order('rig_number')

  const { data: checks } = await supabase
    .from('rig_checks')
    .select('vehicle_id, ai_analysis_notes, damage_photo_url, created_at, answers')
    .eq('org_id', session?.orgId)
    .order('created_at', { ascending: false })

  const vehiclesWithNotes = (vehicles || []).map(v => ({
    ...v,
    ai_note: checks?.find(c => c.vehicle_id === v.id)?.ai_analysis_notes || null,
    damage_photo_url: checks?.find(c => c.vehicle_id === v.id)?.damage_photo_url || null,
    original_dispute_text: checks?.find(c => c.vehicle_id === v.id)?.answers?.handoff_dispute_notes || null
  }))

  const { data: todayChecks } = await supabase
    .from('rig_checks')
    .select('id, created_at, damage_notes, ai_damage_severity, answers, crew_last_name, vehicles!rig_checks_vehicle_id_fkey(rig_number), users(username, first_name, last_name)')
    .eq('org_id', session?.orgId)
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: todayEos } = await supabase
    .from('end_of_shift_reports')
    .select('id, created_at, fuel_level, cleanliness_rating, crew_last_name, vehicles(rig_number), users(username, first_name, last_name)')
    .eq('org_id', session?.orgId)
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  const normalizeJoin = (row: any) => ({
    ...row,
    vehicles: Array.isArray(row.vehicles) ? row.vehicles[0] ?? null : row.vehicles,
    users: Array.isArray(row.users) ? row.users[0] ?? null : row.users,
  })

  const activity = [
    ...(todayChecks || []).map(c => ({ ...normalizeJoin(c), _type: 'start' as const })),
    ...(todayEos || []).map(e => ({ ...normalizeJoin(e), _type: 'eos' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return { vehicles: vehiclesWithNotes, activity }
}

export default async function DashboardPage() {
  const [{ vehicles, activity }, labels, session, initialShiftIssues] = await Promise.all([
    getInitialData(),
    getOrgLabels(),
    import('@/lib/auth').then(m => m.getSession()),
    getPendingShiftIssues()
  ])
  
  return (
    <DashboardClient 
      initialVehicles={vehicles} 
      initialActivity={activity} 
      labels={labels} 
      userRole={session?.role || 'manager'} 
      orgId={session?.orgId || ''}
      initialShiftIssues={initialShiftIssues}
    />
  )
}
