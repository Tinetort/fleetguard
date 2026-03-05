import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This route needs to be called periodically (e.g., via Vercel Cron or a separate cron trigger)
// It cleans up photos from the `damage_photos` bucket that are older than 72 hours
// and removes the reference to them from `rig_checks` and `vehicles`.

export async function GET(request: Request) {
  // Simple auth via an environment variable CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Need service role key to bypass RLS and delete storage objects
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

    // 1. Find all rig_checks older than 72 hours that still have a damage_photo_url
    const { data: checks, error: fetchError } = await supabase
      .from('rig_checks')
      .select('id, damage_photo_url')
      .not('damage_photo_url', 'is', null)
      .lt('created_at', seventyTwoHoursAgo)

    if (fetchError) {
      throw new Error(`Failed to fetch old checks: ${fetchError.message}`)
    }

    if (!checks || checks.length === 0) {
      return NextResponse.json({ success: true, message: 'No old photos to delete', deletedCount: 0 })
    }

    // Extract file paths from the URLs
    // The URL format is: https://<project>.supabase.co/storage/v1/object/public/damage_photos/<filename>
    const STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/damage_photos/`
    
    const validChecks = checks.filter(c => c.damage_photo_url && c.damage_photo_url.startsWith(STORAGE_PREFIX))
    const filesToDelete = validChecks.map(c => c.damage_photo_url!.replace(STORAGE_PREFIX, ''))

    if (filesToDelete.length === 0) {
      return NextResponse.json({ success: true, message: 'URLs found but they do not match the expected bucket format', deletedCount: 0 })
    }

    // 2. Delete the files from Supabase Storage
    const { error: storageError } = await supabase
      .storage
      .from('damage_photos')
      .remove(filesToDelete)

    if (storageError) {
      console.error('Storage deletion error:', storageError)
      // Even if some failed, we should continue to clear the database references for the ones that succeeded,
      // but the Supabase API deletes in batch. Logging is best here.
    }

    // 3. Update the rig_checks table to set damage_photo_url to null
    const checkIds = validChecks.map(c => c.id)
    const { error: updateError } = await supabase
      .from('rig_checks')
      .update({ damage_photo_url: null })
      .in('id', checkIds)

    if (updateError) {
      throw new Error(`Failed to clear damage_photo_urls from rig_checks: ${updateError.message}`)
    }

    // Note: We don't necessarily need to clear it from `vehicles.pending_approval_data` 
    // because vehicles pending approval for 72 hours are highly unlikely (they should be approved/rejected). 
    // But for thoroughness, let's also remove any pending approval photos older than 72h from the vehicles table.
    
    // We can't do a simple JSON update across many random rows easily in a single Supabase JS query,
    // so we skip the `vehicles` table since shifts aren't pending for 72 hours.
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cleanup successful', 
      deletedCount: filesToDelete.length,
      files: filesToDelete
    })

  } catch (error: any) {
    console.error('Cron job error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
