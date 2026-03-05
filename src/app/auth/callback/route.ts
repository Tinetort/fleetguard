import { NextResponse } from 'next/server'
import { createClient } from '@/../utils/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && user) {
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
      const nameParts = fullName.trim().split(' ')
      const firstName = nameParts[0] || null
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null

      // Check if profile exists
      let { data: profile } = await supabase
        .from('users')
        .select('id, role, first_name')
        .eq('auth_id', user.id)
        .single()

      if (!profile) {
        // Try linking by email if profile exists without auth_id
        const { data: existingProfile } = await supabase
          .from('users')
          .select('id, auth_id, role, first_name')
          .eq('email', user.email)
          .single()

        if (existingProfile) {
          // Update the auth_id, and also set the name if it was missing
          const updateData: any = { auth_id: user.id }
          if (!existingProfile.first_name && firstName) {
            updateData.first_name = firstName
            updateData.last_name = lastName
          }

          await supabase
            .from('users')
            .update(updateData)
            .eq('id', existingProfile.id)
          
          profile = existingProfile
        } else {
          // Create a default profile with Google names
          const { data: newProfile } = await supabase
            .from('users')
            .insert({
              auth_id: user.id,
              email: user.email,
              username: user.email?.split('@')[0] || 'user',
              first_name: firstName,
              last_name: lastName,
              role: 'emt',
              org_id: '00000000-0000-0000-0000-000000000001'
            })
            .select('id, role, first_name')
            .single()
          profile = newProfile
        }
      } else if (!profile.first_name && firstName) {
        // If the profile already existed but had no name (from earlier sign-ins), update it now
        await supabase
          .from('users')
          .update({ first_name: firstName, last_name: lastName })
          .eq('id', profile.id)
      }

      // Determine redirect destination based on role
      const role = profile?.role || 'emt'
      const defaultDest = (role === 'manager' || role === 'director') ? '/dashboard' : '/rig-check'
      const destination = next || defaultDest

      return NextResponse.redirect(new URL(destination, requestUrl.origin))
    } else {
      console.error('exchangeCodeForSession error:', error?.message)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(new URL('/login?error=Invalid link', requestUrl.origin))
}
