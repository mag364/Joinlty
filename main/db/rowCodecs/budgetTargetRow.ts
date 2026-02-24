import { z } from 'zod'
import type { BudgetTarget } from '../../../shared/types'

export const BudgetTargetRowSchema = z.object({
  id: z.preprocess((value) => String(value), z.string()),
  owner_type: z.preprocess((value) => String(value), z.enum(['joint', 'member'])),
  owner_id: z.preprocess((value) => String(value), z.string()),
  category: z.preprocess((value) => String(value), z.string()),
  amount: z.preprocess(
    (value) => Number(value),
    z.number().refine((n) => !Number.isNaN(n), 'amount is NaN'),
  ),
  period: z
    .preprocess((value) => (value == null ? 'monthly' : String(value)), z.enum(['monthly', 'yearly']))
    .transform((value) => value as BudgetTarget['period']),
  active: z.preprocess((value) => Number(value) === 1, z.boolean()),
  updated_at: z.preprocess((value) => String(value), z.string()),
})

export const parseBudgetTargetRow = (row: unknown): BudgetTarget => {
  try {
    return BudgetTargetRowSchema.parse(row)
  } catch {
    throw new Error('Invalid BudgetTarget DB row')
  }
}
