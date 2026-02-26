'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Shield, FileText, Pen, Search, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'

interface AuditEntry {
  id: string
  created_at: string
  type: 'rig_check' | 'eos'
  rig_number: string
  username: string
  crew_last_name: string | null
  severity: string | null
  damage_notes: string | null
  ai_notes: string | null
  has_signature: boolean
  missing_items: string[]
}

function SeverityBadge({ severity }: { severity: string | null }) {
  if (severity === 'red') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
      <XCircle className="w-3 h-3" /> Critical
    </span>
  )
  if (severity === 'yellow') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
      <AlertTriangle className="w-3 h-3" /> Needs TLC
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3 h-3" /> Good
    </span>
  )
}

export default function AuditLogClient({ entries }: { entries: AuditEntry[] }) {
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = entries.filter(e => {
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        e.rig_number.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        (e.crew_last_name && e.crew_last_name.toLowerCase().includes(q)) ||
        (e.damage_notes && e.damage_notes.toLowerCase().includes(q))
      )
    }
    return true
  })

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600" /> Audit Log
              </h1>
              <p className="text-sm text-slate-500">{entries.length} records</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-5 pb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by vehicle, user, or notes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-12 bg-white border-slate-200"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['all', 'green', 'yellow', 'red'].map(s => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    severityFilter === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {s === 'all' ? 'All' : s === 'green' ? '✅ Good' : s === 'yellow' ? '⚠️ Needs TLC' : '🚨 Critical'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <Card className="border-0 shadow">
              <CardContent className="py-12 text-center text-slate-400">
                <p className="text-lg font-semibold">No records found</p>
              </CardContent>
            </Card>
          )}
          {filtered.map(entry => {
            const isExpanded = expandedId === entry.id
            const dt = new Date(entry.created_at)
            return (
              <Card
                key={entry.id}
                className={`border-0 shadow-md overflow-hidden transition-all cursor-pointer hover:shadow-lg ${
                  entry.severity === 'red' ? 'border-l-4 border-l-rose-500' :
                  entry.severity === 'yellow' ? 'border-l-4 border-l-amber-400' :
                  'border-l-4 border-l-emerald-400'
                }`}
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        entry.type === 'eos' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {entry.type === 'eos' ? <FileText className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">
                          {entry.rig_number}
                          {entry.crew_last_name && <span className="font-medium text-slate-500"> — {entry.crew_last_name}</span>}
                        </p>
                        <p className="text-xs text-slate-400">
                          {dt.toLocaleDateString()} {dt.toLocaleTimeString()} · {entry.username}
                          {entry.type === 'eos' && ' · End of Shift'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <SeverityBadge severity={entry.severity} />
                      {entry.has_signature && <span title="Signed"><Pen className="w-3.5 h-3.5 text-blue-500" /></span>}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      {entry.damage_notes && (
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Damage Notes</p>
                          <p className="text-sm text-slate-700">{entry.damage_notes}</p>
                        </div>
                      )}
                      {entry.ai_notes && (
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">AI Analysis</p>
                          <p className="text-sm text-slate-700">{entry.ai_notes}</p>
                        </div>
                      )}
                      {entry.missing_items.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Missing Items</p>
                          <div className="flex flex-wrap gap-1.5">
                            {entry.missing_items.map((item: string) => (
                              <span key={item} className="text-xs bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded-full">{item}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {!entry.damage_notes && !entry.ai_notes && entry.missing_items.length === 0 && (
                        <p className="text-sm text-slate-400 italic">No issues reported</p>
                      )}
                      <p className="text-xs text-slate-300 font-mono">ID: {entry.id}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
