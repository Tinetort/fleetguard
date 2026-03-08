import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 2) {
    return NextResponse.json([])
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=1`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'SmartRigCheck/1.0 (dispatch management app)',
      'Accept-Language': 'en',
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 })
  }

  const data = await res.json()

  const results = (data as any[]).map((item) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    name: item.name || item.display_name.split(',')[0],
    address: item.display_name,
    type: item.type,
    category: item.class,
  }))

  return NextResponse.json(results)
}
