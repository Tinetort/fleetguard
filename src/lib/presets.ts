// Industry-specific checklist presets for FleetGuard
// Each preset auto-populates the checklist builder

export type OrgType = 'ems' | 'fire' | 'police' | 'fleet' | 'custom'

export interface IndustryPreset {
  id: OrgType
  label: string
  icon: string
  color: string
  description: string
  startOfShiftQuestions: string[]
  endOfShiftRestockItems: string[]
}

export const INDUSTRY_PRESETS: Record<OrgType, IndustryPreset> = {
  ems: {
    id: 'ems',
    label: 'EMS / Ambulance',
    icon: '🚑',
    color: 'blue',
    description: 'Emergency Medical Services vehicle inspection',
    startOfShiftQuestions: [
      'Main oxygen cylinder pressure (PSI)',
      'Portable oxygen cylinder pressure (PSI)',
      'AED battery charged and ready',
      'Cardiac monitor powered on and functional',
      'IV supply bag stocked (18G, 20G, 22G needles)',
      'Trauma bag — bandages, gauze, tourniquets present',
      'Airway kit — BVM, intubation equipment, suction',
      'Medications bag sealed and stocked',
      'Stretcher locked, mattress clean, straps functional',
      'Stair chair accessible and operational',
      'Backboard and cervical collars present',
      'Pediatric equipment bag (peds BVM, IO kit)',
      'EMS radio operational and on correct channel',
      'Vehicle fueled (¾ or above)',
      'Emergency lights and sirens functional',
      'All windows and mirrors clean and unobstructed',
    ],
    endOfShiftRestockItems: [
      'IV supplies', 'Gauze / bandages', 'Gloves (S/M/L)',
      'Oxygen (main)', 'Oxygen (portable)', 'Tape / bandage wraps',
      'Saline flushes', 'Medications', 'Sharps container',
    ],
  },
  fire: {
    id: 'fire',
    label: 'Fire Department',
    icon: '🚒',
    color: 'red',
    description: 'Fire apparatus daily inspection',
    startOfShiftQuestions: [
      'SCBA tanks — all cylinders at full pressure (4500 PSI)',
      'SCBA masks cleaned and sealed — no cracks',
      'Hose lines loaded and free of damage',
      'Ground ladders secured and in correct position',
      'Water tank level (at least 500 gallons)',
      'Pump panel — all gauges functional',
      'Engine oil and coolant levels',
      'Power generator operational',
      'Thermal imaging camera charged and functional',
      'Forcible entry tools present (Halligan, flathead axe)',
      'Medical bag stocked (AED, oxygen, trauma supplies)',
      'Apparatus fueled (¾ or above)',
      'Emergency lights operational',
      'Portable radios charged and programmed',
      'PPE (turnout gear) accessible and uncontaminated',
    ],
    endOfShiftRestockItems: [
      'SCBA air refills', 'Medical supplies', 'Foam agent',
      'Hydraulic fluid', 'Fuel', 'Spare fuses',
    ],
  },
  police: {
    id: 'police',
    label: 'Police / Law Enforcement',
    icon: '🚓',
    color: 'slate',
    description: 'Police patrol unit inspection',
    startOfShiftQuestions: [
      'In-car camera (dashcam) operational and recording',
      'Laptop / MDT powered on and connected',
      'Police radio on correct channel, tested',
      'Weapons — secured, loaded, safety on',
      'Handcuffs present (2 pairs minimum)',
      'First aid kit present and stocked',
      'Spike strips / stop sticks in trunk',
      'Flares / safety triangles present',
      'Shotgun / rifle secured in rack (if applicable)',
      'Vehicle fueled (¾ or above)',
      'Emergency lights and sirens functional',
      'Tires — no visible damage, inflation looks good',
      'Body camera charged and functional',
    ],
    endOfShiftRestockItems: [
      'Gloves', 'First aid supplies', 'Citation books',
      'Evidence bags', 'Flares', 'Fuel',
    ],
  },
  fleet: {
    id: 'fleet',
    label: 'Fleet / Logistics',
    icon: '🚛',
    color: 'amber',
    description: 'Commercial vehicle pre-trip inspection (DOT compliant)',
    startOfShiftQuestions: [
      'Engine oil level — on dipstick between min/max',
      'Coolant level — full in reservoir',
      'Brake fluid level — at max line',
      'Windshield washer fluid filled',
      'All tires — visual check, no low/flat, no sidewall damage',
      'All lights functional (headlights, tail, brake, turn, reverse)',
      'Horn functional',
      'Windshield wipers operational',
      'Seat belts functional for all seats',
      'Fire extinguisher present and in-date',
      'Cargo area clean, tie-downs present',
      'Cargo doors latch and lock correctly',
      'Fuel level (¾ or above)',
      'No visible fluid leaks under vehicle',
    ],
    endOfShiftRestockItems: [
      'Windshield fluid', 'Fuel', 'Tie-down straps',
      'Oil (1qt)', 'Coolant', 'Paper towels / gloves',
    ],
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    icon: '⚙️',
    color: 'purple',
    description: 'Build your own checklist from scratch',
    startOfShiftQuestions: [],
    endOfShiftRestockItems: [],
  },
}

export function getPreset(orgType: OrgType): IndustryPreset {
  return INDUSTRY_PRESETS[orgType] ?? INDUSTRY_PRESETS.custom
}
