'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Package, Plus, Pencil, Trash2, RefreshCw, RotateCcw, X, ChevronDown, ChevronUp, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import {
  toggleInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  restockInventoryItem,
  getInventoryItems,
  getInventoryTransactions,
  seedEMSInventoryItems,
} from '../../actions'

interface InventoryItem {
  id: string
  name: string
  category: string
  unit: string
  quantity: number
  low_threshold: number
  critical_threshold: number
  created_at: string
  updated_at: string
}

interface Transaction {
  id: string
  created_at: string
  change: number
  quantity_after: number
  shift_type: string
  user_name: string
  notes: string | null
  inventory_items: { name: string; unit: string; category: string } | null
  vehicles: { rig_number: string } | null
}

interface Props {
  initialItems: InventoryItem[]
  initialTransactions: Transaction[]
  inventoryEnabled: boolean
}

const CATEGORIES = ['PPE', 'Medical', 'Cleaning', 'Equipment', 'Office', 'General']
const UNITS = ['pcs', 'boxes', 'packs', 'pairs', 'bottles', 'rolls', 'sets']

function getStockLevel(item: InventoryItem): 'green' | 'yellow' | 'red' | 'negative' {
  if (item.quantity < 0) return 'negative'
  if (item.quantity <= item.critical_threshold) return 'red'
  if (item.quantity <= item.low_threshold) return 'yellow'
  return 'green'
}

function stockBadge(level: string) {
  switch (level) {
    case 'green': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'yellow': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'red': return 'bg-rose-100 text-rose-700 border-rose-200'
    case 'negative': return 'bg-red-200 text-red-900 border-red-300'
    default: return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

function stockLabel(level: string) {
  switch (level) {
    case 'green': return 'In Stock'
    case 'yellow': return '⚠️ Running Low'
    case 'red': return '🚨 Critical'
    case 'negative': return '⛔ Negative'
    default: return ''
  }
}

export default function InventoryClient({ initialItems, initialTransactions, inventoryEnabled }: Props) {
  const [items, setItems] = useState<InventoryItem[]>(initialItems)
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [enabled, setEnabled] = useState(inventoryEnabled)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Add Item Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', category: 'General', unit: 'pcs', quantity: '0', low_threshold: '10', critical_threshold: '3' })
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Edit Item
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', category: '', unit: '', quantity: '', low_threshold: '', critical_threshold: '' })
  const [editLoading, setEditLoading] = useState(false)

  // Restock
  const [restockId, setRestockId] = useState<string | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [restockLoading, setRestockLoading] = useState(false)

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Toggle loading
  const [toggleLoading, setToggleLoading] = useState(false)

  // Seed loading & confirm
  const [seedLoading, setSeedLoading] = useState(false)
  const [showSeedConfirm, setShowSeedConfirm] = useState(false)

  // Show transactions
  const [showTransactions, setShowTransactions] = useState(false)

  async function refreshData() {
    setIsRefreshing(true)
    try {
      const [newItems, newTx] = await Promise.all([getInventoryItems(), getInventoryTransactions(50)])
      setItems(newItems)
      setTransactions(newTx)
    } catch { }
    setIsRefreshing(false)
  }

  async function handleToggle() {
    setToggleLoading(true)
    try {
      await toggleInventory(!enabled)
      setEnabled(!enabled)
    } catch (err: any) {
      alert(err.message)
    }
    setToggleLoading(false)
  }

  async function handleSeedEMS() {
    setSeedLoading(true)
    try {
      await seedEMSInventoryItems()
      await refreshData()
      setShowSeedConfirm(false)
    } catch (err: any) {
      alert(err.message)
    }
    setSeedLoading(false)
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    setAddLoading(true)
    setAddError(null)
    try {
      await addInventoryItem(
        addForm.name, addForm.category, addForm.unit,
        parseInt(addForm.quantity) || 0,
        parseInt(addForm.low_threshold) || 10,
        parseInt(addForm.critical_threshold) || 3
      )
      setShowAddModal(false)
      setAddForm({ name: '', category: 'General', unit: 'pcs', quantity: '0', low_threshold: '10', critical_threshold: '3' })
      await refreshData()
    } catch (err: any) {
      setAddError(err.message)
    }
    setAddLoading(false)
  }

  function startEdit(item: InventoryItem) {
    setEditingId(item.id)
    setEditForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      quantity: String(item.quantity),
      low_threshold: String(item.low_threshold),
      critical_threshold: String(item.critical_threshold),
    })
  }

  async function handleEditSave() {
    if (!editingId) return
    setEditLoading(true)
    try {
      await updateInventoryItem(editingId, {
        name: editForm.name,
        category: editForm.category,
        unit: editForm.unit,
        quantity: parseInt(editForm.quantity),
        low_threshold: parseInt(editForm.low_threshold),
        critical_threshold: parseInt(editForm.critical_threshold),
      })
      setEditingId(null)
      await refreshData()
    } catch (err: any) {
      alert(err.message)
    }
    setEditLoading(false)
  }

  async function handleDelete(itemId: string) {
    setDeleteLoading(true)
    try {
      await deleteInventoryItem(itemId)
      setDeleteConfirmId(null)
      await refreshData()
    } catch (err: any) {
      alert(err.message)
    }
    setDeleteLoading(false)
  }

  async function handleRestock(itemId: string) {
    const qty = parseInt(restockQty)
    if (!qty || qty <= 0) return
    setRestockLoading(true)
    try {
      await restockInventoryItem(itemId, qty)
      setRestockId(null)
      setRestockQty('')
      await refreshData()
    } catch (err: any) {
      alert(err.message)
    }
    setRestockLoading(false)
  }

  // Group items by category
  const grouped = items.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    const key = item.category || 'General'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  // Stats
  const totalItems = items.length
  const lowItems = items.filter(i => getStockLevel(i) === 'yellow').length
  const criticalItems = items.filter(i => getStockLevel(i) === 'red' || getStockLevel(i) === 'negative').length

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-md transition-all duration-200">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Package className="w-6 h-6 text-indigo-600" />
                </div>
                Inventory
              </h1>
              <p className="text-slate-400 text-xs mt-1 font-medium">Warehouse & supply management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Feature Toggle */}
            <button
              onClick={handleToggle}
              disabled={toggleLoading}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none shadow-inner ${enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{enabled ? 'Enabled' : 'Disabled'}</span>

            {/* Refresh */}
            <button
              onClick={refreshData}
              className={`p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-md transition-all ${isRefreshing ? 'animate-spin text-blue-500' : ''}`}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Load EMS Defaults */}
            {items.length === 0 && (
              showSeedConfirm ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                  <span className="text-xs font-bold text-slate-500 mr-1">Load defaults?</span>
                  <Button
                    onClick={handleSeedEMS}
                    disabled={seedLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md rounded-xl h-[38px] px-4"
                  >
                    {seedLoading ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : 'Yes'}
                  </Button>
                  <Button
                    onClick={() => setShowSeedConfirm(false)}
                    disabled={seedLoading}
                    variant="ghost"
                    className="text-slate-500 hover:text-slate-700 rounded-xl h-[38px] px-3 border border-slate-200 bg-white"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowSeedConfirm(true)}
                  disabled={seedLoading}
                  variant="outline"
                  className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 font-bold shadow-sm rounded-xl h-[38px]"
                >
                  {seedLoading ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : '⚡ Load EMS Defaults'}
                </Button>
              )
            )}

            {/* Add Item */}
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md hover:shadow-lg transition-all rounded-xl h-[38px]"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          </div>
        </div>

        {/* Not enabled notice */}
        {!enabled && (
          <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-start gap-3 animate-in fade-in duration-300">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 text-sm">Inventory is disabled</p>
              <p className="text-amber-600 text-xs mt-0.5">Workers will not see the inventory section in their shift forms. Enable the toggle above to activate.</p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="h-1 bg-indigo-500" />
            <CardContent className="pt-5 pb-4 px-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Items</p>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">{totalItems}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="h-1 bg-amber-400" />
            <CardContent className="pt-5 pb-4 px-5">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Running Low</p>
              <p className="text-3xl font-extrabold text-amber-600 mt-1">{lowItems}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg overflow-hidden">
            <div className="h-1 bg-rose-500" />
            <CardContent className="pt-5 pb-4 px-5">
              <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Critical</p>
              <p className="text-3xl font-extrabold text-rose-600 mt-1">{criticalItems}</p>
            </CardContent>
          </Card>
        </div>

        {/* Low stock alerts */}
        {items.filter(i => getStockLevel(i) === 'red' || getStockLevel(i) === 'negative').length > 0 && (
          <div className="space-y-2">
            {items.filter(i => getStockLevel(i) === 'red' || getStockLevel(i) === 'negative').map(item => (
              <div key={item.id} className={`p-3 rounded-xl border-2 flex items-center justify-between ${
                item.quantity < 0
                  ? 'bg-red-50 border-red-300'
                  : 'bg-rose-50 border-rose-200'
              } animate-in fade-in slide-in-from-top-1 duration-300`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.quantity < 0 ? '⛔' : '🚨'}</span>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{item.name}</p>
                    <p className={`text-xs font-medium ${item.quantity < 0 ? 'text-red-700' : 'text-rose-600'}`}>
                      {item.quantity < 0
                        ? `NEGATIVE STOCK (${item.quantity}) — tracking error!`
                        : `Only ${item.quantity} ${item.unit} left — reorder now!`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setRestockId(item.id); setRestockQty('') }}
                  className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg shadow-sm transition-all"
                >
                  Restock
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Items grouped by category */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16">
            <div className="p-4 bg-slate-100 rounded-full inline-block mb-4">
              <Package className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-slate-500 font-bold text-lg">No inventory items yet</p>
            <p className="text-slate-400 text-sm mt-1">Click &quot;Add Item&quot; to start tracking your supplies</p>
          </div>
        ) : (
          Object.entries(grouped).map(([category, catItems]) => (
            <div key={category}>
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                {category}
                <span className="text-slate-300 font-medium tracking-normal normal-case">({catItems.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catItems.map(item => {
                  const level = getStockLevel(item)
                  const isEditing = editingId === item.id
                  const isDeleting = deleteConfirmId === item.id
                  const isRestocking = restockId === item.id

                  return (
                    <Card key={item.id} className={`border-0 shadow-md overflow-hidden transition-all hover:shadow-lg ${
                      level === 'red' || level === 'negative' ? 'ring-2 ring-rose-300' :
                      level === 'yellow' ? 'ring-2 ring-amber-200' : ''
                    }`}>
                      <div className={`h-1 ${
                        level === 'green' ? 'bg-emerald-500' :
                        level === 'yellow' ? 'bg-amber-400' :
                        level === 'red' ? 'bg-rose-500' :
                        'bg-red-600'
                      }`} />
                      <CardContent className="p-4">
                        {isEditing ? (
                          /* Edit Mode */
                          <div className="space-y-3 animate-in fade-in duration-200">
                            <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Item name" className="h-9 text-sm font-semibold" />
                            <div className="grid grid-cols-2 gap-2">
                              <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} className="h-9 text-sm rounded-lg border border-slate-200 px-2 bg-white">
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <select value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} className="h-9 text-sm rounded-lg border border-slate-200 px-2 bg-white">
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Qty</label>
                                <Input value={editForm.quantity} onChange={e => setEditForm({ ...editForm, quantity: e.target.value })} type="number" className="h-8 text-sm" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-amber-500 uppercase">Low</label>
                                <Input value={editForm.low_threshold} onChange={e => setEditForm({ ...editForm, low_threshold: e.target.value })} type="number" className="h-8 text-sm" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-rose-500 uppercase">Critical</label>
                                <Input value={editForm.critical_threshold} onChange={e => setEditForm({ ...editForm, critical_threshold: e.target.value })} type="number" className="h-8 text-sm" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={handleEditSave} disabled={editLoading} className="flex-1 h-8 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold">
                                {editLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Save'}
                              </Button>
                              <Button onClick={() => setEditingId(null)} variant="outline" className="h-8 text-xs font-bold">Cancel</Button>
                            </div>
                          </div>
                        ) : isDeleting ? (
                          /* Delete confirmation */
                          <div className="space-y-3 animate-in fade-in duration-200">
                            <p className="text-sm font-bold text-slate-800 text-center">Delete &ldquo;{item.name}&rdquo;?</p>
                            <p className="text-xs text-slate-500 text-center">This will also delete all transaction history for this item.</p>
                            <div className="flex gap-2">
                              <Button onClick={() => handleDelete(item.id)} disabled={deleteLoading} className="flex-1 h-8 bg-rose-600 hover:bg-rose-700 text-xs font-bold">
                                {deleteLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Delete'}
                              </Button>
                              <Button onClick={() => setDeleteConfirmId(null)} variant="outline" className="h-8 text-xs font-bold">Cancel</Button>
                            </div>
                          </div>
                        ) : isRestocking ? (
                          /* Restock inline */
                          <div className="space-y-3 animate-in fade-in duration-200">
                            <p className="text-sm font-bold text-slate-800">Restock: {item.name}</p>
                            <div className="flex gap-2">
                              <Input
                                value={restockQty}
                                onChange={e => setRestockQty(e.target.value)}
                                type="number"
                                min="1"
                                placeholder="Qty to add"
                                className="h-9 text-sm flex-1"
                                autoFocus
                              />
                              <Button onClick={() => handleRestock(item.id)} disabled={restockLoading || !restockQty} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold px-4">
                                {restockLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : '+ Add'}
                              </Button>
                            </div>
                            <Button onClick={() => { setRestockId(null); setRestockQty('') }} variant="ghost" className="w-full h-7 text-xs text-slate-400">Cancel</Button>
                          </div>
                        ) : (
                          /* Normal display */
                          <div>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-900 text-sm leading-tight truncate">{item.name}</p>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{item.unit}</p>
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${stockBadge(level)}`}>
                                {stockLabel(level)}
                              </span>
                            </div>
                            <div className="flex items-end justify-between mt-3">
                              <div>
                                <p className={`text-2xl font-extrabold tracking-tight ${
                                  level === 'green' ? 'text-slate-900' :
                                  level === 'yellow' ? 'text-amber-600' :
                                  level === 'red' ? 'text-rose-600' :
                                  'text-red-700'
                                }`}>
                                  {item.quantity}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">
                                  Low: {item.low_threshold} · Crit: {item.critical_threshold}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => { setRestockId(item.id); setRestockQty('') }} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restock">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="Edit">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setDeleteConfirmId(item.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors" title="Delete">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {/* Transactions History */}
        <div className="mt-12">
          <button
            onClick={() => setShowTransactions(!showTransactions)}
            className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest mb-3 hover:text-slate-700 transition-colors"
          >
            {showTransactions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Recent Transactions
            <span className="text-slate-300 font-medium tracking-normal normal-case">({transactions.length})</span>
          </button>

          {showTransactions && (
            <Card className="border-0 shadow-lg overflow-hidden animate-in slide-in-from-top-2 fade-in duration-300">
              <CardContent className="p-0">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">No transactions yet</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {transactions.map(tx => (
                      <div key={tx.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                        <div className={`p-1.5 rounded-lg ${tx.change > 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                          {tx.change > 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> : <TrendingDown className="w-3.5 h-3.5 text-rose-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {tx.inventory_items?.name || 'Unknown Item'}
                            <span className={`ml-2 font-bold ${tx.change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {tx.change > 0 ? '+' : ''}{tx.change}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium truncate">
                            {tx.user_name}
                            {tx.vehicles?.rig_number && ` · ${tx.vehicles.rig_number}`}
                            {tx.shift_type && ` · ${tx.shift_type.replace(/_/g, ' ')}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-slate-600">{tx.quantity_after} left</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {new Date(tx.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Item Modal Overlay */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowAddModal(false)}>
          <Card className="w-full max-w-md border-0 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-extrabold text-slate-900">Add Inventory Item</h2>
                <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {addError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                  ⚠️ {addError}
                </div>
              )}

              <form onSubmit={handleAddItem} className="space-y-4">
                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Item Name *</Label>
                  <Input
                    value={addForm.name}
                    onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="e.g. Gloves (L), Stethoscope, Bandages..."
                    className="h-11 mt-1"
                    required
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Category</Label>
                    <select value={addForm.category} onChange={e => setAddForm({ ...addForm, category: e.target.value })} className="w-full h-11 mt-1 rounded-lg border border-slate-200 px-3 bg-white text-sm">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Unit</Label>
                    <select value={addForm.unit} onChange={e => setAddForm({ ...addForm, unit: e.target.value })} className="w-full h-11 mt-1 rounded-lg border border-slate-200 px-3 bg-white text-sm">
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Initial Quantity</Label>
                  <Input
                    value={addForm.quantity}
                    onChange={e => setAddForm({ ...addForm, quantity: e.target.value })}
                    type="number"
                    min="0"
                    className="h-11 mt-1 text-lg font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold text-amber-600 uppercase tracking-wide">⚠️ Low Threshold</Label>
                    <Input
                      value={addForm.low_threshold}
                      onChange={e => setAddForm({ ...addForm, low_threshold: e.target.value })}
                      type="number"
                      min="0"
                      className="h-11 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-rose-600 uppercase tracking-wide">🚨 Critical Threshold</Label>
                    <Input
                      value={addForm.critical_threshold}
                      onChange={e => setAddForm({ ...addForm, critical_threshold: e.target.value })}
                      type="number"
                      min="0"
                      className="h-11 mt-1"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={addLoading || !addForm.name.trim()} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-md rounded-xl mt-2">
                  {addLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add Item
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
