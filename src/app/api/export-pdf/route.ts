import { NextResponse } from 'next/server'
import { createClient } from '@/../utils/supabase/server'
import { getLabels, DEFAULT_LABELS } from '@/lib/labels'
import type { OrgType } from '@/lib/presets'
import { getSession } from '@/lib/auth'

export async function GET() {
  const supabase = await createClient()
  const session = await getSession()

  // Get org labels for this user
  let labels = DEFAULT_LABELS
  if (session?.userId) {
    const { data: user } = await supabase
      .from('users')
      .select('org_type')
      .eq('id', session.userId)
      .single()
    labels = getLabels((user?.org_type as OrgType) ?? 'ems')
  }

  // Fetch last 30 days of rig checks
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: checks } = await supabase
    .from('rig_checks')
    .select('id, created_at, damage_notes, ai_damage_severity, ai_analysis_notes, answers, vehicles(rig_number), users(username)')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: eosReports } = await supabase
    .from('end_of_shift_reports')
    .select('id, created_at, fuel_level, cleanliness_rating, restock_needed, vehicle_condition, notes, vehicles(rig_number), users(username)')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(50)

  const normalize = (row: any) => ({
    ...row,
    vehicles: Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles,
    users: Array.isArray(row.users) ? row.users[0] : row.users,
  })

  const normalizedChecks = (checks || []).map(normalize)
  const normalizedEos = (eosReports || []).map(normalize)

  const now = new Date().toLocaleString()

  const severityBadge = (s: string | null) => {
    if (s === 'red') return `<span style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">🔴 RED</span>`
    if (s === 'yellow') return `<span style="background:#fef9c3;color:#92400e;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">⚠️ YELLOW</span>`
    return `<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">✓ GREEN</span>`
  }

  const fuelBar = (level: string | null) => {
    const map: Record<string, string> = {
      empty: '⬜⬜⬜⬜', quarter: '🟥⬜⬜⬜',
      half: '🟧🟧⬜⬜', three_quarter: '🟨🟨🟨⬜', full: '🟩🟩🟩🟩'
    }
    return map[level || ''] || level || '—'
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${labels.dashboard} — Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; background: #fff; padding: 40px; padding-top: 80px; }
  h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
  .subtitle { color: #64748b; font-size: 13px; margin-bottom: 32px; }
  h2 { font-size: 17px; font-weight: 700; margin: 28px 0 12px; color: #1e293b; border-left: 4px solid #3b82f6; padding-left: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f1f5f9; color: #475569; text-align: left; padding: 8px 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:hover td { background: #f8fafc; }
  .notes { color: #64748b; font-size: 12px; }
  .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 11px; }
  .print-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 40px; background: #1e293b; box-shadow: 0 2px 12px rgba(0,0,0,.2); }
  .print-bar span { color: #94a3b8; font-size: 13px; font-weight: 500; }
  .print-btn { display: inline-flex; align-items: center; gap: 8px; background: #3b82f6; color: #fff; border: none; border-radius: 10px; padding: 10px 22px; font-size: 14px; font-weight: 700; cursor: pointer; transition: background .15s; letter-spacing: .01em; }
  .print-btn:hover { background: #2563eb; }
  @media print { .print-bar { display: none; } body { padding: 20px; } }
</style>
</head>
<body>
  <div class="print-bar">
    <span>🛡️ ${labels.dashboard} — Compliance Report &nbsp;·&nbsp; ${now}</span>
    <button class="print-btn" onclick="window.print()">🖨️ Save as PDF</button>
  </div>
  <h1>🛡️ ${labels.dashboard}</h1>
  <p class="subtitle">Compliance Report — Last 30 days &nbsp;|&nbsp; Generated: ${now}</p>

  <h2>📋 ${labels.inspection} History (${normalizedChecks.length} records)</h2>
  ${normalizedChecks.length === 0 ? '<p style="color:#94a3b8">No records found.</p>' : `
  <table>
    <thead><tr>
      <th>Date / Time</th>
      <th>${labels.vehicle}</th>
      <th>${labels.worker}</th>
      <th>Status</th>
      <th>AI Notes</th>
      <th>Damage</th>
    </tr></thead>
    <tbody>
      ${normalizedChecks.map(c => `<tr>
        <td>${new Date(c.created_at).toLocaleString()}</td>
        <td><strong>${c.vehicles?.rig_number ?? '—'}</strong></td>
        <td>${c.users?.username ?? '—'}</td>
        <td>${severityBadge(c.ai_damage_severity)}</td>
        <td class="notes">${c.ai_analysis_notes ? c.ai_analysis_notes.substring(0, 120) + (c.ai_analysis_notes.length > 120 ? '…' : '') : '—'}</td>
        <td class="notes">${c.damage_notes ? c.damage_notes.substring(0, 80) + (c.damage_notes.length > 80 ? '…' : '') : '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`}

  <h2>🌙 ${labels.shiftEnd} Reports (${normalizedEos.length} records)</h2>
  ${normalizedEos.length === 0 ? '<p style="color:#94a3b8">No records found.</p>' : `
  <table>
    <thead><tr>
      <th>Date / Time</th>
      <th>${labels.vehicle}</th>
      <th>${labels.worker}</th>
      <th>Fuel</th>
      <th>Cleanliness</th>
      <th>Restock Needed</th>
      <th>Notes</th>
    </tr></thead>
    <tbody>
      ${normalizedEos.map(e => `<tr>
        <td>${new Date(e.created_at).toLocaleString()}</td>
        <td><strong>${e.vehicles?.rig_number ?? '—'}</strong></td>
        <td>${e.users?.username ?? '—'}</td>
        <td>${fuelBar(e.fuel_level)}</td>
        <td>${'⭐'.repeat(e.cleanliness_rating ?? 0)}${'☆'.repeat(5 - (e.cleanliness_rating ?? 0))}</td>
        <td class="notes">${(e.restock_needed?.length > 0) ? e.restock_needed.join(', ') : '—'}</td>
        <td class="notes">${e.notes ? e.notes.substring(0, 100) + (e.notes.length > 100 ? '…' : '') : '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`}

  <div class="footer">FleetGuard — ${labels.dashboard} &nbsp;|&nbsp; Smart Rig Check &nbsp;|&nbsp; ${now}</div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="fleetguard-report-${new Date().toISOString().split('T')[0]}.html"`,
    },
  })
}
