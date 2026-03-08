import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/../utils/supabase/server'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId || !session?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { vehicleId: string; lat: number; lng: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { vehicleId, lat, lng } = body

  if (!vehicleId || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'Missing vehicleId, lat, or lng' }, { status: 400 })
  }

  // Validate coordinates
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  const supabase = await createClient()

  // Only update if the vehicle belongs to this org and is currently on shift
  const { error } = await supabase
    .from('vehicles')
    .update({ lat, lng, location_updated_at: new Date().toISOString() })
    .eq('id', vehicleId)
    .eq('org_id', session.orgId)
    .not('on_shift_since', 'is', null)

  if (error) {
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
