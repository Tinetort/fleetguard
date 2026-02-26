'use server'

import { createClient } from '@/../utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSession, getSession } from '@/lib/auth'
import { getLabels, DEFAULT_LABELS, type OrgLabels } from '@/lib/labels'
import type { OrgType } from '@/lib/presets'

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
    .order('rig_number')

  if (error || !vehicles) {
    console.error('Supabase fetch failed:', error?.message)
    return []
  }

  // Получаем последние проверки для подгрузки AI-ответов на дашборд
  const { data: checks } = await supabase
    .from('rig_checks')
    .select('vehicle_id, ai_analysis_notes, created_at')
    .order('created_at', { ascending: false })

  return vehicles.map(v => {
    const latestCheck = checks?.find(c => c.vehicle_id === v.id)
    return {
      ...v,
      ai_note: latestCheck?.ai_analysis_notes || null
    }
  })
}

import { analyzeDamage } from '@/lib/ai'
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

  const supabase = await createClient()
  const session = await getSession()
  
  let aiSeverity = null
  let aiNotes = null
  let uploadedPhotoUrl = null

  // If missing items flagged → auto-set yellow severity so dispatcher sees it
  if (missing_items.length > 0 && !aiSeverity) {
    aiSeverity = 'yellow'
    aiNotes = `Missing equipment flagged by ${session?.username || 'crew'}: ${missing_items.join(', ')}`
  }

  // Process AI Analysis if there's damage reported
  if (damage_notes || (damage_file && damage_file.size > 0)) {
    let base64Image = undefined
    let mimeType = undefined
    
    if (damage_file && damage_file.size > 0) {
      const arrayBuffer = await damage_file.arrayBuffer()
      base64Image = Buffer.from(arrayBuffer).toString('base64')
      mimeType = damage_file.type
      uploadedPhotoUrl = 'uploaded-via-mvp.jpg'
    }

    const aiResult = await analyzeDamage(damage_notes, base64Image, mimeType)
    // Damage AI overrides missing-items severity (damage is higher priority)
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
        pdf_confirmed: !!pdf_confirmed
      },
      damage_notes,
      damage_photo_url: uploadedPhotoUrl,
      ai_damage_severity: aiSeverity,
      ai_analysis_notes: aiNotes
    })

  if (error) {
    console.error('Supabase Insert failed:', error.message)
    throw new Error(error.message)
  }

  // Trigger Push Notification to managers if Red/Yellow status, missing items, or damage notes written
  const hasDamageNotes = damage_notes && damage_notes.trim().length > 0
  console.log('Push trigger check: aiSeverity=', aiSeverity, 'missing=', missing_items.length, 'hasDamageNotes=', hasDamageNotes)
  if (aiSeverity === 'red' || aiSeverity === 'yellow' || missing_items.length > 0 || hasDamageNotes) {
    const isRed = aiSeverity === 'red'
    const alertBody = aiNotes
      ? `${session?.username || 'Crew'}: ${aiNotes}`
      : hasDamageNotes
      ? `${session?.username || 'Crew'}: ${damage_notes}`
      : `${session?.username || 'Crew'}: Missing items flagged.`
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

  revalidatePath('/dashboard')
  revalidatePath('/rig-check')
  
  return { success: true }
}

export async function authenticate(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Username and password are required' }
  }

  const supabase = await createClient()

  // 1. Поиск пользователя по username
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, role')
    .eq('username', username)
    .single()

  // В реальном приложении здесь должна быть проверка хэша пароля из БД
  // Сейчас мы делаем мок-проверку или предполагаем, что пароль 'password123' подходит всем (для MVP)
  // Для продакшна: const isValid = await bcrypt.compare(password, user.hashed_password)
  const isValid = password === 'password123' || password === 'admin'

  if (error || !user || !isValid) {
    return { error: 'Invalid username or password' }
  }

  // 2. Создание JWT сессии
  await createSession(user.id, user.username, user.role)

  // 3. Редирект в зависимости от роли
  if (user.role === 'manager') {
    redirect('/dashboard')
  } else {
    redirect('/rig-check')
  }
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
  const cleanliness_rating = parseInt(formData.get('cleanliness_rating') as string, 10)
  const restock_needed = JSON.parse(formData.get('restock_needed') as string || '[]')
  const vehicle_condition = formData.get('vehicle_condition') as string
  const notes = formData.get('notes') as string
  const checklist_id = formData.get('checklist_id') as string | null

  if (!vehicle_id) throw new Error('Vehicle is required')

  const { error } = await supabase
    .from('end_of_shift_reports')
    .insert({
      vehicle_id,
      emt_id: session?.userId || null,
      checklist_id: checklist_id || null,
      fuel_level,
      cleanliness_rating,
      restock_needed,
      vehicle_condition,
      notes,
    })

  if (error) {
    console.error('End of shift report error:', error.message)
    throw new Error(error.message)
  }

  revalidatePath('/dashboard')
}
