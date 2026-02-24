import { getDb } from '../dbService'
import { makeId, nowIso } from '../utils'
import type { Joint } from '../../shared/types'
import { parseJointRow } from '../db/rowCodecs/jointRow'

const mapJoint = (row: unknown): Joint => parseJointRow(row)

export const jointService = {
  list(): Joint[] {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM joints ORDER BY created_at ASC').all() as Record<string, unknown>[]
    return rows.map(mapJoint)
  },

  upsert(payload: { id?: string; name: string; active?: boolean }): Joint {
    const db = getDb()
    const now = nowIso()

    if (payload.id) {
      db.prepare(
        `UPDATE joints
         SET name = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      ).run(payload.name, payload.active === false ? 0 : 1, now, payload.id)

      const updated = db.prepare('SELECT * FROM joints WHERE id = ?').get(payload.id) as Record<string, unknown>
      return mapJoint(updated)
    }

    const id = makeId()
    db.prepare(
      `INSERT INTO joints(id, name, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, payload.name, payload.active === false ? 0 : 1, now, now)

    const inserted = db.prepare('SELECT * FROM joints WHERE id = ?').get(id) as Record<string, unknown>
    return mapJoint(inserted)
  },

  delete(id: string): { ok: true } {
    const db = getDb()
    db.prepare('DELETE FROM joints WHERE id = ?').run(id)
    return { ok: true }
  },
}
