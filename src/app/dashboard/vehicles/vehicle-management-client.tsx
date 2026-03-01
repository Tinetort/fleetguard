'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Truck, ArrowLeft, Plus, Trash2, Pencil, Check, X, Wrench } from 'lucide-react'
import Link from 'next/link'
import { addVehicle, removeVehicle, renameVehicle, toggleVehicleService } from '@/app/actions'

interface Vehicle {
  id: string
  rig_number: string
  status: 'green' | 'yellow' | 'red'
  in_service: boolean
  created_at: string
}

export default function VehicleManagementClient({ initialVehicles }: { initialVehicles: Vehicle[] }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles)
  const [isAdding, setIsAdding] = useState(false)
  const [newRigNumber, setNewRigNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renameLoading, setRenameLoading] = useState(false)

  // Service toggle loading
  const [serviceLoading, setServiceLoading] = useState<Record<string, boolean>>({})

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault()
    setIsAdding(true)
    setError(null)
    try {
      await addVehicle(newRigNumber)
      setVehicles([...vehicles, {
        id: crypto.randomUUID(),
        rig_number: newRigNumber,
        status: 'green' as const,
        in_service: false,
        created_at: new Date().toISOString()
      }].sort((a, b) => a.rig_number.localeCompare(b.rig_number)))
      setNewRigNumber('')
      setShowAddModal(false)
    } catch (err: any) {
      setError(err.message || 'Failed to add vehicle')
    } finally {
      setIsAdding(false)
    }
  }

  async function handleRemoveVehicle(id: string, rigNumber: string) {
    if (!window.confirm(`Are you sure you want to completely remove ${rigNumber} from the system? This cannot be undone.`)) return
    try {
      await removeVehicle(id)
      setVehicles(prev => prev.filter(v => v.id !== id))
    } catch (err: any) {
      alert(err.message || 'Failed to remove vehicle')
    }
  }

  function startRename(v: Vehicle) {
    setRenamingId(v.id)
    setRenameValue(v.rig_number)
    setRenameError(null)
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
    setRenameError(null)
  }

  async function handleRename(id: string) {
    setRenameLoading(true)
    setRenameError(null)
    try {
      await renameVehicle(id, renameValue)
      setVehicles(prev =>
        prev.map(v => v.id === id ? { ...v, rig_number: renameValue.trim() } : v)
          .sort((a, b) => a.rig_number.localeCompare(b.rig_number))
      )
      setRenamingId(null)
    } catch (err: any) {
      setRenameError(err.message || 'Failed to rename vehicle')
    } finally {
      setRenameLoading(false)
    }
  }

  async function handleToggleService(v: Vehicle) {
    setServiceLoading(prev => ({ ...prev, [v.id]: true }))
    try {
      await toggleVehicleService(v.id, !v.in_service)
      setVehicles(prev => prev.map(veh => veh.id === v.id ? { ...veh, in_service: !veh.in_service } : veh))
    } catch (err: any) {
      alert(err.message || 'Failed to update service status')
    } finally {
      setServiceLoading(prev => ({ ...prev, [v.id]: false }))
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-900">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Manage Vehicles
              </h1>
              <p className="text-sm font-medium text-slate-500">Director Administration</p>
            </div>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-bold gap-2 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Add Vehicle
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Card className="shadow-lg border-slate-200 rounded-2xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-bold text-slate-800">Organization Fleet</CardTitle>
            <CardDescription className="text-slate-500 font-medium">
              Rename vehicles, toggle out-of-service status, or remove them entirely.
              Vehicles marked <span className="font-semibold text-amber-600">In Service</span> are hidden from EMT shift selection.
            </CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="py-4 px-6 font-bold text-xs uppercase tracking-wider text-slate-500">Rig Number</th>
                  <th className="py-4 px-6 font-bold text-xs uppercase tracking-wider text-slate-500">Status</th>
                  <th className="py-4 px-6 font-bold text-xs uppercase tracking-wider text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 px-6 text-center text-slate-500 font-medium">
                      No vehicles found. Click "Add Vehicle" to create one.
                    </td>
                  </tr>
                ) : (
                  vehicles.map((v) => (
                    <tr key={v.id} className={`hover:bg-slate-50/50 transition-colors ${v.in_service ? 'bg-amber-50/40' : ''}`}>
                      {/* Rig Number / Rename */}
                      <td className="py-4 px-6">
                        {renamingId === v.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRename(v.id)
                                if (e.key === 'Escape') cancelRename()
                              }}
                              className="border border-blue-300 rounded-lg px-2.5 py-1 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 w-36"
                            />
                            <button
                              onClick={() => handleRename(v.id)}
                              disabled={renameLoading || !renameValue.trim()}
                              className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelRename}
                              className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            {renameError && (
                              <span className="text-xs text-rose-600 font-semibold">{renameError}</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md text-sm border border-slate-200">
                              {v.rig_number}
                            </span>
                            <button
                              onClick={() => startRename(v)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-500 transition-all"
                              title="Rename vehicle"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {v.in_service ? (
                          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                            <Wrench className="w-4 h-4 text-amber-500" />
                            In Service
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                              v.status === 'green' ? 'bg-emerald-500' :
                              v.status === 'yellow' ? 'bg-amber-400' :
                              'bg-rose-500'
                            }`} />
                            <span className="text-slate-600 capitalize">{v.status}</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          {/* Service Toggle */}
                          <Button
                            variant="ghost"
                            disabled={serviceLoading[v.id]}
                            onClick={() => handleToggleService(v)}
                            className={`font-bold px-3 py-1.5 h-auto text-xs rounded-lg gap-1.5 ${
                              v.in_service
                                ? 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50'
                                : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                            }`}
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            {serviceLoading[v.id] ? '...' : v.in_service ? 'Mark Available' : 'Send to Service'}
                          </Button>

                          {/* Remove */}
                          <Button
                            variant="ghost"
                            onClick={() => handleRemoveVehicle(v.id, v.rig_number)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold px-3 py-1.5 h-auto text-xs rounded-lg"
                          >
                            <Trash2 className="w-4 h-4 mr-1.5" /> Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Add New Vehicle
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddVehicle} className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600 flex items-start gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="rigNumber" className="text-slate-700 font-bold text-xs uppercase tracking-wider">Rig / Vehicle Number</Label>
                <Input
                  id="rigNumber"
                  value={newRigNumber}
                  onChange={(e) => setNewRigNumber(e.target.value)}
                  placeholder="e.g. Rig 45"
                  className="h-12 bg-slate-50 border-slate-200 font-medium text-slate-900 placeholder:text-slate-400"
                  required
                  autoFocus
                />
              </div>

              <div className="pt-2 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-12 font-bold text-slate-600 border-slate-200 hover:bg-slate-50 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAdding || !newRigNumber.trim()}
                  className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm"
                >
                  {isAdding ? 'Adding...' : 'Add Vehicle'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
