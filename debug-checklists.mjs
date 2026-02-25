import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envContent = readFileSync('.env.local', 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) env[key.trim()] = rest.join('=').trim()
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 1. Деактивируем все чек-листы
await supabase.from('checklists').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
console.log('All deactivated')

// 2. Активируем нужный "test check" с oxygen Cylinder и laryngoscope
const { data, error } = await supabase
  .from('checklists')
  .update({ is_active: true })
  .eq('title', 'test check')
  .select('id, title, is_active, questions')
  .single()

console.log('Activated test check:', JSON.stringify(data))
if (error) console.log('Error:', error.message)

// 3. Покажем финальное состояние
const { data: all } = await supabase
  .from('checklists')
  .select('title,type,is_active,questions')
  .order('created_at', { ascending: false })

console.log('\nFinal state:')
for (const c of all || []) {
  console.log(c.is_active ? '✅ ACTIVE' : '   inactive', '-', c.title, '|', c.type, '|', JSON.stringify(c.questions))
}
