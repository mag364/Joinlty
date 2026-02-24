import { z } from 'zod'
import type { Joint } from '../../../shared/types'

export const JointRowSchema = z.object({
  id: z.preprocess((value) => String(value), z.string()),
  name: z.preprocess((value) => String(value), z.string()),
  active: z.preprocess((value) => Number(value) === 1, z.boolean()),
  created_at: z.preprocess((value) => String(value), z.string()),
  updated_at: z.preprocess((value) => String(value), z.string()),
})

export const parseJointRow = (row: unknown): Joint => {
  try {
    return JointRowSchema.parse(row)
  } catch {
    throw new Error('Invalid Joint DB row')
  }
}
