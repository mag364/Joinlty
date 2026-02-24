import { z } from 'zod'
import type { RecurringRule } from '../../../shared/types'

const RecurringRowSchemaBase = z.object({
  id: z.preprocess((value) => String(value), z.string()),
  rule_type: z.preprocess((value) => String(value), z.enum(['expense', 'income'])),
  name: z.preprocess((value) => String(value), z.string()),
  amount: z.preprocess(
    (value) => Number(value),
    z.number().refine((n) => !Number.isNaN(n), 'amount is NaN'),
  ),
  category: z.preprocess(
    (value) => {
      if (value == null) return null
      return String(value)
    },
    z.string().nullable(),
  ),
  owner_type: z.preprocess((value) => String(value), z.enum(['joint', 'member'])),
  owner_id: z.preprocess((value) => String(value), z.string()),
  account_id: z.preprocess(
    (value) => {
      if (value == null) return null
      return String(value)
    },
    z.string().nullable(),
  ),
  day_of_month: z.preprocess(
    (value) => Number(value),
    z.number().refine((n) => !Number.isNaN(n), 'day_of_month is NaN'),
  ),
  next_run_date: z.preprocess((value) => String(value), z.string()),
  active: z.preprocess((value) => Number(value) === 1, z.boolean()),
  created_at: z.preprocess((value) => String(value), z.string()),
  updated_at: z.preprocess((value) => String(value), z.string()),
})

export const RecurringRowSchema = RecurringRowSchemaBase.transform((value): RecurringRule => ({
  ...value,
  schedule: 'monthly',
}))

export const parseRecurringRow = (row: unknown): RecurringRule => {
  try {
    return RecurringRowSchema.parse(row)
  } catch {
    throw new Error('Invalid RecurringRule DB row')
  }
}
