import { createClient } from '@/../utils/supabase/server'
import UserManagementClient from './user-management-client'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export const revalidate = 0

export default async function UsersPage() {
  const session = await getSession()
  if (session?.role !== 'director') {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  // Fetch all users
  const { data: users, error } = await supabase
    .from('users')
    .select('id, username, role, org_type, created_at, temp_password')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load users:', error.message)
    return <div className="p-8 text-center text-rose-500 font-bold">Failed to load users.</div>
  }

  return <UserManagementClient initialUsers={users || []} />
}
