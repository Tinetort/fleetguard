// Industry-specific checklist presets for FleetGuard
// Each preset auto-populates the checklist builder with hierarchical items

export type OrgType = 'ems' | 'fire' | 'police' | 'fleet' | 'custom'

// ── Hierarchical Checklist Types ──────────────────────────────────────

export interface ChecklistSubItem {
  id: string
  label: string
}

export interface ChecklistItem {
  id: string
  label: string
  subItems: ChecklistSubItem[]
}

export interface ChecklistCategory {
  id: string
  category: string
  items: ChecklistItem[]
}

// ── Helper: generate unique IDs ──────────────────────────────────────

let _idCounter = 0
export function genId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${(++_idCounter).toString(36)}`
}

// ── Helper: flatten hierarchical checklist to flat string[] for backward compat ──

export function flattenChecklist(categories: ChecklistCategory[]): string[] {
  const result: string[] = []
  for (const cat of categories) {
    for (const item of cat.items) {
      result.push(item.label)
      for (const sub of item.subItems) {
        result.push(`${item.label} → ${sub.label}`)
      }
    }
  }
  return result
}

// ── Helper: count all answerable items (items + sub-items) ──

export function countAllItems(categories: ChecklistCategory[]): number {
  let count = 0
  for (const cat of categories) {
    for (const item of cat.items) {
      if (item.subItems.length > 0) {
        count += item.subItems.length // only sub-items are answerable when they exist
      } else {
        count += 1 // top-level item is answerable when no sub-items
      }
    }
  }
  return count
}

// ── Industry Preset Definition ───────────────────────────────────────

export interface IndustryPreset {
  id: OrgType
  label: string
  icon: string
  color: string
  description: string
  categories: ChecklistCategory[]
  endOfShiftRestockItems: string[]
  /** @deprecated — kept for backward compat reading old data */
  startOfShiftQuestions: string[]
}

// Helper to build items quickly
function item(label: string, subItems: string[] = []): ChecklistItem {
  return {
    id: genId('item'),
    label,
    subItems: subItems.map(s => ({ id: genId('sub'), label: s })),
  }
}

function cat(category: string, items: ChecklistItem[]): ChecklistCategory {
  return { id: genId('cat'), category, items }
}

export const INDUSTRY_PRESETS: Record<OrgType, IndustryPreset> = {
  ems: {
    id: 'ems',
    label: 'EMS / Ambulance',
    icon: '🚑',
    color: 'blue',
    description: 'Emergency Medical Services vehicle inspection',
    categories: [
      cat('🫁 Airway & Oxygen', [
        item('Main Oxygen Cylinder', ['Pressure above 500 PSI', 'Valve opens/closes smoothly', 'Regulator attached']),
        item('Portable Oxygen Cylinder', ['Pressure above 500 PSI', 'Carrying case intact']),
        item('Airway Kit', ['BVM (adult) present', 'BVM (pediatric) present', 'Intubation equipment', 'Suction unit functional']),
      ]),
      cat('🫀 Cardiac', [
        item('AED / Defibrillator', ['Battery charged', 'Pads in-date', 'Power-on test passed']),
        item('Cardiac Monitor', ['Powered on and functional', '12-lead cables present', 'Electrodes stocked']),
      ]),
      cat('🩸 Trauma & Bleeding Control', [
        item('Trauma Bag', ['Bandages present', 'Gauze stocked', 'Tourniquets (x2 minimum)', 'Hemostatic agents']),
        item('Backboard & Collar', ['Backboard present', 'Cervical collars (S/M/L)', 'Straps functional']),
      ]),
      cat('🧰 IV & Medications', [
        item('IV Supply Bag', ['18G needles', '20G needles', '22G needles', 'Tubing & extension sets', 'Saline bags']),
        item('Medications Bag', ['Sealed and stocked', 'Expiration dates checked']),
      ]),
      cat('🛏 Patient Movement', [
        item('Stretcher', ['Locked securely', 'Mattress clean', 'Straps functional']),
        item('Stair Chair', ['Accessible', 'Operational']),
      ]),
      cat('👶 Pediatric', [
        item('Pediatric Equipment Bag', ['Peds BVM present', 'IO kit present', 'Broselow tape']),
      ]),
      cat('🚗 Vehicle & Safety', [
        item('Vehicle Fuel Level', ['¾ tank or above']),
        item('Emergency Lights & Sirens', ['All functional']),
        item('Windows & Mirrors', ['Clean and unobstructed']),
        item('EMS Radio', ['Operational', 'Correct channel']),
      ]),
    ],
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
    categories: [
      cat('🔥 SCBA & Breathing', [
        item('SCBA Tanks', ['All cylinders at full pressure (4500 PSI)', 'Valves operational']),
        item('SCBA Masks', ['Cleaned and sealed', 'No cracks or damage']),
      ]),
      cat('🚒 Hose & Water', [
        item('Hose Lines', ['Loaded correctly', 'Free of damage']),
        item('Water Tank', ['At least 500 gallons', 'No leaks']),
        item('Pump Panel', ['All gauges functional']),
      ]),
      cat('🪜 Ladders & Tools', [
        item('Ground Ladders', ['Secured in correct position']),
        item('Forcible Entry Tools', ['Halligan present', 'Flathead axe present']),
        item('Thermal Imaging Camera', ['Charged', 'Functional']),
      ]),
      cat('🧰 Medical & Safety', [
        item('Medical Bag', ['AED present', 'Oxygen present', 'Trauma supplies']),
        item('PPE / Turnout Gear', ['Accessible', 'Uncontaminated']),
      ]),
      cat('🚗 Vehicle', [
        item('Engine Oil & Coolant', ['Levels normal']),
        item('Power Generator', ['Operational']),
        item('Fuel Level', ['¾ or above']),
        item('Emergency Lights', ['All functional']),
        item('Portable Radios', ['Charged', 'Programmed']),
      ]),
    ],
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
    categories: [
      cat('📡 Communications & Tech', [
        item('Dashcam', ['Operational', 'Recording']),
        item('Laptop / MDT', ['Powered on', 'Connected']),
        item('Police Radio', ['On correct channel', 'Tested']),
        item('Body Camera', ['Charged', 'Functional']),
      ]),
      cat('🔫 Tactical Equipment', [
        item('Weapons', ['Secured', 'Loaded', 'Safety on']),
        item('Handcuffs', ['2 pairs minimum']),
        item('Shotgun / Rifle Rack', ['Secured (if applicable)']),
      ]),
      cat('🧰 Safety & Medical', [
        item('First Aid Kit', ['Present', 'Stocked']),
        item('Spike Strips', ['In trunk']),
        item('Flares / Safety Triangles', ['Present']),
      ]),
      cat('🚗 Vehicle', [
        item('Fuel Level', ['¾ or above']),
        item('Emergency Lights & Sirens', ['Functional']),
        item('Tires', ['No visible damage', 'Inflation OK']),
      ]),
    ],
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
    categories: [
      cat('🔧 Fluids & Engine', [
        item('Engine Oil', ['Level between min/max on dipstick']),
        item('Coolant', ['Full in reservoir']),
        item('Brake Fluid', ['At max line']),
        item('Windshield Washer Fluid', ['Filled']),
      ]),
      cat('🚗 Exterior', [
        item('Tires', ['No low/flat', 'No sidewall damage']),
        item('Lights', ['Headlights', 'Tail lights', 'Brake lights', 'Turn signals', 'Reverse lights']),
        item('Horn', ['Functional']),
        item('Windshield Wipers', ['Operational']),
        item('No Fluid Leaks', ['Checked under vehicle']),
      ]),
      cat('🪑 Interior & Safety', [
        item('Seat Belts', ['Functional for all seats']),
        item('Fire Extinguisher', ['Present', 'In-date']),
      ]),
      cat('📦 Cargo', [
        item('Cargo Area', ['Clean']),
        item('Tie-downs', ['Present']),
        item('Cargo Doors', ['Latch correctly', 'Lock correctly']),
      ]),
      cat('⛽ Fuel', [
        item('Fuel Level', ['¾ or above']),
      ]),
    ],
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
    categories: [],
    startOfShiftQuestions: [],
    endOfShiftRestockItems: [],
  },
}

export function getPreset(orgType: OrgType): IndustryPreset {
  return INDUSTRY_PRESETS[orgType] ?? INDUSTRY_PRESETS.custom
}
