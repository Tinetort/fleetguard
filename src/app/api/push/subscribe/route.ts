import { NextResponse } from 'next/server'
import { createClient } from '@/../utils/supabase/server'
import { decrypt } from '@/lib/auth'

function getSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || ''
  console.log('Subscribe: Raw cookie header:', cookieHeader ? cookieHeader.substring(0, 100) : '(empty)')
  const match = cookieHeader.match(/session=([^;]+)/)
  return match ? match[1] : null
}

export async function POST(request: Request) {
  try {
    const token = getSessionCookie(request)
    if (!token) {
      console.log('Subscribe: No session cookie found in header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await decrypt(token)
    if (!session?.userId) {
      console.log('Subscribe: Session decryption failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subscription = await request.json()
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    const supabase = await createClient()

    // Upsert subscription (unique by endpoint)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: session.userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh,
        auth: subscription.keys?.auth,
      }, { onConflict: 'endpoint' })

    if (error) {
      console.error('Error saving subscription:', error)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    console.log('Subscribe: Saved subscription for user', session.userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Subscribe POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

