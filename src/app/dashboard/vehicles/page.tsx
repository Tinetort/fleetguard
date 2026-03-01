import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/../utils/supabase/server'
import VehicleManagementClient from './vehicle-management-client'

export const metadata = {
  title: 'Manage Vehicles | Smart Rig Check',
}

export default async function VehiclesPage() {
  const session = await getSession()
  if (!session || session.role !== 'director') {
    redirect('/dashboard') // fallback for non-directors
  }

  const supabase = await createClient()

  // Fetch all vehicles
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .order('rig_number', { ascending: true })

  return (
    <VehicleManagementClient initialVehicles={vehicles || []} />
  )
}
