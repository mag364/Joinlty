import { getDb } from '../dbService'
import { makeId, nowIso } from '../utils'
import type { GenerationPreviewItem, Transaction } from '../../shared/types'

const monthBounds = (month: string) => {
  const [year, monthNum] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, monthNum - 1, 1))
  const end = new Date(Date.UTC(year, monthNum, 0))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    daysInMonth: end.getUTCDate(),
  }
}

const buildDate = (month: string, dayOfMonth: number) => {
  const { daysInMonth } = monthBounds(month)
  const day = Math.max(1, Math.min(dayOfMonth, daysInMonth))
  return `${month}-${String(day).padStart(2, '0')}`
}

const todayIso = () => new Date().toISOString().slice(0, 10)
const currentMonthIso = () => todayIso().slice(0, 7)

export const generationService = {
  preview(month: string): GenerationPreviewItem[] {
    const db = getDb()
    const rules = db
      .prepare('SELECT * FROM recurring_rules WHERE active = 1')
      .all() as Array<Record<string, unknown>>

    const settings = db
      .prepare('SELECT * FROM contribution_settings WHERE active = 1 AND contributes = 1')
      .all() as Array<Record<string, unknown>>

    const preview: GenerationPreviewItem[] = []

    for (const rule of rules) {
      const logKey = `rule:${String(rule.id)}:${month}`
      const exists = db.prepare('SELECT id FROM generation_log WHERE log_key = ?').get(logKey)
      if (exists) continue

      const ruleType = String(rule.rule_type)
      const transactionType: Transaction['type'] = ruleType === 'expense' ? 'expense' : 'income'
      const date = buildDate(month, Number(rule.day_of_month))
      const nextRunDate = String(rule.next_run_date ?? '')
      if (nextRunDate && date < nextRunDate) continue

      preview.push({
        source_type: 'recurring_rule',
        source_id: String(rule.id),
        month,
        log_key: logKey,
        transaction: {
          date,
          amount: Number(rule.amount),
          type: transactionType,
          category: (rule.category as string | null) ?? null,
          description: String(rule.name),
          owner_type: rule.owner_type as Transaction['owner_type'],
          owner_id: String(rule.owner_id),
          account_id: (rule.account_id as string | null) ?? null,
          from_account_id: null,
          to_account_id: null,
          tags: ['generated', 'recurring'],
          notes: `Generated for ${month}`,
        },
      })
    }

    for (const setting of settings) {
      const logKey = `contribution:${String(setting.id)}:${month}`
      const exists = db.prepare('SELECT id FROM generation_log WHERE log_key = ?').get(logKey)
      if (exists) continue

      const method = String(setting.method ?? 'fixed')
      let amount = 0
      if (method === 'fixed') amount = Number(setting.fixed_amount ?? 0)
      if (method === 'split') amount = Number(setting.fixed_amount ?? 0)
      if (method === 'percent_income') {
        const { start, end } = monthBounds(month)
        const incomes = db
          .prepare(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM transactions
             WHERE type = 'income' AND owner_type = 'member' AND owner_id = ? AND date BETWEEN ? AND ?`,
          )
          .get(String(setting.member_id), start, end) as { total: number }
        amount = (Number(incomes.total) * Number(setting.percent_income ?? 0)) / 100
      }

      if (amount <= 0) continue
      if (!setting.funding_account_id) continue

      const selectedJointRef = String(setting.joint_id)
      const jointAccountById = db
        .prepare(
          `SELECT id FROM accounts WHERE id = ? AND owner_type = 'joint' AND type IN ('checking', 'savings') LIMIT 1`,
        )
        .get(selectedJointRef) as { id: string } | undefined

      // Legacy fallback: older settings stored a joint owner_id (e.g. joint-household)
      // instead of a specific destination account id.
      const jointAccountByOwner = db
        .prepare(
          `SELECT id FROM accounts
           WHERE owner_type = 'joint' AND owner_id = ? AND type = 'checking'
           ORDER BY created_at ASC LIMIT 1`,
        )
        .get(selectedJointRef) as { id: string } | undefined

      const jointAccount = jointAccountById ?? jointAccountByOwner

      if (!jointAccount) continue

      preview.push({
        source_type: 'contribution_setting',
        source_id: String(setting.id),
        month,
        log_key: logKey,
        transaction: {
          date: `${month}-01`,
          amount,
          type: 'transfer',
          category: 'Joint Contribution',
          description: `Joint contribution ${month}`,
          owner_type: 'member',
          owner_id: String(setting.member_id),
          account_id: null,
          from_account_id: String(setting.funding_account_id),
          to_account_id: jointAccount.id,
          tags: ['generated', 'contribution'],
          notes: `Generated contribution for ${month}`,
        },
      })
    }

    return preview
  },

  commit(month: string) {
    const db = getDb()
    const preview = this.preview(month)
    const duePreview = preview.filter((item) => item.transaction.date <= todayIso())
    const now = nowIso()

    const insertTransaction = db.prepare(
      `INSERT INTO transactions(
         id, date, amount, type, category, description, owner_type, owner_id,
         account_id, from_account_id, to_account_id, tags, notes, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )

    const insertLog = db.prepare(
      `INSERT INTO generation_log(id, month, source_type, source_id, log_key, transaction_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )

    const tx = db.transaction(() => {
      for (const item of duePreview) {
        const txId = makeId()
        insertTransaction.run(
          txId,
          item.transaction.date,
          item.transaction.amount,
          item.transaction.type,
          item.transaction.category ?? null,
          item.transaction.description ?? null,
          item.transaction.owner_type,
          item.transaction.owner_id,
          item.transaction.account_id ?? null,
          item.transaction.from_account_id ?? null,
          item.transaction.to_account_id ?? null,
          JSON.stringify(item.transaction.tags ?? []),
          item.transaction.notes ?? null,
          now,
        )

        insertLog.run(makeId(), month, item.source_type, item.source_id, item.log_key, txId, now)
      }
    })

    tx()
    return { created: duePreview.length }
  },

  autoCommitDueForCurrentMonth() {
    const month = currentMonthIso()
    return this.commit(month)
  },
}
