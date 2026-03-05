import { redirect } from 'next/navigation'
import { createClient } from '@/../utils/supabase/server'
import { getSession } from '@/lib/auth'
import { getLabels } from '@/lib/labels'
import type { OrgType } from '@/lib/presets'
import PendingApprovalClient from './pending-approval-client'

export default async function PendingApprovalPage() {
  const supabase = await createClient()
  const session = await getSession()

  if (!session?.userId) {
    redirect('/login')
  }

  const { data: user } = await supabase
    .from('users')
    .select('username, first_name, last_name, org_type')
    .eq('id', session.userId)
    .single()

  const currentUserFullName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.username ?? ''

  // Find vehicle pending approval for this user
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, rig_number, pending_approval, pending_approval_data, on_shift_since, on_shift_by')
    .eq('pending_approval', true)

  // Match by crew name in pending_approval_data
  const pendingVehicle = vehicles?.find(v => 
    v.pending_approval_data?.crew_display?.includes(currentUserFullName)
  )

  // If already approved (on_shift_since is set), go to on-shift page
  const approvedVehicle = vehicles?.find(v => false) // check all vehicles
  const { data: onShiftVehicles } = await supabase
    .from('vehicles')
    .select('id')
    .not('on_shift_since', 'is', null)
    .ilike('on_shift_by', `%${currentUserFullName}%`)

  if (onShiftVehicles && onShiftVehicles.length > 0) {
    redirect('/rig-check/on-shift')
  }

  // If no pending vehicle found, go back to rig-check form
  if (!pendingVehicle) {
    redirect('/rig-check')
  }

  return (
    <PendingApprovalClient
      rigNumber={pendingVehicle.rig_number}
      crewDisplay={pendingVehicle.pending_approval_data?.crew_display || currentUserFullName}
      vehicleId={pendingVehicle.id}
    />
  )
}
