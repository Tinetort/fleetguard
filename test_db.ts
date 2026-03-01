
import { createClient } from './utils/supabase/server'

async function testFetch() {
  console.log('--- DB Connection Test ---')
  try {
    const supabase = await createClient()
    
    const { data: checks, error: cError } = await supabase
      .from('rig_checks')
      .select('id, created_at')
      .limit(5)
      
    if (cError) {
      console.error('Rig Checks Error:', cError)
    } else {
      console.log('Rig Checks found:', checks?.length || 0)
      if (checks && checks.length > 0) {
        console.log('Latest check date:', checks[0].created_at)
      }
    }
    
    const { data: eos, error: eError } = await supabase
      .from('end_of_shift_reports')
      .select('id, created_at')
      .limit(5)
      
    if (eError) {
      console.error('EOS Error:', eError)
    } else {
      console.log('EOS Reports found:', eos?.length || 0)
      if (eos && eos.length > 0) {
        console.log('Latest EOS date:', eos[0].created_at)
      }
    }
  } catch (err: any) {
    console.error('Critical Script Error:', err.message)
  }
}

testFetch()
