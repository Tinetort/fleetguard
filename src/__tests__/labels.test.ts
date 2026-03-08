import { describe, it, expect } from 'vitest'
import { getLabels, DEFAULT_LABELS, LABEL_MAP } from '@/lib/labels'
import type { OrgType } from '@/lib/presets'

describe('getLabels', () => {
  it('returns DEFAULT_LABELS (ems) when called with no argument', () => {
    expect(getLabels()).toBe(DEFAULT_LABELS)
  })

  it('returns DEFAULT_LABELS when orgType is null', () => {
    expect(getLabels(null)).toBe(DEFAULT_LABELS)
  })

  it('returns DEFAULT_LABELS when orgType is undefined', () => {
    expect(getLabels(undefined)).toBe(DEFAULT_LABELS)
  })

  it('returns correct labels for ems', () => {
    const labels = getLabels('ems')
    expect(labels.vehicle).toBe('Rig')
    expect(labels.worker).toBe('EMT')
    expect(labels.inspection).toBe('Rig Check')
  })

  it('returns correct labels for fire', () => {
    const labels = getLabels('fire')
    expect(labels.vehicle).toBe('Apparatus')
    expect(labels.worker).toBe('Firefighter')
    expect(labels.manager).toBe('Chief')
  })

  it('returns correct labels for police', () => {
    const labels = getLabels('police')
    expect(labels.vehicle).toBe('Unit')
    expect(labels.worker).toBe('Officer')
  })

  it('returns correct labels for fleet', () => {
    const labels = getLabels('fleet')
    expect(labels.vehicle).toBe('Truck')
    expect(labels.worker).toBe('Driver')
  })

  it('returns custom labels for custom org type', () => {
    const labels = getLabels('custom')
    expect(labels.vehicle).toBe('Vehicle')
    expect(labels.worker).toBe('Operator')
  })

  it('all label maps have required keys', () => {
    const requiredKeys = ['vehicle', 'vehiclePlural', 'worker', 'workerPlural', 'inspection', 'shiftStart', 'shiftEnd', 'manager', 'dashboard']
    const orgTypes: OrgType[] = ['ems', 'fire', 'police', 'fleet', 'custom']
    for (const orgType of orgTypes) {
      const labels = LABEL_MAP[orgType]
      for (const key of requiredKeys) {
        expect(labels[key as keyof typeof labels], `${orgType}.${key}`).toBeTruthy()
      }
    }
  })
})
