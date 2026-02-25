import { createClient } from '@/../utils/supabase/server'
import DashboardClient from './dashboard-client'
import { getOrgLabels } from '../actions'

export const revalidate = 0

async function getInitialData() {
  const supabase = await createClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, rig_number, status, last_checked_at')
    .order('rig_number')

  const { data: checks } = await supabase
    .from('rig_checks')
    .select('vehicle_id, ai_analysis_notes, created_at')
    .order('created_at', { ascending: false })

  const vehiclesWithNotes = (vehicles || []).map(v => ({
    ...v,
    ai_note: checks?.find(c => c.vehicle_id === v.id)?.ai_analysis_notes || null
  }))

  const { data: todayChecks } = await supabase
    .from('rig_checks')
    .select('id, created_at, damage_notes, ai_damage_severity, vehicles(rig_number), users(username)')
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: todayEos } = await supabase
    .from('end_of_shift_reports')
    .select('id, created_at, fuel_level, cleanliness_rating, vehicles(rig_number), users(username)')
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
  const [{ vehicles, activity }, labels] = await Promise.all([
    getInitialData(),
    getOrgLabels(),
  ])
  return <DashboardClient initialVehicles={vehicles} initialActivity={activity} labels={labels} />
}
