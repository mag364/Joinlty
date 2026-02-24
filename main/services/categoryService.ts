import { getDb } from '../dbService'
import { makeId, nowIso } from '../utils'
import type { Category } from '../../shared/types'
import { parseCategoryRow } from '../db/rowCodecs/categoryRow'

const mapCategory = (row: unknown): Category => parseCategoryRow(row)

export const categoryService = {
  list(): Category[] {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM categories ORDER BY name ASC').all() as Record<string, unknown>[]
    return rows.map(mapCategory)
  },

  create(payload: { name: string; kind?: 'income' | 'expense' | null }): Category {
    const db = getDb()
    const now = nowIso()
    const normalizedName = payload.name.trim()

    db.prepare(
      `INSERT INTO categories(id, name, kind, active, created_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(name) DO UPDATE SET kind = COALESCE(excluded.kind, categories.kind)`,
    ).run(makeId(), normalizedName, payload.kind ?? null, now)

    const row = db.prepare('SELECT * FROM categories WHERE name = ?').get(normalizedName) as Record<string, unknown>
    return mapCategory(row)
  },

  update(payload: { id: string; name: string; kind?: 'income' | 'expense' | null; active: boolean }): Category {
    const db = getDb()
    const normalizedName = payload.name.trim()

    db.prepare(
      `UPDATE categories
       SET name = ?, kind = ?, active = ?
       WHERE id = ?`,
    ).run(normalizedName, payload.kind ?? null, payload.active ? 1 : 0, payload.id)

    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(payload.id) as Record<string, unknown> | undefined
    if (!row) throw new Error('Category not found after update')
    return mapCategory(row)
  },

  delete(payload: { id: string }): { ok: true } {
    const db = getDb()
    db.prepare('DELETE FROM categories WHERE id = ?').run(payload.id)
    return { ok: true }
  },
}
