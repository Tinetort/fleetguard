'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, ShieldAlert, Camera, X, FileText, ArrowRight, CheckCheck } from 'lucide-react'
import { submitRigCheck, getVehicles, getActiveChecklist, getOrgLabels } from '../actions'
import { categorizeItems } from '@/lib/categorize'
import Link from 'next/link'
import type { OrgLabels } from '@/lib/labels'
import { DEFAULT_LABELS } from '@/lib/labels'

type ItemStatus = 'present' | 'missing' | null

export default function RigCheckPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [vehicles, setVehicles] = useState<any[]>([])
  const [checklist, setChecklist] = useState<any>(null)
  const [vehicleId, setVehicleId] = useState<string>('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [labels, setLabels] = useState<OrgLabels>(DEFAULT_LABELS)

  // Present/Missing state per item: Record<itemName, 'present'|'missing'|null>
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemStatus>>({})

  useEffect(() => {
    async function loadData() {
      const [dbVehicles, activeChecklist, orgLabels] = await Promise.all([
        getVehicles(),
        getActiveChecklist(),
        getOrgLabels(),
      ])
      setVehicles(dbVehicles)
      setChecklist(activeChecklist)
      setLabels(orgLabels)
    }
    loadData()
  }, [])

  // Categorize questions whenever checklist changes
  const categorized = useMemo(() => {
    if (!checklist?.questions?.length) return null
    return categorizeItems(checklist.questions)
  }, [checklist])

  function setItemStatus(item: string, status: ItemStatus) {
    setItemStatuses(prev => ({ ...prev, [item]: status }))
  }

  function markCategoryAll(items: string[], status: 'present' | 'missing') {
    setItemStatuses(prev => {
      const next = { ...prev }
      items.forEach(i => { next[i] = status })
      return next
    })
  }

  const missingItems = Object.entries(itemStatuses)
    .filter(([, s]) => s === 'missing')
    .map(([item]) => item)

  const allAnswered = checklist?.questions?.every((q: string) => itemStatuses[q] !== null && itemStatuses[q] !== undefined) ?? true

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (checklist?.type === 'manual' && checklist?.questions?.length > 0 && !allAnswered) {
      setSubmitError('Please mark every item as Present or Missing before submitting.')
      return
    }

    if (!vehicleId) {
      setSubmitError('Please select a vehicle.')
      return
    }

    setIsSubmitting(true)
    const form = e.currentTarget
    const formData = new FormData(form)

    // CRITICAL: Shadcn Select doesn't populate FormData — must add manually
    formData.set('vehicle_id', vehicleId)

    // CRITICAL: manually append the selected file — hidden <input> is not picked up by FormData(form)
    if (selectedFile) {
      formData.set('damage_photo', selectedFile, selectedFile.name)
    }

    // Inject item statuses into formData
    if (checklist?.type === 'manual') {
      formData.append('item_statuses', JSON.stringify(itemStatuses))
      formData.append('missing_items', JSON.stringify(missingItems))
    }

    try {
      setSubmitError(null)
      await submitRigCheck(formData)
      setSuccess(true)
      setSelectedFile(null)
      setItemStatuses({})
      setTimeout(() => setSuccess(false), 8000)
      form.reset()
    } catch (error: any) {
      console.error(error)
      setSubmitError(error?.message || 'Submission failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
    }
  }

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
          <CardTitle className="text-3xl font-extrabold text-center text-slate-900">{labels.inspection}</CardTitle>
          <CardDescription className="text-center text-slate-500 font-medium text-base">{labels.shiftStart} vehicle inspection form</CardDescription>
        </CardHeader>
        <CardContent className="bg-slate-50 pt-6">
          {success && (
            <div className="mb-4 space-y-3">
              <div className="p-4 bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 animate-in fade-in slide-in-from-top-4 duration-500">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Check submitted! {labels.vehicle} status updated.</p>
                  {missingItems.length > 0 && (
                    <p className="text-xs text-rose-700 mt-1 font-medium">
                      ⚠️ {missingItems.length} missing item{missingItems.length > 1 ? 's' : ''} flagged to dispatcher
                    </p>
                  )}
                </div>
              </div>
              <Link href="/rig-check/end-of-shift">
                <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors animate-in fade-in slide-in-from-top-4 duration-700">
                  <div>
                    <p className="font-bold text-amber-800">End of Shift?</p>
                    <p className="text-xs text-amber-700 mt-0.5">Submit your handoff report — fuel, restock</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-amber-600 shrink-0" />
                </div>
              </Link>
            </div>
          )}

          {submitError && (
            <div className="mb-4 p-4 bg-rose-100 border border-rose-200 rounded-xl text-rose-800">
              <p className="font-semibold text-sm">⚠️ {submitError}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="vehicle_id" className="text-slate-700 font-bold text-sm uppercase tracking-wide">Select {labels.vehicle}</Label>
              <Select onValueChange={setVehicleId} required>
                <SelectTrigger id="vehicle_id" className="w-full h-14 text-lg bg-white border-slate-300 shadow-sm focus:ring-2 focus:ring-blue-500">
                  <SelectValue placeholder={`Tap to select ${labels.vehicle.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v: any) => (
                    <SelectItem key={v.id} value={v.id} className="text-lg py-3 cursor-pointer">{v.rig_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="oxygen_psi" className="text-slate-700 font-bold text-sm uppercase tracking-wide">Main Oxygen (PSI)</Label>
              <Input id="oxygen_psi" name="oxygen_psi" type="number" required min="0" max="2500"
                placeholder="e.g. 2000" className="h-14 tracking-wider text-xl font-medium bg-white border-slate-300 shadow-sm"
                onInput={(e) => { const v = parseInt((e.target as HTMLInputElement).value); if (v < 0) (e.target as HTMLInputElement).value = '0'; if (v > 2500) (e.target as HTMLInputElement).value = '2500' }} />
            </div>

            <div className="space-y-3">
              <Label htmlFor="portable_oxygen_psi" className="text-slate-700 font-bold text-sm uppercase tracking-wide">Portable Oxygen (PSI)</Label>
              <Input id="portable_oxygen_psi" name="portable_oxygen_psi" type="number" required min="0" max="2500"
                placeholder="e.g. 2000" className="h-14 tracking-wider text-xl font-medium bg-white border-slate-300 shadow-sm"
                onInput={(e) => { const v = parseInt((e.target as HTMLInputElement).value); if (v < 0) (e.target as HTMLInputElement).value = '0'; if (v > 2500) (e.target as HTMLInputElement).value = '2500' }} />
            </div>

            {/* Dynamic Checklist — Categorized */}
            {checklist && (
              <div className="space-y-5 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-md">
                    {checklist.type === 'pdf' ? <FileText className="w-4 h-4 text-blue-600" /> : <ShieldAlert className="w-4 h-4 text-blue-600" />}
                  </div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">{checklist.title}</h3>
                </div>

                <input type="hidden" name="checklist_id" value={checklist.id} />

                {/* PDF checklist */}
                {checklist.type === 'pdf' && (
                  <div className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <p className="text-sm text-slate-600">Please review the protocol document before proceeding.</p>
                    <a href={checklist.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full h-12 bg-white border border-blue-200 text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
                      <FileText className="w-5 h-5" /> Open Protocol PDF
                    </a>
                    <label className="flex items-start gap-3 mt-4 cursor-pointer group">
                      <input type="checkbox" name="pdf_confirmed" value="true" required
                        className="mt-1 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                        I confirm that I have reviewed the active protocol document.
                      </span>
                    </label>
                  </div>
                )}

                {/* Manual checklist — categorized with Present/Missing */}
                {checklist.type === 'manual' && categorized && (
                  <div className="space-y-6">
                    {Object.entries(categorized).map(([category, items]) => (
                      <div key={category} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                        {/* Category header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                          <h4 className="font-bold text-slate-700 text-sm">{category}</h4>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => markCategoryAll(items as string[], 'present')}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                            >
                              <CheckCheck className="w-3.5 h-3.5" /> All Present
                            </button>
                          </div>
                        </div>

                        {/* Items */}
                        <div className="divide-y divide-slate-100">
                          {(items as string[]).map((item: string) => {
                            const status = itemStatuses[item] ?? null
                            return (
                              <div key={item} className="flex items-center justify-between gap-3 px-4 py-3">
                                <span className={`text-sm font-medium leading-snug flex-1 ${
                                  status === 'missing' ? 'text-rose-600' : status === 'present' ? 'text-slate-700' : 'text-slate-600'
                                }`}>
                                  {item}
                                </span>
                                <div className="flex gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setItemStatus(item, 'present')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                      status === 'present'
                                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-400 hover:text-emerald-600'
                                    }`}
                                  >
                                    ✓ Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setItemStatus(item, 'missing')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                      status === 'missing'
                                        ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-rose-400 hover:text-rose-600'
                                    }`}
                                  >
                                    ✗ Missing
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Progress indicator */}
                    {checklist.questions.length > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${(Object.keys(itemStatuses).filter(k => itemStatuses[k] !== null).length / checklist.questions.length) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                          {Object.keys(itemStatuses).filter(k => itemStatuses[k] !== null).length}/{checklist.questions.length} answered
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Damage + Photo */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <Label htmlFor="damage_notes" className="text-slate-700 font-bold text-sm uppercase tracking-wide">Damage / Issues (Optional)</Label>
              <textarea id="damage_notes" name="damage_notes"
                className="flex w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-h-[80px] resize-y"
                placeholder="Describe any new damages or missing equipment..." />

              <div className="mt-2">
                {!selectedFile ? (
                  <label className="flex items-center justify-center gap-2 w-full h-14 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 font-bold cursor-pointer hover:bg-slate-100 transition-colors">
                    <Camera className="w-5 h-5" />
                    <span>Attach Photo</span>
                    <input type="file" name="damage_photo" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="font-medium text-blue-900 truncate text-sm">{selectedFile.name}</span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="text-blue-500 hover:text-blue-700 hover:bg-blue-100 shrink-0"
                      onClick={() => setSelectedFile(null)}>
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Missing items warning before submit */}
            {missingItems.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <p className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-2">⚠️ Missing items — dispatcher will be notified:</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingItems.map(item => (
                    <span key={item} className="text-xs bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded-full">{item}</span>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || (checklist?.type === 'manual' && !allAnswered)}
              className="w-full h-16 text-xl font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : `Submit ${labels.inspection}`}
            </Button>

            {checklist?.type === 'manual' && !allAnswered && (
              <p className="text-center text-xs text-slate-400 font-medium">
                Mark all items Present or Missing to enable submit
              </p>
            )}

            <p className="text-center text-xs text-slate-400 font-medium uppercase tracking-widest mt-4">
              FleetGuard — Powered by Smart Rig Check
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
