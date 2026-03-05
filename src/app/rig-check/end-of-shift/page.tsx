'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, Fuel, Star, ShieldAlert, Package, LogOut } from 'lucide-react'
import { getChecklistForVehicle, submitEndOfShiftReport, checkActiveShift, getInitialEndOfShiftData, getShiftMissingItems, logoutAction, getAllVehiclesForEOS, getInventoryEnabled, getInventoryItems, takeInventoryItems } from '../../actions'
import Link from 'next/link'
import SignaturePad, { type SignaturePadRef } from '@/components/signature-pad'

const FUEL_LEVELS = [
  { value: 'empty',          label: 'Empty',           icon: '⬜⬜⬜⬜', color: 'text-rose-600' },
  { value: 'quarter',        label: '¼  Quarter',       icon: '🟥⬜⬜⬜', color: 'text-orange-500' },
  { value: 'half',           label: '½  Half',          icon: '🟧🟧⬜⬜', color: 'text-amber-500' },
  { value: 'three_quarter',  label: '¾  Three Quarters', icon: '🟨🟨🟨⬜', color: 'text-yellow-500' },
  { value: 'full',           label: 'Full',             icon: '🟩🟩🟩🟩', color: 'text-emerald-600' },
]

export default function EndOfShiftPage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [checklist, setChecklist] = useState<any>(null)
  const [vehicleId, setVehicleId] = useState('')
  const [fuelLevel, setFuelLevel] = useState('half')
  const [cleanlinessDetails, setCleanlinessDetails] = useState({ cab: true, patient: true, trash: true })
  const [restockNeeded, setRestockNeeded] = useState<string[]>([])
  const [vehicleCondition, setVehicleCondition] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [activeShift, setActiveShift] = useState<{active: boolean, since: string | null, by: string | null} | null>(null)
  const [shiftChecking, setShiftChecking] = useState(false)
  const signatureRef = useRef<SignaturePadRef>(null)

  // Inventory
  const [inventoryEnabled, setInventoryEnabled] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [takenItems, setTakenItems] = useState<Record<string, number>>({})
  const [inventoryConfirmed, setInventoryConfirmed] = useState(false)

  useEffect(() => {
    async function load() {
      const [v, initData, invEnabled, invItems] = await Promise.all([
        getAllVehiclesForEOS(), 
        getInitialEndOfShiftData(),
        getInventoryEnabled(),
        getInventoryItems()
      ])
      setVehicles(v)
      if (initData.vehicleId) {
        setVehicleId(initData.vehicleId)
      }
      setInventoryEnabled(invEnabled)
      setInventoryItems(invItems)
    }
    load()
  }, [])

  // EOS gate: check if selected vehicle has an active shift
  useEffect(() => {
    if (!vehicleId) { setActiveShift(null); return }
    setShiftChecking(true)
    
    Promise.all([
      checkActiveShift(vehicleId),
      getShiftMissingItems(vehicleId),
      getChecklistForVehicle(vehicleId)
    ]).then(([shiftResult, missingResult, cl]) => {
      setActiveShift(shiftResult)
      setChecklist(cl)
      if (missingResult.missingItems && missingResult.missingItems.length > 0) {
        setRestockNeeded(missingResult.missingItems)
      } else {
        setRestockNeeded([])
      }
      setShiftChecking(false)
    }).catch(() => setShiftChecking(false))
  }, [vehicleId])

  const DEFAULT_RESTOCK = ['IV Supplies', 'Gauze / Bandages', 'Gloves', 'Oxygen (main)', 'Oxygen (portable)', 'Medications', 'Saline', 'Tape / Wraps']
  const restockItems: string[] = Array.isArray(checklist?.restock_items) && checklist.restock_items.length > 0
    ? checklist.restock_items
    : DEFAULT_RESTOCK

  const toggleRestock = (item: string) => {
    setRestockNeeded(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vehicleId) { setSubmitError('Please select a vehicle.'); return }
    if (signatureRef.current?.isEmpty()) { setSubmitError('Please sign the form before submitting.'); return }
    if (inventoryEnabled && !inventoryConfirmed) { setSubmitError('Please confirm the warehouse supplies you took, or tap "I didn\'t take anything".'); return }
    setIsSubmitting(true)
    setSubmitError(null)
    const formData = new FormData()
    formData.append('vehicle_id', vehicleId)
    formData.append('fuel_level', fuelLevel)
    formData.append('cleanliness_details', JSON.stringify(cleanlinessDetails))
    formData.append('restock_needed', JSON.stringify(restockNeeded))
    formData.append('vehicle_condition', vehicleCondition)
    formData.append('notes', vehicleCondition)
    formData.append('signature_data_url', signatureRef.current?.toDataURL() || '')
    if (checklist?.id) formData.append('checklist_id', checklist.id)
    try {
      // Submit inventory first if taking items
      if (inventoryEnabled && Object.keys(takenItems).length > 0) {
        const itemsToTake = Object.entries(takenItems)
          .map(([itemId, quantity]) => ({ itemId, quantity }))
          .filter(i => i.quantity > 0)
        
        if (itemsToTake.length > 0) {
          try {
            await takeInventoryItems(itemsToTake, 'end_of_shift', vehicleId)
          } catch (invErr) {
            console.error('Inventory error:', invErr) // don't block main shift submission
          }
        }
      }

      await submitEndOfShiftReport(formData)
      setSuccess(true)
    } catch (err: any) {
      setSubmitError(err?.message || 'Submission failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden text-center">
          <div className="bg-emerald-500 h-4 w-full" />
          <CardContent className="pt-12 pb-10 px-8 space-y-5">
            <div className="flex justify-center">
              <div className="p-4 bg-emerald-100 rounded-full">
                <CheckCircle2 className="w-12 h-12 text-emerald-600" />
              </div>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Shift Complete!</h2>
            <p className="text-slate-500 font-medium">Your end-of-shift report has been submitted and the dispatcher has been notified.</p>
            <form action={logoutAction}>
              <Button type="submit" className="w-full h-12 bg-slate-700 hover:bg-slate-800 font-bold mt-4">
                <LogOut className="w-4 h-4 mr-2" /> Log Out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden">
        <div className="bg-amber-500 h-4 w-full" />
        <CardHeader className="bg-white pb-4 pt-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-amber-100 rounded-full">
              <ShieldAlert className="w-10 h-10 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-3xl font-extrabold text-center text-slate-900">End of Shift</CardTitle>
          <CardDescription className="text-center text-slate-500 font-medium text-base">End-of-shift vehicle handoff report</CardDescription>
        </CardHeader>
        <CardContent className="bg-slate-50 pt-6">
          {submitError && (
            <div className="mb-4 p-4 bg-rose-100 border border-rose-200 rounded-xl text-rose-800">
              <p className="font-semibold text-sm">⚠️ {submitError}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Vehicle */}
            <div className="space-y-3">
              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wide">Select Vehicle</Label>
              <Select name="vehicle_id" onValueChange={setVehicleId} value={vehicleId} required>
                <SelectTrigger className="w-full h-14 text-lg bg-white border-slate-300 shadow-sm">
                  <SelectValue placeholder="Tap to select rig" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v: any) => (
                    <SelectItem key={v.id} value={v.id} className="text-lg py-3">{v.rig_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* EOS Gate — shift status */}
            {vehicleId && shiftChecking && (
              <p className="text-sm text-slate-400 animate-pulse">Checking shift status...</p>
            )}
            {vehicleId && !shiftChecking && activeShift && !activeShift.active && (
              <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-2">
                <p className="font-bold text-rose-700 text-sm">⛔ No active shift for this vehicle</p>
                <p className="text-rose-600 text-xs">You must complete a Start of Shift before submitting an End of Shift report.</p>
                <Link href="/rig-check" className="block text-xs font-bold text-blue-600 underline mt-1">→ Go to Start of Shift</Link>
              </div>
            )}
            {vehicleId && !shiftChecking && activeShift?.active && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p className="text-sm font-semibold">
                  Active shift by {activeShift.by}
                  {activeShift.since && ` · since ${new Date(activeShift.since).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                </p>
              </div>
            )}

            {/* Fuel Level */}
            <div className="space-y-3">
              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                <Fuel className="w-4 h-4" /> Fuel Level
              </Label>
              <div className="grid grid-cols-1 gap-2">
                {FUEL_LEVELS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFuelLevel(f.value)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left font-medium ${
                      fuelLevel === f.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-lg font-mono">{f.icon}</span>
                    <span className={`font-semibold ${fuelLevel === f.value ? 'text-blue-700' : 'text-slate-700'}`}>{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cleanliness */}
            <div className="space-y-3">
              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                <Star className="w-4 h-4" /> Vehicle Cleanliness
              </Label>
              <div className="grid grid-cols-1 gap-2 bg-white p-4 rounded-xl border border-slate-200">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={cleanlinessDetails.cab} onChange={(e) => setCleanlinessDetails({...cleanlinessDetails, cab: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer" />
                  <span className="font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">Front Cab Clean</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group mt-2">
                  <input type="checkbox" checked={cleanlinessDetails.patient} onChange={(e) => setCleanlinessDetails({...cleanlinessDetails, patient: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer" />
                  <span className="font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">Rear Patient Area Clean</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group mt-2">
                  <input type="checkbox" checked={cleanlinessDetails.trash} onChange={(e) => setCleanlinessDetails({...cleanlinessDetails, trash: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer" />
                  <span className="font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">Trash Emptied</span>
                </label>
              </div>
            </div>

            {/* Restock Needed */}
            <div className="space-y-3">
              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                <Package className="w-4 h-4" /> Restock Needed <span className="font-normal text-slate-400">(select all that apply)</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {restockItems.slice(0, 12).map((item: string) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleRestock(item)}
                    className={`p-2.5 rounded-lg border-2 text-xs font-semibold text-left transition-all ${
                      restockNeeded.includes(item)
                        ? 'border-amber-500 bg-amber-50 text-amber-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {restockNeeded.includes(item) ? '✓ ' : ''}{item}
                  </button>
                ))}
              </div>
            </div>

            {/* Inventory / Items Taken */}
            {inventoryEnabled && inventoryItems.length > 0 && (
              <div className="space-y-3 pt-6 border-t border-slate-200">
                {/* Section header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-fuchsia-100 rounded-xl text-base">📦</span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-800 leading-tight">Warehouse Supplies</h3>
                      <p className="text-xs text-slate-400 leading-tight">Did you take any supplies during your shift?</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTakenItems({})
                      setInventoryConfirmed(true)
                    }}
                    className={`flex-shrink-0 rounded-full text-xs font-bold px-3 h-8 border transition-all ${
                      inventoryConfirmed && Object.values(takenItems).every(v => v === 0)
                        ? 'bg-fuchsia-600 text-white border-fuchsia-600 shadow-sm'
                        : 'bg-white text-fuchsia-700 border-fuchsia-300 hover:bg-fuchsia-50'
                    }`}
                  >
                    {inventoryConfirmed && Object.values(takenItems).every(v => v === 0) ? '✓ Confirmed' : "I didn't take anything"}
                  </button>
                </div>

                {/* Items list grouped by category */}
                <div className={`rounded-2xl border overflow-hidden transition-all ${
                  inventoryConfirmed && Object.keys(takenItems).filter(k => (takenItems[k] || 0) > 0).length > 0
                    ? 'border-fuchsia-300 ring-2 ring-fuchsia-100'
                    : 'border-slate-200'
                }`}>
                  {(() => {
                    const grouped = inventoryItems.reduce<Record<string, any[]>>((acc, item) => {
                      const key = item.category || 'General'
                      if (!acc[key]) acc[key] = []
                      acc[key].push(item)
                      return acc
                    }, {})

                    return Object.entries(grouped).map(([category, items], gi) => (
                      <div key={category}>
                        {/* Category header */}
                        <div className={`flex items-center gap-2 px-4 py-2 bg-slate-50 ${gi > 0 ? 'border-t border-slate-100' : ''}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 flex-shrink-0" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{category}</span>
                        </div>
                        {/* Item rows */}
                        <div className="divide-y divide-slate-100">
                          {items.map(item => {
                            const qty = takenItems[item.id] || 0
                            const isTaken = qty > 0
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
                                  isTaken ? 'bg-fuchsia-50/60' : 'bg-white'
                                }`}
                              >
                                {/* Item name */}
                                <span className={`text-sm font-semibold flex-1 min-w-0 truncate ${
                                  isTaken ? 'text-fuchsia-900' : 'text-slate-700'
                                }`}>
                                  {item.name}
                                </span>

                                {/* Stepper */}
                                <div className={`flex items-center gap-1 flex-shrink-0 rounded-xl p-1 border ${
                                  isTaken ? 'border-fuchsia-200 bg-white' : 'border-slate-100 bg-slate-50'
                                }`}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTakenItems(prev => ({ ...prev, [item.id]: Math.max(0, qty - 1) }))
                                      setInventoryConfirmed(true)
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 active:scale-95 transition-all shadow-sm text-base font-bold"
                                  >−</button>
                                  <div className={`w-8 text-center text-sm font-black tabular-nums select-none ${
                                    isTaken ? 'text-fuchsia-700' : 'text-slate-300'
                                  }`}>
                                    {qty > 0 ? qty : '–'}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTakenItems(prev => ({ ...prev, [item.id]: qty + 1 }))
                                      setInventoryConfirmed(true)
                                    }}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 active:scale-95 transition-all shadow-sm text-base font-bold">+</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            )}

            {/* Shift Notes & Issues (merged field) */}
            <div className="space-y-3">
              <Label className="text-slate-700 font-bold text-sm uppercase tracking-wide">Shift Notes & Issues</Label>
              <p className="text-xs text-slate-400 -mt-1">Damage, maintenance needs, notes for next crew — all in one place</p>
              <textarea
                value={vehicleCondition}
                onChange={e => setVehicleCondition(e.target.value)}
                className="flex w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 min-h-[100px] resize-y"
                placeholder="Any damage, issues, or notes for the next crew..."
              />
            </div>

            {/* E-Signature */}
            <SignaturePad ref={signatureRef} label="Crew Signature" required />

            <Button
              type="submit"
              disabled={isSubmitting || !vehicleId}
              className="w-full h-16 text-xl font-bold rounded-xl shadow-md bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isSubmitting ? 'Submitting...' : 'Submit End of Shift Report'}
            </Button>

            <p className="text-center text-xs text-slate-400 font-medium uppercase tracking-widest">
              FleetGuard — Powered by Smart Rig Check
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
