'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BarChart3, TrendingUp, Users, Truck, AlertTriangle, Clock, Package, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts'

interface RigCheck {
  id: string
  created_at: string
  vehicle_id: string
  emt_id: string
  ai_damage_severity: string | null
  answers: any
  crew_last_name: string | null
  check_duration_seconds: number | null
  vehicles: { rig_number: string } | null
  users: { username: string; first_name?: string | null; last_name?: string | null } | null
}

interface EosReport {
  id: string
  created_at: string
  vehicle_id: string
  emt_id: string
  fuel_level: string
  restock_needed: string[] | null
  vehicle_condition: string | null
  vehicles: { rig_number: string } | null
  users: { username: string; first_name?: string | null; last_name?: string | null } | null
}

interface Employee {
  id: string
  username: string
  first_name: string | null
  last_name: string | null
  role: string
}

interface Vehicle {
  id: string
  rig_number: string
}

interface Props {
  rigChecks: RigCheck[]
  eosReports: EosReport[]
  employees: Employee[]
  vehicles: Vehicle[]
  shiftIssues: any[]
  inventoryEnabled?: boolean
  inventoryTransactions?: any[]
}

type TimeRange = 'week' | 'month' | 'year' | 'all'

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#14b8a6']

function getTimeRangeStart(range: TimeRange): Date {
  const now = new Date()
  switch (range) {
    case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case 'year': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    case 'all': return new Date(0)
  }
}

function userName(u: { username: string; first_name?: string | null; last_name?: string | null } | null): string {
  if (!u) return 'Unknown'
  return u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.username
}

export default function AnalyticsClient({ rigChecks, eosReports, employees, vehicles, shiftIssues, inventoryEnabled, inventoryTransactions = [] }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>('month')
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section)
  }

  // Filter data by time range
  const filteredChecks = useMemo(() => {
    const start = getTimeRangeStart(timeRange)
    return rigChecks.filter(c => new Date(c.created_at) >= start)
  }, [rigChecks, timeRange])

  const filteredEos = useMemo(() => {
    const start = getTimeRangeStart(timeRange)
    return eosReports.filter(e => new Date(e.created_at) >= start)
  }, [eosReports, timeRange])

  const filteredIssues = useMemo(() => {
    const start = getTimeRangeStart(timeRange)
    return shiftIssues.filter(i => new Date(i.created_at) >= start)
  }, [shiftIssues, timeRange])

  // ─── SUMMARY STATS ───
  const totalChecks = filteredChecks.length
  const totalEos = filteredEos.length
  const redChecks = filteredChecks.filter(c => c.ai_damage_severity === 'red').length
  const yellowChecks = filteredChecks.filter(c => c.ai_damage_severity === 'yellow').length
  const greenChecks = totalChecks - redChecks - yellowChecks
  const problemRate = totalChecks > 0 ? Math.round(((redChecks + yellowChecks) / totalChecks) * 100) : 0

  // Overall avg duration
  const checksWithDuration = filteredChecks.filter(c => c.check_duration_seconds && c.check_duration_seconds > 0)
  const avgDurationOverall = checksWithDuration.length > 0
    ? Math.round(checksWithDuration.reduce((s, c) => s + (c.check_duration_seconds || 0), 0) / checksWithDuration.length)
    : null

  function formatDuration(seconds: number | null): string {
    if (!seconds) return '—'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ─── AVG INSPECTION TIME PER EMPLOYEE ───
  // We pair consecutive rig_check and EOS for same vehicle to estimate shift duration
  // For "inspection time" we'll use the time between rig_check created and the next rig_check for same emt
  // Actually — we compute the gap between two consecutive checks by the same EMT as proxy for form fill time
  // Better approach: we'll look at pair of (Start of Shift rig_check → End of Shift EOS) for same vehicle
  const employeeCheckCounts = useMemo(() => {
    const map: Record<string, { name: string; count: number; totalMissingItems: number; disputes: number; totalDuration: number; durationCount: number }> = {}

    filteredChecks.forEach(c => {
      // Primary EMT
      const emtId = c.emt_id
      const emtName = userName(c.users)
      if (!map[emtId]) map[emtId] = { name: emtName, count: 0, totalMissingItems: 0, disputes: 0, totalDuration: 0, durationCount: 0 }
      map[emtId].count++
      map[emtId].totalMissingItems += (c.answers?.missing_items?.length || 0)
      if (c.answers?.handoff_disputed) map[emtId].disputes++
      if (c.check_duration_seconds && c.check_duration_seconds > 0) {
        map[emtId].totalDuration += c.check_duration_seconds
        map[emtId].durationCount++
      }

      // Partner (from crew_last_name — the second name after " & ")
      if (c.crew_last_name && c.crew_last_name.includes(' & ')) {
        const partnerName = c.crew_last_name.split(' & ')[1]?.trim()
        if (partnerName) {
          // Find employee by name match
          const partner = employees.find(e => {
            const fullName = e.first_name ? `${e.first_name} ${e.last_name || ''}`.trim() : e.username
            return fullName === partnerName
          })
          if (partner) {
            if (!map[partner.id]) map[partner.id] = { name: partnerName, count: 0, totalMissingItems: 0, disputes: 0, totalDuration: 0, durationCount: 0 }
            map[partner.id].count++
            if (c.check_duration_seconds && c.check_duration_seconds > 0) {
              map[partner.id].totalDuration += c.check_duration_seconds
              map[partner.id].durationCount++
            }
          }
        }
      }
    })

    return Object.entries(map)
      .map(([id, data]) => ({ id, ...data, avgDuration: data.durationCount > 0 ? Math.round(data.totalDuration / data.durationCount) : null }))
      .sort((a, b) => b.count - a.count)
  }, [filteredChecks, employees])

  // ─── VEHICLE PROBLEM FREQUENCY ───
  const vehicleStats = useMemo(() => {
    const map: Record<string, { rig_number: string; total: number; red: number; yellow: number; green: number; missingItems: Record<string, number> }> = {}

    filteredChecks.forEach(c => {
      const vid = c.vehicle_id
      const rig = c.vehicles?.rig_number || 'Unknown'
      if (!map[vid]) map[vid] = { rig_number: rig, total: 0, red: 0, yellow: 0, green: 0, missingItems: {} }
      map[vid].total++
      if (c.ai_damage_severity === 'red') map[vid].red++
      else if (c.ai_damage_severity === 'yellow') map[vid].yellow++
      else map[vid].green++

      // Track missing items per vehicle
      const missing = c.answers?.missing_items || []
      missing.forEach((item: string) => {
        // Shorten item names for display
        const short = item.length > 40 ? item.substring(0, 37) + '...' : item
        map[vid].missingItems[short] = (map[vid].missingItems[short] || 0) + 1
      })
    })

    return Object.entries(map)
      .map(([id, data]) => ({
        id,
        ...data,
        problemRate: data.total > 0 ? Math.round(((data.red + data.yellow) / data.total) * 100) : 0,
        topIssues: Object.entries(data.missingItems)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([item, count]) => ({ item, count }))
      }))
      .sort((a, b) => b.problemRate - a.problemRate)
  }, [filteredChecks])

  // ─── MOST COMMON MISSING ITEMS (company-wide) ───
  const companyMissingItems = useMemo(() => {
    const map: Record<string, number> = {}
    filteredChecks.forEach(c => {
      const missing = c.answers?.missing_items || []
      missing.forEach((item: string) => {
        map[item] = (map[item] || 0) + 1
      })
    })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([item, count]) => ({ item, count }))
  }, [filteredChecks])

  // ─── SEVERITY DISTRIBUTION FOR PIE CHART ───
  const severityData = [
    { name: 'Green (Ready)', value: greenChecks, fill: '#22c55e' },
    { name: 'Yellow (Needs TLC)', value: yellowChecks, fill: '#f59e0b' },
    { name: 'Red (Critical)', value: redChecks, fill: '#ef4444' },
  ].filter(d => d.value > 0)

  // ─── CHECKS PER VEHICLE BAR CHART ───
  const vehicleCheckData = vehicleStats.map(v => ({
    name: v.rig_number,
    problems: v.red + v.yellow,
    clean: v.green,
    problemRate: v.problemRate,
  }))

  // ─── EMPLOYEE CHECK COUNT BAR CHART ───
  const employeeCheckData = employeeCheckCounts.slice(0, 12).map(e => ({
    name: e.name.length > 12 ? e.name.substring(0, 10) + '…' : e.name,
    fullName: e.name,
    checks: e.count,
    missing: e.totalMissingItems,
    disputes: e.disputes,
  }))

  // ─── SHIFT ISSUES: DEMERITS BY INDIVIDUAL EMPLOYEE ───
  const crewDemerits = useMemo(() => {
    const map: Record<string, number> = {}
    filteredIssues.forEach(issue => {
      // Only count 'approved' issues as demerits
      if (issue.status === 'approved' && issue.previous_crew_name) {
        // Split crew name into individual members (e.g., "Smith & Jones" → ["Smith", "Jones"])
        const members = issue.previous_crew_name.split(' & ').map((n: string) => n.trim()).filter(Boolean)
        members.forEach((name: string) => {
          map[name] = (map[name] || 0) + 1
        })
      }
    })
    return Object.entries(map)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name: name.length > 15 ? name.substring(0, 13) + '…' : name, fullName: name, demerits: count }))
  }, [filteredIssues])

  // ─── INVENTORY USAGE ───
  const filteredInventory = useMemo(() => {
    const start = getTimeRangeStart(timeRange)
    return inventoryTransactions.filter(t => new Date(t.created_at) >= start)
  }, [inventoryTransactions, timeRange])

  const inventoryUsageData = useMemo(() => {
    const map: Record<string, { name: string; category: string; takenCount: number; costEstimate: number }> = {}
    
    filteredInventory.forEach(txn => {
      // Look for negative changes (taken from warehouse)
      if (txn.change < 0 && txn.inventory_items) {
        const itemId = txn.item_id
        if (!map[itemId]) {
          map[itemId] = { 
            name: txn.inventory_items.name, 
            category: txn.inventory_items.category || 'General', 
            takenCount: 0,
            costEstimate: 0
          }
        }
        map[itemId].takenCount += Math.abs(txn.change)
      }
    })

    return Object.entries(map)
      .map(([id, data]) => ({ id, ...data, shortName: data.name.length > 15 ? data.name.substring(0, 13) + '…' : data.name }))
      .sort((a, b) => b.takenCount - a.takenCount)
      .slice(0, 12)
  }, [filteredInventory])

  // ─── SHIFT ISSUES: CATEGORIES ───
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {}
    filteredIssues.forEach(issue => {
      // We can count all reported issues (pending or approved) to see what people complain about
      const cat = issue.category.replace('_', ' ')
      // Capitalize
      const label = cat.charAt(0).toUpperCase() + cat.slice(1)
      map[label] = (map[label] || 0) + 1
    })
    return Object.entries(map)
      .sort(([,a], [,b]) => b - a)
      .map(([name, count], i) => ({ name, value: count, fill: COLORS[i % COLORS.length] }))
  }, [filteredIssues])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-900">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Analytics & History
              </h1>
              <p className="text-sm font-medium text-slate-500">Fleet performance insights</p>
            </div>
          </div>
          {/* Time Range Selector */}
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(['week', 'month', 'year', 'all'] as TimeRange[]).map(r => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  timeRange === r
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                {r === 'week' ? '7 Days' : r === 'month' ? '30 Days' : r === 'year' ? '1 Year' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ─── Summary Cards ─── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-indigo-600 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Total Checks</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900">{totalChecks}</p>
              <p className="text-xs text-slate-500 mt-1">{totalEos} end-of-shift</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-green-50">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <Truck className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Fleet Size</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900">{vehicles.length}</p>
              <p className="text-xs text-slate-500 mt-1">{employees.length} employees</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-orange-50">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Problem Rate</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900">{problemRate}%</p>
              <p className="text-xs text-slate-500 mt-1">{redChecks} critical, {yellowChecks} warnings</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-rose-50 to-pink-50">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-rose-600 mb-2">
                <Package className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Missing Items</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900">{companyMissingItems.reduce((s, i) => s + i.count, 0)}</p>
              <p className="text-xs text-slate-500 mt-1">{companyMissingItems.length} unique items</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-violet-50 to-purple-50">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-violet-600 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Avg Check Time</span>
              </div>
              <p className="text-3xl font-extrabold text-slate-900">{formatDuration(avgDurationOverall)}</p>
              <p className="text-xs text-slate-500 mt-1">{checksWithDuration.length} timed checks</p>
            </CardContent>
          </Card>
        </div>

        {/* ─── Severity Distribution + Checks per Vehicle ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie chart: severity */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" /> Severity Distribution
              </h3>
              {severityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {severityData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} stroke="white" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-12">No data for this period</p>
              )}
            </CardContent>
          </Card>

          {/* Bar chart: problems per vehicle */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Problems by Vehicle
              </h3>
              {vehicleCheckData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={vehicleCheckData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    formatter={(value: any, name: any) => [value, name === 'problems' ? 'Issues' : 'Clean']}
                    />
                    <Bar dataKey="problems" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} name="Issues" />
                    <Bar dataKey="clean" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} name="Clean" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-12">No data for this period</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Employee Activity ─── */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" /> Employee Activity
            </h3>
            {employeeCheckData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={employeeCheckData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    formatter={(value: any, name: any) => [value, name === 'checks' ? 'Rig Checks' : name === 'missing' ? 'Missing Items' : 'Disputes']}
                    labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullName || label}
                  />
                  <Bar dataKey="checks" fill="#6366f1" radius={[4, 4, 0, 0]} name="Rig Checks" />
                  <Bar dataKey="missing" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Missing Items" />
                  <Bar dataKey="disputes" fill="#ef4444" radius={[4, 4, 0, 0]} name="Disputes" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400 text-center py-12">No data for this period</p>
            )}
          </CardContent>
        </Card>

        {/* ─── Avg Check Time per Employee ─── */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-500" /> Avg Start of Shift Time per Employee
            </h3>
            {(() => {
              const data = employeeCheckCounts
                .filter(e => e.avgDuration !== null)
                .slice(0, 12)
                .map(e => ({
                  name: e.name.length > 12 ? e.name.substring(0, 10) + '…' : e.name,
                  fullName: e.name,
                  minutes: Math.round((e.avgDuration || 0) / 60 * 10) / 10,
                }))
              return data.length > 0 ? (
                <ResponsiveContainer width="100%" height={270}>
                  <BarChart data={data} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 11 }} unit=" min" />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      formatter={(value: any) => [`${value} min`, 'Avg Time']}
                      labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullName || label}
                    />
                    <Bar dataKey="minutes" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Avg Time">
                      {data.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-12">No duration data yet — times will appear after the next rig check submissions</p>
              )
            })()}
          </CardContent>
        </Card>

        {/* ─── Most Common Missing Items (Company-wide) ─── */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-500" /> Most Common Missing Items
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 normal-case tracking-normal">Company-wide</span>
            </h3>
            {companyMissingItems.length > 0 ? (
              <div className="space-y-2">
                {companyMissingItems.map((item, i) => {
                  const maxCount = companyMissingItems[0].count
                  const pct = Math.round((item.count / maxCount) * 100)
                  return (
                    <div key={i} className="flex items-center gap-3 group">
                      <span className="text-xs font-bold text-slate-400 w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-sm font-semibold text-slate-700 truncate">{item.item}</p>
                          <span className="text-xs font-bold text-slate-500 ml-2 shrink-0">{item.count}×</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">No missing items reported in this period 🎉</p>
            )}
          </CardContent>
        </Card>

        {/* ─── Vehicle Details (expandable) ─── */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-500" /> Vehicle Breakdown
            </h3>
            <div className="space-y-2">
              {vehicleStats.map(v => {
                const isExpanded = expandedSection === v.id
                return (
                  <div key={v.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection(v.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md text-xs border border-slate-200">{v.rig_number}</span>
                        <span className="text-xs text-slate-500 font-medium">{v.total} checks</span>
                        {v.problemRate > 0 && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            v.problemRate > 50 ? 'bg-rose-100 text-rose-700' :
                            v.problemRate > 20 ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {v.problemRate}% issues
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          {v.green > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500" title={`${v.green} green`} />}
                          {v.yellow > 0 && <span className="w-2 h-2 rounded-full bg-amber-400" title={`${v.yellow} yellow`} />}
                          {v.red > 0 && <span className="w-2 h-2 rounded-full bg-rose-500" title={`${v.red} red`} />}
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                            <p className="text-lg font-extrabold text-emerald-700">{v.green}</p>
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Clean</p>
                          </div>
                          <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                            <p className="text-lg font-extrabold text-amber-700">{v.yellow}</p>
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Warning</p>
                          </div>
                          <div className="bg-rose-50 rounded-lg p-2.5 text-center">
                            <p className="text-lg font-extrabold text-rose-700">{v.red}</p>
                            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Critical</p>
                          </div>
                        </div>
                        {v.topIssues.length > 0 ? (
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Top Issues</p>
                            <div className="space-y-1.5">
                              {v.topIssues.map((issue, i) => (
                                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                                  <span className="text-xs font-medium text-slate-700 truncate">{issue.item}</span>
                                  <span className="text-xs font-bold text-rose-600 ml-2 shrink-0">{issue.count}×</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic text-center py-2">No recurring issues — this vehicle is in great shape! ✅</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* ─── Shift Accountability (Shift Issues) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shift Issue Categories (Pie) */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-violet-500" /> Issues Left from Prev Shift
              </h3>
              {categoryCounts.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={categoryCounts}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {categoryCounts.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} stroke="white" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-12">No shift issues reported</p>
              )}
            </CardContent>
          </Card>

          {/* Demerits by Crew (Bar) */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-600" /> Strikes (Demerits) By Employee
              </h3>
              <p className="text-xs text-slate-500 mb-4 tracking-wide font-medium">Each crew member gets an individual strike.</p>
              {crewDemerits.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={crewDemerits} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      formatter={(value: any) => [value, 'Strikes']}
                      labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullName || label}
                    />
                    <Bar dataKey="demerits" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Strikes">
                      {crewDemerits.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={i === 0 ? '#7c3aed' : '#8b5cf6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-12">No strikes recorded</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Inventory Usage (if enabled) ─── */}
        {inventoryEnabled && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-fuchsia-500" /> Top Warehouse Items Taken
              </h3>
              <p className="text-xs text-slate-500 mb-4 tracking-wide font-medium">Tracking items pulled from inventory during Start/End of shift.</p>
              {inventoryUsageData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={inventoryUsageData} barGap={4} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={true} vertical={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="shortName" type="category" tick={{ fontSize: 11, fontWeight: 600 }} width={100} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      formatter={(value: any) => [value, 'Units Taken']}
                      labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.name || label}
                    />
                    <Bar dataKey="takenCount" fill="#d946ef" radius={[0, 4, 4, 0]} name="Units Taken">
                      {inventoryUsageData.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-12">No items taken from inventory</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── Employee Details Table ─── */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" /> Employee Details
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-3 px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Employee</th>
                    <th className="py-3 px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Checks</th>
                    <th className="py-3 px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Avg Time</th>
                    <th className="py-3 px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Missing Items</th>
                    <th className="py-3 px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Disputes</th>
                    <th className="py-3 px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Avg Missing/Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeeCheckCounts.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <span className="text-sm font-semibold text-slate-900">{e.name}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-sm font-bold text-indigo-600">{e.count}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-sm font-bold ${e.avgDuration && e.avgDuration > 600 ? 'text-amber-600' : 'text-violet-600'}`}>{formatDuration(e.avgDuration)}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-sm font-bold ${e.totalMissingItems > 5 ? 'text-amber-600' : 'text-slate-600'}`}>{e.totalMissingItems}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-sm font-bold ${e.disputes > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{e.disputes}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-sm font-medium text-slate-600">
                          {e.count > 0 ? (e.totalMissingItems / e.count).toFixed(1) : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
