import { NextResponse } from 'next/server'
import { createClient } from '@/../utils/supabase/server'
import { getSession } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      console.log('Subscribe POST: Unauthorized, no session found')
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Subscribe POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
