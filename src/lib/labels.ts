// Configurable UI labels per org type for FleetGuard
// Allows the same app to feel native for different industries

import type { OrgType } from './presets'

export interface OrgLabels {
  vehicle: string        // singular: "Rig", "Apparatus", "Unit", "Truck"
  vehiclePlural: string  // plural: "Rigs", "Apparatus", "Units", "Trucks"
  worker: string         // "EMT", "Firefighter", "Officer", "Driver"
  workerPlural: string   // "EMTs", "Firefighters", "Officers", "Drivers"
  inspection: string     // "Rig Check", "Apparatus Inspection", "Vehicle Inspection"
  shiftStart: string     // "Start of Shift", "Morning Inspection", "Pre-trip"
  shiftEnd: string       // "End of Shift", "Evening Inspection", "Post-trip"
  manager: string        // "Manager", "Chief", "Supervisor", "Dispatcher"
  dashboard: string      // "Fleet Dashboard", "Apparatus Status Board"
}

export const LABEL_MAP: Record<OrgType, OrgLabels> = {
  ems: {
    vehicle: 'Rig',
    vehiclePlural: 'Rigs',
    worker: 'EMT',
    workerPlural: 'EMTs',
    inspection: 'Rig Check',
    shiftStart: 'Start of Shift',
    shiftEnd: 'End of Shift',
    manager: 'Manager',
    dashboard: 'Fleet Monitor',
  },
  fire: {
    vehicle: 'Apparatus',
    vehiclePlural: 'Apparatus',
    worker: 'Firefighter',
    workerPlural: 'Firefighters',
    inspection: 'Apparatus Inspection',
    shiftStart: 'Morning Inspection',
    shiftEnd: 'Evening Inspection',
    manager: 'Chief',
    dashboard: 'Apparatus Status Board',
  },
  police: {
    vehicle: 'Unit',
    vehiclePlural: 'Units',
    worker: 'Officer',
    workerPlural: 'Officers',
    inspection: 'Vehicle Inspection',
    shiftStart: 'Start of Watch',
    shiftEnd: 'End of Watch',
    manager: 'Supervisor',
    dashboard: 'Fleet Status',
  },
  fleet: {
    vehicle: 'Truck',
    vehiclePlural: 'Trucks',
    worker: 'Driver',
    workerPlural: 'Drivers',
    inspection: 'Pre-trip Inspection',
    shiftStart: 'Pre-trip',
    shiftEnd: 'Post-trip',
    manager: 'Dispatcher',
    dashboard: 'Fleet Dashboard',
  },
  custom: {
    vehicle: 'Vehicle',
    vehiclePlural: 'Vehicles',
    worker: 'Operator',
    workerPlural: 'Operators',
    inspection: 'Vehicle Check',
    shiftStart: 'Start of Shift',
    shiftEnd: 'End of Shift',
    manager: 'Manager',
    dashboard: 'Fleet Dashboard',
  },
}

// Default to EMS labels for backward compatibility
export const DEFAULT_LABELS = LABEL_MAP.ems

export function getLabels(orgType?: OrgType | null): OrgLabels {
  if (!orgType || !LABEL_MAP[orgType]) return DEFAULT_LABELS
  return LABEL_MAP[orgType]
}
