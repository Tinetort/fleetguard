'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/../utils/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { ListChecks, RefreshCw, Download, Shield, X, Users, Truck, Wrench } from 'lucide-react'
import type { OrgLabels } from '@/lib/labels'
import PushToggle from '@/components/push-toggle'
import { adminForceEndShift } from '../actions'

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
}

function getStatusColor(status: string) {
  switch (status) {
    case 'green': return 'bg-emerald-500 text-white'
    case 'yellow': return 'bg-amber-400 text-amber-950'
    case 'red': return 'bg-rose-500 text-white'
    default: return 'bg-gray-200'
  }
}

export default function DashboardClient({ initialVehicles, initialActivity, labels, userRole }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles)
  const [activity, setActivity] = useState<ActivityEvent[]>(initialActivity)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, string>>({})
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [endingShifts, setEndingShifts] = useState<Record<string, boolean>>({})
  const [confirmingShiftId, setConfirmingShiftId] = useState<string | null>(null)

function ExpandableAiNote({ note, originalText }: { note: string, originalText?: string | null }) {
  const [expanded, setExpanded] = useState(false)
  
  // The note could be just a dispute, just missing items/damage, or both concatenated with " | "
  const parts = note.split(' | ')
  const disputeSummaryPart = parts.find(p => p.includes('Dispute Summary:'))
  const otherNotesPart = parts.find(p => !p.includes('Dispute Summary:'))

  return (
    <div className="mt-3 flex flex-col gap-2">
      {/* 1. Render Missing Equipment or Standard AI Notes (if any) */}
      {otherNotesPart && (
        <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3 text-left">
          <div className="bg-amber-100 text-amber-700 p-1.5 rounded-md mt-0.5 shrink-0">
            <span className="text-[10px] font-black tracking-widest uppercase">System</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Checklist Flag</p>
            <p className="text-xs text-slate-500 font-medium">{otherNotesPart}</p>
          </div>
        </div>
      )}

      {/* 2. Render Expandable Dispute Summary (if any) */}
      {disputeSummaryPart && (
        <div 
          className="w-full p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-left cursor-pointer hover:bg-rose-100/50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="bg-rose-100 text-rose-700 p-1.5 rounded-md mt-0.5 shrink-0">
            <span className="text-[10px] font-black tracking-widest uppercase">AI</span>
          </div>
          <div className="flex-1 w-full min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-rose-900">Handoff Dispute (AI Summary)</p>
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest bg-white/50 px-2 py-0.5 rounded-full border border-rose-200">
                {expanded ? 'Hide Original' : 'View Original'}
              </span>
            </div>
            <p className="text-xs text-rose-700 font-medium">
              {disputeSummaryPart.replace('Dispute Summary:', '').trim()}
            </p>
            
            {expanded && originalText && (
              <div className="mt-2 pt-2 border-t border-rose-200/60 animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-[10px] uppercase font-bold text-rose-400 mb-1 tracking-widest">Original EMT Text:</p>
                <p className="text-xs text-rose-800 italic bg-white/40 p-2 rounded-md border border-rose-100/50">"{originalText}"</p>
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

    // Fetch updated vehicles
    const { data: vehiclesData } = await supabase
      .from('vehicles')
      .select('id, rig_number, status, last_checked_at, in_service, on_shift_since, on_shift_by')
      .order('rig_number')

    // Fetch latest AI notes per vehicle
    const { data: checks } = await supabase
      .from('rig_checks')
      .select('vehicle_id, ai_analysis_notes, damage_photo_url, created_at, answers')
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
      .select('id, created_at, damage_notes, ai_damage_severity, answers, crew_last_name, vehicles(rig_number), users(username, first_name, last_name)')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(20)

    const { data: todayEos } = await supabase
      .from('end_of_shift_reports')
      .select('id, created_at, fuel_level, cleanliness_rating, crew_last_name, vehicles(rig_number), users(username, first_name, last_name)')
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
            {userRole === 'director' && (
              <>
                <Link href="/dashboard/users" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm hover:shadow transition-all">
                  <Users className="w-4 h-4" /> Manage Users
                </Link>
                <Link href="/dashboard/vehicles" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm hover:shadow transition-all">
                  <Truck className="w-4 h-4" /> Manage Vehicles
                </Link>
              </>
            )}
            <Link href="/dashboard/audit-log" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm hover:shadow transition-all">
              <Shield className="w-4 h-4" /> Audit Log
            </Link>
            <PushToggle />
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

        {/* In the Field — active shifts */}
        {vehicles.filter(v => v.on_shift_since).length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
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
                  <div key={v.id} className="rounded-2xl overflow-hidden shadow-md border-2 border-amber-300 bg-white">
                    <div style={{ background: 'linear-gradient(135deg, #92400e, #b45309)', padding: '14px 16px 12px' }}>
                      <div className="flex items-center justify-between">
                        <p className="text-white font-extrabold text-lg">{v.rig_number}</p>
                        <span className="text-amber-200 font-mono font-bold text-base tracking-widest">{elapsed}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-amber-200 text-xs font-medium">
                          {v.on_shift_by} · since {since?.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        </p>
                        {(userRole === 'manager' || userRole === 'director') && (
                          <div className="flex items-center gap-2">
                            {confirmingShiftId === v.id ? (
                              <>
                                <button
                                  onClick={() => handleForceEndShift(v.id)}
                                  disabled={endingShifts[v.id]}
                                  className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-sm transition-all disabled:opacity-50"
                                >
                                  {endingShifts[v.id] ? 'Ending...' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => setConfirmingShiftId(null)}
                                  disabled={endingShifts[v.id]}
                                  className="bg-slate-500 hover:bg-slate-400 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-sm transition-all"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmingShiftId(v.id)}
                                disabled={endingShifts[v.id]}
                                className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-sm transition-all disabled:opacity-50"
                              >
                                {endingShifts[v.id] ? 'Ending...' : 'Force End'}
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

        {/* Vehicle Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {vehicles.map((rig) => {
            const checkedToday = checkedTodayIds.has(rig.rig_number)
            return (
              <Card key={rig.id} className={`overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 ${rig.in_service ? 'opacity-80' : ''}`}>
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
