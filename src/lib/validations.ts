import { z } from 'zod'

export const submitRigCheckSchema = z.object({
  vehicle_id: z.string().uuid('Invalid vehicle ID'),
  oxygen_psi: z.number().int().min(0).max(3000),
  portable_oxygen_psi: z.number().int().min(0).max(3000),
  damage_notes: z.string().max(2000).optional(),
  checklist_id: z.string().uuid().nullable().optional(),
  unit_number: z.string().regex(/^\d+$/, 'Unit number must be digits only').max(10).nullable().optional(),
  crew_last_name: z.string().max(100).nullable().optional(),
  partner_name: z.string().max(100).nullable().optional(),
  handoff_disputed: z.boolean(),
  handoff_dispute_notes: z.string().max(1000).nullable().optional(),
  check_duration_seconds: z.number().int().min(0).nullable().optional(),
})

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50).trim(),
  lastName: z.string().min(1, 'Last name is required').max(50).trim(),
  role: z.enum(['emt', 'paramedic', 'nurse', 'manager', 'director']),
  recoveryEmail: z.union([z.string().email('Invalid email'), z.literal(''), z.undefined()]),
})

export const submitEndOfShiftSchema = z.object({
  vehicle_id: z.string().uuid('Invalid vehicle ID'),
  fuel_level: z.string().min(1, 'Fuel level is required').max(50),
  vehicle_condition: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  checklist_id: z.string().uuid().nullable().optional(),
})

export const updateVehicleSchema = z.object({
  vehicleId: z.string().uuid('Invalid vehicle ID'),
  rigNumber: z.string().min(1).max(20).trim(),
  status: z.enum(['green', 'yellow', 'red']).optional(),
})
