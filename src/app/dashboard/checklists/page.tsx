'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AiInput } from '@/components/ui/ai-input'
import { createChecklist, updateChecklist, deleteChecklist, toggleChecklist, getOrgChecklists, getVehicles } from '../../actions'
import {
  CheckCircle2, Plus, Trash2, ArrowLeft, Wand2, ListChecks, ChevronDown, ChevronRight,
  Pencil, Copy, Power, MoreVertical, Truck, Globe, GripVertical, X, Layers3, Package
} from 'lucide-react'
import { INDUSTRY_PRESETS, genId, countAllItems, type OrgType, type ChecklistCategory, type ChecklistItem, type ChecklistSubItem } from '@/lib/presets'

// ── Types ────────────────────────────────────────────────────────────

type View = 'list' | 'builder'
type StartMode = 'blank' | 'preset'

interface OrgChecklist {
  id: string
  title: string
  description: string | null
  type: string
  is_active: boolean
  vehicle_ids: string[] | null
  questions: any
  created_at: string
}

// ── Main Component ───────────────────────────────────────────────────

export default function ChecklistsPage() {
  const [view, setView] = useState<View>('list')
  const [checklists, setChecklists] = useState<OrgChecklist[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Builder state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categories, setCategories] = useState<ChecklistCategory[]>([])
  const [assignMode, setAssignMode] = useState<'all' | 'specific'>('all')
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([])
  const [restockItems, setRestockItems] = useState<string[]>([])
  const [newRestockItem, setNewRestockItem] = useState('')

  // UI state
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [newItemInput, setNewItemInput] = useState<Record<string, string>>({})
  const [newSubItemInput, setNewSubItemInput] = useState<Record<string, string>>({})
  const [newCatName, setNewCatName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [editingLabelValue, setEditingLabelValue] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [cl, v] = await Promise.all([getOrgChecklists(), getVehicles()])
    setChecklists(cl as any)
    setVehicles(v)
    setLoading(false)
  }

  // ── Builder helpers ──────────────────────────────────────────────

  function startBlank() {
    resetBuilder()
    setView('builder')
  }

  function startFromPreset(orgType: OrgType) {
    resetBuilder()
    const preset = INDUSTRY_PRESETS[orgType]
    setTitle(`${preset.label} — Start of Shift Check`)
    setCategories(JSON.parse(JSON.stringify(preset.categories))) // deep clone
    setRestockItems([...preset.endOfShiftRestockItems])
    // Expand all categories by default
    const ids = new Set(preset.categories.map(c => c.id))
    setExpandedCats(ids)
    setView('builder')
  }

  function editChecklist(cl: OrgChecklist) {
    resetBuilder()
    setEditingId(cl.id)
    setTitle(cl.title)
    setDescription(cl.description || '')
    // Normalize questions to ChecklistCategory[]
    const cats: ChecklistCategory[] = Array.isArray(cl.questions) && cl.questions.length > 0 && typeof cl.questions[0] === 'object' && 'category' in cl.questions[0]
      ? cl.questions
      : []
    setCategories(JSON.parse(JSON.stringify(cats)))
    setExpandedCats(new Set(cats.map((c: any) => c.id)))
    setAssignMode(cl.vehicle_ids ? 'specific' : 'all')
    setSelectedVehicleIds(cl.vehicle_ids || [])
    setRestockItems(Array.isArray((cl as any).restock_items) ? (cl as any).restock_items : [])
    setView('builder')
  }

  function cloneChecklist(cl: OrgChecklist) {
    editChecklist({ ...cl, id: '' })
    setEditingId(null)
    setTitle(`${cl.title} (Copy)`)
  }

  function resetBuilder() {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setCategories([])
    setAssignMode('all')
    setSelectedVehicleIds([])
    setExpandedCats(new Set())
    setExpandedItems(new Set())
    setNewItemInput({})
    setNewSubItemInput({})
    setNewCatName('')
    setRestockItems([])
    setNewRestockItem('')
    setError(null)
  }

  // Category
  function addCategory() {
    const name = newCatName.trim() || `Section ${categories.length + 1}`
    const id = genId('cat')
    setCategories([...categories, { id, category: name, items: [] }])
    setExpandedCats(prev => new Set([...prev, id]))
    setNewCatName('')
  }

  function removeCategory(catId: string) {
    setCategories(categories.filter(c => c.id !== catId))
  }

  function renameCategory(catId: string, newName: string) {
    setCategories(categories.map(c => c.id === catId ? { ...c, category: newName } : c))
  }

  // Items
  function addItem(catId: string) {
    const label = (newItemInput[catId] || '').trim()
    if (!label) return
    setCategories(categories.map(c => {
      if (c.id !== catId) return c
      return { ...c, items: [...c.items, { id: genId('item'), label, subItems: [] }] }
    }))
    setNewItemInput({ ...newItemInput, [catId]: '' })
  }

  function removeItem(catId: string, itemId: string) {
    setCategories(categories.map(c => {
      if (c.id !== catId) return c
      return { ...c, items: c.items.filter(i => i.id !== itemId) }
    }))
  }

  function renameItem(catId: string, itemId: string, newLabel: string) {
    setCategories(categories.map(c => {
      if (c.id !== catId) return c
      return { ...c, items: c.items.map(i => i.id === itemId ? { ...i, label: newLabel } : i) }
    }))
  }

  // Sub-items
  function addSubItem(catId: string, itemId: string) {
    const key = `${catId}-${itemId}`
    const label = (newSubItemInput[key] || '').trim()
    if (!label) return
    setCategories(categories.map(c => {
      if (c.id !== catId) return c
      return {
        ...c, items: c.items.map(i => {
          if (i.id !== itemId) return i
          return { ...i, subItems: [...i.subItems, { id: genId('sub'), label }] }
        })
      }
    }))
    setNewSubItemInput({ ...newSubItemInput, [key]: '' })
  }

  function removeSubItem(catId: string, itemId: string, subId: string) {
    setCategories(categories.map(c => {
      if (c.id !== catId) return c
      return {
        ...c, items: c.items.map(i => {
          if (i.id !== itemId) return i
          return { ...i, subItems: i.subItems.filter(s => s.id !== subId) }
        })
      }
    }))
  }

  // Toggle helpers
  function toggleCat(id: string) {
    setExpandedCats(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleItem(id: string) {
    setExpandedItems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Inline edit
  function startEditLabel(id: string, currentLabel: string) {
    setEditingLabel(id)
    setEditingLabelValue(currentLabel)
  }

  function commitEditLabel(catId: string, itemId?: string) {
    if (itemId) {
      renameItem(catId, itemId, editingLabelValue)
    } else {
      renameCategory(catId, editingLabelValue)
    }
    setEditingLabel(null)
    setEditingLabelValue('')
  }

  // Vehicle toggle
  function toggleVehicle(id: string) {
    setSelectedVehicleIds(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    )
  }

  // ── Submit ─────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!title.trim()) { setError('Please enter a checklist name.'); return }
    if (categories.length === 0) { setError('Please add at least one section.'); return }
    const totalItems = countAllItems(categories)
    if (totalItems === 0) { setError('Please add at least one item.'); return }

    setIsSubmitting(true)
    setError(null)

    const vehicleIds = assignMode === 'specific' && selectedVehicleIds.length > 0
      ? selectedVehicleIds
      : null

    try {
      let res: any
      if (editingId) {
        res = await updateChecklist(editingId, title, categories, vehicleIds, description, restockItems)
      } else {
        res = await createChecklist(title, categories, vehicleIds, description, restockItems)
      }
      if (res.error) throw new Error(res.error)

      setSuccess(true)
      setView('list')
      resetBuilder()
      await loadData()
      setTimeout(() => setSuccess(false), 4000)
    } catch (err: any) {
      setError(err?.message || 'An error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Delete / Toggle ────────────────────────────────────────────────

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (pendingDeleteId !== id) {
      // First click — show confirmation
      setPendingDeleteId(id)
      // Auto-clear after 3s if they don't confirm
      setTimeout(() => setPendingDeleteId(prev => prev === id ? null : prev), 3000)
      return
    }
    // Second click — actually delete
    setPendingDeleteId(null)
    await deleteChecklist(id)
    await loadData()
  }

  async function handleToggle(id: string, current: boolean) {
    await toggleChecklist(id, !current)
    await loadData()
  }

  // ── Render ─────────────────────────────────────────────────────────

  const totalItems = countAllItems(categories)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400 font-semibold">Loading checklists...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
              Checklist <span className="text-blue-600">Manager</span>
            </h1>
            <p className="text-slate-500 mt-2">Create, edit, and manage inspection checklists for your fleet.</p>
          </div>
          {view === 'list' && (
            <Button onClick={startBlank} className="bg-blue-600 hover:bg-blue-700 h-12 px-6 font-bold text-base gap-2">
              <Plus className="w-5 h-5" /> New Checklist
            </Button>
          )}
        </div>

        {/* Success toast */}
        {success && (
          <div className="p-4 bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 animate-in fade-in slide-in-from-top-4 duration-500">
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
            <p className="font-semibold">Checklist saved successfully!</p>
          </div>
        )}

        {error && view === 'list' && (
          <div className="p-4 bg-rose-100 border border-rose-200 rounded-xl text-rose-800">
            <p className="font-semibold text-sm">{error}</p>
          </div>
        )}

        {/* ─── LIST VIEW ──────────────────────────────────────────── */}
        {view === 'list' && (
          <div className="space-y-6">

            {/* Quick-start from presets */}
            <div>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Start from Template</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {Object.values(INDUSTRY_PRESETS).filter(p => p.id !== 'custom').map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => startFromPreset(preset.id)}
                    className="p-4 border-2 border-slate-200 rounded-xl flex flex-col items-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-all text-center group"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform">{preset.icon}</span>
                    <span className="text-xs font-bold text-slate-600 group-hover:text-blue-700">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Existing checklists */}
            <div>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Your Checklists</h2>
              {checklists.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                  <Layers3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">No checklists yet</p>
                  <p className="text-sm text-slate-400 mt-1">Create your first checklist above or start from a template.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {checklists.map(cl => {
                    const itemCount = Array.isArray(cl.questions) && cl.questions.length > 0 && typeof cl.questions[0] === 'object' && 'items' in cl.questions[0]
                      ? countAllItems(cl.questions)
                      : Array.isArray(cl.questions) ? cl.questions.length : 0
                    const catCount = Array.isArray(cl.questions) && cl.questions.length > 0 && typeof cl.questions[0] === 'object' && 'category' in cl.questions[0]
                      ? cl.questions.length : 0

                    return (
                      <div key={cl.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${cl.is_active ? 'border-blue-200 shadow-md' : 'border-slate-200 opacity-70'}`}>
                        <div className="flex items-center justify-between px-5 py-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className={`w-3 h-3 rounded-full shrink-0 ${cl.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <div className="min-w-0">
                              <h3 className="font-bold text-slate-800 truncate">{cl.title}</h3>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                {catCount > 0 && <span>{catCount} sections</span>}
                                <span>{itemCount} items</span>
                                <span className="flex items-center gap-1">
                                  {cl.vehicle_ids ? (
                                    <><Truck className="w-3 h-3" /> {cl.vehicle_ids.length} vehicle{cl.vehicle_ids.length > 1 ? 's' : ''}</>
                                  ) : (
                                    <><Globe className="w-3 h-3" /> All vehicles</>
                                  )}
                                </span>
                                <span>{cl.is_active ? '● Active' : '○ Inactive'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => editChecklist(cl)} title="Edit">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => cloneChecklist(cl)} title="Clone">
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className={`h-8 w-8 ${cl.is_active ? 'text-emerald-500 hover:text-amber-600' : 'text-slate-400 hover:text-emerald-600'}`} onClick={() => handleToggle(cl.id, cl.is_active)} title={cl.is_active ? 'Deactivate' : 'Activate'}>
                              <Power className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size={pendingDeleteId === cl.id ? 'sm' : 'icon'}
                              className={`h-8 ${pendingDeleteId === cl.id ? 'px-2 bg-rose-100 text-rose-600 hover:bg-rose-200 font-bold text-xs animate-pulse' : 'w-8 text-slate-400 hover:text-rose-600'}`}
                              onClick={() => handleDelete(cl.id)}
                              title="Delete"
                            >
                              {pendingDeleteId === cl.id ? 'Delete?' : <Trash2 className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── BUILDER VIEW ───────────────────────────────────────── */}
        {view === 'builder' && (
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={() => { setView('list'); resetBuilder() }}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Checklists
            </button>

            {error && (
              <div className="p-4 bg-rose-100 border border-rose-200 rounded-xl text-rose-800">
                <p className="font-semibold text-sm">{error}</p>
              </div>
            )}

            {/* Title + Description */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <div className="bg-blue-600 h-2 w-full" />
              <CardHeader>
                <CardTitle>{editingId ? 'Edit Checklist' : 'New Checklist'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cl-title" className="font-bold">Checklist Name *</Label>
                  <Input
                    id="cl-title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Morning BLS Rig Check"
                    className="h-12 text-lg"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cl-desc" className="font-bold">Description <span className="text-slate-400 font-normal text-xs">(optional)</span></Label>
                  <Input
                    id="cl-desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brief description..."
                    className="h-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Vehicle Assignment */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="w-5 h-5 text-blue-500" /> Vehicle Assignment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setAssignMode('all')}
                    className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all ${assignMode === 'all' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                  >
                    <Globe className={`w-5 h-5 ${assignMode === 'all' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div className="text-left">
                      <p className={`font-bold text-sm ${assignMode === 'all' ? 'text-blue-900' : 'text-slate-600'}`}>All Vehicles</p>
                      <p className="text-xs text-slate-400">Applied to entire fleet</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setAssignMode('specific')}
                    className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all ${assignMode === 'specific' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                  >
                    <Truck className={`w-5 h-5 ${assignMode === 'specific' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div className="text-left">
                      <p className={`font-bold text-sm ${assignMode === 'specific' ? 'text-blue-900' : 'text-slate-600'}`}>Specific Vehicles</p>
                      <p className="text-xs text-slate-400">Pick from your fleet</p>
                    </div>
                  </button>
                </div>

                {assignMode === 'specific' && (
                  <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    {vehicles.length === 0 ? (
                      <p className="text-sm text-slate-400">No vehicles found.</p>
                    ) : vehicles.map((v: any) => {
                      const selected = selectedVehicleIds.includes(v.id)
                      return (
                        <button
                          key={v.id}
                          onClick={() => toggleVehicle(v.id)}
                          className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all border ${selected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          {selected && '✓ '}{v.rig_number}
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Categories + Items Builder */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListChecks className="w-5 h-5 text-blue-500" /> Inspection Items
                    {totalItems > 0 && (
                      <span className="ml-2 text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {totalItems} items
                      </span>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Categories */}
                {categories.map(cat => (
                  <div key={cat.id} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    {/* Category header */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <button onClick={() => toggleCat(cat.id)} className="p-0.5 hover:bg-slate-200 rounded transition-colors">
                        {expandedCats.has(cat.id) ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                      </button>

                      {editingLabel === cat.id ? (
                        <input
                          autoFocus
                          value={editingLabelValue}
                          onChange={e => setEditingLabelValue(e.target.value)}
                          onBlur={() => commitEditLabel(cat.id)}
                          onKeyDown={e => e.key === 'Enter' && commitEditLabel(cat.id)}
                          className="flex-1 text-sm font-bold bg-white border border-blue-300 px-2 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      ) : (
                        <h4
                          className="flex-1 font-bold text-slate-700 text-sm cursor-pointer hover:text-blue-600 transition-colors"
                          onClick={() => startEditLabel(cat.id, cat.category)}
                        >
                          {cat.category}
                        </h4>
                      )}

                      <span className="text-xs text-slate-400 font-medium">{cat.items.length} items</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-500" onClick={() => removeCategory(cat.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Category items */}
                    {expandedCats.has(cat.id) && (
                      <div className="divide-y divide-slate-100">
                        {cat.items.map(item => (
                          <div key={item.id} className="group">
                            {/* Item row */}
                            <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                              {item.subItems.length > 0 ? (
                                <button onClick={() => toggleItem(item.id)} className="p-0.5 hover:bg-slate-200 rounded">
                                  {expandedItems.has(item.id) ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                </button>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                </div>
                              )}

                              {editingLabel === item.id ? (
                                <input
                                  autoFocus
                                  value={editingLabelValue}
                                  onChange={e => setEditingLabelValue(e.target.value)}
                                  onBlur={() => commitEditLabel(cat.id, item.id)}
                                  onKeyDown={e => e.key === 'Enter' && commitEditLabel(cat.id, item.id)}
                                  className="flex-1 text-sm bg-white border border-blue-300 px-2 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                              ) : (
                                <span
                                  className="flex-1 text-sm font-medium text-slate-700 cursor-pointer hover:text-blue-600 transition-colors"
                                  onClick={() => startEditLabel(item.id, item.label)}
                                >
                                  {item.label}
                                </span>
                              )}

                              {item.subItems.length > 0 && (
                                <span className="text-xs text-slate-400">{item.subItems.length} sub</span>
                              )}

                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => { toggleItem(item.id); }}
                                title="Add sub-items"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeItem(cat.id, item.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>

                            {/* Sub-items */}
                            {expandedItems.has(item.id) && (
                              <div className="pl-12 pr-4 pb-2 space-y-1">
                                {item.subItems.map(sub => (
                                  <div key={sub.id} className="flex items-center gap-2 py-1.5 group/sub">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                    <span className="flex-1 text-xs text-slate-600">{sub.label}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-rose-500 opacity-0 group-hover/sub:opacity-100" onClick={() => removeSubItem(cat.id, item.id, sub.id)}>
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                                {/* Add sub-item input */}
                                <div className="flex items-center gap-2 mt-1">
                                  <Input
                                    value={newSubItemInput[`${cat.id}-${item.id}`] || ''}
                                    onChange={e => setNewSubItemInput({ ...newSubItemInput, [`${cat.id}-${item.id}`]: e.target.value })}
                                    onKeyDown={e => e.key === 'Enter' && addSubItem(cat.id, item.id)}
                                    placeholder="Add sub-check..."
                                    className="h-8 text-xs flex-1"
                                  />
                                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => addSubItem(cat.id, item.id)}>
                                    <Plus className="w-3 h-3 mr-1" /> Add
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Add item input */}
                        <div className="px-4 py-3 flex items-center gap-2 bg-slate-50/50">
                          <AiInput
                            value={newItemInput[cat.id] || ''}
                            onValueChange={val => setNewItemInput({ ...newItemInput, [cat.id]: val })}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(cat.id) } }}
                            placeholder="Type item or let AI suggest... (Tab to accept)"
                            className="h-10 flex-1 text-sm"
                          />
                          <Button variant="outline" className="h-10 px-4 font-semibold text-sm" onClick={() => addItem(cat.id)}>
                            <Plus className="w-4 h-4 mr-1" /> Add
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add category */}
                <div className="flex items-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                  <Input
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCategory()}
                    placeholder="New section name (e.g. 🫁 Airway & Oxygen)"
                    className="h-10 flex-1 text-sm"
                  />
                  <Button variant="outline" className="h-10 px-4 font-semibold text-sm" onClick={addCategory}>
                    <Plus className="w-4 h-4 mr-1" /> Add Section
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* End of Shift — Restock Items */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="w-5 h-5 text-amber-500" /> End of Shift — Restock Items
                  {restockItems.length > 0 && (
                    <span className="ml-2 text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {restockItems.length}
                    </span>
                  )}
                </CardTitle>
                <p className="text-xs text-slate-400 mt-1">Items your crew can flag for restocking when ending their shift.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Existing restock items */}
                {restockItems.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {restockItems.map((item, i) => (
                      <span
                        key={`${item}-${i}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-sm font-medium text-amber-800"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => setRestockItems(restockItems.filter((_, j) => j !== i))}
                          className="text-amber-400 hover:text-rose-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {/* Add restock item */}
                <div className="flex items-center gap-2">
                  <Input
                    value={newRestockItem}
                    onChange={e => setNewRestockItem(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newRestockItem.trim()) {
                        e.preventDefault()
                        setRestockItems([...restockItems, newRestockItem.trim()])
                        setNewRestockItem('')
                      }
                    }}
                    placeholder="e.g. IV Supplies, Gloves, Oxygen..."
                    className="h-10 flex-1 text-sm"
                  />
                  <Button
                    variant="outline"
                    className="h-10 px-4 font-semibold text-sm"
                    onClick={() => {
                      if (newRestockItem.trim()) {
                        setRestockItems([...restockItems, newRestockItem.trim()])
                        setNewRestockItem('')
                      }
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
                {restockItems.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No restock items defined. Crew will see a default list.</p>
                )}
              </CardContent>
            </Card>

            {/* Deploy */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Saving...' : editingId ? '💾 Save Changes' : '🚀 Deploy Checklist'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
