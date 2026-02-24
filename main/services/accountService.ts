import { getDb } from '../dbService'
import { makeId, nowIso } from '../utils'
import type { Account, AccountWithBalance } from '../../shared/types'
import { parseAccountListRow, parseAccountRow } from '../db/rowCodecs/accountRow'

const mapAccount = (row: unknown): Account => parseAccountRow(row)

export const accountService = {
  list(): AccountWithBalance[] {
    const db = getDb()
    const rows = db
      .prepare(
        `SELECT
          a.*,
          CASE
            WHEN a.type = 'credit_card' THEN (
              a.starting_balance
              + COALESCE((
                  SELECT SUM(t.amount)
                  FROM transactions t
                  WHERE t.account_id = a.id AND t.type = 'expense'
                ), 0)
              - COALESCE((
                  SELECT SUM(t.amount)
                  FROM transactions t
                  WHERE t.account_id = a.id AND t.type = 'income'
                ), 0)
              + COALESCE((
                  SELECT SUM(t.amount)
                  FROM transactions t
                  WHERE t.from_account_id = a.id AND t.type = 'transfer'
                ), 0)
              - COALESCE((
                  SELECT SUM(t.amount)
                  FROM transactions t
                  WHERE t.to_account_id = a.id AND t.type = 'transfer'
                ), 0)
            )
            ELSE (
              a.starting_balance
              + COALESCE((
                  SELECT SUM(t.amount)
                  FROM transactions t
                  WHERE t.account_id = a.id AND t.type = 'income'
                ), 0)
              - COALESCE((
                  SELECT SUM(t.amount)
                  FROM transactions t
                  WHERE t.account_id = a.id AND t.type = 'expense'
                ), 0)
              - COALESCE((
                  SELECT SUM(t.amount)
                  FROM transactions t
                  WHERE t.from_account_id = a.id AND t.type = 'transfer'
                ), 0)
              + COALESCE((
                  SELECT SUM(t.amount)
                  FROM transactions t
                  WHERE t.to_account_id = a.id AND t.type = 'transfer'
                ), 0)
            )
          END AS current_balance
         FROM accounts a
         ORDER BY a.sort_order ASC, a.created_at ASC`,
      )
      .all() as Array<Record<string, unknown>>

    return rows.map((row) => {
      const parsed = parseAccountListRow(row)
      return {
        ...parsed.account,
        current_balance: parsed.current_balance,
      }
    })
  },

  upsert(payload: {
    id?: string
    name: string
    type: Account['type']
    owner_type: Account['owner_type']
    owner_id: string
    starting_balance?: number
  }): Account {
    const db = getDb()
    const now = nowIso()
    const startingBalance = payload.starting_balance ?? 0

    if (payload.id) {
      db.prepare(
        `UPDATE accounts
         SET name = ?, type = ?, owner_type = ?, owner_id = ?, starting_balance = ?, updated_at = ?
         WHERE id = ?`,
      ).run(payload.name, payload.type, payload.owner_type, payload.owner_id, startingBalance, now, payload.id)

      const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(payload.id) as Record<string, unknown>
      return mapAccount(updated)
    }

    const id = makeId()
    const nextSortOrderRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order FROM accounts').get() as {
      next_sort_order: number
    }

    db.prepare(
      `INSERT INTO accounts(id, name, type, owner_type, owner_id, starting_balance, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      payload.name,
      payload.type,
      payload.owner_type,
      payload.owner_id,
      startingBalance,
      Number(nextSortOrderRow.next_sort_order),
      now,
      now,
    )

    const inserted = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Record<string, unknown>
    return mapAccount(inserted)
  },

  delete(id: string): { ok: true } {
    const db = getDb()
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
    return { ok: true }
  },

  reorder(ids: string[]): { ok: true } {
    const db = getDb()

    const tx = db.transaction((orderedIds: string[]) => {
      const update = db.prepare('UPDATE accounts SET sort_order = ?, updated_at = ? WHERE id = ?')
      const now = nowIso()

      orderedIds.forEach((id, index) => {
        update.run(index + 1, now, id)
      })
    })

    tx(ids)
    return { ok: true }
  },
}
