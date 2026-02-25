import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function testFetchVehicles() {
  console.log('Authenticating as admin...')
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@test.com',
    password: 'password123' // Fake password or maybe it doesn't matter if we just need JWT, actually our login logic fakes the auth, but supabase JS client needs real auth for RLS!
  })
  
  // WAIT, our `authenticate` function in `actions.ts` creates a CUSTOM session ignoring Supabase Auth!
  // This means the `createClient()` from `@/utils/supabase/server` doesn't pass a valid Supabase JWT to the database!
  // The database sees ALL requests from our Next.js app as ANON!
  
  console.log('Testing access to vehicles table as ANON...')
  const { data: vehicles, error } = await supabase.from('vehicles').select('*')
  
  console.log('Result:', { vehicles: vehicles?.length, error: error?.message })
}

testFetchVehicles()
