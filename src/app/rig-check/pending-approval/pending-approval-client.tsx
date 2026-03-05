'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/../utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ShieldAlert, Clock, Loader2, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  rigNumber: string
  crewDisplay: string
  vehicleId: string
}

export default function PendingApprovalClient({ rigNumber, crewDisplay, vehicleId }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [waitTime, setWaitTime] = useState('00:00')

  // Timer for how long they've been waiting
  useEffect(() => {
    const start = Date.now()
    const tick = () => {
      const diffMs = Date.now() - start
      const m = Math.floor(diffMs / 60000)
      const s = Math.floor((diffMs % 60000) / 1000)
      setWaitTime(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Subscribe to real-time updates on the vehicle
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('pending-approval-watch')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'vehicles',
        filter: `id=eq.${vehicleId}`,
      }, (payload) => {
        const updated = payload.new as any
        if (updated.on_shift_since && !updated.pending_approval) {
          // Approved! Redirect to on-shift
          setStatus('approved')
          setTimeout(() => router.push('/rig-check/on-shift'), 1500)
        } else if (!updated.pending_approval && !updated.on_shift_since) {
          // Rejected
          setStatus('rejected')
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [vehicleId, router])

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
        {status === 'approved' ? (
          <>
            <div className="bg-emerald-500 h-4 w-full" />
            <CardHeader className="space-y-1 bg-white pb-6 pt-8">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-emerald-100 rounded-full">
                  <ShieldAlert className="w-10 h-10 text-emerald-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-extrabold text-center text-emerald-700">
                Approved! ✅
              </CardTitle>
              <CardDescription className="text-center text-slate-500 font-medium text-base">
                Your shift has been approved. Redirecting...
              </CardDescription>
            </CardHeader>
          </>
        ) : status === 'rejected' ? (
          <>
            <div className="bg-rose-500 h-4 w-full" />
            <CardHeader className="space-y-1 bg-white pb-6 pt-8">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-rose-100 rounded-full">
                  <XCircle className="w-10 h-10 text-rose-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-extrabold text-center text-rose-700">
                Rejected
              </CardTitle>
              <CardDescription className="text-center text-slate-500 font-medium text-base">
                Manager has rejected this vehicle for shift duty due to critical damage.
              </CardDescription>
            </CardHeader>
            <CardContent className="bg-slate-50 pt-6 pb-6">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl mb-4">
                <p className="text-sm text-rose-800 font-semibold text-center">
                  🚫 {rigNumber} cannot go on shift. Please report to your manager for further instructions.
                </p>
              </div>
              <button
                onClick={() => router.push('/rig-check')}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all text-sm"
              >
                Back to Rig Check
              </button>
            </CardContent>
          </>
        ) : (
          <>
            <div className="bg-amber-500 h-4 w-full animate-pulse" />
            <CardHeader className="space-y-1 bg-white pb-6 pt-8">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-amber-100 rounded-full animate-pulse">
                  <ShieldAlert className="w-10 h-10 text-amber-600" />
                </div>
              </div>
              <CardTitle className="text-2xl font-extrabold text-center text-slate-800">
                Waiting for Approval
              </CardTitle>
              <CardDescription className="text-center text-slate-500 font-medium text-base">
                Manager review required before going on shift
              </CardDescription>
            </CardHeader>
            <CardContent className="bg-slate-50 pt-6">
              <div className="space-y-4 py-4">
                <div className="rounded-2xl overflow-hidden border-0 shadow-lg">
                  <div style={{ background: 'linear-gradient(135deg, #92400e, #d97706)', padding: '24px 20px 20px', position: 'relative' }}>
                    {/* Vehicle Badge */}
                    <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-full tracking-widest shadow-sm">
                      {rigNumber}
                    </div>

                    <p className="text-xs font-bold text-amber-200 uppercase tracking-widest mb-1">WAITING FOR MANAGER</p>
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-6 h-6 text-amber-200 animate-spin" />
                      <span className="text-3xl font-extrabold text-white font-mono tracking-widest">
                        {waitTime}
                      </span>
                    </div>

                    <p className="text-amber-100 text-sm mt-3 font-semibold uppercase tracking-wide opacity-90">
                      <span className="opacity-75">CREW: </span>
                      {crewDisplay}
                    </p>
                  </div>

                  <div className="bg-white p-4 space-y-3">
                    <div className="p-3 bg-rose-50 rounded-xl flex items-center gap-2 text-rose-700">
                      <ShieldAlert className="w-4 h-4" />
                      <span className="text-sm font-semibold">AI flagged critical damage — manager must review</span>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-xs text-amber-800 font-medium text-center">
                        Your manager has been notified. This page will update automatically when they approve or reject.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
