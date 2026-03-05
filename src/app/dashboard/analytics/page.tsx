import { createClient as createAdminClientFn } from '@supabase/supabase-js'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AnalyticsClient from './analytics-client'

// Use admin client so RLS doesn't block managers from reading rig_checks
function getAdminSupabase() {
  return createAdminClientFn(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function AnalyticsPage() {
  const session = await getSession()
  if (!session || (session.role !== 'manager' && session.role !== 'director')) {
    redirect('/dashboard')
  }

  const supabase = getAdminSupabase()

  // Fetch all rig checks for this org
  const { data: rigChecks } = await supabase
    .from('rig_checks')
    .select(`
      id, created_at, vehicle_id, emt_id, ai_damage_severity, answers, crew_last_name, check_duration_seconds,
      vehicles!rig_checks_vehicle_id_fkey (rig_number),
      users (username, first_name, last_name)
    `)
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })
    .limit(500)

  // Fetch all EOS reports
  const { data: eosReports } = await supabase
    .from('end_of_shift_reports')
    .select(`
      id, created_at, vehicle_id, emt_id, fuel_level, restock_needed, vehicle_condition,
      vehicles (rig_number),
      users (username, first_name, last_name)
    `)
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })
    .limit(500)

  // Fetch all employees
  const { data: employees } = await supabase
    .from('users')
    .select('id, username, first_name, last_name, role')
    .eq('org_id', session.orgId)

  // Fetch vehicles
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, rig_number')
    .eq('org_id', session.orgId)
    .order('rig_number')

  // Fetch shift issues
  const { data: shiftIssues } = await supabase
    .from('shift_issues')
    .select(`
      id, created_at, vehicle_id, category, status, ai_severity, reporter_name, previous_crew_name,
      vehicles (rig_number)
    `)
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })
    .limit(500)

  // Fetch feature flags
  const { data: org } = await supabase
    .from('organizations')
    .select('inventory_enabled')
    .eq('id', session.orgId)
    .single()
  
  const inventoryEnabled = org?.inventory_enabled || false

  // Fetch inventory transactions
  let inventoryTransactions = []
  if (inventoryEnabled) {
    const { data: txns } = await supabase
      .from('inventory_transactions')
      .select(`
        id, created_at, item_id, shift_type, change, quantity_after, user_name, notes,
        vehicles (rig_number),
        users (username, first_name, last_name),
        inventory_items (name, category, unit)
      `)
      .eq('org_id', session.orgId)
      .order('created_at', { ascending: false })
      .limit(1000)
    
    inventoryTransactions = (txns || []).map((row: any) => ({
      ...row,
      vehicles: Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles,
      users: Array.isArray(row.users) ? row.users[0] : row.users,
      inventory_items: Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items,
    }))
  }

  // Normalize join results
  const normalize = (row: any) => ({
    ...row,
    vehicles: Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles,
    users: Array.isArray(row.users) ? row.users[0] : row.users,
  })

  // Normalize shift issues join results (only vehicles)
  const normalizeIssues = (row: any) => ({
    ...row,
    vehicles: Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles
  })

  const normalizedChecks = (rigChecks || []).map(normalize)
  const normalizedEos = (eosReports || []).map(normalize)
  const normalizedShiftIssues = (shiftIssues || []).map(normalizeIssues)

  return (
    <AnalyticsClient
      rigChecks={normalizedChecks}
      eosReports={normalizedEos}
      employees={employees || []}
      vehicles={vehicles || []}
      shiftIssues={normalizedShiftIssues}
      inventoryEnabled={inventoryEnabled}
      inventoryTransactions={inventoryTransactions}
    />
  )
}
