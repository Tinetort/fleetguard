'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/../utils/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { ListChecks, RefreshCw, Download } from 'lucide-react'
import type { OrgLabels } from '@/lib/labels'

interface Vehicle {
  id: string
  rig_number: string
  status: string
  last_checked_at: string | null
  ai_note?: string | null
}

interface ActivityEvent {
  id: string
  created_at: string
  _type: 'start' | 'eos'
  vehicles?: { rig_number: string } | null
  users?: { username: string } | null
  damage_notes?: string | null
  ai_damage_severity?: string | null
  fuel_level?: string | null
  cleanliness_rating?: number | null
}

interface Props {
  initialVehicles: Vehicle[]
  initialActivity: ActivityEvent[]
  labels: OrgLabels
}

function getStatusColor(status: string) {
  switch (status) {
    case 'green': return 'bg-emerald-500 text-white'
    case 'yellow': return 'bg-amber-400 text-amber-950'
    case 'red': return 'bg-rose-500 text-white'
    default: return 'bg-gray-200'
  }
}

export default function DashboardClient({ initialVehicles, initialActivity, labels }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles)
  const [activity, setActivity] = useState<ActivityEvent[]>(initialActivity)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const fetchLatestData = useCallback(async () => {
    const supabase = createClient()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // Fetch updated vehicles
    const { data: vehiclesData } = await supabase
      .from('vehicles')
      .select('id, rig_number, status, last_checked_at')
      .order('rig_number')

    // Fetch latest AI notes per vehicle
    const { data: checks } = await supabase
      .from('rig_checks')
      .select('vehicle_id, ai_analysis_notes, created_at')
      .order('created_at', { ascending: false })

    if (vehiclesData) {
      const withNotes = vehiclesData.map(v => ({
        ...v,
        ai_note: checks?.find(c => c.vehicle_id === v.id)?.ai_analysis_notes || null
      }))
      setVehicles(withNotes)
    }

    // Fetch today's activity
    const { data: todayChecks } = await supabase
      .from('rig_checks')
      .select('id, created_at, damage_notes, ai_damage_severity, vehicles(rig_number), users(username)')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(20)

    const { data: todayEos } = await supabase
      .from('end_of_shift_reports')
      .select('id, created_at, fuel_level, cleanliness_rating, vehicles(rig_number), users(username)')
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

  const checkedTodayIds = new Set(
    activity.filter(a => a._type === 'start').map((a: any) => a.vehicles?.rig_number)
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
          <div className="flex items-center gap-3">
            <button
              onClick={handleManualRefresh}
              className={`p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:shadow transition-all ${isRefreshing ? 'animate-spin text-blue-500' : ''}`}
              title="Refresh now"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link href="/dashboard/checklists" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm hover:shadow transition-all">
              <ListChecks className="w-4 h-4" /> Checklists
            </Link>
            <a
              href="/api/export-pdf"
              target="_blank"
              className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm hover:shadow transition-all"
            >
              <Download className="w-4 h-4" /> Export PDF
            </a>
            <div className="hidden sm:flex gap-3">
              {['green', 'yellow', 'red'].map(s => (
                <div key={s} className="flex items-center gap-2 text-sm font-medium">
                  <span className={`w-3 h-3 rounded-full ${s === 'green' ? 'bg-emerald-500' : s === 'yellow' ? 'bg-amber-400' : 'bg-rose-500'} shadow-sm`} />
                  {s === 'green' ? 'Ready' : s === 'yellow' ? 'Needs TLC' : 'Out of Service'}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vehicle Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {vehicles.map((rig) => {
            const checkedToday = checkedTodayIds.has(rig.rig_number)
            return (
              <Card key={rig.id} className="overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300">
                <div className={`h-3 ${getStatusColor(rig.status)} w-full transition-colors duration-700`} />
                <CardHeader className="pb-2">
                  <CardTitle className="flex justify-between items-center text-2xl font-bold">
                    {rig.rig_number}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${getStatusColor(rig.status)}`}>
                      {rig.status}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-slate-500 font-medium pb-2">
                    Last Checked: {rig.last_checked_at ? new Date(rig.last_checked_at).toLocaleString() : 'Never'}
                  </div>
                  {!checkedToday && (
                    <div className="mt-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                      ⚠️ {labels.vehicle} not checked this shift
                    </div>
                  )}
                  {rig.ai_note && (
                    <div className="mt-3 w-full p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3 text-left">
                      <div className="bg-purple-100 text-purple-700 p-1.5 rounded-md mt-0.5 shrink-0">
                        <span className="text-[10px] font-black tracking-widest uppercase">AI</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-1">Gemini Detection</p>
                        <p className="text-xs text-slate-500 font-medium">{rig.ai_note}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

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
                          <p className="text-xs text-slate-500 mt-0.5">by {event.users?.username ?? 'Unknown'}</p>
                          {isEos && event.fuel_level && (
                            <p className="text-xs text-amber-700 mt-1 font-medium">
                              Fuel: {event.fuel_level.replace('_', ' ')}
                            </p>
                          )}
                          {!isEos && event.ai_damage_severity === 'yellow' && event.damage_notes === null && (
                            <p className="text-xs text-amber-700 mt-1 font-medium">⚠️ Missing equipment flagged</p>
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
      </div>
    </div>
  )
}
