'use server'

import { createClient } from '@/../utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession, logout } from '@/lib/auth'
import { getLabels, DEFAULT_LABELS, type OrgLabels } from '@/lib/labels'
import type { OrgType } from '@/lib/presets'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Admin client for user management (service role key)
function getAdminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Logs an event to the audit_log table for compliance tracking.
 * Uses service role to bypass RLS for inserts.
 */
async function logAuditEvent(opts: {
  orgId: string
  actorId: string
  actorName: string
  action: string
  targetType: string
  targetId?: string
  targetLabel?: string
  details?: Record<string, any>
}) {
  try {
    const adminSupa = getAdminSupabase()
    await adminSupa.from('audit_log').insert({
      org_id: opts.orgId,
      actor_id: opts.actorId,
      actor_name: opts.actorName,
      action: opts.action,
      target_type: opts.targetType,
      target_id: opts.targetId || null,
      target_label: opts.targetLabel || null,
      details: opts.details || {},
    })
  } catch (e) {
    console.error('Audit log error (non-fatal):', e)
  }
}

export async function logoutAction() {
  await logout()
  redirect('/login')
}

export async function requestPasswordReset(username: string) {
  try {
    const supabase = await createClient()
    // Look up user's email by username
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('username', username.trim())
      .single()

    if (!user?.email) {
      return { success: true } // Generic — don't reveal whether username exists
    }

    // Use Supabase Auth's built-in password reset flow
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${APP_URL}/reset-password`,
    })

    if (error) {
      console.error('resetPasswordForEmail error:', error)
    }

    return { success: true }
  } catch (error) {
    console.error('requestPasswordReset error:', error)
    return { success: true }
  }
}

export async function resetPasswordWithToken(newPassword: string) {
  if (!newPassword || newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters.' }
  }

  const supabase = await createClient()

  // Supabase Auth handles token verification via the callback URL
  // At this point the user is already authenticated via the magic link
  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    return { error: 'Failed to update password. Please try again.' }
  }

  // Also clear temp_password flag if it was set
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('users').update({ temp_password: false }).eq('auth_id', user.id)
  }

  redirect('/login')
}

export async function getInitialRigCheckData() {
  try {
    const supabase = await createClient()
    const session = await getSession()
    if (!session?.userId) return { currentUser: null, orgLabels: DEFAULT_LABELS, employees: [] }

    // Auto-cleanup: reset stale shifts older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await supabase
      .from('vehicles')
      .update({ on_shift_since: null, on_shift_by: null, on_shift_rig_check_id: null })
      .eq('org_id', session.orgId)
      .not('on_shift_since', 'is', null)
      .lt('on_shift_since', twentyFourHoursAgo)

    // Fetch current user details
    const { data: user } = await supabase
      .from('users')
      .select('username, first_name, last_name, org_type')
      .eq('id', session.userId)
      .single()

    const orgType = (user?.org_type as OrgType) ?? 'ems'
    const orgLabels = getLabels(orgType)

    const currentUserFullName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username

    // Fetch org details for customizable shift issue categories & feature flags
    const { data: org } = await supabase
      .from('organizations')
      .select('shift_issue_categories, inventory_enabled')
      .eq('id', session.orgId)
      .single()

    const shiftIssueCategories = org?.shift_issue_categories || [
      'Expired Meds', 'Dirty Cab', 'Low O₂', 'Dead Battery', 'Missing Equipment', 'Other'
    ]
    const inventoryEnabled = org?.inventory_enabled || false

    // Fetch inventory items if enabled
    let inventoryItems: any[] = []
    if (inventoryEnabled) {
      const { data: items } = await supabase
        .from('inventory_items')
        .select('id, name, category, unit, quantity')
        .eq('org_id', session.orgId)
        .order('category')
        .order('name')
      inventoryItems = items || []
    }

    // Fetch all employees for this org to populate the partner dropdown
    const { data: employeesData } = await supabase
      .from('users')
      .select('id, username, first_name, last_name, role')
      .eq('org_id', session.orgId)
      .in('role', ['emt', 'paramedic', 'nurse'])
      .order('first_name', { ascending: true })

    // Find employees already on shift in any vehicle (can't be selected as partner)
    const { data: onShiftVehicles } = await supabase
      .from('vehicles')
      .select('on_shift_by')
      .eq('org_id', session.orgId)
      .not('on_shift_by', 'is', null)

    const onShiftNames = new Set<string>()
    ;(onShiftVehicles || []).forEach((v: any) => {
      if (v.on_shift_by) {
        v.on_shift_by.split(' & ').forEach((name: string) => onShiftNames.add(name.trim()))
      }
    })

    const employees = (employeesData || [])
      .filter((emp: any) => emp.id !== session.userId) // exclude current user
      .map((emp: any) => {
        const name = emp.first_name ? `${emp.first_name} ${emp.last_name || ''}`.trim() : emp.username
        return { id: emp.id, name, onShift: onShiftNames.has(name) }
      })

    // Check if the current user already has an active shift
    // We fetch all active shifts for this org and accurately check the on_shift_by names
    const { data: allActiveShifts } = await supabase
      .from('vehicles')
      .select('id, on_shift_since, on_shift_by, on_shift_partner')
      .eq('org_id', session.orgId)
      .not('on_shift_since', 'is', null)
      .order('on_shift_since', { ascending: false })

    let activeShiftVehicle = null
    if (allActiveShifts) {
      activeShiftVehicle = allActiveShifts.find(v => {
        if (!v.on_shift_by) return false
        const crewNames = v.on_shift_by.split(' & ').map((n: string) => n.trim())
        return crewNames.includes(currentUserFullName)
      }) || null
    }

    // Check if the user has a vehicle pending manager approval
    const { data: pendingVehicles } = await supabase
      .from('vehicles')
      .select('id, pending_approval, pending_approval_data')
      .eq('pending_approval', true)

    const pendingVehicle = pendingVehicles?.find(v =>
      v.pending_approval_data?.crew_display?.includes(currentUserFullName)
    )

    return { 
      currentUser: currentUserFullName, 
      orgLabels, 
      employees,
      shiftIssueCategories,
      activeShift: activeShiftVehicle ? {
        vehicle_id: activeShiftVehicle.id,
        on_shift_since: activeShiftVehicle.on_shift_since,
        on_shift_by: activeShiftVehicle.on_shift_by
      } : null,
      pendingApproval: pendingVehicle ? {
        vehicle_id: pendingVehicle.id,
      } : null,
      inventoryEnabled,
      inventoryItems,
    }

  } catch {
    return { 
      currentUser: null, 
      orgLabels: DEFAULT_LABELS, 
      employees: [], 
      activeShift: null, 
      pendingApproval: null,
      inventoryEnabled: false,
      inventoryItems: [],
    }
  }
}

// Returns dynamic labels based on the current user's org_type
export async function getOrgLabels(): Promise<OrgLabels> {
  try {
    const supabase = await createClient()
    const session = await getSession()
    if (!session?.userId) return DEFAULT_LABELS
    const { data: user } = await supabase
      .from('users')
      .select('org_type')
      .eq('id', session.userId)
      .single()
    return getLabels((user?.org_type as OrgType) ?? 'ems')
  } catch {
    return DEFAULT_LABELS
  }
}

export async function getVehicles() {
  const session = await getSession()
  if (!session?.userId) return []

  const supabase = await createClient()
  
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('org_id', session.orgId)
    .eq('in_service', false)   // exclude vehicles at the mechanic
    .neq('status', 'red')      // exclude out of service vehicles
    .not('pending_approval', 'eq', true) // exclude pending approval vehicles
    .order('rig_number')

  if (error || !vehicles) {
    console.error('Supabase fetch failed:', error?.message)
    return []
  }

  // Получаем последние проверки для подгрузки AI-ответов на дашборд
  const { data: checks } = await supabase
    .from('rig_checks')
    .select('vehicle_id, ai_analysis_notes, damage_photo_url, created_at')
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })

  return vehicles.map(v => {
    const latestCheck = checks?.find(c => c.vehicle_id === v.id)
    return {
      ...v,
      ai_note: latestCheck?.ai_analysis_notes || null,
      damage_photo_url: latestCheck?.damage_photo_url || null
    }
  })
}

/**
 * Gets ALL vehicles (excluding mechanic/in_service) for the END OF SHIFT form.
 * The Start of Shift explicitly excludes red/pending vehicles, but for EOS we MUST
 * include them so if a user is actively assigned to one, they can still end their shift.
 */
export async function getAllVehiclesForEOS() {
  const session = await getSession()
  if (!session?.userId) return []

  const supabase = await createClient()
  
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('org_id', session.orgId)
    .eq('in_service', false)   // exclude vehicles at the mechanic
    .order('rig_number')

  if (error || !vehicles) {
    console.error('Supabase fetch failed:', error?.message)
    return []
  }

  return vehicles
}

import { analyzeDamage, generateShiftGreeting, generateHandoffWarning, analyzeDispute, analyzeShiftIssue } from '@/lib/ai'
import webpush from 'web-push'

// Configure web-push
webpush.setVapidDetails(
  'mailto:support@smartrigcheck.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
)

export async function sendPushNotificationToManagers(payload: any) {
  try {
    console.log('Push: sendPushNotificationToManagers called with:', JSON.stringify(payload).substring(0, 200))
    const supabase = await createClient()
    
    // Find all users with role 'manager' or 'director' in the same org
    const { data: managers, error: mgrError } = await supabase
      .from('users')
      .select('id')
      .in('role', ['manager', 'director'])
      .eq('org_id', payload.org_id)

    console.log('Push: Found managers:', managers?.length, 'error:', mgrError?.message || 'none')

    if (!managers || managers.length === 0) {
      console.log('Push: No managers found')
      return
    }

    const managerIds = managers.map(m => m.id)

    // Get all subscriptions for those managers in the same org
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', managerIds)
      .eq('org_id', payload.org_id) // Only send to managers in this org

    console.log('Push: Found subscriptions:', subscriptions?.length, 'error:', subError?.message || 'none')

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`Push: No subscriptions found for ${managerIds.length} managers`)
      return
    }

    // Send push to each subscription
    console.log('Push: Sending to', subscriptions.length, 'endpoints...')
    const pushPromises = subscriptions.map(async (sub, index) => {
      try {
        console.log(`Push: Sending to endpoint #${index}:`, sub.endpoint.substring(0, 60))
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          JSON.stringify(payload)
        )
        console.log(`Push: SUCCESS sent to endpoint #${index}`)
      } catch (err: any) {
        console.error(`Push: FAILED endpoint #${index}:`, err.statusCode, err.body || err.message)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          console.log(`Push: Deleted expired subscription #${index}`)
        }
      }
    })

    await Promise.allSettled(pushPromises)
    console.log('Push: All sends completed')
  } catch (error) {
    console.error('sendPushNotificationToManagers CRASH:', error)
  }
}

export async function submitRigCheck(formData: FormData) {
  const vehicle_id = formData.get('vehicle_id') as string
  const oxygen_psi = parseInt(formData.get('oxygen_psi') as string, 10)
  const portable_oxygen_psi = parseInt(formData.get('portable_oxygen_psi') as string, 10)
  const damage_notes = formData.get('damage_notes') as string
  const damage_file = formData.get('damage_photo') as File | null
  const checklist_id = formData.get('checklist_id') as string | null
  const pdf_confirmed = formData.get('pdf_confirmed')

  // New: item-level statuses from Present/Missing UI
  const item_statuses_raw = formData.get('item_statuses') as string | null
  const missing_items_raw = formData.get('missing_items') as string | null
  const item_statuses = item_statuses_raw ? JSON.parse(item_statuses_raw) : {}
  const missing_items: string[] = missing_items_raw ? JSON.parse(missing_items_raw) : []

  const crew_last_name = formData.get('crew_last_name') as string | null // this is now pre-filled with full name
  const partner_name = formData.get('partner_name') as string | null
  const signature_data_url = formData.get('signature_data_url') as string | null

  // New: handoff dispute
  const handoff_disputed = formData.get('handoff_disputed') === 'true'
  const handoff_dispute_notes = formData.get('handoff_dispute_notes') as string | null

  // Duration tracking
  const check_duration_raw = formData.get('check_duration_seconds') as string | null
  const check_duration_seconds = check_duration_raw ? parseInt(check_duration_raw, 10) : null

  const supabase = await createClient()
  const session = await getSession()
  
  // Calculate full crew display name early for AI and Push alerts
  let crewDisplay = crew_last_name?.trim() || session?.username || 'Crew'
  if (partner_name && partner_name !== 'none') {
    crewDisplay = `${crewDisplay} & ${partner_name}`
  }

  let aiSeverity = null
  let aiNotes = null
  let uploadedPhotoUrl = null

  // 1. Process Missing Items
  if (missing_items.length > 0) {
    aiSeverity = 'yellow'
    aiNotes = `Missing equipment: ${missing_items.join(', ')}`
  }

  // 2. Process Handoff Dispute
  if (handoff_disputed) {
    aiSeverity = 'yellow' // Ensure it's yellow
    const disputeSummary = await analyzeDispute(handoff_dispute_notes || 'No details provided')
    
    if (aiNotes) {
      // If we already have missing items, append the dispute summary
      aiNotes = `${aiNotes} | ${disputeSummary}`
    } else {
      aiNotes = disputeSummary
    }
  }

  // 3. Process O2 Levels
  if (oxygen_psi < 500) {
    aiSeverity = 'yellow'
    aiNotes = aiNotes ? `${aiNotes} | Main O2 is critically low (${oxygen_psi} PSI)` : `Main O2 is critically low (${oxygen_psi} PSI)`
  }

  if (portable_oxygen_psi < 1000) {
    aiSeverity = 'yellow'
    aiNotes = aiNotes ? `${aiNotes} | Portable O2 is critically low (${portable_oxygen_psi} PSI)` : `Portable O2 is critically low (${portable_oxygen_psi} PSI)`
  }

  // PHOTO & TEXT NOTES AI ANALYSIS
  if ((damage_notes && damage_notes.trim()) || (damage_file && damage_file.size > 0)) {
    
    // First, handle the photo upload if it exists
    if (damage_file && damage_file.size > 0) {
      const fileExt = damage_file.name.split('.').pop() || 'jpg'
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('damage_photos')
        .upload(fileName, damage_file)

      if (uploadError) {
        console.error('Photo upload error:', uploadError.message)
        throw new Error('Failed to upload damage photo: ' + uploadError.message)
      }

      const { data: publicUrlData } = supabase.storage
        .from('damage_photos')
        .getPublicUrl(fileName)

      uploadedPhotoUrl = publicUrlData.publicUrl
      console.log('Push: uploadedPhotoUrl:', uploadedPhotoUrl)
    }

    // Now send either text, photo, or both to Gemini for analysis
    const aiResult = await analyzeDamage(damage_notes, uploadedPhotoUrl)
    
    aiSeverity = aiResult.severity // Assuming AI damage usually escalates severity to red/yellow anyway, keeping it simple
    aiNotes = aiNotes ? `${aiNotes} | ${aiResult.notes}` : aiResult.notes
  }

  const { error } = await supabase
    .from('rig_checks')
    .insert({
      org_id: session?.orgId,
      vehicle_id,
      emt_id: session?.userId || null,
      checklist_id: checklist_id || null,
      answers: { 
        oxygen_psi, 
        portable_oxygen_psi,
        item_statuses,
        missing_items,
        handoff_disputed,
        handoff_dispute_notes,
        pdf_confirmed: !!pdf_confirmed
      },
      damage_notes,
      damage_photo_url: uploadedPhotoUrl,
      ai_damage_severity: aiSeverity,
      ai_analysis_notes: aiNotes,
      crew_last_name: partner_name && partner_name !== 'none' ? `${crew_last_name} & ${partner_name}` : crew_last_name || null,
      signature_data_url: signature_data_url || null,
      check_duration_seconds: check_duration_seconds || null
    })

  if (error) {
    console.error('Supabase Insert failed:', error.message)
    throw new Error(error.message)
  }

  // Trigger Push Notification to managers if Red/Yellow status, missing items, or damage notes written
  const hasDamageNotes = damage_notes && damage_notes.trim().length > 0
  console.log('Push trigger check: aiSeverity=', aiSeverity, 'missing=', missing_items.length, 'hasDamageNotes=', hasDamageNotes, 'disputed=', handoff_disputed)

  if (aiSeverity === 'red' || aiSeverity === 'yellow' || missing_items.length > 0 || hasDamageNotes || handoff_disputed) {
    const isRed = aiSeverity === 'red'
    
    let alertBody = 'Fleet alert'
    if (handoff_disputed) {
      alertBody = `${crewDisplay} disputed handoff: ${handoff_dispute_notes}`
    } else if (aiNotes) {
      alertBody = `${crewDisplay}: ${aiNotes}`
    } else if (hasDamageNotes) {
      alertBody = `${crewDisplay}: ${damage_notes}`
    } else {
      alertBody = `${crewDisplay}: Missing items flagged.`
    }

    console.log('Push: Calling sendPushNotificationToManagers NOW')
    // AWAIT so we see all logs before response returns
    await sendPushNotificationToManagers({
      title: isRed ? '🚨 CRITICAL: FleetGuard Alert' : '⚠️ FleetGuard Alert',
      body: alertBody,
      url: '/dashboard',
      org_id: session?.orgId
    })
    console.log('Push: sendPushNotificationToManagers returned')
  } else {
    // GREEN — everything is OK, send "Unit Ready" notification
    console.log('Push: Green check — sending ready notification')
    const greenBody = `${crewDisplay} completed inspection — unit is ready for service.`
    await sendPushNotificationToManagers({
      title: '✅ Unit Ready',
      body: greenBody,
      url: '/dashboard',
      org_id: session?.orgId
    })
  }

  // Save in-app notification for dashboard bell (always, regardless of status)
  try {
    let notifTitle = ''
    let notifBody = ''
    let notifType: 'green' | 'yellow' | 'red' = 'green'

    if (aiSeverity === 'red') {
      notifType = 'red'
      notifTitle = '🚨 Critical Alert'
      notifBody = aiNotes || damage_notes || 'Critical issue detected'
    } else if (aiSeverity === 'yellow' || missing_items.length > 0 || handoff_disputed) {
      notifType = 'yellow'
      notifTitle = '⚠️ Needs Attention'
      notifBody = aiNotes || 'Issues flagged during inspection'
    } else {
      notifType = 'green'
      notifTitle = '✅ Unit Ready'
      notifBody = 'Inspection completed — unit is ready for service'
    }

    await supabase.from('notifications').insert({
      org_id: session?.orgId,
      type: notifType,
      title: notifTitle,
      body: `${crewDisplay}: ${notifBody}`,
      url: '/dashboard',
      vehicle_id,
    })
  } catch (notifError) {
    console.error('Failed to save in-app notification:', notifError)
  }

  // revalidatePath moved down below update

  // Generate personalized greeting (non-blocking — fallback is used if AI fails or quota hit)
  // Mark vehicle as on active shift (or pending approval if red)
  // crewDisplay is already calculated above

  if (aiSeverity === 'red') {
    // RED = Critical → Require manager approval before shift starts
    const { error: vehicleUpdateError } = await supabase
      .from('vehicles')
      .update({
        pending_approval: true,
        pending_approval_data: {
          crew_display: crewDisplay,
          ai_notes: aiNotes,
          damage_photo_url: uploadedPhotoUrl,
          requested_at: new Date().toISOString(),
        },
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', vehicle_id)

    if (vehicleUpdateError) {
      console.error('Error setting pending approval:', vehicleUpdateError.message)
    }

    revalidatePath('/dashboard')
    revalidatePath('/rig-check')

    return { success: true, pendingApproval: true, greeting: null }
  }

  // GREEN / YELLOW → Go on shift immediately
  const { error: vehicleUpdateError } = await supabase
    .from('vehicles')
    .update({
      on_shift_since: new Date().toISOString(),
      on_shift_by: crewDisplay,
      last_checked_at: new Date().toISOString()
    })
    .eq('id', vehicle_id)

  if (vehicleUpdateError) {
    console.error('Error updating vehicle shift status:', vehicleUpdateError.message)
  }

  revalidatePath('/dashboard')
  revalidatePath('/rig-check')

  const greeting = await generateShiftGreeting(
    partner_name && partner_name !== 'none' ? `${crew_last_name} and ${partner_name}` : crew_last_name || session?.username || 'Crew',
    crew_last_name || '',
    'ems'
  ).catch(() => `${(crewDisplay).toUpperCase()} — great job, stay safe out there!`)

  return { success: true, greeting }
}

export async function authenticate(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Username and password are required' }
  }

  const supabase = await createClient()

  // 1. Look up user's email by username
  const { data: profile, error: lookupError } = await supabase
    .from('users')
    .select('email, role, temp_password')
    .eq('username', username.trim())
    .single()

  if (lookupError || !profile?.email) {
    return { error: 'Invalid username or password' }
  }

  // 2. Sign in via Supabase Auth using the mapped email
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password,
  })

  if (authError) {
    return { error: 'Invalid username or password' }
  }

  // 3. Redirect based on role
  if (profile.temp_password) {
    redirect('/change-password')
  } else if (profile.role === 'manager' || profile.role === 'director') {
    redirect('/dashboard')
  } else {
    redirect('/rig-check')
  }
}

export async function updatePassword(formData: FormData) {
  const newPassword = formData.get('newPassword') as string
  
  if (!newPassword || newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters' }
  }

  const session = await getSession()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  const supabase = await createClient()

  // Update password via Supabase Auth
  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    return { error: 'Failed to update password' }
  }

  // Clear temp_password flag in profile
  await supabase.from('users').update({ temp_password: false }).eq('id', session.userId)

  if (session.role === 'manager' || session.role === 'director') {
    redirect('/dashboard')
  } else {
    redirect('/rig-check')
  }
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
  let pwd = ''
  for (let i = 0; i < 10; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pwd
}

export async function createEmployee(firstName: string, lastName: string, role: string, recoveryEmail?: string) {
  const session = await getSession()
  if (session?.role !== 'director') {
    return { error: 'Unauthorized' }
  }

  const username = `${firstName.charAt(0).toUpperCase()}${lastName.charAt(0).toUpperCase()}${lastName.slice(1).toLowerCase()}`
  const tempPassword = generateTempPassword()

  // Generate a synthetic email for Supabase Auth
  const email = recoveryEmail || `${username.toLowerCase()}@fleetguard.local`

  const supabase = await createClient()

  // Ensure username is unique
  const { data: existing } = await supabase.from('users').select('id').eq('username', username).single()
  if (existing) {
    return { error: 'A user with this generated username already exists.' }
  }

  // 1. Create auth user via admin API
  const adminSupabase = getAdminSupabase()
  const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true, // Auto-confirm, no verification email needed
  })

  if (authError || !authUser.user) {
    console.error('Create auth user error:', authError)
    return { error: 'Failed to create user account' }
  }

  // 2. Insert profile in public.users linked via auth_id
  const { error } = await supabase.from('users').insert({
    auth_id: authUser.user.id,
    username,
    email,
    first_name: firstName,
    last_name: lastName,
    role,
    org_id: session.orgId,
    org_type: 'ems',
    temp_password: true,
    ...(recoveryEmail ? { recovery_email: recoveryEmail } : {})
  })

  if (error) {
    console.error('Create profile error:', error)
    // Cleanup: delete the auth user if profile creation fails
    await adminSupabase.auth.admin.deleteUser(authUser.user.id)
    return { error: 'Database error creating user' }
  }

  revalidatePath('/dashboard/users')
  return { success: true, username, tempPassword }
}

export async function resetEmployeePassword(userId: string) {
  const session = await getSession()
  if (session?.role !== 'director') {
    return { error: 'Unauthorized' }
  }

  const supabase = await createClient()

  // Get the auth_id for this profile
  const { data: profile } = await supabase
    .from('users')
    .select('auth_id')
    .eq('id', userId)
    .single()

  if (!profile?.auth_id) {
    return { error: 'User not found' }
  }

  const tempPassword = generateTempPassword()

  // Update password via admin API
  const adminSupabase = getAdminSupabase()
  const { error: authError } = await adminSupabase.auth.admin.updateUserById(profile.auth_id, {
    password: tempPassword,
  })

  if (authError) {
    console.error('Reset password error:', authError)
    return { error: 'Failed to reset password' }
  }

  // Set temp_password flag
  await supabase.from('users').update({ temp_password: true }).eq('id', userId)

  revalidatePath('/dashboard/users')
  return { success: true, tempPassword }
}

export async function updateUserRecoveryEmail(userId: string, email: string) {
  const session = await getSession()
  if (session?.role !== 'director') {
    return { error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ recovery_email: email || null })
    .eq('id', userId)

  if (error) {
    console.error('Update recovery email error:', error)
    return { error: 'Failed to update email' }
  }

  revalidatePath('/dashboard/users')
  return { success: true }
}

// ── Checklist Management ──────────────────────────────────────────────

import { normalizeChecklist } from '@/lib/categorize'
import type { ChecklistCategory } from '@/lib/presets'

/**
 * Get the active checklist for a given vehicle.
 * Priority: vehicle-specific checklist first, then global fallback.
 * Auto-normalizes legacy flat format to hierarchical.
 */
export async function getChecklistForVehicle(vehicleId: string | null) {
  const session = await getSession()
  const supabase = await createClient()

  if (!session?.orgId) return null

  // 1. Try vehicle-specific checklist (vehicle_ids contains this vehicle)
  if (vehicleId) {
    const { data: vehicleSpecific } = await supabase
      .from('checklists')
      .select('*')
      .eq('is_active', true)
      .eq('org_id', session.orgId)
      .contains('vehicle_ids', [vehicleId])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (vehicleSpecific) {
      return {
        ...vehicleSpecific,
        questions: normalizeChecklist(vehicleSpecific.questions),
      }
    }
  }

  // 2. Fall back to global checklist (vehicle_ids is NULL)
  const { data: global } = await supabase
    .from('checklists')
    .select('*')
    .eq('is_active', true)
    .eq('org_id', session.orgId)
    .is('vehicle_ids', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (global) {
    return {
      ...global,
      questions: normalizeChecklist(global.questions),
    }
  }

  // 3. Try any active checklist (backward compat — old data might not have vehicle_ids)
  const { data: any } = await supabase
    .from('checklists')
    .select('*')
    .eq('is_active', true)
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (any) {
    return {
      ...any,
      questions: normalizeChecklist(any.questions),
    }
  }

  return null
}

/** @deprecated Use getChecklistForVehicle instead. Kept for backward compat. */
export async function getActiveChecklist() {
  return getChecklistForVehicle(null)
}

/**
 * Create a new hierarchical checklist.
 * vehicleIds = null means global (all vehicles).
 */
export async function createChecklist(
  title: string,
  categories: ChecklistCategory[],
  vehicleIds: string[] | null = null,
  description: string = '',
  restockItems: string[] = []
): Promise<{ error?: string; success?: boolean; id?: string }> {
  const session = await getSession()
  if (!session?.userId) return { error: 'Unauthorized' }

  const supabase = await createClient()

  // Deactivate conflicting checklists:
  // If global → deactivate other globals. If vehicle-specific → deactivate ones targeting same vehicles.
  if (!vehicleIds) {
    await supabase
      .from('checklists')
      .update({ is_active: false })
      .eq('org_id', session.orgId)
      .is('vehicle_ids', null)
  }

  const { data, error } = await supabase
    .from('checklists')
    .insert({
      org_id: session.orgId,
      title,
      type: 'manual',
      questions: categories,
      vehicle_ids: vehicleIds,
      description: description || null,
      restock_items: restockItems.length > 0 ? restockItems : null,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to create checklist:', error.message)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/checklists')
  revalidatePath('/rig-check')

  return { success: true, id: data?.id }
}

/**
 * Update an existing checklist.
 */
export async function updateChecklist(
  checklistId: string,
  title: string,
  categories: ChecklistCategory[],
  vehicleIds: string[] | null = null,
  description: string = '',
  restockItems: string[] = []
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session?.userId) return { error: 'Unauthorized' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('checklists')
    .update({
      title,
      questions: categories,
      vehicle_ids: vehicleIds,
      description: description || null,
      restock_items: restockItems.length > 0 ? restockItems : null,
    })
    .eq('id', checklistId)
    .eq('org_id', session.orgId)

  if (error) {
    console.error('Failed to update checklist:', error.message)
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/checklists')
  revalidatePath('/rig-check')

  return { success: true }
}

/**
 * Toggle checklist active state.
 */
export async function toggleChecklist(checklistId: string, isActive: boolean): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session?.userId) return { error: 'Unauthorized' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('checklists')
    .update({ is_active: isActive })
    .eq('id', checklistId)
    .eq('org_id', session.orgId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/checklists')
  revalidatePath('/rig-check')

  return { success: true }
}

/**
 * Delete a checklist.
 */
export async function deleteChecklist(checklistId: string): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession()
  if (!session?.userId) return { error: 'Unauthorized' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('checklists')
    .delete()
    .eq('id', checklistId)
    .eq('org_id', session.orgId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/checklists')
  revalidatePath('/rig-check')

  return { success: true }
}

/**
 * Get all checklists for the current org (for the management page).
 */
export async function getOrgChecklists() {
  const session = await getSession()
  if (!session?.orgId) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('checklists')
    .select('id, title, description, type, is_active, vehicle_ids, questions, restock_items, created_at')
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch checklists:', error.message)
    return []
  }

  return data || []
}

export async function submitEndOfShiftReport(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const session = await getSession()

  const vehicle_id = formData.get('vehicle_id') as string
  const fuel_level = formData.get('fuel_level') as string
  const cleanliness_details = formData.get('cleanliness_details') as string | null
  const restock_needed = JSON.parse(formData.get('restock_needed') as string || '[]')
  const vehicle_condition = formData.get('vehicle_condition') as string
  const notes = formData.get('notes') as string
  const checklist_id = formData.get('checklist_id') as string | null

  if (!vehicle_id) throw new Error('Vehicle is required')

  const { data: vehicleData } = await supabase.from('vehicles').select('on_shift_by').eq('id', vehicle_id).single()
  const crew_last_name = vehicleData?.on_shift_by || null

  // Merge notes: the UI now sends a single field, but we store in both columns for backward compat
  const mergedNotes = [vehicle_condition, notes].filter(Boolean).join(' ').trim()

  const { error } = await supabase
    .from('end_of_shift_reports')
    .insert({
      org_id: session?.orgId,
      vehicle_id,
      emt_id: session?.userId || null,
      checklist_id: checklist_id || null,
      fuel_level,
      cleanliness_details: cleanliness_details ? JSON.parse(cleanliness_details) : null,
      restock_needed,
      vehicle_condition: mergedNotes || null,
      notes: mergedNotes || null,
      crew_last_name
    })

  if (error) {
    console.error('End of shift report error:', error.message)
    throw new Error(error.message)
  }

  // Determine new vehicle status:
  // If crew reported any issues/notes → YELLOW (needs attention)
  // Otherwise → GREEN (all clear)
  const hasIssues = mergedNotes.length > 0
  const newStatus = hasIssues ? 'yellow' : 'green'

  // Clear active shift from vehicle AND set status
  const { error: clearShiftError } = await supabase
    .from('vehicles')
    .update({
      on_shift_since: null,
      on_shift_by: null,
      on_shift_rig_check_id: null,
      status: newStatus,
    })
    .eq('id', vehicle_id)

  if (clearShiftError) {
    console.error('Error clearing vehicle shift status:', clearShiftError.message)
  }

  revalidatePath('/dashboard')
  revalidatePath('/rig-check')
}

export async function adminForceEndShift(vehicleId: string) {
  const session = await getSession()
  if (session?.role !== 'manager' && session?.role !== 'director') {
    throw new Error('Unauthorized')
  }

  const supabase = await createClient()

  // Read the current crew to record it in the audit log
  const { data: vehicleData } = await supabase.from('vehicles').select('on_shift_by').eq('id', vehicleId).single()
  const crew_last_name = vehicleData?.on_shift_by || null

  const { error: eosError } = await supabase
    .from('end_of_shift_reports')
    .insert({
      org_id: session.orgId,
      vehicle_id: vehicleId,
      emt_id: session.userId,
      fuel_level: 'empty',
      vehicle_condition: 'System forced end of shift',
      notes: `Shift forcefully ended by ${session.username}.`,
      crew_last_name
    })

  if (eosError) {
    console.error('Forced EOS insert error:', eosError.message)
    throw new Error(eosError.message)
  }

  // Clear active shift from vehicle
  const { error: clearShiftError } = await supabase
    .from('vehicles')
    .update({ on_shift_since: null, on_shift_by: null, on_shift_rig_check_id: null })
    .eq('id', vehicleId)

  if (clearShiftError) {
    throw new Error(clearShiftError.message)
  }

  await logAuditEvent({
    orgId: session.orgId,
    actorId: session.userId,
    actorName: session.username,
    action: 'shift.force_ended',
    targetType: 'vehicle',
    targetId: vehicleId,
    targetLabel: crew_last_name || undefined,
    details: { crew: crew_last_name },
  })

  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Manager approves a red-flagged vehicle to go on shift.
 * Clears pending_approval and sets on_shift_since.
 */
export async function approveVehicleShift(vehicleId: string) {
  const session = await getSession()
  if (session?.role !== 'manager' && session?.role !== 'director') {
    throw new Error('Unauthorized')
  }

  const supabase = await createClient()

  // Read pending data
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('pending_approval_data')
    .eq('id', vehicleId)
    .single()

  if (!vehicle?.pending_approval_data) {
    throw new Error('No pending approval found for this vehicle')
  }

  const crewDisplay = vehicle.pending_approval_data.crew_display || 'Crew'

  // Approve: clear pending, start shift, reset status to GREEN
  const { error } = await supabase
    .from('vehicles')
    .update({
      pending_approval: false,
      pending_approval_data: null,
      status: 'green',
      on_shift_since: new Date().toISOString(),
      on_shift_by: crewDisplay,
    })
    .eq('id', vehicleId)

  if (error) {
    throw new Error(error.message)
  }

  // Send push notification to crew that they're approved
  await sendPushNotificationToManagers({
    title: '✅ Vehicle Approved',
    body: `${crewDisplay} — shift approved by ${session.username}. Timer started.`,
    url: '/rig-check/on-shift',
    org_id: session.orgId
  })

  await logAuditEvent({
    orgId: session!.orgId,
    actorId: session!.userId,
    actorName: session!.username,
    action: 'shift.approved',
    targetType: 'vehicle',
    targetId: vehicleId,
    targetLabel: crewDisplay,
    details: { crew: crewDisplay },
  })

  revalidatePath('/dashboard')
  revalidatePath('/rig-check')
  return { success: true }
}

/**
 * Manager rejects a red-flagged vehicle. Vehicle stays off-shift.
 */
export async function rejectVehicleShift(vehicleId: string) {
  const session = await getSession()
  if (session?.role !== 'manager' && session?.role !== 'director') {
    throw new Error('Unauthorized')
  }

  const supabase = await createClient()

  // Read pending data for notification
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('pending_approval_data, rig_number')
    .eq('id', vehicleId)
    .single()

  const crewDisplay = vehicle?.pending_approval_data?.crew_display || 'Crew'

  // Reject: clear pending, do NOT start shift
  const { error } = await supabase
    .from('vehicles')
    .update({
      pending_approval: false,
      pending_approval_data: null,
    })
    .eq('id', vehicleId)

  if (error) {
    throw new Error(error.message)
  }

  // Send push notification
  await sendPushNotificationToManagers({
    title: '🚫 Vehicle Rejected',
    body: `${vehicle?.rig_number || 'Vehicle'} rejected by ${session.username}. ${crewDisplay} cannot go on shift.`,
    url: '/dashboard',
    org_id: session.orgId
  })

  await logAuditEvent({
    orgId: session!.orgId,
    actorId: session!.userId,
    actorName: session!.username,
    action: 'shift.rejected',
    targetType: 'vehicle',
    targetId: vehicleId,
    targetLabel: vehicle?.rig_number || undefined,
    details: { crew: crewDisplay },
  })

  revalidatePath('/dashboard')
  revalidatePath('/rig-check')
  return { success: true }
}

/**
 * Returns the most recent EOS report + SoS damage notes for a vehicle,
 * used to build the Handoff Card for the incoming crew.
 */
export async function getVehicleHandoff(vehicleId: string): Promise<{
  lastCrew: string | null
  fuelLevel: string | null
  cleanlinessDetails: any | null
  restockNeeded: string[]
  handoffNotes: string | null
  damageSummary: string | null
  endedAt: string | null
} | null> {
  const supabase = await createClient()

  // Get latest EOS for this vehicle
  const { data: eos } = await supabase
    .from('end_of_shift_reports')
    .select('fuel_level, cleanliness_rating, cleanliness_details, restock_needed, vehicle_condition, notes, created_at, users(username)')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Get latest rig_check damage notes for this vehicle
  const { data: latestCheck } = await supabase
    .from('rig_checks')
    .select('damage_notes, crew_last_name, created_at, users(username)')
    .eq('vehicle_id', vehicleId)
    .not('damage_notes', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!eos && !latestCheck) return null

  const eosUsers = eos ? (Array.isArray((eos as any).users) ? (eos as any).users[0]?.username : (eos as any).users?.username) : null
  const checkUsers = latestCheck ? (Array.isArray((latestCheck as any).users) ? (latestCheck as any).users[0]?.username : (latestCheck as any).users?.username) : null

  return {
    lastCrew: (latestCheck as any)?.crew_last_name || (eos as any)?.crew_last_name || eosUsers || checkUsers || null,
    fuelLevel: eos?.fuel_level || null,
    cleanlinessDetails: (eos as any)?.cleanliness_details || null,
    restockNeeded: eos?.restock_needed || [],
    handoffNotes: eos?.notes || null,
    damageSummary: latestCheck?.damage_notes || null,
    endedAt: eos?.created_at || null,
  }
}

/**
 * Gets the initial data for the EOS form based on the user's latest rig check.
 */
export async function getInitialEndOfShiftData() {
  const supabase = await createClient()
  const session = await getSession()
  if (!session?.userId) return { vehicleId: null }

  // Get the most recent rig check for this user from the last 16 hours
  const sixteenHoursAgo = new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString()
  
  const { data: latestCheck } = await supabase
    .from('rig_checks')
    .select('vehicle_id')
    .eq('emt_id', session.userId)
    .gte('created_at', sixteenHoursAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return {
    vehicleId: latestCheck?.vehicle_id || null
  }
}

/**
 * Gets the missing items from the most recent rigorous check for a specific vehicle.
 */
export async function getShiftMissingItems(vehicleId: string) {
  const supabase = await createClient()
  const session = await getSession()
  const { data: latestCheck } = await supabase
    .from('rig_checks')
    .select('answers, created_at, crew_last_name')
    .eq('vehicle_id', vehicleId)
    .eq('org_id', session?.orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return {
    missingItems: (latestCheck as any)?.answers?.missing_items || [],
    previousCrew: (latestCheck as any)?.crew_last_name || null
  }
}

/**
 * Report still-missing items at start of shift — notifies manager.
 */
export async function reportStillMissingItems(vehicleId: string, stillMissingItems: string[], vehicleRigNumber: string) {
  const supabase = await createClient()
  const session = await getSession()
  if (!session?.orgId || stillMissingItems.length === 0) return

  const itemList = stillMissingItems.join(', ')

  await sendPushNotificationToManagers({
    title: `⚠️ Equipment Still Missing — ${vehicleRigNumber}`,
    body: `New crew confirmed items still missing: ${itemList}`,
    url: '/dashboard',
    org_id: session.orgId
  })

  await supabase.from('notifications').insert({
    org_id: session.orgId,
    type: 'yellow',
    title: `⚠️ Equipment Still Missing — ${vehicleRigNumber}`,
    body: `Incoming crew confirmed: ${itemList} still not in vehicle.`,
    url: '/dashboard',
    vehicle_id: vehicleId
  })
}

/**
 * Validates whether a vehicle has an active shift.
 * Used to gate the End of Shift form.
 */
export async function checkActiveShift(vehicleId: string): Promise<{
  active: boolean
  since: string | null
  by: string | null
}> {
  const supabase = await createClient()
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('on_shift_since, on_shift_by')
    .eq('id', vehicleId)
    .single()

  return {
    active: !!(vehicle?.on_shift_since),
    since: vehicle?.on_shift_since || null,
    by: vehicle?.on_shift_by || null,
  }
}

/**
 * Fetches a personalized AI welcome greeting for the top of the Rig Check form.
 */
export async function fetchWelcomeGreeting(): Promise<string | null> {
  try {
    const session = await getSession()
    if (!session?.userId) return null
    const supabase = await createClient()
    const { data: user } = await supabase.from('users').select('first_name, last_name, org_type').eq('id', session.userId).single()
    if (!user) return null
    
    return await generateShiftGreeting(user.first_name || session.username, user.last_name || '', user.org_type || 'ems')
  } catch (err) {
    return null
  }
}

/**
 * ==========================================
 * DIRECTOR FUNCTIONS (VEHICLE MANAGEMENT)
 * ==========================================
 */

/**
 * Adds a new vehicle to the organization.
 */
export async function addVehicle(rigNumber: string) {
  const session = await getSession()
  if (!session?.userId || session.role !== 'director') {
    throw new Error('Unauthorized: Only directors can add vehicles')
  }

  if (!rigNumber || rigNumber.trim() === '') {
    throw new Error('Rig number cannot be empty')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('vehicles')
    .insert({
      org_id: session.orgId,
      rig_number: rigNumber.trim(),
      status: 'green'
    })

  if (error) {
    if (error.code === '23505') { // Unique constraint violation in Postgres
      throw new Error(`Vehicle ${rigNumber} already exists in the system.`)
    }
    console.error('Failed to add vehicle:', error)
    throw new Error('Database error while adding vehicle')
  }

  await logAuditEvent({
    orgId: session.orgId,
    actorId: session.userId,
    actorName: session.username,
    action: 'vehicle.added',
    targetType: 'vehicle',
    targetLabel: rigNumber.trim(),
  })

  revalidatePath('/dashboard/vehicles')
  revalidatePath('/dashboard')
}

/**
 * Removes a vehicle from the organization.
 */
export async function removeVehicle(vehicleId: string) {
  const session = await getSession()
  if (!session?.userId || session.role !== 'director') {
    throw new Error('Unauthorized: Only directors can remove vehicles')
  }

  const supabase = await createClient()

  // Read vehicle name before deleting for audit
  const { data: vehicle } = await supabase.from('vehicles').select('rig_number').eq('id', vehicleId).single()

  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', vehicleId)

  if (error) {
    console.error('Failed to remove vehicle:', error)
    throw new Error('Database error while removing vehicle')
  }

  await logAuditEvent({
    orgId: session.orgId,
    actorId: session.userId,
    actorName: session.username,
    action: 'vehicle.removed',
    targetType: 'vehicle',
    targetId: vehicleId,
    targetLabel: vehicle?.rig_number || undefined,
  })

  revalidatePath('/dashboard/vehicles')
  revalidatePath('/dashboard')
}

/**
 * Renames a vehicle's rig_number.
 */
export async function renameVehicle(vehicleId: string, newName: string) {
  const session = await getSession()
  if (!session?.userId || session.role !== 'director') {
    throw new Error('Unauthorized: Only directors can rename vehicles')
  }

  if (!newName || newName.trim() === '') {
    throw new Error('Vehicle name cannot be empty')
  }

  const supabase = await createClient()

  // Read old name for audit
  const { data: oldVehicle } = await supabase.from('vehicles').select('rig_number').eq('id', vehicleId).single()

  const { error } = await supabase
    .from('vehicles')
    .update({ rig_number: newName.trim() })
    .eq('id', vehicleId)

  if (error) {
    if (error.code === '23505') {
      throw new Error(`A vehicle named "${newName}" already exists.`)
    }
    console.error('Failed to rename vehicle:', error)
    throw new Error('Database error while renaming vehicle')
  }

  await logAuditEvent({
    orgId: session.orgId,
    actorId: session.userId,
    actorName: session.username,
    action: 'vehicle.renamed',
    targetType: 'vehicle',
    targetId: vehicleId,
    targetLabel: newName.trim(),
    details: { old_name: oldVehicle?.rig_number, new_name: newName.trim() },
  })

  revalidatePath('/dashboard/vehicles')
  revalidatePath('/dashboard')
  revalidatePath('/rig-check')
}

/**
 * Toggles a vehicle's in_service status.
 * When in_service=true the vehicle is hidden from EMT rig-check selection.
 */
export async function toggleVehicleService(vehicleId: string, inService: boolean) {
  const session = await getSession()
  if (!session?.userId || session.role !== 'director') {
    throw new Error('Unauthorized: Only directors can change vehicle service status')
  }

  const supabase = await createClient()

  // Read vehicle name for audit
  const { data: veh } = await supabase.from('vehicles').select('rig_number').eq('id', vehicleId).single()

  const { error } = await supabase
    .from('vehicles')
    .update({ in_service: inService })
    .eq('id', vehicleId)

  if (error) {
    console.error('Failed to update vehicle service status:', error)
    throw new Error('Database error while updating vehicle service status')
  }

  await logAuditEvent({
    orgId: session.orgId,
    actorId: session.userId,
    actorName: session.username,
    action: inService ? 'vehicle.sent_to_service' : 'vehicle.returned_from_service',
    targetType: 'vehicle',
    targetId: vehicleId,
    targetLabel: veh?.rig_number || undefined,
  })

  revalidatePath('/dashboard/vehicles')
  revalidatePath('/dashboard')
  revalidatePath('/rig-check')
}

/**
 * Manually updates a vehicle's status (green/yellow/red).
 * Clears any pending_approval state since a manager is manually overriding.
 */
export async function updateVehicleStatus(vehicleId: string, newStatus: 'green' | 'yellow' | 'red') {
  const session = await getSession()
  if (!session?.userId || (session.role !== 'manager' && session.role !== 'director')) {
    throw new Error('Unauthorized: Only managers and directors can change vehicle status')
  }

  const supabase = await createClient()

  // Read old status for audit
  const { data: oldVeh } = await supabase.from('vehicles').select('rig_number, status').eq('id', vehicleId).single()

  const { error } = await supabase
    .from('vehicles')
    .update({ 
      status: newStatus,
      pending_approval: false,
      pending_approval_data: null
    })
    .eq('id', vehicleId)

  if (error) {
    console.error('Failed to update vehicle status:', error)
    throw new Error('Database error while updating vehicle status')
  }

  await logAuditEvent({
    orgId: session.orgId,
    actorId: session.userId,
    actorName: session.username,
    action: 'vehicle.status_changed',
    targetType: 'vehicle',
    targetId: vehicleId,
    targetLabel: oldVeh?.rig_number || undefined,
    details: { old_status: oldVeh?.status, new_status: newStatus },
  })

  revalidatePath('/dashboard/vehicles')
  revalidatePath('/dashboard')
  revalidatePath('/rig-check')
}

// ─── In-App Notifications ───────────────────────────────────────────

export async function getUnreadNotifications() {
  const session = await getSession()
  if (!session?.orgId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('getUnreadNotifications error:', error)
    return []
  }
  return data || []
}

export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return
  const supabase = await createClient()
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .in('id', ids)
  revalidatePath('/dashboard')
}

export async function markAllNotificationsRead() {
  const session = await getSession()
  if (!session?.orgId) return

  const supabase = await createClient()
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
    .eq('org_id', session.orgId)
  revalidatePath('/dashboard')
}

// ==========================================
// SHIFT ACCOUNTABILITY
// ==========================================

/**
 * Submit a shift issue reported by the incoming crew.
 * Uploads photo, runs AI analysis, finds previous crew, creates the record.
 */
export async function submitShiftIssue(formData: FormData) {
  const supabase = await createClient()
  const session = await getSession()
  if (!session?.userId || !session?.orgId) throw new Error('Not authenticated')

  const vehicle_id = formData.get('vehicle_id') as string
  const rig_check_id = formData.get('rig_check_id') as string | null
  const category = formData.get('issue_category') as string
  const description = formData.get('issue_description') as string | null
  const photoCount = parseInt(formData.get('issue_photo_count') as string || '0', 10)
  const fuel_level = formData.get('issue_fuel_level') as string | null
  const reporter_name = formData.get('reporter_name') as string || session.username || 'Crew'

  if (!vehicle_id || !category) throw new Error('Vehicle and category are required')

  // 1. Upload all photos
  const photoUrls: string[] = []
  for (let i = 0; i < photoCount; i++) {
    const photo = formData.get(`issue_photo_${i}`) as File | null
    if (photo && photo.size > 0) {
      const fileExt = photo.name.split('.').pop() || 'jpg'
      const fileName = `shift_issue_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('damage_photos')
        .upload(fileName, photo)

      if (uploadError) {
        console.error(`Shift issue photo ${i} upload error:`, uploadError.message)
        continue // Skip failed uploads, don't block the whole submission
      }

      const { data: publicUrlData } = supabase.storage
        .from('damage_photos')
        .getPublicUrl(fileName)
      photoUrls.push(publicUrlData.publicUrl)
    }
  }

  // Store as JSON array or single URL for backward compatibility
  const photoUrlValue = photoUrls.length > 0 ? JSON.stringify(photoUrls) : null

  // 2. AI analysis (send first photo for analysis)
  const aiResult = await analyzeShiftIssue(photoUrls[0] || null, category, description)

  // 3. Find previous crew — look at last EOS report for this vehicle
  let previousCrewName: string | null = null
  let previousEosId: string | null = null

  const { data: lastEos } = await supabase
    .from('end_of_shift_reports')
    .select('id, crew_last_name')
    .eq('org_id', session.orgId)
    .eq('vehicle_id', vehicle_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (lastEos) {
    previousCrewName = lastEos.crew_last_name
    previousEosId = lastEos.id
  }

  // 4. Insert shift issue
  const { error } = await supabase
    .from('shift_issues')
    .insert({
      org_id: session.orgId,
      reporter_id: session.userId,
      reporter_name,
      rig_check_id: rig_check_id || null,
      vehicle_id,
      previous_crew_name: previousCrewName,
      previous_eos_id: previousEosId,
      category,
      description,
      photo_url: photoUrlValue,
      fuel_level,
      ai_analysis: aiResult.analysis,
      ai_severity: aiResult.severity,
      status: 'pending'
    })

  if (error) {
    console.error('Shift issue insert error:', error.message)
    throw new Error(error.message)
  }

  // 5. Get vehicle rig number for notification
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('rig_number')
    .eq('id', vehicle_id)
    .single()

  // 6. Push notification to managers
  await sendPushNotificationToManagers({
    title: '📸 Shift Issue Reported',
    body: `${reporter_name} reported: ${category} on ${vehicle?.rig_number || 'vehicle'}`,
    url: '/dashboard',
    org_id: session.orgId
  })

  // 7. In-app notification
  await supabase.from('notifications').insert({
    org_id: session.orgId,
    type: 'yellow',
    title: '📸 Shift Issue',
    body: `${reporter_name}: ${category} on ${vehicle?.rig_number || 'vehicle'} — ${aiResult.severity}`,
    url: '/dashboard',
    vehicle_id
  })

  // 8. Audit log
  await logAuditEvent({
    orgId: session.orgId,
    actorId: session.userId,
    actorName: reporter_name,
    action: 'shift_issue_reported',
    targetType: 'vehicle',
    targetId: vehicle_id,
    targetLabel: vehicle?.rig_number || vehicle_id,
    details: {
      category,
      ai_severity: aiResult.severity,
      previous_crew: previousCrewName
    }
  })

  revalidatePath('/dashboard')
  return { success: true, severity: aiResult.severity, analysis: aiResult.analysis }
}

/**
 * Manager approves or rejects a shift issue.
 */
export async function reviewShiftIssue(issueId: string, approved: boolean, notes?: string) {
  const supabase = await createClient()
  const session = await getSession()
  if (!session?.userId) throw new Error('Not authenticated')

  const { data: issue } = await supabase
    .from('shift_issues')
    .select('id, category, previous_crew_name, vehicle_id, reporter_name')
    .eq('id', issueId)
    .single()

  if (!issue) throw new Error('Issue not found')

  const { error } = await supabase
    .from('shift_issues')
    .update({
      status: approved ? 'approved' : 'rejected',
      reviewed_by: session.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: notes || null
    })
    .eq('id', issueId)

  if (error) throw new Error(error.message)

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('rig_number')
    .eq('id', issue.vehicle_id)
    .single()

  await logAuditEvent({
    orgId: session.orgId!,
    actorId: session.userId,
    actorName: session.username || 'Manager',
    action: approved ? 'shift_issue_approved' : 'shift_issue_rejected',
    targetType: 'shift_issue',
    targetId: issueId,
    targetLabel: `${issue.category} on ${vehicle?.rig_number || 'vehicle'}`,
    details: {
      previous_crew: issue.previous_crew_name,
      reporter: issue.reporter_name,
      notes
    }
  })

  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Get pending shift issues for the dashboard (manager view).
 */
export async function getPendingShiftIssues() {
  const supabase = await createClient()
  const session = await getSession()
  if (!session?.orgId) return []

  const { data, error } = await supabase
    .from('shift_issues')
    .select(`
      id, category, description, photo_url, fuel_level, ai_analysis, ai_severity,
      status, created_at, reporter_name, previous_crew_name,
      vehicles!shift_issues_vehicle_id_fkey (rig_number)
    `)
    .eq('org_id', session.orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch shift issues:', error.message)
    return []
  }

  return (data || []).map((d: any) => ({
    ...d,
    rig_number: Array.isArray(d.vehicles) ? d.vehicles[0]?.rig_number : d.vehicles?.rig_number
  }))
}

// ==========================================
// INVENTORY (WAREHOUSE) MANAGEMENT
// ==========================================

/**
 * Check if inventory is enabled for the current org.
 */
export async function getInventoryEnabled(): Promise<boolean> {
  const session = await getSession()
  if (!session?.orgId) return false

  const supabase = await createClient()
  const { data } = await supabase
    .from('organizations')
    .select('inventory_enabled')
    .eq('id', session.orgId)
    .single()

  return data?.inventory_enabled ?? false
}

/**
 * Director toggles inventory feature on/off.
 */
export async function toggleInventory(enabled: boolean) {
  const session = await getSession()
  if (!session?.userId || session.role !== 'director') {
    throw new Error('Unauthorized: Only directors can toggle inventory')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organizations')
    .update({ inventory_enabled: enabled })
    .eq('id', session.orgId)

  if (error) throw new Error(error.message)

  await logAuditEvent({
    orgId: session.orgId,
    actorId: session.userId,
    actorName: session.username,
    action: enabled ? 'inventory.enabled' : 'inventory.disabled',
    targetType: 'organization',
    targetId: session.orgId,
  })

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/inventory')
  return { success: true }
}

/**
 * Get all inventory items for the org.
 */
export async function getInventoryItems() {
  const session = await getSession()
  if (!session?.orgId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('org_id', session.orgId)
    .order('category')
    .order('name')

  if (error) {
    console.error('getInventoryItems error:', error)
    return []
  }
  return data || []
}

/**
 * Director adds a new inventory item.
 */
export async function addInventoryItem(
  name: string,
  category: string,
  unit: string,
  quantity: number,
  lowThreshold: number,
  criticalThreshold: number
) {
  const session = await getSession()
  if (!session?.userId || session.role !== 'director') {
    throw new Error('Unauthorized: Only directors can add inventory items')
  }

  if (!name || name.trim() === '') throw new Error('Item name is required')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      org_id: session.orgId,
      name: name.trim(),
      category: category.trim() || 'General',
      unit: unit.trim() || 'pcs',
      quantity,
      low_threshold: lowThreshold,
      critical_threshold: criticalThreshold,
    })
    .select()
    .single()

  if (error) {
    console.error('addInventoryItem error:', error)
    throw new Error(error.message)
  }

  await logAuditEvent({
    orgId: session.orgId,
    actorId: session.userId,
    actorName: session.username,
    action: 'inventory.item_added',
    targetType: 'inventory_item',
    targetId: data.id,
    targetLabel: name.trim(),
    details: { quantity, category, unit },
  })

  revalidatePath('/dashboard/inventory')
  return { success: true, id: data.id }
}

/**
 * Director updates an inventory item.
 */
export async function updateInventoryItem(
  itemId: string,
  updates: {
    name?: string
    category?: string
    unit?: string
    quantity?: number
    low_threshold?: number
    critical_threshold?: number
  }
) {
  const session = await getSession()
  if (!session?.userId || session.role !== 'director') {
    throw new Error('Unauthorized: Only directors can edit inventory items')
  }

  const supabase = await createClient()

  // Read old values for audit
  const { data: oldItem } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', itemId)
    .single()

  const updatePayload: any = { updated_at: new Date().toISOString() }
  if (updates.name !== undefined) updatePayload.name = updates.name.trim()
  if (updates.category !== undefined) updatePayload.category = updates.category.trim()
  if (updates.unit !== undefined) updatePayload.unit = updates.unit.trim()
  if (updates.quantity !== undefined) updatePayload.quantity = updates.quantity
  if (updates.low_threshold !== undefined) updatePayload.low_threshold = updates.low_threshold
  if (updates.critical_threshold !== undefined) updatePayload.critical_threshold = updates.critical_threshold

  const { error } = await supabase
    .from('inventory_items')
    .update(updatePayload)
    .eq('id', itemId)

  if (error) throw new Error(error.message)

  // If quantity was manually adjusted, log a transaction
  if (updates.quantity !== undefined && oldItem && updates.quantity !== oldItem.quantity) {
    const change = updates.quantity - oldItem.quantity
    await supabase.from('inventory_transactions').insert({
      org_id: session.orgId,
      item_id: itemId,
      user_id: session.userId,
      user_name: session.username,
      shift_type: 'manual_adjust',
      change,
      quantity_after: updates.quantity,
      notes: `Manual adjustment by ${session.username}`,
    })
  }

  await logAuditEvent({
    orgId: session.orgId,
    actorId: session.userId,
    actorName: session.username,
    action: 'inventory.item_updated',
    targetType: 'inventory_item',
    targetId: itemId,
    targetLabel: updates.name || oldItem?.name || itemId,
    details: { updates, old_quantity: oldItem?.quantity },
  })

  revalidatePath('/dashboard/inventory')
  return { success: true }
}

/**
 * Director deletes an inventory item.
 */
export async function deleteInventoryItem(itemId: string) {
  const session = await getSession()
  if (!session?.userId || session.role !== 'director') {
    throw new Error('Unauthorized: Only directors can delete inventory items')
  }

  const supabase = await createClient()

  // Read item name for audit
  const { data: item } = await supabase
    .from('inventory_items')
    .select('name')
    .eq('id', itemId)
    .single()

  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId)

  if (error) throw new Error(error.message)

  await logAuditEvent({
    orgId: session.orgId,
    actorId: session.userId,
    actorName: session.username,
    action: 'inventory.item_deleted',
    targetType: 'inventory_item',
    targetId: itemId,
    targetLabel: item?.name || itemId,
  })

  revalidatePath('/dashboard/inventory')
  return { success: true }
}

/**
 * Worker takes items from inventory during a shift.
 * Decrements stock and logs transactions. Allows going negative.
 */
export async function takeInventoryItems(
  items: { itemId: string; quantity: number }[],
  shiftType: 'start_of_shift' | 'end_of_shift',
  vehicleId?: string
) {
  const session = await getSession()
  if (!session?.userId || !session?.orgId) throw new Error('Not authenticated')

  if (!items || items.length === 0) return { success: true, warnings: [] }

  const supabase = await createClient()
  const warnings: string[] = []

  // Get user display name
  const { data: userData } = await supabase
    .from('users')
    .select('first_name, last_name')
    .eq('id', session.userId)
    .single()
  const userName = userData
    ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || session.username
    : session.username

  for (const { itemId, quantity } of items) {
    if (quantity <= 0) continue

    // 1. Get current item
    const { data: item, error: fetchError } = await supabase
      .from('inventory_items')
      .select('id, name, quantity, low_threshold, critical_threshold')
      .eq('id', itemId)
      .single()

    if (fetchError || !item) {
      console.error('Item fetch error:', fetchError)
      continue
    }

    // 2. Decrement quantity (allows negative)
    const newQuantity = item.quantity - quantity
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq('id', itemId)

    if (updateError) {
      console.error('Inventory update error:', updateError)
      continue
    }

    // 3. Log transaction
    await supabase.from('inventory_transactions').insert({
      org_id: session.orgId,
      item_id: itemId,
      user_id: session.userId,
      user_name: userName,
      shift_type: shiftType,
      change: -quantity,
      quantity_after: newQuantity,
      vehicle_id: vehicleId || null,
    })

    // 4. Check thresholds and send notifications
    if (newQuantity <= item.critical_threshold) {
      // CRITICAL — push + in-app
      await supabase.from('notifications').insert({
        org_id: session.orgId,
        type: 'red',
        title: `🚨 CRITICAL: ${item.name} almost out!`,
        body: `Only ${newQuantity} ${item.name} left in stock. Taken by ${userName} during ${shiftType.replace('_', ' ')}.`,
        url: '/dashboard/inventory',
      })

      try {
        await sendPushNotificationToManagers({
          title: `🚨 CRITICAL: ${item.name} almost out!`,
          body: `Only ${newQuantity} left. Reorder immediately!`,
          url: '/dashboard/inventory',
          org_id: session.orgId,
        })
      } catch (e) {
        // Non-critical
      }

      warnings.push(`CRITICAL: ${item.name} only has ${newQuantity} left!`)
    } else if (newQuantity <= item.low_threshold) {
      // LOW — in-app only
      await supabase.from('notifications').insert({
        org_id: session.orgId,
        type: 'yellow',
        title: `⚠️ Low stock: ${item.name}`,
        body: `${newQuantity} ${item.name} remaining. Consider reordering soon. Taken by ${userName}.`,
        url: '/dashboard/inventory',
      })

      warnings.push(`Low stock: ${item.name} (${newQuantity} remaining)`)
    }
  }

  revalidatePath('/dashboard/inventory')
  return { success: true, warnings }
}

/**
 * Director manually restocks an item.
 */
export async function restockInventoryItem(itemId: string, quantity: number, notes?: string) {
  const session = await getSession()
  if (!session?.userId || session.role !== 'director') {
    throw new Error('Unauthorized: Only directors can restock inventory')
  }

  if (quantity <= 0) throw new Error('Restock quantity must be positive')

  const supabase = await createClient()

  const { data: item, error: fetchError } = await supabase
    .from('inventory_items')
    .select('id, name, quantity')
    .eq('id', itemId)
    .single()

  if (fetchError || !item) throw new Error('Item not found')

  const newQuantity = item.quantity + quantity

  const { error: updateError } = await supabase
    .from('inventory_items')
    .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
    .eq('id', itemId)

  if (updateError) throw new Error(updateError.message)

  await supabase.from('inventory_transactions').insert({
    org_id: session.orgId,
    item_id: itemId,
    user_id: session.userId,
    user_name: session.username,
    shift_type: 'manual_restock',
    change: quantity,
    quantity_after: newQuantity,
    notes: notes || `Restocked by ${session.username}`,
  })

  await logAuditEvent({
    orgId: session.orgId,
    actorId: session.userId,
    actorName: session.username,
    action: 'inventory.restocked',
    targetType: 'inventory_item',
    targetId: itemId,
    targetLabel: item.name,
    details: { added: quantity, new_total: newQuantity },
  })

  revalidatePath('/dashboard/inventory')
  return { success: true, newQuantity }
}

/**
 * Get recent inventory transactions for the org (for analytics/history).
 */
export async function getInventoryTransactions(limit = 100) {
  const session = await getSession()
  if (!session?.orgId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select(`
      id, created_at, change, quantity_after, shift_type, user_name, notes,
      inventory_items (name, unit, category),
      vehicles (rig_number)
    `)
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getInventoryTransactions error:', error)
    return []
  }

  return (data || []).map((d: any) => ({
    ...d,
    inventory_items: Array.isArray(d.inventory_items) ? d.inventory_items[0] : d.inventory_items,
    vehicles: Array.isArray(d.vehicles) ? d.vehicles[0] : d.vehicles,
  }))
}

/**
 * Seed default EMS inventory items for an organization.
 */
export async function seedEMSInventoryItems() {
  const session = await getSession()
  if (session?.role !== 'director') throw new Error('Unauthorized')

  const EMS_DEFAULTS = [
    // PPE
    { name: 'Gloves (S)', category: 'PPE', unit: 'boxes', quantity: 20, low_threshold: 10, critical_threshold: 3 },
    { name: 'Gloves (M)', category: 'PPE', unit: 'boxes', quantity: 20, low_threshold: 10, critical_threshold: 3 },
    { name: 'Gloves (L)', category: 'PPE', unit: 'boxes', quantity: 20, low_threshold: 10, critical_threshold: 3 },
    { name: 'Gloves (XL)', category: 'PPE', unit: 'boxes', quantity: 20, low_threshold: 10, critical_threshold: 3 },
    { name: 'N95 Masks', category: 'PPE', unit: 'boxes', quantity: 15, low_threshold: 5, critical_threshold: 2 },
    { name: 'Surgical Masks', category: 'PPE', unit: 'boxes', quantity: 20, low_threshold: 5, critical_threshold: 2 },
    { name: 'Safety Goggles', category: 'PPE', unit: 'pcs', quantity: 10, low_threshold: 3, critical_threshold: 1 },
    { name: 'Isolation Gowns', category: 'PPE', unit: 'packs', quantity: 10, low_threshold: 4, critical_threshold: 1 },
    
    // Medical
    { name: '4x4 Gauze Sponges', category: 'Medical', unit: 'packs', quantity: 50, low_threshold: 15, critical_threshold: 5 },
    { name: '5x9 Combine Dressings', category: 'Medical', unit: 'packs', quantity: 30, low_threshold: 10, critical_threshold: 3 },
    { name: 'Kerlix / Rolled Gauze', category: 'Medical', unit: 'rolls', quantity: 40, low_threshold: 10, critical_threshold: 3 },
    { name: 'Medical Tape (1")', category: 'Medical', unit: 'rolls', quantity: 30, low_threshold: 10, critical_threshold: 2 },
    { name: 'Medical Tape (2")', category: 'Medical', unit: 'rolls', quantity: 30, low_threshold: 10, critical_threshold: 2 },
    { name: 'Trauma Shears', category: 'Medical', unit: 'pcs', quantity: 15, low_threshold: 5, critical_threshold: 2 },
    { name: 'Cravats / Triangular Bandages', category: 'Medical', unit: 'pcs', quantity: 20, low_threshold: 5, critical_threshold: 2 },
    { name: 'Tourniquets (CAT)', category: 'Medical', unit: 'pcs', quantity: 20, low_threshold: 5, critical_threshold: 2 },
    { name: 'Steri-Strips', category: 'Medical', unit: 'packs', quantity: 15, low_threshold: 5, critical_threshold: 2 },
    { name: 'Band-Aids (Assorted)', category: 'Medical', unit: 'boxes', quantity: 10, low_threshold: 3, critical_threshold: 1 },
    { name: 'Burn Sheets', category: 'Medical', unit: 'pcs', quantity: 5, low_threshold: 2, critical_threshold: 1 },
    { name: 'Cold Packs', category: 'Medical', unit: 'pcs', quantity: 30, low_threshold: 10, critical_threshold: 3 },
    { name: 'Hot Packs', category: 'Medical', unit: 'pcs', quantity: 30, low_threshold: 10, critical_threshold: 3 },
    { name: 'Emesis Bags', category: 'Medical', unit: 'pcs', quantity: 50, low_threshold: 15, critical_threshold: 5 },
    { name: 'Biohazard Bags', category: 'Medical', unit: 'rolls', quantity: 5, low_threshold: 2, critical_threshold: 1 },

    // Equipment
    { name: 'Stethoscope', category: 'Equipment', unit: 'pcs', quantity: 5, low_threshold: 2, critical_threshold: 1 },
    { name: 'BP Cuff (Adult)', category: 'Equipment', unit: 'pcs', quantity: 5, low_threshold: 2, critical_threshold: 1 },
    { name: 'Pulse Oximeter', category: 'Equipment', unit: 'pcs', quantity: 5, low_threshold: 2, critical_threshold: 1 },
    { name: 'Penlights', category: 'Equipment', unit: 'pcs', quantity: 20, low_threshold: 5, critical_threshold: 2 },

    // Cleaning
    { name: 'Sani-Wipes', category: 'Cleaning', unit: 'tubs', quantity: 30, low_threshold: 10, critical_threshold: 3 },
    { name: 'Hand Sanitizer', category: 'Cleaning', unit: 'bottles', quantity: 20, low_threshold: 5, critical_threshold: 2 },
    { name: 'Paper Towels', category: 'Cleaning', unit: 'rolls', quantity: 40, low_threshold: 10, critical_threshold: 3 },
  ]

  const supabase = await createClient()

  // Prepare insert data
  const insertData = EMS_DEFAULTS.map(item => ({
    org_id: session.orgId,
    name: item.name,
    category: item.category,
    unit: item.unit,
    quantity: item.quantity,
    low_threshold: item.low_threshold,
    critical_threshold: item.critical_threshold,
  }))

  const { error } = await supabase
    .from('inventory_items')
    .insert(insertData)

  if (error) {
    console.error('Failed to seed EMS inventory:', error)
    throw new Error(error.message)
  }

  await logAuditEvent({
    orgId: session.orgId,
    actorId: session.userId,
    actorName: session.username,
    action: 'inventory.seeded',
    targetType: 'inventory_items',
    targetId: 'batch',
    targetLabel: 'EMS Defaults Package',
    details: { items_added: insertData.length },
  })

  revalidatePath('/dashboard/inventory')
  return { success: true }
}
