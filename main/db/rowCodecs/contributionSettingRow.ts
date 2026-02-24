import { z } from 'zod'
import type { ContributionSetting } from '../../../shared/types'

const nullableNumberFromDb = z.preprocess(
  (value) => {
    if (value == null) return null
    return Number(value)
  },
  z.union([z.null(), z.number().refine((n) => !Number.isNaN(n), 'value is NaN')]),
)

export const ContributionSettingRowSchema = z.object({
  id: z.preprocess((value) => String(value), z.string()),
  member_id: z.preprocess((value) => String(value), z.string()),
  joint_id: z.preprocess((value) => String(value), z.string()),
  contributes: z.preprocess((value) => Number(value) === 1, z.boolean()),
  method: z
    .preprocess((value) => (value == null ? null : String(value)), z.enum(['fixed', 'percent_income', 'split']).nullable())
    .transform((value) => value as ContributionSetting['method']),
  fixed_amount: nullableNumberFromDb,
  percent_income: nullableNumberFromDb,
  split_mode: z
    .preprocess((value) => (value == null ? null : String(value)), z.enum(['equal', 'weighted']).nullable())
    .transform((value) => value as ContributionSetting['split_mode']),
  weight: nullableNumberFromDb,
  funding_account_id: z.preprocess(
    (value) => {
      if (value == null) return null
      return String(value)
    },
    z.string().nullable(),
  ),
  active: z.preprocess((value) => Number(value) === 1, z.boolean()),
  created_at: z.preprocess((value) => String(value), z.string()),
  updated_at: z.preprocess((value) => String(value), z.string()),
})

export const parseContributionSettingRow = (row: unknown): ContributionSetting => {
  try {
    return ContributionSettingRowSchema.parse(row)
  } catch {
    throw new Error('Invalid ContributionSetting DB row')
  }
}
