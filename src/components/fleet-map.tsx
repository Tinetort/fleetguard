'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default icons for leaflet in react
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const createVehicleIcon = (label: string) => {
  return L.divIcon({
    className: 'bg-transparent',
    html: `<div class="bg-blue-600 text-white font-bold text-xs px-2 py-1 rounded-full shadow-lg border-2 border-white whitespace-nowrap text-center">${label}</div>`,
    iconSize: [40, 24],
    iconAnchor: [20, 12]
  })
}

function getDistanceInMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function BoundsUpdater({ vehicles, baseLocation }: {
  vehicles: any[]
  baseLocation?: [number, number] | null
}) {
  const map = useMap()

  useEffect(() => {
    const active = vehicles.filter(v => v.lat && v.lng)

    if (active.length === 0) {
      // Center on org base if set, otherwise USA
      if (baseLocation) {
        map.setView(baseLocation, 13)
      }
      return
    }

    if (active.length === 1) {
      map.setView([active[0].lat, active[0].lng], 14)
      return
    }

    const bounds = L.latLngBounds(active.map(v => [v.lat, v.lng]))
    map.fitBounds(bounds, { padding: [50, 50] })
  }, [vehicles, map, baseLocation])

  return null
}

function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

const baseIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div style="background:#0f172a" class="text-white font-bold text-[10px] w-7 h-7 flex items-center justify-center rounded-xl shadow-lg border-2 border-slate-400">🏠</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
})

const hospitalIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div class="bg-rose-500 text-white font-bold text-[10px] w-6 h-6 flex items-center justify-center rounded-lg shadow-lg border-2 border-rose-300">H</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
})

const stationIcon = L.divIcon({
  className: 'bg-transparent',
  html: `<div class="bg-indigo-500 text-white font-bold text-[10px] w-6 h-6 flex items-center justify-center rounded-lg shadow-lg border-2 border-indigo-300">S</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
})

export default function FleetMap({
  vehicles,
  mapPoints = [],
  baseLocation,
  baseAddress,
  onMapClick,
}: {
  vehicles: any[]
  mapPoints?: any[]
  baseLocation?: [number, number] | null
  baseAddress?: string | null
  onMapClick?: (lat: number, lng: number) => void
}) {
  const initialCenter: [number, number] = baseLocation ?? [39.8283, -98.5795]
  const initialZoom = baseLocation ? 13 : 4

  return (
    <div className="h-full w-full bg-slate-100 z-0">
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
      >
        <MapClickHandler onMapClick={onMapClick} />
        <BoundsUpdater vehicles={vehicles} baseLocation={baseLocation} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Base marker */}
        {baseLocation && (
          <Marker position={baseLocation} icon={baseIcon}>
            <Popup>
              <div className="min-w-[160px]">
                <p className="font-bold text-sm text-slate-800">Base Station</p>
                {baseAddress && <p className="text-xs text-slate-500 mt-1">{baseAddress}</p>}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Vehicle markers */}
        {vehicles.filter(v => v.lat && v.lng).map((v) => (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={createVehicleIcon(v.unit_number || v.rig_number)}
          >
            <Popup>
              <div className="font-sans min-w-[200px]">
                <p className="font-bold text-base text-slate-800">
                  {v.rig_number}{v.unit_number ? ` · Unit ${v.unit_number}` : ''}
                </p>
                <div className="my-1.5 border-t border-slate-100" />
                <p className="text-sm text-slate-600">
                  Crew: <span className="font-bold text-slate-900">{v.on_shift_by}</span>
                </p>
                {v.location_updated_at && (
                  <p className="text-xs text-slate-400 mt-1">
                    Updated: {new Date(v.location_updated_at).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Map point markers */}
        {mapPoints.map((mp, i) => {
          let closestVehicle: any = null
          let minDistance = Infinity

          vehicles.filter(v => v.lat && v.lng).forEach(v => {
            const dist = getDistanceInMiles(mp.lat, mp.lng, v.lat, v.lng)
            if (dist < minDistance) {
              minDistance = dist
              closestVehicle = v
            }
          })

          return (
            <Marker
              key={`mp-${i}`}
              position={[mp.lat, mp.lng]}
              icon={mp.type === 'hospital' ? hospitalIcon : stationIcon}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <p className="font-bold text-sm text-slate-800">{mp.name}</p>
                  {mp.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{mp.description}</p>}

                  {closestVehicle && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Closest Unit</p>
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-100 text-emerald-800 font-black text-xs px-2 py-0.5 rounded-md">
                          {closestVehicle.unit_number || closestVehicle.rig_number}
                        </span>
                        <span className="text-xs font-bold text-slate-600">
                          {minDistance.toFixed(1)} mi
                        </span>
                      </div>
                      {closestVehicle.on_shift_by && (
                        <p className="text-[10px] text-slate-400 mt-1 truncate">
                          {closestVehicle.on_shift_by}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
