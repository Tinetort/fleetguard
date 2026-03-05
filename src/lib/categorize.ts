// Smart keyword-based categorizer for checklist items
// Automatically groups inspection items into logical categories
// Also handles conversion from legacy flat format to hierarchical format

import type { ChecklistCategory, ChecklistItem, ChecklistSubItem } from './presets'
import { genId } from './presets'

export interface CategorizedChecklist {
  [category: string]: string[]
}

const CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  {
    category: '🫁 Airway & Oxygen',
    keywords: ['oxygen', 'o2', 'airway', 'bvm', 'intubat', 'suction', 'ventilat', 'mask', 'nasal', 'cannula', 'supraglottic', 'laryngoscope', 'blade', 'tube', 'psi'],
  },
  {
    category: '🩸 Trauma & Bleeding Control',
    keywords: ['tourniquet', 'trauma', 'gauze', 'bleed', 'hemorrhage', 'bandage', 'wound', 'pressure', 'hemostatic', 'chitosan', 'combat', 'pack', 'Israeli'],
  },
  {
    category: '💊 Medications',
    keywords: ['medication', 'drug', 'epi', 'epinephrine', 'aspirin', 'nitroglycerin', 'albuterol', 'narcan', 'naloxone', 'dextrose', 'adenosine', 'amiodarone', 'atropine', 'morphine', 'fentanyl', 'ketamine', 'adenosine', 'saline', 'flush', 'vial', 'prefilled'],
  },
  {
    category: '🫀 Cardiac',
    keywords: ['aed', 'cardiac', 'defibrillat', 'monitor', 'ecg', 'ekg', 'electrode', 'pad', '12-lead', 'pulse ox', 'spo2', 'capnograph', 'etco2'],
  },
  {
    category: '🧰 IV & Fluid Access',
    keywords: ['iv', 'intravenous', 'needle', 'catheter', 'gauge', '18g', '20g', '22g', 'io', 'intraosseous', 'saline', 'lactated', 'bag', 'tubing', 'extension'],
  },
  {
    category: '🛏 Patient Movement',
    keywords: ['stretcher', 'gurney', 'backboard', 'spine', 'collar', 'cervical', 'stair chair', 'scoop', 'ked', 'splint', 'straps', 'mattress'],
  },
  {
    category: '👶 Pediatric',
    keywords: ['pediatric', 'peds', 'child', 'infant', 'neonatal', 'broselow', 'pedi'],
  },
  {
    category: '🧤 Basic PPE & Supplies',
    keywords: ['gloves', 'ppe', 'gown', 'goggles', 'mask', 'n95', 'sharps', 'biohazard', 'tape', 'scissors', 'shears', 'sterile'],
  },
  {
    category: '📡 Comms & Navigation',
    keywords: ['radio', 'communication', 'channel', 'dispatch', 'tablet', 'laptop', 'mdt', 'gps', 'navigation'],
  },
  {
    category: '🚗 Vehicle & Safety',
    keywords: ['fuel', 'gas', 'oil', 'tire', 'light', 'siren', 'horn', 'mirror', 'windshield', 'wiper', 'battery', 'engine', 'coolant', 'fluid', 'brake', 'vehicle', 'truck', 'apparatus', 'rig'],
  },
  {
    category: '🔥 Fire & Rescue Equipment',
    keywords: ['scba', 'hose', 'nozzle', 'ladder', 'pump', 'foam', 'thermal', 'halligan', 'axe', 'forcible', 'turnout', 'gear', 'tank', 'water'],
  },
  {
    category: '🔫 Law Enforcement',
    keywords: ['weapon', 'firearm', 'handcuff', 'taser', 'baton', 'radio', 'uniform', 'vest', 'shield', 'spike', 'dashcam', 'camera', 'citation', 'evidence'],
  },
]

/**
 * Categorize a flat list of checklist items into logical groups.
 * Items that don't match any category go into "Other".
 */
export function categorizeItems(items: string[]): CategorizedChecklist {
  const result: CategorizedChecklist = {}
  const usedItems = new Set<string>()

  for (const rule of CATEGORY_RULES) {
    const matched = items.filter(item => {
      const lower = item.toLowerCase()
      return !usedItems.has(item) && rule.keywords.some(kw => lower.includes(kw.toLowerCase()))
    })
    if (matched.length > 0) {
      result[rule.category] = matched
      matched.forEach(i => usedItems.add(i))
    }
  }

  // Anything unmatched goes to General
  const rest = items.filter(i => !usedItems.has(i))
  if (rest.length > 0) {
    result['📋 General'] = rest
  }

  return result
}

/**
 * Normalize any checklist `questions` value into the new ChecklistCategory[] format.
 * Handles:
 *  - Already-hierarchical data (ChecklistCategory[]) → pass through
 *  - Legacy flat string[] → auto-categorize using keyword rules
 *  - null/undefined → empty array
 */
export function normalizeChecklist(questions: any): ChecklistCategory[] {
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return []
  }

  // Check if already in new format (first element has 'category' and 'items')
  if (typeof questions[0] === 'object' && questions[0] !== null && 'category' in questions[0] && 'items' in questions[0]) {
    return questions as ChecklistCategory[]
  }

  // Legacy flat format: string[]
  if (typeof questions[0] === 'string') {
    const categorized = categorizeItems(questions as string[])
    return Object.entries(categorized).map(([category, items]) => ({
      id: genId('cat'),
      category,
      items: items.map(label => ({
        id: genId('item'),
        label,
        subItems: [] as ChecklistSubItem[],
      })),
    }))
  }

  return []
}

/**
 * Collect ALL missing item labels from nested statuses.
 * Returns labels with parent context for sub-items (e.g., "Jump Bag → Stethoscope").
 */
export function collectMissingLabels(
  categories: ChecklistCategory[],
  statuses: Record<string, 'present' | 'missing' | null>
): string[] {
  const missing: string[] = []
  for (const cat of categories) {
    for (const item of cat.items) {
      if (item.subItems.length > 0) {
        for (const sub of item.subItems) {
          if (statuses[sub.id] === 'missing') {
            missing.push(`${item.label} → ${sub.label}`)
          }
        }
      } else {
        if (statuses[item.id] === 'missing') {
          missing.push(item.label)
        }
      }
    }
  }
  return missing
}
