import { createClient } from './utils/supabase/server'

async function checkVehicles() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('vehicles').select('*')
  if (error) {
    console.error('Error fetching vehicles:', error.message)
    return
  }
  console.log('Vehicles on shift:')
  data?.filter(v => v.on_shift_since).forEach(v => {
    console.log(`- ${v.rig_number}: since ${v.on_shift_since} by ${v.on_shift_by}`)
  })
}

checkVehicles()
