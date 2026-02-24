import { basename, join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { clearAllData, getAppDataPaths, getDb } from '../dbService'
import { nowIso } from '../utils'
import type { FullDataBackupPayload, FullDataImportResult } from '../../shared/preload'

const sanitizeFilename = (name: string) => {
  const trimmed = basename(name || '').trim()
  return trimmed.length > 0 ? trimmed : 'attachment.bin'
}

export const settingsService = {
  getAll(): Record<string, string> {
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
    return rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.key] = row.value
      return acc
    }, {})
  },

  set(key: string, value: string) {
    const db = getDb()
    db.prepare(
      `INSERT INTO settings(key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).run(key, value, nowIso())
    return { ok: true as const }
  },

  clearAll() {
    clearAllData({ seedDefaults: false })
    return { ok: true as const }
  },

  exportAllData(): FullDataBackupPayload {
    const db = getDb()

    const members = db.prepare('SELECT * FROM members ORDER BY sort_order ASC, created_at ASC').all() as Array<Record<string, unknown>>
    const joints = db.prepare('SELECT * FROM joints ORDER BY created_at ASC').all() as Array<Record<string, unknown>>
    const accounts = db.prepare('SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC').all() as Array<Record<string, unknown>>
    const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all() as Array<Record<string, unknown>>
    const transactions = db.prepare('SELECT * FROM transactions ORDER BY date ASC, created_at ASC').all() as Array<Record<string, unknown>>
    const recurringRules = db.prepare('SELECT * FROM recurring_rules ORDER BY created_at ASC').all() as Array<Record<string, unknown>>
    const contributionSettings = db.prepare('SELECT * FROM contribution_settings ORDER BY created_at ASC').all() as Array<Record<string, unknown>>
    const generationLog = db.prepare('SELECT * FROM generation_log ORDER BY created_at ASC').all() as Array<Record<string, unknown>>
    const attachments = db.prepare('SELECT * FROM attachments ORDER BY created_at ASC').all() as Array<Record<string, unknown>>
    const settings = db.prepare('SELECT * FROM settings ORDER BY key ASC').all() as Array<Record<string, unknown>>
    const budgetTargets = db.prepare('SELECT * FROM budget_targets ORDER BY owner_type, owner_id, category').all() as Array<Record<string, unknown>>

    return {
      format: 'jointly-full-backup-v1',
      exported_at: nowIso(),
      data: {
        members: members.map((row) => ({
          ...row,
          active: Boolean(row.active),
        })) as FullDataBackupPayload['data']['members'],
        joints: joints.map((row) => ({
          ...row,
          active: Boolean(row.active),
        })) as FullDataBackupPayload['data']['joints'],
        accounts: accounts as unknown as FullDataBackupPayload['data']['accounts'],
        categories: categories.map((row) => ({
          ...row,
          active: Boolean(row.active),
        })) as FullDataBackupPayload['data']['categories'],
        transactions: transactions.map((row) => ({
          ...row,
          tags: typeof row.tags === 'string' ? JSON.parse(String(row.tags || '[]')) : row.tags,
        })) as FullDataBackupPayload['data']['transactions'],
        recurring_rules: recurringRules.map((row) => ({
          ...row,
          active: Boolean(row.active),
        })) as FullDataBackupPayload['data']['recurring_rules'],
        contribution_settings: contributionSettings.map((row) => ({
          ...row,
          contributes: Boolean(row.contributes),
          active: Boolean(row.active),
        })) as FullDataBackupPayload['data']['contribution_settings'],
        generation_log: generationLog as FullDataBackupPayload['data']['generation_log'],
        attachments: attachments.map((row) => {
          const filePath = String(row.file_path ?? '')
          const fileDataBase64 = existsSync(filePath) ? readFileSync(filePath).toString('base64') : null
          return {
            id: String(row.id),
            transaction_id: String(row.transaction_id),
            original_filename: String(row.original_filename),
            mime_type: String(row.mime_type),
            size: Number(row.size ?? 0),
            created_at: String(row.created_at),
            file_data_base64: fileDataBase64,
          }
        }),
        settings: settings.map((row) => ({
          key: String(row.key),
          value: String(row.value),
          updated_at: String(row.updated_at),
        })),
        budget_targets: budgetTargets.map((row) => ({
          ...row,
          active: Boolean(row.active),
        })) as FullDataBackupPayload['data']['budget_targets'],
      },
    }
  },

  importAllData(payload: FullDataBackupPayload): FullDataImportResult {
    const db = getDb()
    const { storageDir } = getAppDataPaths()

    clearAllData({ seedDefaults: false })
    rmSync(storageDir, { recursive: true, force: true })
    mkdirSync(storageDir, { recursive: true })

    const insertAll = db.transaction(() => {
      for (const item of payload.data.members ?? []) {
        db.prepare(
          `INSERT INTO members(id, name, member_type, color, avatar, active, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          item.id,
          item.name,
          item.member_type,
          item.color ?? null,
          item.avatar ?? null,
          item.active ? 1 : 0,
          Number(item.sort_order ?? 0),
          item.created_at,
          item.updated_at,
        )
      }

      for (const item of payload.data.joints ?? []) {
        db.prepare(
          `INSERT INTO joints(id, name, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(item.id, item.name, item.active ? 1 : 0, item.created_at, item.updated_at)
      }

      for (const item of payload.data.accounts ?? []) {
        db.prepare(
          `INSERT INTO accounts(id, name, type, owner_type, owner_id, starting_balance, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          item.id,
          item.name,
          item.type,
          item.owner_type,
          item.owner_id,
          item.starting_balance,
          Number(item.sort_order ?? 0),
          item.created_at,
          item.updated_at,
        )
      }

      for (const item of payload.data.categories ?? []) {
        db.prepare(
          `INSERT INTO categories(id, name, kind, active, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(item.id, item.name, item.kind ?? null, item.active ? 1 : 0, item.created_at)
      }

      for (const item of payload.data.transactions ?? []) {
        db.prepare(
          `INSERT INTO transactions(id, date, amount, type, category, description, owner_type, owner_id, account_id, from_account_id, to_account_id, tags, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          item.id,
          item.date,
          item.amount,
          item.type,
          item.category ?? null,
          item.description ?? null,
          item.owner_type,
          item.owner_id,
          item.account_id ?? null,
          item.from_account_id ?? null,
          item.to_account_id ?? null,
          JSON.stringify(item.tags ?? []),
          item.notes ?? null,
          item.created_at,
        )
      }

      for (const item of payload.data.recurring_rules ?? []) {
        db.prepare(
          `INSERT INTO recurring_rules(id, rule_type, name, amount, category, owner_type, owner_id, account_id, schedule, day_of_month, next_run_date, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          item.id,
          item.rule_type,
          item.name,
          item.amount,
          item.category ?? null,
          item.owner_type,
          item.owner_id,
          item.account_id ?? null,
          item.schedule,
          item.day_of_month,
          item.next_run_date,
          item.active ? 1 : 0,
          item.created_at,
          item.updated_at,
        )
      }

      for (const item of payload.data.contribution_settings ?? []) {
        db.prepare(
          `INSERT INTO contribution_settings(id, member_id, joint_id, contributes, method, fixed_amount, percent_income, split_mode, weight, funding_account_id, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          item.id,
          item.member_id,
          item.joint_id,
          item.contributes ? 1 : 0,
          item.method ?? null,
          item.fixed_amount ?? null,
          item.percent_income ?? null,
          item.split_mode ?? null,
          item.weight ?? null,
          item.funding_account_id ?? null,
          item.active ? 1 : 0,
          item.created_at,
          item.updated_at,
        )
      }

      for (const item of payload.data.generation_log ?? []) {
        db.prepare(
          `INSERT INTO generation_log(id, month, source_type, source_id, log_key, transaction_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(item.id, item.month, item.source_type, item.source_id, item.log_key, item.transaction_id ?? null, item.created_at)
      }

      for (const item of payload.data.settings ?? []) {
        db.prepare(
          `INSERT INTO settings(key, value, updated_at)
           VALUES (?, ?, ?)`,
        ).run(item.key, item.value, item.updated_at)
      }

      for (const item of payload.data.budget_targets ?? []) {
        db.prepare(
          `INSERT INTO budget_targets(id, owner_type, owner_id, category, amount, period, active, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(item.id, item.owner_type, item.owner_id, item.category, item.amount, item.period, item.active ? 1 : 0, item.updated_at)
      }
    })

    insertAll()

    for (const attachment of payload.data.attachments ?? []) {
      const filename = sanitizeFilename(attachment.original_filename)
      const txDir = join(storageDir, attachment.transaction_id)
      const destination = join(txDir, filename)

      mkdirSync(txDir, { recursive: true })
      if (attachment.file_data_base64) {
        writeFileSync(destination, Buffer.from(attachment.file_data_base64, 'base64'))
      }

      db.prepare(
        `INSERT INTO attachments(id, transaction_id, original_filename, file_path, mime_type, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        attachment.id,
        attachment.transaction_id,
        attachment.original_filename,
        destination,
        attachment.mime_type,
        attachment.size,
        attachment.created_at,
      )
    }

    return {
      ok: true,
      importedAt: nowIso(),
      counts: {
        members: payload.data.members?.length ?? 0,
        joints: payload.data.joints?.length ?? 0,
        accounts: payload.data.accounts?.length ?? 0,
        categories: payload.data.categories?.length ?? 0,
        transactions: payload.data.transactions?.length ?? 0,
        recurring_rules: payload.data.recurring_rules?.length ?? 0,
        contribution_settings: payload.data.contribution_settings?.length ?? 0,
        generation_log: payload.data.generation_log?.length ?? 0,
        attachments: payload.data.attachments?.length ?? 0,
        settings: payload.data.settings?.length ?? 0,
        budget_targets: payload.data.budget_targets?.length ?? 0,
      },
    }
  },
}
