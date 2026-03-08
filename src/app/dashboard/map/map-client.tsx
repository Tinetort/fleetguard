'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/../utils/supabase/client'
import dynamic from 'next/dynamic'
import { ArrowLeft, MapPin, Trash2, Hospital, Building2, RefreshCw, Search, X, Home, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { createMapPoint, deleteMapPoint, updateOrgBaseLocation } from '../../actions'
import { toast } from 'sonner'

const FleetMap = dynamic(() => import('@/components/fleet-map'), { ssr: false })

interface Vehicle {
  id: string
  rig_number: string
  unit_number?: string | null
  lat?: number | null
  lng?: number | null
  location_updated_at?: string | null
  on_shift_since?: string | null
  on_shift_by?: string | null
}

interface MapPoint {
  id: string
  name: string
  type: string
  lat: number
  lng: number
  description?: string | null
}

interface GeoResult {
  lat: number
  lng: number
  name: string
  address: string
  type: string
  category: string
}

export default function MapClient({
  initialVehicles,
  initialPoints,
  orgId,
  userRole,
  baseLat,
  baseLng,
  baseAddress,
}: {
  initialVehicles: Vehicle[]
  initialPoints: MapPoint[]
  orgId: string
  userRole: string
  baseLat: number | null
  baseLng: number | null
  baseAddress: string | null
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles)
  const [mapPoints, setMapPoints] = useState<MapPoint[]>(initialPoints)
  const [base, setBase] = useState<{ lat: number; lng: number; address: string } | null>(
    baseLat && baseLng ? { lat: baseLat, lng: baseLng, address: baseAddress ?? '' } : null
  )

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GeoResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [savingBase, setSavingBase] = useState(false)

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canEdit = userRole === 'manager' || userRole === 'director'

  const fetchLatestData = useCallback(async () => {
    const supabase = createClient()
    const { data: vData } = await supabase
      .from('vehicles')
      .select('id, rig_number, unit_number, lat, lng, location_updated_at, on_shift_since, on_shift_by')
      .eq('org_id', orgId)
      .not('on_shift_since', 'is', null)
    if (vData) setVehicles(vData)

    const { data: pData } = await supabase
      .from('map_points')
      .select('*')
      .eq('org_id', orgId)
    if (pData) setMapPoints(pData)
  }, [orgId])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('map-client-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicles' }, fetchLatestData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_points' }, fetchLatestData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchLatestData])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setShowResults(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim() || value.trim().length < 2) {
      setSearchResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(value.trim())}`)
        const data: GeoResult[] = await res.json()
        setSearchResults(data)
        setShowResults(data.length > 0)
      } finally {
        setIsSearching(false)
      }
    }, 400)
  }

  const handleSelectResult = async (result: GeoResult, index: number) => {
    setSavingId(index)
    try {
      const type = result.category === 'amenity' && result.type === 'hospital' ? 'hospital' : 'custom'
      await createMapPoint({ name: result.name, type, lat: result.lat, lng: result.lng, description: result.address })
      toast.success(`Added "${result.name}"`)
      setSearchQuery('')
      setSearchResults([])
      setShowResults(false)
      await fetchLatestData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to add location')
    } finally {
      setSavingId(null)
    }
  }

  const handleSetBase = async (result: GeoResult, index: number) => {
    setSavingBase(true)
    setSavingId(index)
    try {
      await updateOrgBaseLocation({ base_lat: result.lat, base_lng: result.lng, base_address: result.address })
      setBase({ lat: result.lat, lng: result.lng, address: result.address })
      toast.success(`Base set to "${result.name}"`)
      setSearchQuery('')
      setSearchResults([])
      setShowResults(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to set base location')
    } finally {
      setSavingBase(false)
      setSavingId(null)
    }
  }

  const handleDeletePoint = async (id: string) => {
    if (!confirm('Delete this map point?')) return
    try {
      await deleteMapPoint(id)
      toast.success('Deleted')
      await fetchLatestData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete')
    }
  }

  const activeVehicleCount = vehicles.filter(v => v.lat && v.lng).length

  const sidebarContent = (
    <>
      {/* Search */}
      {canEdit && (
        <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0" ref={searchRef}>
          <div className="relative">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                placeholder="Search to add location or set base..."
                autoComplete="off"
                className="w-full pl-9 pr-9 py-3 rounded-2xl border border-slate-200 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900 font-medium text-sm"
              />
              {isSearching && <RefreshCw className="w-4 h-4 text-blue-500 absolute right-3 animate-spin" />}
              {!isSearching && searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false) }} className="absolute right-3 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
                {searchResults.map((result, i) => (
                  <div key={i} className="border-b border-slate-50 last:border-0">
                    <div className="flex items-start gap-3 px-4 py-3">
                      <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${result.category === 'amenity' && result.type === 'hospital' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                        {result.category === 'amenity' && result.type === 'hospital' ? <Hospital className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-sm truncate">{result.name}</p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{result.address}</p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleSelectResult(result, i)}
                            disabled={savingId !== null}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                          >
                            + Add to map
                          </button>
                          <button
                            onClick={() => handleSetBase(result, i)}
                            disabled={savingId !== null}
                            className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <Home className="w-3 h-3" /> Set as Base
                          </button>
                        </div>
                      </div>
                      {savingId === i && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin shrink-0 mt-1" />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showResults && searchResults.length === 0 && !isSearching && searchQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-3 z-50">
                <p className="text-sm text-slate-500 font-medium">No results found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Base location */}
      {base && (
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-900/5">
          <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
            <Home className="w-3 h-3" /> Base Station
          </p>
          <p className="text-sm font-bold text-slate-800 truncate">{base.address.split(',').slice(0, 2).join(',')}</p>
        </div>
      )}

      {/* Saved locations */}
      <div className="p-4 overflow-y-auto flex-1">
        <h2 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-4 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5" /> Saved Locations
        </h2>

        {mapPoints.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-50 border border-slate-100 rounded-2xl">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">No points added yet.</p>
            {canEdit && <p className="text-xs text-slate-400 mt-1">Search for hospitals, stations, or any address above.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {mapPoints.map(point => (
              <div key={point.id} className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-blue-300 transition-colors group relative">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${point.type === 'hospital' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {point.type === 'hospital' ? <Hospital className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0 pr-7">
                    <p className="font-bold text-slate-900 text-sm truncate">{point.name}</p>
                    {point.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{point.description}</p>}
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleDeletePoint(point.id)}
                    className="absolute right-2 top-2 p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center gap-3 shadow-sm z-10 relative">
        <Link href="/dashboard" className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight">Live Fleet Map</h1>
          <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {activeVehicleCount} {activeVehicleCount === 1 ? 'Unit' : 'Units'} Tracking
          </p>
        </div>

        {/* Mobile: toggle sidebar button */}
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="md:hidden flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm px-3 py-2 rounded-xl transition-colors"
        >
          <MapPin className="w-4 h-4" />
          {mapPoints.length + (base ? 1 : 0)}
          {sidebarOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 relative flex flex-col md:flex-row overflow-hidden bg-slate-100">

        {/* Sidebar — slides down on mobile, fixed column on desktop */}
        <div className={`
          md:w-96 md:flex md:flex-col bg-white border-b md:border-b-0 md:border-r border-slate-200 shadow-xl z-20
          ${sidebarOpen ? 'flex flex-col max-h-[50vh]' : 'hidden md:flex'}
          md:max-h-full md:overflow-hidden
        `}>
          {sidebarContent}
        </div>

        {/* Map */}
        <div className="flex-1 relative min-h-0">
          <FleetMap
            vehicles={vehicles}
            mapPoints={mapPoints}
            baseLocation={base ? [base.lat, base.lng] : null}
            baseAddress={base?.address ?? null}
          />
        </div>
      </div>
    </div>
  )
}
