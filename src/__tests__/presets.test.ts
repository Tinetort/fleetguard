import { describe, it, expect } from 'vitest'
import { genId, flattenChecklist } from '@/lib/presets'
import type { ChecklistCategory } from '@/lib/presets'

describe('genId', () => {
  it('generates a non-empty string', () => {
    expect(genId()).toBeTruthy()
    expect(typeof genId()).toBe('string')
  })

  it('uses the given prefix', () => {
    expect(genId('cat')).toMatch(/^cat-/)
    expect(genId('item')).toMatch(/^item-/)
  })

  it('generates unique IDs on each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => genId()))
    expect(ids.size).toBe(100)
  })
})

describe('flattenChecklist', () => {
  it('returns empty array for empty input', () => {
    expect(flattenChecklist([])).toEqual([])
  })

  it('flattens top-level items', () => {
    const categories: ChecklistCategory[] = [
      {
        id: 'c1',
        category: 'Safety',
        items: [
          { id: 'i1', label: 'Oxygen Cylinder', subItems: [] },
          { id: 'i2', label: 'Stretcher', subItems: [] },
        ],
      },
    ]
    const flat = flattenChecklist(categories)
    expect(flat).toContain('Oxygen Cylinder')
    expect(flat).toContain('Stretcher')
  })

  it('flattens sub-items with arrow notation', () => {
    const categories: ChecklistCategory[] = [
      {
        id: 'c1',
        category: 'Medical',
        items: [
          {
            id: 'i1',
            label: 'AED',
            subItems: [
              { id: 's1', label: 'Pads attached' },
              { id: 's2', label: 'Battery charged' },
            ],
          },
        ],
      },
    ]
    const flat = flattenChecklist(categories)
    expect(flat).toContain('AED')
    expect(flat).toContain('AED → Pads attached')
    expect(flat).toContain('AED → Battery charged')
  })

  it('handles multiple categories', () => {
    const categories: ChecklistCategory[] = [
      { id: 'c1', category: 'Cat1', items: [{ id: 'i1', label: 'Item A', subItems: [] }] },
      { id: 'c2', category: 'Cat2', items: [{ id: 'i2', label: 'Item B', subItems: [] }] },
    ]
    const flat = flattenChecklist(categories)
    expect(flat).toContain('Item A')
    expect(flat).toContain('Item B')
    expect(flat).toHaveLength(2)
  })
})
