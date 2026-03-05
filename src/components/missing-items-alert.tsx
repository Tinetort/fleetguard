'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle, Package, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const WITTY_MESSAGES = [
  "🧐 The last crew left something behind — let's make sure YOU don't start a shift empty-handed.",
  "👀 Heads up, crew! The previous shift flagged some missing gear. Quick check before you roll out.",
  "⚠️ PSA from your past colleagues: they couldn't find this stuff. Can you?",
  "🔍 Before you hit the road — the last team couldn't locate these items. Time to investigate.",
  "📋 Shift briefing: missing items from the previous crew. Don't let it be your problem too.",
  "🚨 Intel from the last shift: these items were MIA. Can you confirm they're back in action?",
  "🤝 Your crew before you wanted to give you a heads-up about some missing equipment.",
  "🎯 Quick check before dispatch — previous crew reported these items missing. Status update needed.",
  "💡 Pro tip from the outgoing team: double-check this stuff before you go anywhere.",
  "🔬 The last crew did their job and flagged missing items. Now it's your turn to verify.",
  "🚑 Ready to roll? Not so fast — confirm these missing items first.",
  "👮 Safety check: missing equipment from the previous shift. Confirm before starting.",
  "📡 Incoming message from last shift: these items are unaccounted for. Please verify.",
  "🏥 Patient safety first — make sure these flagged items are in your kit.",
  "⚡ Almost clear to go. Just need you to verify this equipment from last shift.",
  "🗂️ Previous crew filed a report — these items need your eyes on them, ASAP.",
  "🔦 Spotlight on: items that went missing last shift. Your job: find them (or escalate).",
  "📣 Before you buckle up — your colleagues marked these items as missing. Quick confirm?",
  "🧰 Equipment roll call! These items from last shift need verification before you proceed.",
  "✈️ Pre-flight check: previous crew flagged these items. Clear them before takeoff.",
]

interface MissingItemsAlertProps {
  items: string[]
  rigNumber: string
  onConfirmed: (stillMissingItems: string[]) => void
}

type ItemStatus = 'pending' | 'ok' | 'missing'

export default function MissingItemsAlert({ items, rigNumber, onConfirmed }: MissingItemsAlertProps) {
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemStatus>>(
    Object.fromEntries(items.map(item => [item, 'pending']))
  )
  const [submitting, setSubmitting] = useState(false)
  const [message] = useState(() => WITTY_MESSAGES[Math.floor(Math.random() * WITTY_MESSAGES.length)])

  const allDecided = Object.values(itemStatuses).every(s => s !== 'pending')
  const stillMissingItems = Object.entries(itemStatuses).filter(([, s]) => s === 'missing').map(([item]) => item)
  const okCount = Object.values(itemStatuses).filter(s => s === 'ok').length

  function markItem(item: string, status: 'ok' | 'missing') {
    setItemStatuses(prev => ({ ...prev, [item]: status }))
  }

  async function handleConfirm() {
    setSubmitting(true)
    onConfirmed(stillMissingItems)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-6 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white/80 text-xs font-semibold uppercase tracking-widest">Previous Shift Alert</p>
              <h2 className="text-white font-black text-lg leading-tight">RIG {rigNumber} — Missing Equipment</h2>
            </div>
          </div>
          <p className="text-amber-50 text-sm leading-relaxed font-medium">{message}</p>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100">
          <div 
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${(okCount / items.length) * 100}%` }}
          />
        </div>

        {/* Items */}
        <div className="px-5 py-4 space-y-2.5 max-h-[50vh] overflow-y-auto">
          {items.map((item) => {
            const status = itemStatuses[item]
            return (
              <div
                key={item}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all duration-200 ${
                  status === 'ok'
                    ? 'border-emerald-200 bg-emerald-50'
                    : status === 'missing'
                    ? 'border-rose-200 bg-rose-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                  status === 'ok' ? 'bg-emerald-100' :
                  status === 'missing' ? 'bg-rose-100' : 'bg-amber-100'
                }`}>
                  <Package className={`w-4 h-4 ${
                    status === 'ok' ? 'text-emerald-600' :
                    status === 'missing' ? 'text-rose-500' : 'text-amber-600'
                  }`} />
                </div>

                <span className={`flex-1 font-semibold text-sm ${
                  status === 'ok' ? 'text-emerald-800 line-through opacity-60' :
                  status === 'missing' ? 'text-rose-800' : 'text-slate-700'
                }`}>
                  {item}
                </span>

                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => markItem(item, 'ok')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      status === 'ok'
                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                        : 'bg-white border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => markItem(item, 'missing')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      status === 'missing'
                        ? 'bg-rose-500 text-white shadow-sm shadow-rose-200'
                        : 'bg-white border border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-600'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Missing
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary + CTA */}
        <div className="px-5 pb-6">
          {allDecided && stillMissingItems.length > 0 && (
            <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 font-semibold">
                {stillMissingItems.length} item{stillMissingItems.length > 1 ? 's' : ''} still missing — your manager will be notified automatically.
              </p>
            </div>
          )}

          <Button
            type="button"
            disabled={!allDecided || submitting}
            onClick={handleConfirm}
            className={`w-full h-13 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all ${
              !allDecided
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : stillMissingItems.length > 0
                ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-lg shadow-rose-200'
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-200'
            }`}
          >
            {submitting ? (
              <span className="animate-pulse">Processing...</span>
            ) : !allDecided ? (
              <>Confirm all items above <ChevronRight className="w-4 h-4" /></>
            ) : stillMissingItems.length === 0 ? (
              <>✅ All Good — Continue to Rig Check</>
            ) : (
              <>⚠️ Report Missing & Continue</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
