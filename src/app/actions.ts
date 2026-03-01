'use server'

import { createClient } from '@/../utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSession, getSession } from '@/lib/auth'
import { getLabels, DEFAULT_LABELS, type OrgLabels } from '@/lib/labels'
import type { OrgType } from '@/lib/presets'

export async function getInitialRigCheckData() {
  try {
    const supabase = await createClient()
    const session = await getSession()
    if (!session?.userId) return { currentUser: null, orgLabels: DEFAULT_LABELS, employees: [] }

    // Fetch current user details
    const { data: user } = await supabase
      .from('users')
      .select('username, first_name, last_name, org_type')
      .eq('id', session.userId)
      .single()

    const orgType = (user?.org_type as OrgType) ?? 'ems'
    const orgLabels = getLabels(orgType)

    const currentUserFullName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username

    // Fetch all employees for this org to populate the partner dropdown
    const { data: employeesData } = await supabase
      .from('users')
      .select('id, username, first_name, last_name, role')
      .eq('org_type', orgType)
      .in('role', ['emt', 'paramedic', 'nurse'])
      .order('first_name', { ascending: true })

    const employees = (employeesData || [])
      .filter((emp: any) => emp.id !== session.userId) // exclude current user from partner list
      .map((emp: any) => ({
        id: emp.id,
        name: emp.first_name ? `${emp.first_name} ${emp.last_name || ''}`.trim() : emp.username
      }))

    // Check if the current user already has an active shift
    // Use ilike because on_shift_by might be "User & Partner"
    const { data: activeShiftVehicle } = await supabase
      .from('vehicles')
      .select('id, on_shift_since, on_shift_by, on_shift_partner')
      .ilike('on_shift_by', `%${currentUserFullName}%`)
      .not('on_shift_since', 'is', null)
      .single()

    return { 
      currentUser: currentUserFullName, 
      orgLabels, 
      employees,
      activeShift: activeShiftVehicle ? {
        vehicle_id: activeShiftVehicle.id,
        on_shift_since: activeShiftVehicle.on_shift_since,
        // Optional: Extract partner name if stored or assume it's part of on_shift_by logic
        // We'll pass the full string back so the frontend can parse it if needed
        on_shift_by: activeShiftVehicle.on_shift_by
      } : null
    }

  } catch {
    return { currentUser: null, orgLabels: DEFAULT_LABELS, employees: [], activeShift: null }
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
  const supabase = await createClient()
  
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('in_service', false)   // exclude vehicles at the mechanic
    .order('rig_number')

  if (error || !vehicles) {
    console.error('Supabase fetch failed:', error?.message)
    return []
  }

  // Получаем последние проверки для подгрузки AI-ответов на дашборд
  const { data: checks } = await supabase
    .from('rig_checks')
    .select('vehicle_id, ai_analysis_notes, damage_photo_url, created_at')
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

import { analyzeDamage, generateShiftGreeting, generateHandoffWarning, analyzeDispute } from '@/lib/ai'
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
    
    // Find all users with role 'manager'
    const { data: managers, error: mgrError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'manager')

    console.log('Push: Found managers:', managers?.length, 'error:', mgrError?.message || 'none')

    if (!managers || managers.length === 0) {
      console.log('Push: No managers found')
      return
    }

    const managerIds = managers.map(m => m.id)

    // Get all subscriptions for those managers
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', managerIds)

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
    
    aiSeverity = aiResult.severity
    aiNotes = aiResult.notes
  }

  const { error } = await supabase
    .from('rig_checks')
    .insert({
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
      signature_data_url: signature_data_url || null
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
      url: '/dashboard'
    })
    console.log('Push: sendPushNotificationToManagers returned')
  } else {
    console.log('Push: Condition not met, no push sent')
  }

  // revalidatePath moved down below update

  // Generate personalized greeting (non-blocking — fallback is used if AI fails or quota hit)
  // Mark vehicle as on active shift
  // crewDisplay is already calculated above

  const { error: vehicleUpdateError } = await supabase
    .from('vehicles')
    .update({
      on_shift_since: new Date().toISOString(),
      on_shift_by: crewDisplay,
      last_checked_at: new Date().toISOString() // FIX: Mark vehicle as checked today
    })
    .eq('id', vehicle_id)

  if (vehicleUpdateError) {
    console.error('Error updating vehicle shift status:', vehicleUpdateError.message)
    // We don't throw here to avoid failing the whole check if only shift tracking fails,
    // but logging is critical for debug.
  }

  revalidatePath('/dashboard')
  revalidatePath('/rig-check')

  const greeting = await generateShiftGreeting(
    partner_name && partner_name !== 'none' ? `${crew_last_name} and ${partner_name}` : crew_last_name || session?.username || 'Crew',
    crew_last_name || '',
    'ems' // TODO: read from org_type when multi-tenancy is added
  ).catch(() => `${(crewDisplay).toUpperCase()} — great job, stay safe out there!`)

  return { success: true, greeting }
}

import bcrypt from 'bcryptjs'

export async function authenticate(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Username and password are required' }
  }

  const supabase = await createClient()

  // 1. Fetch user by username
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, role, hashed_password, temp_password')
    .eq('username', username)
    .single()

  if (error || !user) {
    return { error: 'Invalid username or password' }
  }

  // 2. Verify hashed password or allow MVP bypass
  let isValid = false
  if (user.hashed_password) {
    isValid = await bcrypt.compare(password, user.hashed_password)
  } else {
    // Fallback for MVP original users without hashed_password
    isValid = password === 'password123' || password === 'admin'
  }

  if (!isValid) {
    return { error: 'Invalid username or password' }
  }

  // 3. Create JWT Session
  await createSession(user.id, user.username, user.role, user.temp_password)

  // 4. Redirect handler
  if (user.temp_password) {
    redirect('/change-password')
  } else if (user.role === 'manager' || user.role === 'director') {
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
  if (!session?.userId) {
    return { error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(newPassword, salt)

  const { error } = await supabase
    .from('users')
    .update({ 
      hashed_password: hashedPassword,
      temp_password: false
    })
    .eq('id', session.userId)

  if (error) {
    return { error: 'Failed to update password' }
  }

  // Generate a fresh session without the temp_password flag
  await createSession(session.userId, session.username, session.role, false)

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

export async function createEmployee(firstName: string, lastName: string, role: string) {
  const session = await getSession()
  if (session?.role !== 'director') {
    return { error: 'Unauthorized' }
  }

  const username = `${firstName.charAt(0).toUpperCase()}${lastName.charAt(0).toUpperCase()}${lastName.slice(1).toLowerCase()}`
  
  const tempPassword = generateTempPassword()
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(tempPassword, salt)

  const supabase = await createClient()

  // Ensure username is unique - rough check
  const { data: existing } = await supabase.from('users').select('id').eq('username', username).single()
  if (existing) {
    return { error: 'A user with this generated username already exists.' }
  }

  const { error } = await supabase.from('users').insert({
    username,
    first_name: firstName,
    last_name: lastName,
    role,
    org_type: 'ems', // Default for MVP
    hashed_password: hashedPassword,
    temp_password: true
  })

  if (error) {
    console.error('Create user error:', error)
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

  const tempPassword = generateTempPassword()
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(tempPassword, salt)

  const supabase = await createClient()
  const { error } = await supabase.from('users').update({
    hashed_password: hashedPassword,
    temp_password: true
  }).eq('id', userId)

  if (error) {
    console.error('Reset password error:', error)
    return { error: 'Failed to reset password' }
  }

  revalidatePath('/dashboard/users')
  return { success: true, tempPassword }
}

// Получение текущего активного чек-листа для EMT
export async function getActiveChecklist() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('checklists')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
    
  if (error) {
    // If no rows found, it's fine, just return null
    return null
  }
  return data
}

export async function createChecklist(title: string, type: 'manual' | 'pdf', questions: string[] = [], fileUrl: string | null = null): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()

  // Деактивируем предыдущие чек-листы (оставляем только 1 активный)
  await supabase.from('checklists').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')

  const { error } = await supabase
    .from('checklists')
    .insert({
      title,
      type,
      questions: questions,
      file_url: fileUrl,
      is_active: true // Делаем новый чек-лист сразу активным
    })

  if (error) {
    console.error('Failed to create checklist:', error.message)
    return { error: error.message }
  }

  // Обновляем кэш дашборда и формы, где они могут использоваться
  revalidatePath('/dashboard')
  revalidatePath('/rig-check')

  return { success: true }
}

export async function createPdfChecklist(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const title = formData.get('title') as string
  const file = formData.get('file') as File

  if (!file || file.size === 0) return { error: 'No file provided' }

  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

  const { data, error: uploadError } = await supabase.storage
    .from('checklists')
    .upload(fileName, file)

  if (uploadError) {
    console.error('Storage upload error:', uploadError.message)
    return { error: 'Failed to upload PDF: ' + uploadError.message }
  }

  const { data: publicUrlData } = supabase.storage
    .from('checklists')
    .getPublicUrl(fileName)

  // Деактивируем предыдущие чек-листы
  await supabase.from('checklists').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')

  const { error: dbError } = await supabase
    .from('checklists')
    .insert({
      title,
      type: 'pdf',
      file_url: publicUrlData.publicUrl,
      is_active: true // Делаем новый чек-лист активным
    })

  if (dbError) {
    return { error: dbError.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/rig-check')
  return { success: true }
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

  const { error } = await supabase
    .from('end_of_shift_reports')
    .insert({
      vehicle_id,
      emt_id: session?.userId || null,
      checklist_id: checklist_id || null,
      fuel_level,
      cleanliness_details: cleanliness_details ? JSON.parse(cleanliness_details) : null,
      restock_needed,
      vehicle_condition,
      notes,
      crew_last_name
    })

  if (error) {
    console.error('End of shift report error:', error.message)
    throw new Error(error.message)
  }

  // Clear active shift from vehicle
  const { error: clearShiftError } = await supabase
    .from('vehicles')
    .update({ on_shift_since: null, on_shift_by: null, on_shift_rig_check_id: null })
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

  revalidatePath('/dashboard')
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
  const { data: latestCheck } = await supabase
    .from('rig_checks')
    .select('answers')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return {
    missingItems: (latestCheck as any)?.answers?.missing_items || []
  }
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
  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', vehicleId)

  if (error) {
    console.error('Failed to remove vehicle:', error)
    throw new Error('Database error while removing vehicle')
  }

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
  const { error } = await supabase
    .from('vehicles')
    .update({ in_service: inService })
    .eq('id', vehicleId)

  if (error) {
    console.error('Failed to update vehicle service status:', error)
    throw new Error('Database error while updating vehicle service status')
  }

  revalidatePath('/dashboard/vehicles')
  revalidatePath('/dashboard')
  revalidatePath('/rig-check')
}
