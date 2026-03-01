'use client'

import { AlertTriangle, Star, Fuel, Package, MessageSquare, CheckCircle2, XCircle } from 'lucide-react'

const FUEL_ICONS: Record<string, string> = {
  empty: '⬜⬜⬜⬜',
  quarter: '🟥⬜⬜⬜',
  half: '🟨🟨⬜⬜',
  three_quarters: '🟩🟩🟩⬜',
  full: '🟩🟩🟩🟩',
}

interface HandoffData {
  lastCrew: string | null
  fuelLevel: string | null
  cleanlinessDetails: any | null
  restockNeeded: string[]
  handoffNotes: string | null
  damageSummary: string | null
  aiDamageWarning: string | null
  endedAt: string | null
}

interface HandoffCardProps {
  data: HandoffData
  onAcknowledge: (disputed: boolean, disputeNotes: string) => void
}

export default function HandoffCard({ data, onAcknowledge }: HandoffCardProps) {
  const hasDamage = !!(data.damageSummary)
  const endedAgo = data.endedAt
    ? (() => {
        const diffMs = Date.now() - new Date(data.endedAt).getTime()
        const diffH = Math.floor(diffMs / 3600000)
        if (diffH < 1) return 'less than 1h ago'
        if (diffH < 24) return `${diffH}h ago`
        return `${Math.floor(diffH / 24)}d ago`
      })()
    : null

  return (
    <div className="mb-6 rounded-2xl overflow-hidden border-0 shadow-lg">
      {/* Header */}
      <div className="bg-slate-800 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Previous Shift Handoff</p>
          <p className="text-white font-bold text-base mt-0.5">
            {data.lastCrew || 'Unknown crew'}
            {endedAgo && <span className="text-slate-400 font-normal text-sm ml-2">· {endedAgo}</span>}
          </p>
        </div>
      </div>

      {/* Damage warning — most important, shown first */}
      {hasDamage && (
        <div className="bg-rose-950 border-b border-rose-800 px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-rose-400 uppercase tracking-wide mb-1">Damage Alert</p>
              <p className="text-rose-100 font-semibold text-sm leading-snug">
                {data.aiDamageWarning || data.damageSummary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* EOS Summary */}
      <div className="bg-white px-5 py-4 space-y-4">
        {/* Fuel */}
        {data.fuelLevel && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-600">
              <Fuel className="w-4 h-4" />
              <span className="text-sm font-semibold">Fuel Left</span>
            </div>
            <span className="text-sm font-bold text-slate-800 font-mono tracking-widest">
              {FUEL_ICONS[data.fuelLevel] || data.fuelLevel}
            </span>
          </div>
        )}

        {/* Cleanliness */}
        {data.cleanlinessDetails && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-600">
              <Star className="w-4 h-4" />
              <span className="text-sm font-semibold">Cleanliness</span>
            </div>
            <div className="flex flex-wrap gap-2 text-sm justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className={`font-semibold flex items-center gap-1.5 ${data.cleanlinessDetails.cab ? "text-emerald-700" : "text-rose-700"}`}>
                {data.cleanlinessDetails.cab ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} Cab
              </span>
              <span className={`font-semibold flex items-center gap-1.5 ${data.cleanlinessDetails.patient ? "text-emerald-700" : "text-rose-700"}`}>
                {data.cleanlinessDetails.patient ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} Patient Area
              </span>
              <span className={`font-semibold flex items-center gap-1.5 ${data.cleanlinessDetails.trash ? "text-emerald-700" : "text-rose-700"}`}>
                {data.cleanlinessDetails.trash ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} Trash
              </span>
            </div>
          </div>
        )}

        {/* Restock */}
        {data.restockNeeded && data.restockNeeded.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-slate-600 mb-2">
              <Package className="w-4 h-4" />
              <span className="text-sm font-semibold">Needs Restock</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.restockNeeded.map((item: string) => (
                <span key={item} className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {data.handoffNotes && (
          <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3">
            <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600 italic">"{data.handoffNotes}"</p>
          </div>
        )}

        {/* Acknowledge buttons */}
        <div className="pt-2 grid grid-cols-2 gap-3">
          <AcknowledgeButton
            label="Looks Good"
            icon={<CheckCircle2 className="w-4 h-4" />}
            variant="green"
            onClick={() => onAcknowledge(false, '')}
          />
          <DisputeFlow onDispute={(notes) => onAcknowledge(true, notes)} />
        </div>
      </div>
    </div>
  )
}

function AcknowledgeButton({ label, icon, variant, onClick }: {
  label: string
  icon: React.ReactNode
  variant: 'green' | 'red'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
        variant === 'green'
          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-200'
          : 'bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-200'
      }`}
    >
      {icon} {label}
    </button>
  )
}

function DisputeFlow({ onDispute }: { onDispute: (notes: string) => void }) {
  const [open, setOpen] = require('react').useState(false)
  const [notes, setNotes] = require('react').useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-rose-100 hover:bg-rose-200 text-rose-700 transition-all active:scale-95"
      >
        <XCircle className="w-4 h-4" /> Dispute
      </button>
    )
  }

  return (
    <div className="col-span-2 space-y-2 animate-in fade-in duration-200">
      <textarea
        className="w-full rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-slate-800 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-rose-400"
        placeholder="What do you disagree with? (e.g. vehicle was not clean, oxygen not restocked)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="py-2.5 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => { if (notes.trim()) onDispute(notes.trim()) }}
          disabled={!notes.trim()}
          className="py-2.5 rounded-xl font-bold text-sm bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40 transition-all"
        >
          Submit Dispute
        </button>
      </div>
    </div>
  )
}
