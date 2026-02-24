import { getDb } from '../dbService'
import { makeId, nowIso } from '../utils'
import type { Member } from '../../shared/types'
import { parseMemberRow } from '../db/rowCodecs/memberRow'

const mapMember = (row: unknown): Member => parseMemberRow(row)

export const memberService = {
  list(): Member[] {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM members ORDER BY sort_order ASC, created_at ASC')
      .all() as Record<string, unknown>[]
    return rows.map(mapMember)
  },

  upsert(payload: {
    id?: string
    name: string
    member_type?: Member['member_type']
    color?: string | null
    avatar?: string | null
    active?: boolean
  }): Member {
    const db = getDb()
    const now = nowIso()

    if (payload.id) {
      db.prepare(
        `UPDATE members
         SET name = ?, member_type = ?, color = ?, avatar = ?, active = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        payload.name,
        payload.member_type ?? 'person',
        payload.color ?? null,
        payload.avatar ?? null,
        payload.active === false ? 0 : 1,
        now,
        payload.id,
      )

      const updated = db.prepare('SELECT * FROM members WHERE id = ?').get(payload.id) as Record<string, unknown>
      return mapMember(updated)
    }

    const id = makeId()
    const nextSortOrderRow = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order FROM members').get() as {
      next_sort_order: number
    }

    db.prepare(
      `INSERT INTO members(id, name, member_type, color, avatar, active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      payload.name,
      payload.member_type ?? 'person',
      payload.color ?? null,
      payload.avatar ?? null,
      payload.active === false ? 0 : 1,
      Number(nextSortOrderRow.next_sort_order),
      now,
      now,
    )

    const inserted = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as Record<string, unknown>
    return mapMember(inserted)
  },

  delete(id: string): { ok: true } {
    const db = getDb()
    db.prepare('DELETE FROM members WHERE id = ?').run(id)
    return { ok: true }
  },

  reorder(ids: string[]): { ok: true } {
    const db = getDb()

    const tx = db.transaction((orderedIds: string[]) => {
      const update = db.prepare('UPDATE members SET sort_order = ?, updated_at = ? WHERE id = ?')
      const now = nowIso()

      orderedIds.forEach((id, index) => {
        update.run(index + 1, now, id)
      })
    })

    tx(ids)
    return { ok: true }
  },
}
