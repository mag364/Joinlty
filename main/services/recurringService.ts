import { getDb } from '../dbService'
import { makeId, nowIso } from '../utils'
import type { RecurringRule } from '../../shared/types'
import { parseRecurringRow } from '../db/rowCodecs/recurringRow'

const mapRule = (row: unknown): RecurringRule => parseRecurringRow(row)

export const recurringService = {
  list(): RecurringRule[] {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM recurring_rules ORDER BY created_at DESC').all() as Record<string, unknown>[]
    return rows.map(mapRule)
  },

  upsert(
    payload: Omit<RecurringRule, 'id' | 'created_at' | 'updated_at'> & {
      id?: string
    },
  ): RecurringRule {
    const db = getDb()
    const now = nowIso()

    if (payload.id) {
      db.prepare(
        `UPDATE recurring_rules
         SET rule_type = ?, name = ?, amount = ?, category = ?, owner_type = ?, owner_id = ?,
             account_id = ?, schedule = ?, day_of_month = ?, next_run_date = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        payload.rule_type,
        payload.name,
        payload.amount,
        payload.category ?? null,
        payload.owner_type,
        payload.owner_id,
        payload.account_id ?? null,
        'monthly',
        payload.day_of_month,
        payload.next_run_date,
        payload.active ? 1 : 0,
        now,
        payload.id,
      )

      const row = db.prepare('SELECT * FROM recurring_rules WHERE id = ?').get(payload.id) as Record<string, unknown>
      return mapRule(row)
    }

    const id = makeId()
    db.prepare(
      `INSERT INTO recurring_rules(
        id, rule_type, name, amount, category, owner_type, owner_id, account_id,
        schedule, day_of_month, next_run_date, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'monthly', ?, ?, ?, ?, ?)`,
    ).run(
      id,
      payload.rule_type,
      payload.name,
      payload.amount,
      payload.category ?? null,
      payload.owner_type,
      payload.owner_id,
      payload.account_id ?? null,
      payload.day_of_month,
      payload.next_run_date,
      payload.active ? 1 : 0,
      now,
      now,
    )

    const row = db.prepare('SELECT * FROM recurring_rules WHERE id = ?').get(id) as Record<string, unknown>
    return mapRule(row)
  },

  delete(id: string): { ok: true } {
    const db = getDb()
    db.prepare('DELETE FROM recurring_rules WHERE id = ?').run(id)
    return { ok: true }
  },
}
