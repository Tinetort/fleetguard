'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, ShieldAlert, Camera, X, FileText, ArrowRight, CheckCheck, ChevronDown, ChevronRight } from 'lucide-react'
import { submitRigCheck, getVehicles, getChecklistForVehicle, getInitialRigCheckData, fetchWelcomeGreeting, submitShiftIssue, getShiftMissingItems, reportStillMissingItems, takeInventoryItems } from '../actions'
import { collectMissingLabels } from '@/lib/categorize'
import { countAllItems, type ChecklistCategory } from '@/lib/presets'
import Link from 'next/link'
import type { OrgLabels } from '@/lib/labels'
import { DEFAULT_LABELS } from '@/lib/labels'
import SignaturePad, { type SignaturePadRef } from '@/components/signature-pad'
import ShiftGreetingModal from '@/components/shift-greeting-modal'
import MissingItemsAlert from '@/components/missing-items-alert'
import { Clock, ArrowRightCircle } from 'lucide-react'

type ItemStatus = 'present' | 'missing' | null

export default function RigCheckPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [vehicles, setVehicles] = useState<any[]>([])
  const [checklist, setChecklist] = useState<any>(null)
  const [vehicleId, setVehicleId] = useState<string>('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [labels, setLabels] = useState<OrgLabels>(DEFAULT_LABELS)
  const [employees, setEmployees] = useState<{id: string, name: string, onShift?: boolean}[]>([])
  const [partnerName, setPartnerName] = useState<string>('none')
  const [crewLastName, setCrewLastName] = useState('')
  const [greeting, setGreeting] = useState<string | null>(null)
  const [onShiftSince, setOnShiftSince] = useState<Date | null>(null)
  const [elapsedTime, setElapsedTime] = useState('')
  const [welcomeGreeting, setWelcomeGreeting] = useState<string | null>(null)
  const signatureRef = useRef<SignaturePadRef>(null)
  const formStartTime = useRef(Date.now()) // Track how long the form takes

  // Shift Issue Reporting State
  const [isReportingIssue, setIsReportingIssue] = useState(false)
  const [issueCategories, setIssueCategories] = useState<string[]>([])
  const [issueDescription, setIssueDescription] = useState('')
  const [issuePhotos, setIssuePhotos] = useState<File[]>([])
  const [shiftIssueCategories, setShiftIssueCategories] = useState<string[]>([])
  const [issueFuelLevel, setIssueFuelLevel] = useState<string | null>(null)

  // Missing Items Alert State
  const [missingItemsAlert, setMissingItemsAlert] = useState<{ items: string[], rigNumber: string, vehicleId: string } | null>(null)

  // O2 Tracking for warnings
  const [mainO2, setMainO2] = useState<string>('')
  const [portableO2, setPortableO2] = useState<string>('')

  // Present/Missing state per item: Record<itemId, 'present'|'missing'|null>
  const [itemStatuses, setItemStatuses] = useState<Record<string, ItemStatus>>({})

  // Expandable sub-items in checklist
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Inventory
  const [inventoryEnabled, setInventoryEnabled] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [takenItems, setTakenItems] = useState<Record<string, number>>({})
  const [inventoryConfirmed, setInventoryConfirmed] = useState(false)

  useEffect(() => {
    async function loadData() {
      formStartTime.current = Date.now() // Reset timer on page load
      const [dbVehicles, initialData] = await Promise.all([
        getVehicles(),
        getInitialRigCheckData(),
      ])
      setVehicles(dbVehicles)
      setLabels(initialData.orgLabels)
      setEmployees(initialData.employees || [])
      setShiftIssueCategories(initialData.shiftIssueCategories || [])
      setInventoryEnabled(initialData.inventoryEnabled || false)
      setInventoryItems(initialData.inventoryItems || [])

      if (initialData.currentUser) {
        setCrewLastName(initialData.currentUser)
      }

      // If the user is already on shift → send them to the persistent shift screen
      if (initialData.activeShift) {
        router.push('/rig-check/on-shift')
        return
      }

      // If the user has a pending approval → send them to the pending screen
      if ((initialData as any).pendingApproval) {
        router.push('/rig-check/pending-approval')
        return
      }

      setSuccess(false)
      fetchWelcomeGreeting().then(res => {
        if (res) setWelcomeGreeting(res)
      }).catch(err => console.error(err))
    }
    loadData()
  }, [])

  // Elapsed timer for on-shift screen
  useEffect(() => {
    if (!onShiftSince) return
    const tick = () => {
      const diffMs = Date.now() - onShiftSince.getTime()
      const h = Math.floor(diffMs / 3600000)
      const m = Math.floor((diffMs % 3600000) / 60000)
      const s = Math.floor((diffMs % 60000) / 1000)
      setElapsedTime(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [onShiftSince])

  // Use hierarchical categories directly from checklist
  const checklistCategories: ChecklistCategory[] = checklist?.questions || []
  const totalCheckItems = countAllItems(checklistCategories)

  // Expand all sub-item groups by default when checklist loads
  useEffect(() => {
    if (checklist?.questions) {
      const allExpandableIds = new Set<string>()
      checklist.questions.forEach((cat: ChecklistCategory) => {
        cat.items.forEach(item => {
          if (item.subItems.length > 0) allExpandableIds.add(item.id)
        })
      })
      setExpandedItems(allExpandableIds)
    }
  }, [checklist])

  function setItemStatus(itemId: string, status: ItemStatus) {
    setItemStatuses(prev => ({ ...prev, [itemId]: status }))
  }

  function markCategoryAll(cat: ChecklistCategory, status: 'present' | 'missing') {
    setItemStatuses(prev => {
      const next = { ...prev }
      cat.items.forEach(item => {
        if (item.subItems.length > 0) {
          item.subItems.forEach(sub => { next[sub.id] = status })
        } else {
          next[item.id] = status
        }
      })
      return next
    })
  }

  const missingLabels = collectMissingLabels(checklistCategories, itemStatuses)

  // Count answered items (items without sub-items + all sub-items)
  const answeredCount = (() => {
    let count = 0
    for (const cat of checklistCategories) {
      for (const item of cat.items) {
        if (item.subItems.length > 0) {
          for (const sub of item.subItems) {
            if (itemStatuses[sub.id] != null) count++
          }
        } else {
          if (itemStatuses[item.id] != null) count++
        }
      }
    }
    return count
  })()

  const allAnswered = totalCheckItems > 0 ? answeredCount >= totalCheckItems : true

  async function handleVehicleChange(newVehicleId: string) {
    setVehicleId(newVehicleId)
    setItemStatuses({}) // reset statuses when vehicle changes
    const vehicle = vehicles.find((v: any) => v.id === newVehicleId)
    if (!vehicle) return

    // Load the checklist for this vehicle (vehicle-specific or global fallback)
    try {
      const cl = await getChecklistForVehicle(newVehicleId)
      setChecklist(cl)
    } catch {
      // keep whatever was loaded before
    }

    // Fetch missing items from the last rig check for this vehicle
    try {
      const result = await getShiftMissingItems(newVehicleId)
      if (result.missingItems && result.missingItems.length > 0) {
        setMissingItemsAlert({ items: result.missingItems, rigNumber: vehicle.rig_number, vehicleId: newVehicleId })
      }
    } catch {
      // Silently ignore — non-critical
    }
  }

  async function handleMissingItemsConfirmed(stillMissingItems: string[]) {
    setMissingItemsAlert(null)
    // Pre-mark still-missing items as 'missing' in the checklist
    if (stillMissingItems.length > 0) {
      setItemStatuses(prev => {
        const next = { ...prev }
        stillMissingItems.forEach(item => { next[item] = 'missing' })
        return next
      })
      // Notify manager
      const vehicle = vehicles.find((v: any) => v.id === missingItemsAlert?.vehicleId)
      if (vehicle) {
        try {
          await reportStillMissingItems(vehicle.id, stillMissingItems, vehicle.rig_number)
        } catch {
          // Non-critical
        }
      }
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (totalCheckItems > 0 && !allAnswered) {
      setSubmitError('Please mark every item as Present or Missing before submitting.')
      return
    }

    if (!vehicleId) {
      setSubmitError('Please select a vehicle.')
      return
    }

    if (inventoryEnabled && !inventoryConfirmed) {
      setSubmitError('Please confirm the warehouse supplies you took, or tap "I didn\'t take anything".')
      return
    }

    if (!crewLastName.trim()) {
      setSubmitError('Please enter your last name.')
      return
    }

    if (signatureRef.current?.isEmpty()) {
      setSubmitError('Please sign the form before submitting.')
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
    if (totalCheckItems > 0) {
      formData.append('item_statuses', JSON.stringify(itemStatuses))
      formData.append('missing_items', JSON.stringify(missingLabels))
    }

    // Append crew identity + signature + partner
    formData.append('crew_last_name', crewLastName.trim())
    formData.append('partner_name', partnerName)
    formData.append('signature_data_url', signatureRef.current?.toDataURL() || '')

    // Duration tracking: how long did this form take?
    const durationSeconds = Math.round((Date.now() - formStartTime.current) / 1000)
    formData.append('check_duration_seconds', String(durationSeconds))

    try {
      setSubmitError(null)

      // Submit inventory first if taking items
      if (inventoryEnabled && Object.keys(takenItems).length > 0) {
        const itemsToTake = Object.entries(takenItems)
          .map(([itemId, quantity]) => ({ itemId, quantity }))
          .filter(i => i.quantity > 0)
        
        if (itemsToTake.length > 0) {
          try {
            await takeInventoryItems(itemsToTake, 'start_of_shift', vehicleId)
          } catch (invErr) {
            console.error('Inventory error:', invErr) // don't block main shift creation
          }
        }
      }

      const result = await submitRigCheck(formData)
      
      // If rig check succeeded AND user reported a shift issue, submit the issue
      if (result.success && isReportingIssue && issueCategories.length > 0) {
        const issueFormData = new FormData()
        issueFormData.append('vehicle_id', vehicleId)
        issueFormData.append('issue_category', issueCategories.join(', '))
        issueFormData.append('reporter_name', crewLastName.trim())
        if (issueDescription) issueFormData.append('issue_description', issueDescription)
        issuePhotos.forEach((photo, i) => {
          issueFormData.append(`issue_photo_${i}`, photo, photo.name)
        })
        issueFormData.append('issue_photo_count', String(issuePhotos.length))
        if (issueFuelLevel) issueFormData.append('issue_fuel_level', issueFuelLevel)
        
        try {
          await submitShiftIssue(issueFormData)
        } catch (issueErr) {
          console.error('Failed to submit shift issue:', issueErr)
          // We don't block the main flow, but we log the error
        }
      }

      if ((result as any)?.pendingApproval) {
        // RED vehicle — waiting for manager approval
        router.push('/rig-check/pending-approval')
      } else {
        const greetingText = (result as any)?.greeting
        // Store greeting in sessionStorage so it can be shown on the on-shift page
        if (greetingText) {
          sessionStorage.setItem('shiftGreeting', greetingText)
        }
        // Redirect to the dedicated persistent on-shift page
        router.push('/rig-check/on-shift')
      }
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

  function handleIssuePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setIssuePhotos(prev => [...prev, ...Array.from(e.target.files!)])
      // Reset input so same file can be re-selected
      e.target.value = ''
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
          {welcomeGreeting ? (
            <CardTitle className="text-2xl font-extrabold text-center text-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-700">{welcomeGreeting}</CardTitle>
          ) : (
            <CardTitle className="text-3xl font-extrabold text-center text-slate-900">{labels.inspection}</CardTitle>
          )}
          <CardDescription className="text-center text-slate-500 font-medium text-base">{labels.shiftStart} vehicle inspection form</CardDescription>
        </CardHeader>
        <CardContent className="bg-slate-50 pt-6">
          {/* On-shift screen shown INSTEAD of form after successful submit */}
          {success ? (
            <div className="space-y-4 py-4">
              {greeting && (
                <ShiftGreetingModal greeting={greeting} onClose={() => setGreeting(null)} />
              )}
              {/* On-shift status card */}
              <div className="rounded-2xl overflow-hidden border-0 shadow-lg">
                <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #1d4ed8)', padding: '24px 20px 20px', position: 'relative' }}>
                  
                  {/* Vehicle Number Badge - Top Right */}
                  <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-full tracking-widest shadow-sm">
                    {vehicles.find((v: any) => v.id === vehicleId)?.rig_number || 'Vehicle'}
                  </div>

                  <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">YOU ARE ON SHIFT</p>
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-blue-300" />
                    <span className="text-4xl font-extrabold text-white font-mono tracking-widest">{elapsedTime}</span>
                  </div>
                  
                  {/* Crew Names prominently under the timer */}
                  <p className="text-blue-100 text-sm mt-3 font-semibold uppercase tracking-wide opacity-90">
                    <span className="opacity-75">CREW:</span> {partnerName && partnerName !== 'none' ? `${crewLastName} & ${partnerName}` : crewLastName || 'Crew'}
                  </p>
                </div>
                <div className="bg-white p-4 space-y-3">
                  <div className="p-3 bg-emerald-50 rounded-xl flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-semibold">Start of Shift report submitted</span>
                  </div>
                  {missingLabels.length > 0 && (
                    <div className="p-3 bg-rose-50 rounded-xl text-xs text-rose-700 font-medium">
                      ⚠️ {missingLabels.length} missing item{missingLabels.length > 1 ? 's' : ''} flagged to dispatcher
                    </div>
                  )}
                  <Link href="/rig-check/end-of-shift">
                    <div className="flex items-center justify-between p-4 rounded-xl cursor-pointer active:scale-98 transition-all"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 16px rgba(245,158,11,0.35)' }}>
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
          ) : (
            <>
          {/* Missing Items Alert Modal */}
          {missingItemsAlert && (
            <MissingItemsAlert
              items={missingItemsAlert.items}
              rigNumber={missingItemsAlert.rigNumber}
              onConfirmed={handleMissingItemsConfirmed}
            />
          )}

          {submitError && (
            <div className="mb-4 p-4 bg-rose-100 border border-rose-200 rounded-xl text-rose-800">
              <p className="font-semibold text-sm">⚠️ {submitError}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="vehicle_id" className="text-slate-700 font-bold text-sm uppercase tracking-wide">Select {labels.vehicle}</Label>
              <Select onValueChange={handleVehicleChange} required>
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
                value={mainO2}
                onChange={(e) => setMainO2(e.target.value)}
                onInput={(e) => { const v = parseInt((e.target as HTMLInputElement).value); if (v < 0) (e.target as HTMLInputElement).value = '0'; if (v > 2500) (e.target as HTMLInputElement).value = '2500' }} />
              {mainO2 && parseInt(mainO2) < 500 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 text-sm font-semibold rounded-lg border border-amber-200 mt-2 animate-in fade-in zoom-in duration-300">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
                  <p>Warning: Main O2 level is critically low. Manager will be notified.</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="portable_oxygen_psi" className="text-slate-700 font-bold text-sm uppercase tracking-wide">Portable Oxygen (PSI)</Label>
              <Input id="portable_oxygen_psi" name="portable_oxygen_psi" type="number" required min="0" max="2500"
                placeholder="e.g. 2000" className="h-14 tracking-wider text-xl font-medium bg-white border-slate-300 shadow-sm"
                value={portableO2}
                onChange={(e) => setPortableO2(e.target.value)}
                onInput={(e) => { const v = parseInt((e.target as HTMLInputElement).value); if (v < 0) (e.target as HTMLInputElement).value = '0'; if (v > 2500) (e.target as HTMLInputElement).value = '2500' }} />
              {portableO2 && parseInt(portableO2) < 1000 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 text-sm font-semibold rounded-lg border border-amber-200 mt-2 animate-in fade-in zoom-in duration-300">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
                  <p>Warning: Portable O2 level is critically low. Manager will be notified.</p>
                </div>
              )}
            </div>

            {/* Dynamic Checklist — Hierarchical */}
            {checklist && checklistCategories.length > 0 && (
              <div className="space-y-5 pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-md">
                    <ShieldAlert className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">{checklist.title}</h3>
                </div>

                <input type="hidden" name="checklist_id" value={checklist.id} />

                <div className="space-y-4">
                  {checklistCategories.map((cat: ChecklistCategory) => (
                    <div key={cat.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                      {/* Category header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <h4 className="font-bold text-slate-700 text-sm">{cat.category}</h4>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => markCategoryAll(cat, 'present')}
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                          >
                            <CheckCheck className="w-3.5 h-3.5" /> All Present
                          </button>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="divide-y divide-slate-100">
                        {cat.items.map(item => {
                          const hasSubItems = item.subItems.length > 0
                          // If has sub-items: parent is "missing" if any sub is missing
                          const parentStatus = hasSubItems
                            ? item.subItems.some(s => itemStatuses[s.id] === 'missing')
                              ? 'missing'
                              : item.subItems.every(s => itemStatuses[s.id] === 'present')
                                ? 'present'
                                : null
                            : itemStatuses[item.id] ?? null

                          return (
                            <div key={item.id}>
                              {/* Item row */}
                              <div className="flex items-center justify-between gap-3 px-4 py-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {hasSubItems && (
                                    <button type="button" onClick={() => {
                                      setExpandedItems(prev => {
                                        const next = new Set(prev)
                                        next.has(item.id) ? next.delete(item.id) : next.add(item.id)
                                        return next
                                      })
                                    }} className="p-0.5 shrink-0">
                                      {expandedItems.has(item.id) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                    </button>
                                  )}
                                  <span className={`text-sm font-medium leading-snug ${
                                    parentStatus === 'missing' ? 'text-rose-600' : parentStatus === 'present' ? 'text-slate-700' : 'text-slate-600'
                                  }`}>
                                    {item.label}
                                    {hasSubItems && <span className="text-xs text-slate-400 ml-1.5">({item.subItems.length})</span>}
                                  </span>
                                </div>

                                {/* Same compact toggle buttons for ALL leaf items (no sub-items) */}
                                {!hasSubItems && (
                                  <div className="flex gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setItemStatus(item.id, 'present')}
                                      className={`w-9 h-9 rounded-xl text-sm font-bold transition-all border flex items-center justify-center ${
                                        parentStatus === 'present'
                                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                                          : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-400 hover:text-emerald-600'
                                      }`}
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setItemStatus(item.id, 'missing')}
                                      className={`w-9 h-9 rounded-xl text-sm font-bold transition-all border flex items-center justify-center ${
                                        parentStatus === 'missing'
                                          ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                                          : 'bg-white text-slate-400 border-slate-200 hover:border-rose-400 hover:text-rose-600'
                                      }`}
                                    >
                                      ✗
                                    </button>
                                  </div>
                                )}

                                {/* For items WITH sub-items, show summary badge */}
                                {hasSubItems && (
                                  <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                    parentStatus === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                    parentStatus === 'missing' ? 'bg-rose-100 text-rose-700' :
                                    'bg-slate-100 text-slate-400'
                                  }`}>
                                    {parentStatus === 'present' ? '✓ All OK' : parentStatus === 'missing' ? '✗ Issues' : expandedItems.has(item.id) ? 'Collapse ▾' : 'Expand ▸'}
                                  </div>
                                )}
                              </div>

                              {/* Sub-items (expandable) */}
                              {hasSubItems && expandedItems.has(item.id) && (
                                <div className="bg-slate-50/50 border-t border-slate-100 divide-y divide-slate-100">
                                  {item.subItems.map(sub => {
                                    const subStatus = itemStatuses[sub.id] ?? null
                                    return (
                                      <div key={sub.id} className="flex items-center justify-between gap-3 pl-10 pr-4 py-2.5">
                                        <span className={`text-xs font-medium leading-snug flex-1 ${
                                          subStatus === 'missing' ? 'text-rose-600' : subStatus === 'present' ? 'text-slate-600' : 'text-slate-500'
                                        }`}>
                                          {sub.label}
                                        </span>
                                        <div className="flex gap-1.5 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => setItemStatus(sub.id, 'present')}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                              subStatus === 'present'
                                                ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                                                : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-400 hover:text-emerald-600'
                                            }`}
                                          >
                                            ✓
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setItemStatus(sub.id, 'missing')}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                              subStatus === 'missing'
                                                ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                                                : 'bg-white text-slate-500 border-slate-200 hover:border-rose-400 hover:text-rose-600'
                                            }`}
                                          >
                                            ✗
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Progress indicator */}
                  {totalCheckItems > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${(answeredCount / totalCheckItems) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                        {answeredCount}/{totalCheckItems} answered
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Inventory / Items Taken */}
            {inventoryEnabled && inventoryItems.length > 0 && (
              <div className="space-y-3 pt-6 border-t border-slate-200">
                {/* Section header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-fuchsia-100 rounded-xl text-base">📦</span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-800 leading-tight">Warehouse Supplies</h3>
                      <p className="text-xs text-slate-400 leading-tight">Did you take any supplies from the warehouse?</p>
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

            {/* ======== REPORT PREVIOUS SHIFT ISSUE ======== */}
            <div className="space-y-4 pt-6 border-t-2 border-dashed border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-violet-500" />
                    Report Previous Shift Issue
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Leftover mess or missing critical items from last crew?</p>
                </div>
                <Button
                  type="button"
                  variant={isReportingIssue ? "default" : "outline"}
                  className={`shrink-0 rounded-full font-bold shadow-sm transition-all ${
                    isReportingIssue ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => setIsReportingIssue(!isReportingIssue)}
                >
                  {isReportingIssue ? 'Cancel Report' : 'Report Issue'}
                </Button>
              </div>

              {isReportingIssue && (
                <div className="space-y-5 p-5 bg-violet-50 border border-violet-200 rounded-2xl animate-in slide-in-from-top-2 fade-in duration-300">
                  
                  <div className="space-y-3">
                    <Label className="text-violet-900 font-bold text-sm uppercase tracking-wide">Categories <span className="text-rose-500">*</span> <span className="text-xs text-violet-500/70 normal-case tracking-normal font-medium ml-1">(select all that apply)</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {shiftIssueCategories.map(cat => {
                        const isSelected = issueCategories.includes(cat)
                        const label = cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setIssueCategories(prev => 
                              isSelected ? prev.filter(c => c !== cat) : [...prev, cat]
                            )}
                            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all border ${
                              isSelected
                                ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700'
                            }`}
                          >
                            {isSelected && '✓ '}{label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Label className="text-violet-900 font-bold text-sm uppercase tracking-wide flex items-center justify-between">
                       <span>⛽ Fuel Level Left</span>
                       <span className="font-normal text-violet-500/70 normal-case text-xs tracking-normal">(optional)</span>
                    </Label>
                    
                    <div className="grid grid-cols-5 gap-1.5 p-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                      {[
                        { value: 'empty',         label: 'Empty',  segs: 0, color: 'bg-rose-400' },
                        { value: 'quarter',       label: '¼',      segs: 1, color: 'bg-orange-400' },
                        { value: 'half',          label: '½',      segs: 2, color: 'bg-amber-400' },
                        { value: 'three_quarter', label: '¾',      segs: 3, color: 'bg-lime-500' },
                        { value: 'full',          label: 'Full',   segs: 4, color: 'bg-emerald-500' },
                      ].map((f) => {
                        const isSelected = issueFuelLevel === f.value
                        return (
                          <button
                            key={f.value}
                            type="button"
                            onClick={() => setIssueFuelLevel(f.value === issueFuelLevel ? null : f.value)}
                            className={`flex flex-col items-center justify-center gap-2 py-3 px-1.5 rounded-lg transition-all ${
                              isSelected
                                ? 'bg-violet-50 ring-2 ring-violet-400 shadow-sm'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            {/* Mini fuel gauge: 4 segments */}
                            <div className="flex gap-0.5 items-end h-5">
                              {[1, 2, 3, 4].map(seg => (
                                <div
                                  key={seg}
                                  className={`w-2.5 rounded-sm transition-all ${
                                    seg <= f.segs
                                      ? isSelected ? f.color : 'bg-slate-300'
                                      : 'bg-slate-100 border border-slate-200'
                                  }`}
                                  style={{ height: `${10 + seg * 3}px` }}
                                />
                              ))}
                            </div>
                            <span className={`text-[11px] font-bold leading-tight text-center ${
                              isSelected ? 'text-violet-800' : 'text-slate-500'
                            }`}>
                              {f.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="issue_description" className="text-violet-900 font-bold text-sm uppercase tracking-wide">Description</Label>
                    <textarea 
                      id="issue_description" 
                      value={issueDescription}
                      onChange={(e) => setIssueDescription(e.target.value)}
                      className="flex w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-base shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 min-h-[80px] resize-y"
                      placeholder="What exactly was left behind or missing?..." 
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-violet-900 font-bold text-sm uppercase tracking-wide">Photo Evidence <span className="text-xs text-slate-400 normal-case tracking-normal font-medium ml-1">(add as many as needed)</span></Label>
                    
                    {/* List of attached photos */}
                    {issuePhotos.length > 0 && (
                      <div className="space-y-2">
                        {issuePhotos.map((photo, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 bg-white border border-violet-200 rounded-xl">
                            <div className="flex items-center gap-3 truncate">
                              <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                                <img src={URL.createObjectURL(photo)} alt="" className="w-full h-full object-cover" />
                              </div>
                              <span className="font-medium text-violet-900 truncate text-sm">Photo {i + 1}</span>
                              <span className="text-xs text-slate-400">{(photo.size / 1024).toFixed(0)} KB</span>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="text-violet-500 hover:text-violet-700 hover:bg-violet-100 shrink-0"
                              onClick={() => setIssuePhotos(prev => prev.filter((_, j) => j !== i))}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add photo button */}
                    <label className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border-2 border-dashed border-violet-300 bg-white text-violet-600 font-bold cursor-pointer hover:bg-violet-100 transition-colors">
                      <Camera className="w-5 h-5" />
                      <span>{issuePhotos.length === 0 ? 'Take Photo' : '+ Add More Photos'}</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleIssuePhotoChange} />
                    </label>
                  </div>

                </div>
              )}
            </div>
            {/* =========================================== */}

            {/* Missing items warning before submit */}
            {missingLabels.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <p className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-2">⚠️ Missing items — dispatcher will be notified:</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingLabels.map(item => (
                    <span key={item} className="text-xs bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded-full">{item}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Crew Identity */}
            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="crew_last_name" className="text-slate-700 font-bold text-sm uppercase tracking-wide">Your Name <span className="text-rose-500">*</span></Label>
                <Input 
                  id="crew_last_name"
                  value={crewLastName}
                  onChange={e => setCrewLastName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="h-14 text-lg font-medium bg-slate-50 border-slate-300 shadow-sm text-slate-500"
                  required
                  readOnly
                />
                <p className="text-xs text-slate-500">Auto-filled from your logged in account.</p>
              </div>

              {employees.length > 0 && (
                <div className="space-y-3">
                  <Label htmlFor="partner" className="text-slate-700 font-bold text-sm uppercase tracking-wide">Partner (Optional)</Label>
                  <Select onValueChange={(val) => {
                    if (val === 'none') { setPartnerName(''); return }
                    const emp = employees.find(e => e.id === val)
                    setPartnerName(emp?.name || '')
                  }} value={employees.find(e => e.name === partnerName)?.id || (partnerName ? '' : '')}>
                    <SelectTrigger id="partner" className="w-full h-14 text-lg bg-white border-slate-300 shadow-sm focus:ring-2 focus:ring-blue-500">
                      <SelectValue placeholder="Select partner..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-slate-500 italic">No partner (Working solo)</SelectItem>
                      {employees.map(emp => (
                        <SelectItem 
                          key={emp.id} 
                          value={emp.id} 
                          disabled={emp.onShift} 
                          className={`py-2 ${emp.onShift ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {emp.name}{emp.onShift ? ' (On Shift)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* E-Signature */}
            <SignaturePad ref={signatureRef} label="Signature" required />

            <Button
              type="submit"
              disabled={isSubmitting || (totalCheckItems > 0 && !allAnswered)}
              className="w-full h-16 text-xl font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : `Submit ${labels.inspection}`}
            </Button>

            {totalCheckItems > 0 && !allAnswered && (
              <p className="text-center text-xs text-slate-400 font-medium">
                Mark all items Present or Missing to enable submit
              </p>
            )}

            <p className="text-center text-xs text-slate-400 font-medium uppercase tracking-widest mt-4">
              FleetGuard — Powered by Smart Rig Check
            </p>
          </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
