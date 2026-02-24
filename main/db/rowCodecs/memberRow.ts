import { z } from 'zod'
import type { Member } from '../../../shared/types'

export const MemberRowSchema = z.object({
  id: z.preprocess((value) => String(value), z.string()),
  name: z.preprocess((value) => String(value), z.string()),
  member_type: z
    .preprocess((value) => (value == null ? 'person' : value), z.preprocess((value) => String(value), z.string()))
    .transform((value) => value as Member['member_type']),
  color: z.preprocess(
    (value) => {
      if (value == null) return null
      return String(value)
    },
    z.string().nullable(),
  ),
  avatar: z.preprocess(
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

export const parseMemberRow = (row: unknown): Member => {
  try {
    return MemberRowSchema.parse(row)
  } catch {
    throw new Error('Invalid Member DB row')
  }
}
