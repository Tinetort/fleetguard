// Script to migrate existing users to Supabase Auth
// Usage: npx tsx migrate-users.ts

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase env variables')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function migrateUsers() {
  console.log('Fetching users from public.users...')
  
  const { data: users, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('*')
    .is('auth_id', null) // Only migrate users without an auth_id

  if (fetchError || !users) {
    console.error('Failed to fetch users:', fetchError)
    return
  }

  console.log(`Found ${users.length} users to migrate.`)

  let successCount = 0
  let errorCount = 0

  for (const user of users) {
    try {
      // 1. Generate an email for Supabase Auth if they don't have one
      const email = user.email || `${user.username}@fleetguard.local`
      const tempPassword = 'changeme123'

      console.log(`Migrating: ${user.username} -> ${email}`)

      // 2. Create the user in Supabase Auth
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          username: user.username,
          role: user.role
        }
      })

      if (authError || !authUser.user) {
        console.error(`  - Failed to create auth user for ${user.username}:`, authError?.message)
        errorCount++
        continue
      }

      // 3. Update the public.users record with the new auth_id and email
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          auth_id: authUser.user.id,
          email: email,
          temp_password: true // Force them to change it
        })
        .eq('id', user.id)

      if (updateError) {
        console.error(`  - Failed to link auth_id for ${user.username}:`, updateError.message)
        errorCount++
        continue
      }

      successCount++
      console.log(`  + Success! Temporary password: ${tempPassword}`)
    } catch (err) {
      console.error(`  - Unexpected error migrating ${user.username}:`, err)
      errorCount++
    }
  }

  console.log('\nMigration complete!')
  console.log(`Successfully migrated: ${successCount}`)
  console.log(`Failed to migrate: ${errorCount}`)
  console.log('\nNOTE: All migrated users must log in with their username and the password: changeme123')
}

migrateUsers()
