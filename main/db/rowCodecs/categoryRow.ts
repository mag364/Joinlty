import { z } from 'zod'
import type { Category } from '../../../shared/types'

export const CategoryRowSchema = z.object({
  id: z.preprocess((value) => String(value), z.string()),
  name: z.preprocess((value) => String(value), z.string()),
  kind: z
    .preprocess(
      (value) => {
        if (value == null) return null
        return String(value)
      },
      z.string().nullable(),
    )
    .transform((value) => value as Category['kind']),
  active: z.preprocess((value) => Number(value) === 1, z.boolean()),
  created_at: z.preprocess((value) => String(value), z.string()),
})

export const parseCategoryRow = (row: unknown): Category => {
  try {
    return CategoryRowSchema.parse(row)
  } catch {
    throw new Error('Invalid Category DB row')
  }
}