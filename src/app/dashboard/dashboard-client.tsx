'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/../utils/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { ListChecks, RefreshCw, Download, Shield, ShieldAlert, X, Users, Truck, Wrench, ArrowUpDown, BarChart3, Package } from 'lucide-react'
import type { OrgLabels } from '@/lib/labels'
import NotificationBell from '@/components/notification-bell'
import { adminForceEndShift, approveVehicleShift, rejectVehicleShift, reviewShiftIssue } from '../actions'

interface Vehicle {
  id: string
  rig_number: string
  status: string
  last_checked_at: string | null
  in_service: boolean
  ai_note?: string | null
  on_shift_since?: string | null
  on_shift_by?: string | null
  damage_photo_url?: string | null
  original_dispute_text?: string | null
  pending_approval?: boolean
  pending_approval_data?: {
    crew_display: string
    ai_notes: string | null
    damage_photo_url: string | null
    requested_at: string
  } | null
}

interface ActivityEvent {
  id: string
  created_at: string
  _type: 'start' | 'eos'
  vehicles?: { rig_number: string } | null
  users?: { username: string; first_name?: string | null; last_name?: string | null } | null
  crew_last_name?: string | null
  damage_notes?: string | null
  ai_damage_severity?: string | null
  fuel_level?: string | null
  cleanliness_rating?: number | null
  answers?: any
}

interface Props {
  initialVehicles: Vehicle[]
  initialActivity: ActivityEvent[]
  labels: OrgLabels
  userRole: string
  orgId: string
  initialShiftIssues?: any[]
}

function getStatusColor(status: string) {
  switch (status) {
    case 'green': return 'bg-emerald-500 text-white'
    case 'yellow': return 'bg-amber-400 text-amber-950'
    case 'red': return 'bg-rose-500 text-white'
    default: return 'bg-gray-200'
  }
}

export default function DashboardClient({ initialVehicles, initialActivity, labels, userRole, orgId, initialShiftIssues }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles)
  const [activity, setActivity] = useState<ActivityEvent[]>(initialActivity)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, string>>({})
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [endingShifts, setEndingShifts] = useState<Record<string, boolean>>({})
  const [confirmingShiftId, setConfirmingShiftId] = useState<string | null>(null)
  const [prioritySort, setPrioritySort] = useState(false) // false = Green first, true = Red first
  const [approvingVehicles, setApprovingVehicles] = useState<Record<string, boolean>>({})
  const [rejectingVehicles, setRejectingVehicles] = useState<Record<string, boolean>>({})
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null)
  
  // Shift Issues Review State
  const [shiftIssues, setShiftIssues] = useState<any[]>(initialShiftIssues || [])
  const [reviewingIssues, setReviewingIssues] = useState<Record<string, boolean>>({})
  const [confirmIssueAction, setConfirmIssueAction] = useState<{ id: string; approved: boolean } | null>(null)

  async function handleReviewIssue(issueId: string, approved: boolean) {
    setReviewingIssues(prev => ({ ...prev, [issueId]: true }))
    setConfirmIssueAction(null)
    try {
      await reviewShiftIssue(issueId, approved)
      setShiftIssues(prev => prev.filter(i => i.id !== issueId))
    } catch (err: any) {
      alert(err.message || 'Failed to review issue')
    } finally {
      setReviewingIssues(prev => ({ ...prev, [issueId]: false }))
    }
  }

function ExpandableAiNote({ note, originalText }: { note: string, originalText?: string | null }) {
  const [expanded, setExpanded] = useState(false)

  // Split all alert parts and categorize them
  const parts = note.split(' | ')
  const disputePart = parts.find(p => p.includes('Dispute Summary:'))
  const missingPart = parts.find(p => p.startsWith('Missing equipment:'))
  const o2Parts = parts.filter(p => p.includes('O2 is critically low'))
  const aiDamageParts = parts.filter(p =>
    !p.includes('Dispute Summary:') &&
    !p.startsWith('Missing equipment:') &&
    !p.includes('O2 is critically low')
  )

  return (
    <div className="mt-3 flex flex-col gap-2">

      {/* Missing Equipment */}
      {missingPart && (
        <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-left">
          <span className="shrink-0 text-base mt-0.5">📦</span>
          <div>
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Missing Equipment</p>
            <p className="text-xs text-amber-900 font-medium leading-relaxed">
              {missingPart.replace('Missing equipment:', '').trim()}
            </p>
          </div>
        </div>
      )}

      {/* O2 Warnings */}
      {o2Parts.length > 0 && (
        <div className="w-full p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2.5 text-left">
          <span className="shrink-0 text-base mt-0.5">🫁</span>
          <div className="flex-1">
            <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-2">Low Oxygen</p>
            <div className="flex flex-wrap gap-1.5">
              {o2Parts.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-800 text-[11px] font-bold">
                  ⚠️ {p.trim()}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Damage Analysis */}
      {aiDamageParts.length > 0 && (
        <div className="w-full p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-left">
          <span className="shrink-0 text-base mt-0.5">🔍</span>
          <div>
            <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-1">AI Damage Analysis</p>
            {aiDamageParts.map((p, i) => (
              <p key={i} className="text-xs text-rose-800 font-medium leading-relaxed">{p.trim()}</p>
            ))}
          </div>
        </div>
      )}

      {/* Dispute Summary — expandable */}
      {disputePart && (
        <div
          className="w-full p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2.5 text-left cursor-pointer hover:bg-purple-100/50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="shrink-0 text-base mt-0.5">💬</span>
          <div className="flex-1 w-full min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Handoff Dispute</p>
              <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest bg-white/60 px-2 py-0.5 rounded-full border border-purple-200">
                {expanded ? 'Hide' : 'View original'}
              </span>
            </div>
            <p className="text-xs text-purple-800 font-medium leading-relaxed">
              {disputePart.replace('Dispute Summary:', '').trim()}
            </p>
            {expanded && originalText && (
              <div className="mt-2 pt-2 border-t border-purple-200/60 animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-[10px] uppercase font-bold text-purple-400 mb-1 tracking-widest">Original EMT Text:</p>
                <p className="text-xs text-purple-900 italic bg-white/40 p-2 rounded-md border border-purple-100/50">"{originalText}"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const fetchLatestData = useCallback(async () => {
    const supabase = createClient()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: vehiclesData } = await supabase
      .from('vehicles')
      .select('id, rig_number, status, last_checked_at, in_service, on_shift_since, on_shift_by, pending_approval, pending_approval_data')
      .eq('org_id', orgId)
      .order('rig_number')

    // Fetch latest AI notes per vehicle
    const { data: checks } = await supabase
      .from('rig_checks')
      .select('vehicle_id, ai_analysis_notes, damage_photo_url, created_at, answers')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (vehiclesData) {
      const withNotes = vehiclesData.map(v => {
        const latestCheck = checks?.find(c => c.vehicle_id === v.id)
        return {
          ...v,
          ai_note: latestCheck?.ai_analysis_notes || null,
          damage_photo_url: latestCheck?.damage_photo_url || null,
          original_dispute_text: latestCheck?.answers?.handoff_dispute_notes || null
        }
      })
      setVehicles(withNotes)
    }

    // Fetch today's activity
    const { data: todayChecks } = await supabase
      .from('rig_checks')
      .select('id, created_at, damage_notes, ai_damage_severity, answers, crew_last_name, vehicles!rig_checks_vehicle_id_fkey(rig_number), users(username, first_name, last_name)')
      .eq('org_id', orgId)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(20)

    const { data: todayEos } = await supabase
      .from('end_of_shift_reports')
      .select('id, created_at, fuel_level, cleanliness_rating, crew_last_name, vehicles(rig_number), users(username, first_name, last_name)')
      .eq('org_id', orgId)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(10)

    const normalizeJoin = (row: any) => ({
      ...row,
      vehicles: Array.isArray(row.vehicles) ? row.vehicles[0] ?? null : row.vehicles,
      users: Array.isArray(row.users) ? row.users[0] ?? null : row.users,
    })

    const combined: ActivityEvent[] = [
      ...(todayChecks || []).map(c => ({ ...normalizeJoin(c), _type: 'start' as const })),
      ...(todayEos || []).map(e => ({ ...normalizeJoin(e), _type: 'eos' as const })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setActivity(combined)
    setLastUpdated(new Date())
  }, [])

  // Subscribe to realtime changes on rig_checks and vehicles
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rig_checks' }, () => {
        fetchLatestData()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicles' }, () => {
        fetchLatestData()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'end_of_shift_reports' }, () => {
        fetchLatestData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchLatestData])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await fetchLatestData()
    setIsRefreshing(false)
  }

  const handleForceEndShift = async (vehicleId: string) => {
    try {
      setEndingShifts(prev => ({ ...prev, [vehicleId]: true }))
      await adminForceEndShift(vehicleId)
      setConfirmingShiftId(null)
      await fetchLatestData()
    } catch (err: any) {
      alert(`Failed to end shift: ${err.message}`)
    } finally {
      setEndingShifts(prev => ({ ...prev, [vehicleId]: false }))
    }
  }

  const checkedTodayIds = new Set(
    activity.map((a: any) => a.vehicles?.rig_number).filter(Boolean)
  )

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
              {labels.dashboard.split(' ')[0]} <span className="text-blue-600">{labels.dashboard.split(' ').slice(1).join(' ')}</span>
            </h1>
            <p className="text-slate-400 text-xs mt-1 font-medium flex items-center gap-2" suppressHydrationWarning>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Live · updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
          {/* ─────────────────── TOOLBAR ─────────────────── */}
          <div className="flex items-center gap-2">

            {/* Refresh */}
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-md transition-all duration-200 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* ── Checklists ── */}
            <Link
              href="/dashboard/checklists"
              className="hidden sm:flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700 bg-white border border-slate-200 hover:border-blue-200 px-3 py-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
            >
              <ListChecks className="w-4 h-4" /> Checklists
            </Link>

            {/* ── Reports Dropdown (Audit + Analytics + PDF) ── */}
            <div className="relative group hidden sm:block">
              <button className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700 bg-white border border-slate-200 hover:border-blue-200 px-3 py-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                <BarChart3 className="w-4 h-4" />
                <span>Reports</span>
                <svg className="w-3 h-3 ml-0.5 opacity-50 group-hover:opacity-100 transition-transform duration-200 group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 overflow-hidden">
                <div className="p-1.5 flex flex-col gap-0.5">
                  <Link href="/dashboard/analytics" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    <div>
                      <p>Analytics</p>
                      <p className="text-[10px] font-medium text-slate-400">Shift stats & trends</p>
                    </div>
                  </Link>
                  <Link href="/dashboard/audit-log" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors">
                    <Shield className="w-4 h-4 text-violet-500" />
                    <div>
                      <p>Audit Log</p>
                      <p className="text-[10px] font-medium text-slate-400">All recorded actions</p>
                    </div>
                  </Link>
                  <div className="my-1 border-t border-slate-100" />
                  <a href="/api/export-pdf" target="_blank" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                    <Download className="w-4 h-4 text-emerald-500" />
                    <div>
                      <p>Export PDF</p>
                      <p className="text-[10px] font-medium text-slate-400">Last 30 days report</p>
                    </div>
                  </a>
                </div>
              </div>
            </div>

            {/* ── Manage Dropdown (Users + Vehicles) — director only ── */}
            {userRole === 'director' && (
              <div className="relative group hidden sm:block">
                <button className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700 bg-white border border-slate-200 hover:border-blue-200 px-3 py-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                  <Wrench className="w-4 h-4" />
                  <span>Manage</span>
                  <svg className="w-3 h-3 ml-0.5 opacity-50 group-hover:opacity-100 transition-transform duration-200 group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 overflow-hidden">
                  <div className="p-1.5 flex flex-col gap-0.5">
                    <Link href="/dashboard/users" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                      <Users className="w-4 h-4 text-blue-500" />
                      <div>
                        <p>Users</p>
                        <p className="text-[10px] font-medium text-slate-400">Crew & managers</p>
                      </div>
                    </Link>
                    <Link href="/dashboard/vehicles" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                      <Truck className="w-4 h-4 text-indigo-500" />
                      <div>
                        <p>Vehicles</p>
                        <p className="text-[10px] font-medium text-slate-400">Fleet management</p>
                      </div>
                    </Link>
                    <Link href="/dashboard/inventory" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-fuchsia-50 hover:text-fuchsia-700 transition-colors">
                      <Package className="w-4 h-4 text-fuchsia-500" />
                      <div>
                        <p>Inventory</p>
                        <p className="text-[10px] font-medium text-slate-400">Warehouse tracking</p>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ── Sort toggle — icon only ── */}
            {userRole === 'director' && (
              <button
                onClick={() => setPrioritySort(p => !p)}
                title={prioritySort ? 'Default order (Green first)' : 'Priority order (Red first)'}
                className={`p-2 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 ${
                  prioritySort
                    ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            )}

            {/* Notification Bell */}
            <NotificationBell />

            {/* ── Status legend — visible on lg+ ── */}
            <div className="hidden lg:flex items-center gap-3 pl-1 border-l border-slate-200 ml-1">
              {[
                { color: 'bg-emerald-500', label: 'Ready' },
                { color: 'bg-amber-400', label: 'Needs TLC' },
                { color: 'bg-rose-500', label: 'Out of Service' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <span className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm`} />
                  {label}
                </div>
              ))}
            </div>

            {/* ── Mobile Menu button (visible on sm and below) ── */}
            <div className="relative group sm:hidden">
              <button className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:shadow-md transition-all duration-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {/* Mobile dropdown */}
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 overflow-hidden">
                <div className="p-2 flex flex-col gap-0.5">
                  <Link href="/dashboard/checklists" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                    <ListChecks className="w-4 h-4 text-slate-500" /> Checklists
                  </Link>
                  <div className="my-1 border-t border-slate-100" />
                  <p className="px-3 pt-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reports</p>
                  <Link href="/dashboard/analytics" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                    <BarChart3 className="w-4 h-4 text-blue-500" /> Analytics
                  </Link>
                  <Link href="/dashboard/audit-log" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors">
                    <Shield className="w-4 h-4 text-violet-500" /> Audit Log
                  </Link>
                  <a href="/api/export-pdf" target="_blank" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                    <Download className="w-4 h-4 text-emerald-500" /> Export PDF
                  </a>
                  {userRole === 'director' && (
                    <>
                      <div className="my-1 border-t border-slate-100" />
                      <p className="px-3 pt-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Manage</p>
                      <Link href="/dashboard/users" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                        <Users className="w-4 h-4 text-blue-500" /> Users
                      </Link>
                      <Link href="/dashboard/vehicles" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                        <Truck className="w-4 h-4 text-indigo-500" /> Vehicles
                      </Link>
                      <Link href="/dashboard/inventory" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-fuchsia-50 hover:text-fuchsia-700 transition-colors">
                        <Package className="w-4 h-4 text-fuchsia-500" /> Inventory
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* 📸 Shift Issues Pending Review (Managers only) */}
        {userRole !== 'emt' && shiftIssues.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-black text-violet-600 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500" />
              </span>
              Shift Issues Review
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shiftIssues.map(issue => (
                <div key={issue.id} className="rounded-2xl overflow-hidden shadow-lg bg-white border border-violet-200 flex flex-col sm:flex-row relative">
                  
                  {/* Photo Section */}
                  {issue.photo_url && (() => {
                    // Parse photo_url: could be JSON array or single URL string
                    let photos: string[] = []
                    try {
                      const parsed = JSON.parse(issue.photo_url)
                      photos = Array.isArray(parsed) ? parsed : [issue.photo_url]
                    } catch {
                      photos = [issue.photo_url]
                    }
                    return photos.length > 0 ? (
                      <div className={`shrink-0 bg-slate-100 border-b sm:border-b-0 sm:border-r border-violet-100 overflow-hidden ${
                        photos.length === 1 ? 'w-full sm:w-48 h-48 sm:h-auto' : 'w-full sm:w-56'
                      }`}>
                        <div className={`${photos.length > 1 ? 'flex sm:flex-col gap-1 p-1 overflow-x-auto sm:overflow-y-auto sm:max-h-72' : 'h-full'}`}>
                          {photos.map((url, i) => (
                            <div
                              key={i}
                              className={`relative cursor-pointer group overflow-hidden rounded-lg shrink-0 ${
                                photos.length === 1 ? 'w-full h-full' : 'w-36 h-28 sm:w-full sm:h-28'
                              }`}
                              onClick={() => setSelectedImage(url)}
                            >
                              <img src={url} alt={`Issue ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                <span className="opacity-0 group-hover:opacity-100 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-md shadow-lg">
                                  {photos.length > 1 ? `${i + 1}/${photos.length}` : 'View'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null
                  })()}

                  {/* Content Section */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-slate-900 font-bold text-lg leading-tight flex items-center gap-1.5">
                            {issue.rig_number || 'Unknown Rig'} <span className="text-slate-300 font-normal">|</span> <span className="text-violet-700 capitalize text-sm">{issue.category.replace('_', ' ')}</span>
                          </p>
                          <p className="text-xs font-semibold text-slate-500 mt-0.5">Reported by: <span className="text-slate-800">{issue.reporter_name}</span></p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                          issue.ai_severity === 'severe' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                          issue.ai_severity === 'minor' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                          {issue.ai_severity}
                        </span>
                      </div>

                      <div className="mb-4">
                        <p className="text-xs text-slate-500 font-medium">Strike will apply to each member:</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {(issue.previous_crew_name || 'Unknown').split(' & ').map((name: string, i: number) => (
                            <span key={i} className="text-sm font-bold text-slate-800 bg-slate-100 inline-block px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">
                              {name.trim()}
                            </span>
                          ))}
                        </div>
                      </div>

                      {issue.fuel_level && (
                        <div className="mb-4">
                          <p className="text-xs text-slate-500 font-medium mb-1">Reported Fuel Level:</p>
                          <span className="text-sm font-bold text-violet-700 bg-violet-100 inline-block px-2.5 py-1 rounded-md border border-violet-200">
                            {issue.fuel_level.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </span>
                        </div>
                      )}

                      <div className="bg-violet-50 p-3 rounded-xl border border-violet-100 mb-4">
                        <p className="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><ShieldAlert className="w-3 h-3"/> AI Analysis</p>
                        <p className="text-xs text-violet-900 font-semibold leading-relaxed">{issue.ai_analysis}</p>
                        {issue.description && (
                          <div className="mt-2 pt-2 border-t border-violet-200/50">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">EMT Note</p>
                            <p className="text-xs text-slate-700 italic">"{issue.description}"</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {confirmIssueAction?.id === issue.id ? (
                        /* Inline confirmation step */
                        <div className="flex-1 flex flex-col gap-2 bg-slate-50 rounded-lg p-3 border border-slate-200 animate-in fade-in duration-200">
                          <p className="text-xs font-bold text-slate-800 text-center">
                            {confirmIssueAction!.approved
                              ? '⚠️ Issue a strike to the previous crew?'
                              : 'Reject this report? No strike will be issued.'}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReviewIssue(issue.id, confirmIssueAction!.approved)}
                              disabled={reviewingIssues[issue.id]}
                              className={`flex-1 text-white text-xs font-bold py-2.5 rounded-lg shadow-sm transition-all disabled:opacity-50 flex justify-center ${
                                confirmIssueAction!.approved
                                  ? 'bg-violet-600 hover:bg-violet-700'
                                  : 'bg-rose-500 hover:bg-rose-600'
                              }`}
                            >
                              {reviewingIssues[issue.id] ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Yes, confirm'}
                            </button>
                            <button
                              onClick={() => setConfirmIssueAction(null)}
                              className="flex-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-bold py-2.5 rounded-lg transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Normal buttons */
                        <>
                          <button
                            onClick={() => setConfirmIssueAction({ id: issue.id, approved: true })}
                            disabled={reviewingIssues[issue.id]}
                            className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center"
                          >
                            {reviewingIssues[issue.id] ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Approve (Issue Strike)'}
                          </button>
                          <button
                            onClick={() => setConfirmIssueAction({ id: issue.id, approved: false })}
                            disabled={reviewingIssues[issue.id]}
                            className="flex-[0.5] bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 hover:border-slate-300 text-xs font-bold py-2.5 rounded-lg shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🔴 Pending Approval — Red vehicles needing manager review */}
        {vehicles.filter(v => v.pending_approval).length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-black text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
              </span>
              Pending Manager Approval
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.filter(v => v.pending_approval).map(v => {
                const data = v.pending_approval_data
                return (
                  <div key={v.id} className="rounded-2xl overflow-hidden shadow-lg bg-white border-2 border-rose-300 relative">
                    <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-red-500 to-rose-600" />
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-slate-900 font-extrabold text-xl tracking-tight">{v.rig_number}</p>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full border border-rose-200">
                          🚨 Critical
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs font-medium mb-2">
                        Crew: <span className="text-slate-800 font-semibold">{data?.crew_display || 'Unknown'}</span>
                        {data?.requested_at && (
                          <span> · {new Date(data.requested_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        )}
                      </p>

                      {/* AI Notes */}
                      {data?.ai_notes && (
                        <div className="mb-3">
                          <ExpandableAiNote note={data.ai_notes} originalText={v.original_dispute_text} />
                        </div>
                      )}

                      {/* Damage Photo */}
                      {data?.damage_photo_url && (
                        <div
                          className="w-full border border-slate-200 rounded-lg overflow-hidden relative cursor-pointer group mb-3"
                          onClick={() => setSelectedImage(data.damage_photo_url!)}
                        >
                          <img src={data.damage_photo_url} alt="Damage" className="w-full object-cover max-h-40 group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-opacity backdrop-blur-md">View Full Size</span>
                          </div>
                        </div>
                      )}

                      {/* Approve / Reject */}
                      {(userRole === 'manager' || userRole === 'director') && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              setApprovingVehicles(prev => ({ ...prev, [v.id]: true }))
                              try {
                                await approveVehicleShift(v.id)
                                await fetchLatestData()
                              } catch (err: any) {
                                alert(`Failed: ${err.message}`)
                              } finally {
                                setApprovingVehicles(prev => ({ ...prev, [v.id]: false }))
                              }
                            }}
                            disabled={approvingVehicles[v.id] || rejectingVehicles[v.id]}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg shadow transition-all disabled:opacity-50"
                          >
                            {approvingVehicles[v.id] ? 'Approving…' : '✅ Approve Shift'}
                          </button>
                          {confirmRejectId === v.id ? (
                            <>
                              <button
                                onClick={async () => {
                                  setRejectingVehicles(prev => ({ ...prev, [v.id]: true }))
                                  try {
                                    await rejectVehicleShift(v.id)
                                    setConfirmRejectId(null)
                                    await fetchLatestData()
                                  } catch (err: any) {
                                    alert(`Failed: ${err.message}`)
                                  } finally {
                                    setRejectingVehicles(prev => ({ ...prev, [v.id]: false }))
                                  }
                                }}
                                disabled={rejectingVehicles[v.id]}
                                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-2.5 rounded-lg shadow transition-all disabled:opacity-50"
                              >
                                {rejectingVehicles[v.id] ? 'Rejecting…' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setConfirmRejectId(null)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-bold uppercase tracking-wider px-3 py-2.5 rounded-lg shadow transition-all"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmRejectId(v.id)}
                              disabled={approvingVehicles[v.id]}
                              className="bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-bold uppercase tracking-wider px-3 py-2.5 rounded-lg border border-slate-200 hover:border-rose-200 shadow transition-all disabled:opacity-50"
                            >
                              🚫 Reject
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* In the Field — active shifts */}
        {vehicles.filter(v => v.on_shift_since).length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              In the Field
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.filter(v => v.on_shift_since).map(v => {
                const since = v.on_shift_since ? new Date(v.on_shift_since) : null
                const diffMs = since ? Date.now() - since.getTime() : 0
                const h = Math.floor(diffMs / 3600000)
                const m = Math.floor((diffMs % 3600000) / 60000)
                const elapsed = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
                return (
                  <div key={v.id} className="rounded-2xl overflow-hidden shadow-lg bg-slate-900 border border-slate-700/50 relative">
                    {/* Top accent stripe */}
                    <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
                    <div className="px-5 py-4">
                      {/* Row 1: Rig number + timer */}
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-white font-extrabold text-xl tracking-tight">{v.rig_number}</p>
                        <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-3 py-1 border border-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-emerald-300 font-mono font-bold text-sm tracking-widest">{elapsed}</span>
                        </div>
                      </div>
                      {/* Row 2: Crew + since */}
                      <div className="flex items-center justify-between">
                        <p className="text-slate-400 text-xs font-medium">
                          <span className="text-slate-200 font-semibold">{v.on_shift_by}</span>
                          {since && (
                            <span> · since {since.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                          )}
                        </p>
                        {(userRole === 'manager' || userRole === 'director') && (
                          <div className="flex items-center gap-1.5">
                            {confirmingShiftId === v.id ? (
                              <>
                                <button
                                  onClick={() => handleForceEndShift(v.id)}
                                  disabled={endingShifts[v.id]}
                                  className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow transition-all disabled:opacity-50"
                                >
                                  {endingShifts[v.id] ? 'Ending…' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => setConfirmingShiftId(null)}
                                  disabled={endingShifts[v.id]}
                                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow transition-all"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmingShiftId(v.id)}
                                disabled={endingShifts[v.id]}
                                className="bg-slate-700 hover:bg-rose-600 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow transition-all disabled:opacity-50 border border-slate-600 hover:border-rose-500"
                              >
                                {endingShifts[v.id] ? 'Ending…' : 'Force End'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Vehicle Grid — Grouped by Status */}
        {(() => {
          // Rule: If a vehicle is "In the Field" OR "Pending Approval", hide it from these columns
          const availableVehicles = vehicles.filter(v => !v.on_shift_since && !v.pending_approval)

          const redVehicles = availableVehicles.filter(v => !v.in_service && v.status === 'red')
          const yellowVehicles = availableVehicles.filter(v => !v.in_service && v.status === 'yellow')
          const greenVehicles = availableVehicles.filter(v => !v.in_service && v.status === 'green')
          const inServiceVehicles = availableVehicles.filter(v => v.in_service)

          const renderCard = (rig: Vehicle) => {
            return (
              <Card key={rig.id} className={`overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300`}>
                <div className={`h-3 ${rig.in_service ? 'bg-amber-400' : getStatusColor(rig.status)} w-full transition-colors duration-700`} />
                <CardHeader className="pb-2">
                  <CardTitle className="flex justify-between items-center text-2xl font-bold">
                    {rig.rig_number}
                    {rig.in_service ? (
                      <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                        <Wrench className="w-3.5 h-3.5" /> In Service
                      </span>
                    ) : (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${getStatusColor(rig.status)}`}>
                        {rig.status}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rig.in_service ? (
                    <div className="text-sm text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                      <Wrench className="w-4 h-4 shrink-0" />
                      Vehicle is at the mechanic and unavailable for shifts.
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-slate-500 font-medium pb-2">
                        Last Checked: {rig.last_checked_at ? new Date(rig.last_checked_at).toLocaleString() : 'Never'}
                      </div>
                      {(!rig.last_checked_at || new Date(rig.last_checked_at) < new Date(new Date().setHours(0,0,0,0))) && (
                        <div className="mt-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                          ⚠️ {labels.vehicle} not checked this shift
                        </div>
                      )}
                      {rig.ai_note && (
                        <ExpandableAiNote note={rig.ai_note} originalText={rig.original_dispute_text} />
                      )}
                      {rig.damage_photo_url && (
                        <div 
                          className="mt-3 w-full border border-slate-200 rounded-lg overflow-hidden relative cursor-pointer group"
                          onClick={() => setSelectedImage(rig.damage_photo_url!)}
                        >
                          <img src={rig.damage_photo_url} alt="Damage" className="w-full object-cover max-h-48 group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-opacity backdrop-blur-md">View Full Size</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )
          }

          const GroupHeader = ({ label, count, dot }: { label: string, count: number, dot: string }) => (
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2.5 h-2.5 rounded-full ${dot} shrink-0`} />
              <h2 className="text-sm font-black text-slate-600 uppercase tracking-widest">{label}</h2>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{count}</span>
            </div>
          )

          return (
            <div className="space-y-10">
              {/* Priority View: Red → Yellow → Green. Default View: Green → Yellow → Red */}
              {prioritySort ? (
                <>
                  {redVehicles.length > 0 && (
                    <div>
                      <GroupHeader label="Out of Service" count={redVehicles.length} dot="bg-rose-500" />
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {redVehicles.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {yellowVehicles.length > 0 && (
                    <div>
                      <GroupHeader label="Needs Attention" count={yellowVehicles.length} dot="bg-amber-400" />
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {yellowVehicles.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {greenVehicles.length > 0 && (
                    <div>
                      <GroupHeader label="Ready" count={greenVehicles.length} dot="bg-emerald-500" />
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {greenVehicles.map(renderCard)}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {greenVehicles.length > 0 && (
                    <div>
                      <GroupHeader label="Ready" count={greenVehicles.length} dot="bg-emerald-500" />
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {greenVehicles.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {yellowVehicles.length > 0 && (
                    <div>
                      <GroupHeader label="Needs Attention" count={yellowVehicles.length} dot="bg-amber-400" />
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {yellowVehicles.map(renderCard)}
                      </div>
                    </div>
                  )}
                  {redVehicles.length > 0 && (
                    <div>
                      <GroupHeader label="Out of Service" count={redVehicles.length} dot="bg-rose-500" />
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {redVehicles.map(renderCard)}
                      </div>
                    </div>
                  )}
                </>
              )}
              {/* At Mechanic always last */}
              {inServiceVehicles.length > 0 && (
                <div>
                  <GroupHeader label="At Mechanic" count={inServiceVehicles.length} dot="bg-slate-400" />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {inServiceVehicles.map(renderCard)}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Today's Activity Timeline */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-5">
            Today's Activity
            <span className="ml-3 text-sm font-semibold text-slate-400 bg-slate-100 rounded-full px-3 py-1">{activity.length} events</span>
          </h2>
          {activity.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200">
              <p className="text-lg font-semibold">No activity yet today</p>
              <p className="text-sm mt-1">{labels.inspection}s will appear here as crews submit them</p>
            </div>
          ) : (
            <div className="relative space-y-3">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
              {activity.map((event: any, idx) => {
                const isEos = event._type === 'eos'
                return (
                  <div key={event.id ?? idx} className="relative flex items-start gap-4 pl-14">
                    <div className={`absolute left-4 top-3 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 transition-colors ${
                      isEos ? 'bg-amber-500' : event.ai_damage_severity === 'red' ? 'bg-rose-500' : event.ai_damage_severity === 'yellow' ? 'bg-amber-400' : 'bg-emerald-500'
                    }`} />
                    <div className={`flex-1 bg-white rounded-xl border shadow-sm p-4 ${isEos ? 'border-amber-100' : 'border-slate-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">
                            {isEos ? `🌙 ${labels.shiftEnd}` : `🌅 ${labels.shiftStart}`} —{' '}
                            <span className="text-blue-600">{event.vehicles?.rig_number ?? `Unknown ${labels.vehicle}`}</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">by {event.crew_last_name || (event.users?.first_name ? `${event.users.first_name} ${event.users.last_name || ''}`.trim() : event.users?.username ?? 'Unknown')}</p>
                          {isEos && event.fuel_level && (
                            <p className="text-xs text-amber-700 mt-1 font-medium">
                              Fuel: {event.fuel_level.replace('_', ' ')}
                            </p>
                          )}
                          {!isEos && event.ai_damage_severity === 'yellow' && event.damage_notes === null && (
                            <p className="text-xs text-amber-700 mt-1 font-medium">⚠️ Missing equipment flagged</p>
                          )}
                          {!isEos && event.answers?.handoff_disputed && (
                            <p className="text-xs text-rose-700 mt-1.5 font-medium bg-rose-50 px-2 py-1 rounded-md border border-rose-200">
                              💬 <span className="font-bold">Dispute:</span> {event.answers?.handoff_dispute_notes}
                            </p>
                          )}
                          {!isEos && event.damage_notes && (
                            <p className="text-xs text-rose-600 mt-1 font-medium">⚠️ {event.damage_notes.substring(0, 80)}{event.damage_notes.length > 80 ? '...' : ''}</p>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-medium whitespace-nowrap shrink-0">
                          {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Fullscreen Image Modal */}
        {selectedImage && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedImage(null)}
          >
            <div 
              className="relative max-w-5xl w-full max-h-[95vh] flex flex-col items-center justify-center animate-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 md:-right-12 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              
              <img 
                src={selectedImage} 
                alt="Enlarged damage view" 
                className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
              />
              
              <div className="mt-6 flex gap-4">
                <a 
                  href={selectedImage}
                  download="damage-photo.jpg"
                  target="_blank"
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5"
                >
                  <Download className="w-5 h-5" />
                  Download Original
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
