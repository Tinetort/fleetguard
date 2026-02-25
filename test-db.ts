import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('Testing connection to:', supabaseUrl)
  
  const { data, error } = await supabase.from('vehicles').select('*')
  
  if (error) {
    console.error('Error fetching vehicles:', error.message)
    process.exit(1)
  }
  
  console.log('Success! Found vehicles:', data?.length)
  console.log(data)
}

testConnection()
