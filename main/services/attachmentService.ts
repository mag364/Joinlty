import { basename, join } from 'node:path'
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { shell } from 'electron'
import { getAppDataPaths, getDb } from '../dbService'
import { makeId, nowIso } from '../utils'
import type { Attachment } from '../../shared/types'
import { parseAttachmentRow } from '../db/rowCodecs/attachmentRow'

const mimeFromExt = (filename: string) => {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

const mapAttachment = (row: unknown): Attachment => parseAttachmentRow(row)

export const attachmentService = {
  list(transactionId: string): Attachment[] {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM attachments WHERE transaction_id = ? ORDER BY created_at DESC')
      .all(transactionId) as Record<string, unknown>[]
    const existingRows = rows.filter((row) => {
      const filePath = String(row.file_path ?? '')
      return filePath.length > 0 && existsSync(filePath)
    })

    const missingIds = rows
      .filter((row) => {
        const filePath = String(row.file_path ?? '')
        return filePath.length === 0 || !existsSync(filePath)
      })
      .map((row) => String(row.id ?? ''))
      .filter((id) => id.length > 0)

    if (missingIds.length > 0) {
      const removeMissing = db.prepare('DELETE FROM attachments WHERE id = ?')
      const transaction = db.transaction((ids: string[]) => {
        for (const id of ids) removeMissing.run(id)
      })
      transaction(missingIds)
    }

    return existingRows.map(mapAttachment)
  },

  create(payload: { transaction_id: string; file_path: string }): Attachment {
    const db = getDb()
    const { storageDir } = getAppDataPaths()
    const filename = basename(payload.file_path)
    const txDir = join(storageDir, payload.transaction_id)
    const destination = join(txDir, filename)

    mkdirSync(txDir, { recursive: true })
    copyFileSync(payload.file_path, destination)

    const stat = statSync(destination)
    const id = makeId()
    const createdAt = nowIso()

    db.prepare(
      `INSERT INTO attachments(id, transaction_id, original_filename, file_path, mime_type, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, payload.transaction_id, filename, destination, mimeFromExt(filename), stat.size, createdAt)

    const row = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as Record<string, unknown>
    return mapAttachment(row)
  },

  async openFolder(transactionId: string): Promise<{ ok: true }> {
    const { storageDir } = getAppDataPaths()
    const txDir = join(storageDir, transactionId)

    mkdirSync(txDir, { recursive: true })
    await shell.openPath(txDir)

    return { ok: true }
  },
}
