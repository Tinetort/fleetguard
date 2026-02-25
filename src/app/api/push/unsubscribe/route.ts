import { NextResponse } from 'next/server'
import { createClient } from '@/../utils/supabase/server'
import { decrypt } from '@/lib/auth'

function getSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || ''
  const match = cookieHeader.match(/session=([^;]+)/)
  return match ? match[1] : null
}

export async function POST(request: Request) {
  try {
    const token = getSessionCookie(request)
    if (!token) {
      console.log('Unsubscribe: No session cookie found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await decrypt(token)
    if (!session?.userId) {
      console.log('Unsubscribe: Session decryption failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const endpoint = body.endpoint

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Delete the subscription matching the endpoint for this user
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', session.userId)
      .eq('endpoint', endpoint)

    if (error) {
      console.error('Error deleting subscription:', error)
      return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 })
    }

    console.log('Unsubscribe: Removed subscription for user', session.userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unsubscribe POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
