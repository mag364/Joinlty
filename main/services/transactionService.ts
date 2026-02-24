import { getDb } from '../dbService'
import { makeId, nowIso } from '../utils'
import type { Transaction } from '../../shared/types'
import { parseTransactionRow } from '../db/rowCodecs/transactionRow'

const mapTransaction = (row: unknown): Transaction => parseTransactionRow(row)

export const transactionService = {
  list(): Transaction[] {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC').all() as Record<string, unknown>[]
    return rows.map(mapTransaction)
  },

  create(payload: Omit<Transaction, 'id' | 'created_at'>): Transaction {
    const db = getDb()
    const id = makeId()
    const createdAt = nowIso()

    db.prepare(
      `INSERT INTO transactions(
         id, date, amount, type, category, description, owner_type, owner_id,
         account_id, from_account_id, to_account_id, tags, notes, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      payload.date,
      payload.amount,
      payload.type,
      payload.category ?? null,
      payload.description ?? null,
      payload.owner_type,
      payload.owner_id,
      payload.account_id ?? null,
      payload.from_account_id ?? null,
      payload.to_account_id ?? null,
      JSON.stringify(payload.tags ?? []),
      payload.notes ?? null,
      createdAt,
    )

    const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Record<string, unknown>
    return mapTransaction(row)
  },

  update(id: string, payload: Omit<Transaction, 'id' | 'created_at'>): Transaction {
    const db = getDb()
    db.prepare(
      `UPDATE transactions SET
        date = ?, amount = ?, type = ?, category = ?, description = ?, owner_type = ?, owner_id = ?,
        account_id = ?, from_account_id = ?, to_account_id = ?, tags = ?, notes = ?
       WHERE id = ?`,
    ).run(
      payload.date,
      payload.amount,
      payload.type,
      payload.category ?? null,
      payload.description ?? null,
      payload.owner_type,
      payload.owner_id,
      payload.account_id ?? null,
      payload.from_account_id ?? null,
      payload.to_account_id ?? null,
      JSON.stringify(payload.tags ?? []),
      payload.notes ?? null,
      id,
    )

    const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Record<string, unknown>
    return mapTransaction(row)
  },

  delete(id: string): { ok: true } {
    const db = getDb()
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
    return { ok: true }
  },
}
