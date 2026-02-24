import { getDb } from '../dbService'
import { makeId, nowIso } from '../utils'
import type { BudgetTarget } from '../../shared/types'
import { parseBudgetTargetRow } from '../db/rowCodecs/budgetTargetRow'

const mapBudgetTarget = (row: unknown): BudgetTarget => parseBudgetTargetRow(row)

export const budgetService = {
  list(): BudgetTarget[] {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM budget_targets WHERE active = 1 ORDER BY owner_type ASC, owner_id ASC, category ASC')
      .all() as Record<string, unknown>[]
    return rows.map(mapBudgetTarget)
  },

  upsert(payload: {
    id?: string
    owner_type: BudgetTarget['owner_type']
    owner_id: string
    category: string
    amount: number
    period?: BudgetTarget['period']
    active?: boolean
  }): BudgetTarget {
    const db = getDb()
    const updatedAt = nowIso()

    if (payload.id) {
      db.prepare(
        `UPDATE budget_targets
         SET owner_type = ?, owner_id = ?, category = ?, amount = ?, period = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        payload.owner_type,
        payload.owner_id,
        payload.category.trim(),
        payload.amount,
        payload.period ?? 'monthly',
        payload.active === false ? 0 : 1,
        updatedAt,
        payload.id,
      )

      const updated = db.prepare('SELECT * FROM budget_targets WHERE id = ?').get(payload.id) as Record<string, unknown>
      return mapBudgetTarget(updated)
    }

    db.prepare(
      `INSERT INTO budget_targets(id, owner_type, owner_id, category, amount, period, active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(owner_type, owner_id, category)
       DO UPDATE SET amount = excluded.amount, period = excluded.period, active = excluded.active, updated_at = excluded.updated_at`,
    ).run(
      makeId(),
      payload.owner_type,
      payload.owner_id,
      payload.category.trim(),
      payload.amount,
      payload.period ?? 'monthly',
      payload.active === false ? 0 : 1,
      updatedAt,
    )

    const row = db
      .prepare('SELECT * FROM budget_targets WHERE owner_type = ? AND owner_id = ? AND category = ?')
      .get(payload.owner_type, payload.owner_id, payload.category.trim()) as Record<string, unknown>

    return mapBudgetTarget(row)
  },
}
