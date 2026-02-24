import { z } from 'zod'
import type { Account } from '../../../shared/types'

export const AccountRowSchema = z.object({
  id: z.preprocess((value) => String(value), z.string()),
  name: z.preprocess((value) => String(value), z.string()),
  type: z.preprocess((value) => String(value), z.enum(['checking', 'credit_card', 'savings'])),
  owner_type: z.preprocess((value) => String(value), z.enum(['joint', 'member'])),
  owner_id: z.preprocess((value) => String(value), z.string()),
  starting_balance: z.preprocess(
    (value) => Number(value),
    z.number().refine((n) => !Number.isNaN(n), 'starting_balance is NaN'),
  ),
  created_at: z.preprocess((value) => String(value), z.string()),
  updated_at: z.preprocess((value) => String(value), z.string()),
})

const AccountListRowSchema = AccountRowSchema.extend({
  current_balance: z.preprocess(
    (value) => Number(value),
    z.number().refine((n) => !Number.isNaN(n), 'current_balance is NaN'),
  ),
})

export const parseAccountRow = (row: unknown): Account => {
  try {
    return AccountRowSchema.parse(row)
  } catch {
    throw new Error('Invalid Account DB row')
  }
}

export const parseAccountListRow = (row: unknown): { account: Account; current_balance: number } => {
  try {
    const parsed = AccountListRowSchema.parse(row)
    return {
      account: {
        id: parsed.id,
        name: parsed.name,
        type: parsed.type,
        owner_type: parsed.owner_type,
        owner_id: parsed.owner_id,
        starting_balance: parsed.starting_balance,
        created_at: parsed.created_at,
        updated_at: parsed.updated_at,
      },
      current_balance: parsed.current_balance,
    }
  } catch {
    throw new Error('Invalid Account DB row')
  }
}
