'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Clock, ArrowRightCircle, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import type { OrgLabels } from '@/lib/labels'

interface Props {
  rigNumber: string
  onShiftSince: string   // ISO string from DB
  crewDisplay: string    // e.g. "Alexandr & Viktoria Volkova"
  currentUserName: string
  labels: OrgLabels
}

export default function OnShiftClient({ rigNumber, onShiftSince, crewDisplay, currentUserName, labels }: Props) {
  const startTime = new Date(onShiftSince)
  const [elapsedTime, setElapsedTime] = useState('')
  const [greeting, setGreeting] = useState<string | null>(null)

  // Read one-time greeting from sessionStorage (set by rig-check/page.tsx after successful submit)
  useEffect(() => {
    const stored = sessionStorage.getItem('shiftGreeting')
    if (stored) {
      setGreeting(stored)
      sessionStorage.removeItem('shiftGreeting')
    }
  }, [])

  useEffect(() => {
    const tick = () => {
      const diffMs = Date.now() - startTime.getTime()
      const h = Math.floor(diffMs / 3600000)
      const m = Math.floor((diffMs % 3600000) / 60000)
      const s = Math.floor((diffMs % 60000) / 1000)
      setElapsedTime(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [onShiftSince])

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
        <div className="bg-blue-600 h-4 w-full" />
        <CardHeader className="space-y-1 bg-white pb-6 pt-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <ShieldAlert className="w-10 h-10 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-extrabold text-center text-slate-800">
            Shift In Progress
          </CardTitle>
          <CardDescription className="text-center text-slate-500 font-medium text-base">
            {labels.shiftStart} inspection submitted
          </CardDescription>
        </CardHeader>

        <CardContent className="bg-slate-50 pt-6">
          {/* One-time greeting overlay shown after initial form submission */}
          {greeting && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setGreeting(null)}>
              <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full relative animate-in fade-in zoom-in-95 duration-300">
                <button onClick={() => setGreeting(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-blue-100 rounded-full">
                    <ShieldAlert className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
                <p className="text-xl font-extrabold text-slate-900 text-center leading-snug">{greeting}</p>
                <p className="text-slate-500 text-sm text-center mt-3">Tap anywhere to dismiss</p>
              </div>
            </div>
          )}

          <div className="space-y-4 py-4">
            {/* Active shift card */}
            <div className="rounded-2xl overflow-hidden border-0 shadow-lg">
              <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #1d4ed8)', padding: '24px 20px 20px', position: 'relative' }}>

                {/* Vehicle Number Badge - Top Right */}
                <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-full tracking-widest shadow-sm">
                  {rigNumber}
                </div>

                <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">YOU ARE ON SHIFT</p>
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-blue-300" />
                  <span className="text-4xl font-extrabold text-white font-mono tracking-widest">
                    {elapsedTime || '00:00:00'}
                  </span>
                </div>

                {/* Crew names under the timer */}
                <p className="text-blue-100 text-sm mt-3 font-semibold uppercase tracking-wide opacity-90">
                  <span className="opacity-75">CREW: </span>
                  {crewDisplay || currentUserName || 'Crew'}
                </p>
              </div>

              <div className="bg-white p-4 space-y-3">
                <div className="p-3 bg-emerald-50 rounded-xl flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-semibold">Start of Shift report submitted</span>
                </div>

                <Link href="/rig-check/end-of-shift">
                  <div
                    className="flex items-center justify-between p-4 rounded-xl cursor-pointer active:scale-98 transition-all"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 16px rgba(245,158,11,0.35)' }}
                  >
                    <div>
                      <p className="font-extrabold text-white text-base">End of Shift</p>
                      <p className="text-amber-100 text-xs mt-0.5">Submit handoff report when done</p>
                    </div>
                    <ArrowRightCircle className="w-7 h-7 text-white shrink-0" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
