import { createClient } from '@/../utils/supabase/server'

// ─── Session helpers (wrapping Supabase Auth) ───────────────────────

export interface AppSession {
  authId: string       // auth.users.id
  userId: string       // public.users.id
  email: string
  username: string
  role: string
  orgId: string
  temp_password: boolean
}

/**
 * Get the current user session from Supabase Auth + profile data.
 * Returns null if not authenticated.
 */
export async function getSession(): Promise<AppSession | null> {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  // Fetch profile from public.users
  const { data: profile } = await supabase
    .from('users')
    .select('id, username, role, org_id, temp_password')
    .eq('auth_id', user.id)
    .single()

  if (!profile) return null

  return {
    authId: user.id,
    userId: profile.id,
    email: user.email || '',
    username: profile.username,
    role: profile.role,
    orgId: profile.org_id,
    temp_password: profile.temp_password ?? false,
  }
}

/**
 * Sign out the current user.
 */
export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
