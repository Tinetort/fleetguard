import { redirect } from 'next/navigation'
import { createClient } from '@/../utils/supabase/server'
import { getSession } from '@/lib/auth'
import { getLabels, DEFAULT_LABELS } from '@/lib/labels'
import type { OrgType } from '@/lib/presets'
import OnShiftClient from './on-shift-client'

export default async function OnShiftPage() {
  const supabase = await createClient()
  const session = await getSession()

  // If not logged in → back to login
  if (!session?.userId) {
    redirect('/login')
  }

  // Fetch the current user
  const { data: user } = await supabase
    .from('users')
    .select('username, first_name, last_name, org_type')
    .eq('id', session.userId)
    .single()

  const orgType = (user?.org_type as OrgType) ?? 'ems'
  const labels = getLabels(orgType)

  const currentUserFullName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.username ?? ''

  // Look for an active shift where this user appears in on_shift_by
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, rig_number, on_shift_since, on_shift_by')
    .not('on_shift_since', 'is', null)
    .ilike('on_shift_by', `%${currentUserFullName}%`)

  const activeVehicle = vehicles?.[0] ?? null

  // If there's no active shift, go back to the form
  if (!activeVehicle) {
    redirect('/rig-check')
  }

  return (
    <OnShiftClient
      rigNumber={activeVehicle.rig_number}
      onShiftSince={activeVehicle.on_shift_since}
      crewDisplay={activeVehicle.on_shift_by}
      currentUserName={currentUserFullName}
      labels={labels}
    />
  )
}
