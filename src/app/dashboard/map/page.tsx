import { createClient } from '@/../utils/supabase/server'
import MapClient from './map-client'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function MapPage() {
  const session = await getSession()
  if (!session?.orgId) {
    redirect('/login')
  }

  if (session.role === 'emt') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  const [{ data: vehicles }, { data: mapPoints }, { data: org }] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, rig_number, unit_number, lat, lng, location_updated_at, on_shift_since, on_shift_by')
      .eq('org_id', session.orgId)
      .not('on_shift_since', 'is', null)
      .order('rig_number'),
    supabase
      .from('map_points')
      .select('*')
      .eq('org_id', session.orgId)
      .order('created_at', { ascending: true }),
    supabase
      .from('organizations')
      .select('base_lat, base_lng, base_address')
      .eq('id', session.orgId)
      .single(),
  ])

  return (
    <div className="min-h-screen bg-slate-50">
      <MapClient
        initialVehicles={vehicles || []}
        initialPoints={mapPoints || []}
        orgId={session.orgId}
        userRole={session.role as string}
        baseLat={org?.base_lat ?? null}
        baseLng={org?.base_lng ?? null}
        baseAddress={org?.base_address ?? null}
      />
    </div>
  )
}
