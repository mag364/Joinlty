import { getDb } from '../dbService'
import { makeId, nowIso } from '../utils'
import type { ContributionSetting } from '../../shared/types'
import { parseContributionSettingRow } from '../db/rowCodecs/contributionSettingRow'

const mapSetting = (row: unknown): ContributionSetting => parseContributionSettingRow(row)

export const contributionService = {
  list(): ContributionSetting[] {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM contribution_settings ORDER BY created_at DESC')
      .all() as Record<string, unknown>[]
    return rows.map(mapSetting)
  },

  upsert(
    payload: Omit<ContributionSetting, 'id' | 'created_at' | 'updated_at'> & {
      id?: string
    },
  ): ContributionSetting {
    const db = getDb()
    const now = nowIso()

    if (payload.id) {
      db.prepare(
        `UPDATE contribution_settings
         SET member_id = ?, joint_id = ?, contributes = ?, method = ?, fixed_amount = ?, percent_income = ?,
             split_mode = ?, weight = ?, funding_account_id = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        payload.member_id,
        payload.joint_id,
        payload.contributes ? 1 : 0,
        payload.method ?? null,
        payload.fixed_amount ?? null,
        payload.percent_income ?? null,
        payload.split_mode ?? null,
        payload.weight ?? null,
        payload.funding_account_id ?? null,
        payload.active ? 1 : 0,
        now,
        payload.id,
      )
      const row = db.prepare('SELECT * FROM contribution_settings WHERE id = ?').get(payload.id) as Record<string, unknown>
      return mapSetting(row)
    }

    const id = makeId()
    db.prepare(
      `INSERT INTO contribution_settings(
        id, member_id, joint_id, contributes, method, fixed_amount, percent_income,
        split_mode, weight, funding_account_id, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      payload.member_id,
      payload.joint_id,
      payload.contributes ? 1 : 0,
      payload.method ?? null,
      payload.fixed_amount ?? null,
      payload.percent_income ?? null,
      payload.split_mode ?? null,
      payload.weight ?? null,
      payload.funding_account_id ?? null,
      payload.active ? 1 : 0,
      now,
      now,
    )
    const row = db.prepare('SELECT * FROM contribution_settings WHERE id = ?').get(id) as Record<string, unknown>
    return mapSetting(row)
  },

  delete(id: string): { ok: true } {
    const db = getDb()
    db.prepare('DELETE FROM contribution_settings WHERE id = ?').run(id)
    return { ok: true }
  },
}
