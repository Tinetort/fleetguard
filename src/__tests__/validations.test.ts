import { describe, it, expect } from 'vitest'
import { submitRigCheckSchema, createEmployeeSchema, submitEndOfShiftSchema } from '@/lib/validations'

describe('submitRigCheckSchema', () => {
  const valid = {
    vehicle_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    oxygen_psi: 2000,
    portable_oxygen_psi: 500,
    handoff_disputed: false,
  }

  it('accepts valid input', () => {
    expect(submitRigCheckSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects invalid vehicle_id', () => {
    const result = submitRigCheckSchema.safeParse({ ...valid, vehicle_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects negative oxygen_psi', () => {
    const result = submitRigCheckSchema.safeParse({ ...valid, oxygen_psi: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects unit_number with non-digits', () => {
    const result = submitRigCheckSchema.safeParse({ ...valid, unit_number: 'ABC' })
    expect(result.success).toBe(false)
  })

  it('accepts null unit_number', () => {
    const result = submitRigCheckSchema.safeParse({ ...valid, unit_number: null })
    expect(result.success).toBe(true)
  })

  it('accepts valid unit_number digits', () => {
    const result = submitRigCheckSchema.safeParse({ ...valid, unit_number: '123' })
    expect(result.success).toBe(true)
  })
})

describe('createEmployeeSchema', () => {
  const valid = { firstName: 'John', lastName: 'Doe', role: 'emt' }

  it('accepts valid input', () => {
    expect(createEmployeeSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty firstName', () => {
    const result = createEmployeeSchema.safeParse({ ...valid, firstName: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid role', () => {
    const result = createEmployeeSchema.safeParse({ ...valid, role: 'admin' })
    expect(result.success).toBe(false)
  })

  it('accepts all valid roles', () => {
    for (const role of ['emt', 'paramedic', 'nurse', 'manager', 'director']) {
      expect(createEmployeeSchema.safeParse({ ...valid, role }).success, role).toBe(true)
    }
  })

  it('accepts valid recovery email', () => {
    const result = createEmployeeSchema.safeParse({ ...valid, recoveryEmail: 'user@example.com' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = createEmployeeSchema.safeParse({ ...valid, recoveryEmail: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('accepts empty string recoveryEmail', () => {
    const result = createEmployeeSchema.safeParse({ ...valid, recoveryEmail: '' })
    expect(result.success).toBe(true)
  })
})

describe('submitEndOfShiftSchema', () => {
  const valid = {
    vehicle_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    fuel_level: '3/4',
  }

  it('accepts valid input', () => {
    expect(submitEndOfShiftSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty fuel_level', () => {
    const result = submitEndOfShiftSchema.safeParse({ ...valid, fuel_level: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid vehicle_id', () => {
    const result = submitEndOfShiftSchema.safeParse({ ...valid, vehicle_id: 'bad' })
    expect(result.success).toBe(false)
  })

  it('accepts optional notes', () => {
    const result = submitEndOfShiftSchema.safeParse({ ...valid, notes: 'All good' })
    expect(result.success).toBe(true)
  })
})
