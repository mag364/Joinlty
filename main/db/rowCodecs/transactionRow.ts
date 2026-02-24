import { z } from 'zod'
import type { Transaction } from '../../../shared/types'

const parseTags = (value: unknown): string[] => {
  if (!value) return []

  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

export const TransactionRowSchema = z.object({
  id: z.preprocess((value) => String(value), z.string()),
  date: z.preprocess((value) => String(value), z.string()),
  amount: z.preprocess(
    (value) => Number(value),
    z.number().refine((n) => !Number.isNaN(n), 'amount is NaN'),
  ),
  type: z.preprocess((value) => String(value), z.enum(['expense', 'income', 'transfer'])),
  category: z.preprocess((value) => (value == null ? null : String(value)), z.string().nullable()),
  description: z.preprocess((value) => (value == null ? null : String(value)), z.string().nullable()),
  owner_type: z.preprocess((value) => String(value), z.enum(['joint', 'member'])),
  owner_id: z.preprocess((value) => String(value), z.string()),
  account_id: z.preprocess((value) => (value == null ? null : String(value)), z.string().nullable()),
  from_account_id: z.preprocess((value) => (value == null ? null : String(value)), z.string().nullable()),
  to_account_id: z.preprocess((value) => (value == null ? null : String(value)), z.string().nullable()),
  tags: z.preprocess(parseTags, z.array(z.any())),
  notes: z.preprocess((value) => (value == null ? null : String(value)), z.string().nullable()),
  created_at: z.preprocess((value) => String(value), z.string()),
})

export const parseTransactionRow = (row: unknown): Transaction => {
  try {
    return TransactionRowSchema.parse(row)
  } catch {
    throw new Error('Invalid Transaction DB row')
  }
}
