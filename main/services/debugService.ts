import { getDb } from '../dbService'
import { parseAccountRow } from '../db/rowCodecs/accountRow'
import { parseAttachmentRow } from '../db/rowCodecs/attachmentRow'
import { parseBudgetTargetRow } from '../db/rowCodecs/budgetTargetRow'
import { parseCategoryRow } from '../db/rowCodecs/categoryRow'
import { parseContributionSettingRow } from '../db/rowCodecs/contributionSettingRow'
import { parseMemberRow } from '../db/rowCodecs/memberRow'
import { parseRecurringRow } from '../db/rowCodecs/recurringRow'
import { parseTransactionRow } from '../db/rowCodecs/transactionRow'

type EnumInventory = {
  transactions: { type: string[]; owner_type: string[] }
  accounts: { type: string[]; owner_type: string[] }
  recurring: { rule_type: string[]; owner_type: string[] }
  budget_targets: { owner_type: string[]; period: string[] }
  contribution_settings: { method: string[]; split_mode: string[] }
}

type IntegrityFailure = {
  table: string
  id: string | null
  errorMessage: string
}

type DbIntegrityCheckResult = {
  checkedRows: Record<string, number>
  totalRows: number
  totalFailures: number
  failures: IntegrityFailure[]
  truncated: boolean
}

const distinctStrings = (table: string, column: string): string[] => {
  const db = getDb()
  const rows = db
    .prepare(`SELECT DISTINCT ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL ORDER BY ${column} ASC`)
    .all() as Array<{ value: unknown }>

  return rows.map((row) => String(row.value))
}

export const debugService = {
  getEnumInventory(): EnumInventory {
    return {
      transactions: {
        type: distinctStrings('transactions', 'type'),
        owner_type: distinctStrings('transactions', 'owner_type'),
      },
      accounts: {
        type: distinctStrings('accounts', 'type'),
        owner_type: distinctStrings('accounts', 'owner_type'),
      },
      recurring: {
        rule_type: distinctStrings('recurring_rules', 'rule_type'),
        owner_type: distinctStrings('recurring_rules', 'owner_type'),
      },
      budget_targets: {
        owner_type: distinctStrings('budget_targets', 'owner_type'),
        period: distinctStrings('budget_targets', 'period'),
      },
      contribution_settings: {
        method: distinctStrings('contribution_settings', 'method'),
        split_mode: distinctStrings('contribution_settings', 'split_mode'),
      },
    }
  },

  runDbIntegrityCheck(): DbIntegrityCheckResult {
    const db = getDb()
    const maxFailures = 50
    const failures: IntegrityFailure[] = []
    let totalFailures = 0

    const checkedRows: Record<string, number> = {
      transactions: 0,
      accounts: 0,
      members: 0,
      categories: 0,
      recurring_rules: 0,
      contribution_settings: 0,
      attachments: 0,
      budget_targets: 0,
    }

    const checkTable = (table: keyof typeof checkedRows, parser: (row: unknown) => unknown) => {
      const rows = db.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>
      checkedRows[table] = rows.length

      for (const row of rows) {
        try {
          parser(row)
        } catch (error) {
          totalFailures += 1
          if (failures.length < maxFailures) {
            failures.push({
              table,
              id: row.id == null ? null : String(row.id),
              errorMessage: error instanceof Error ? error.message : 'Unknown parse error',
            })
          }
        }
      }
    }

    checkTable('transactions', parseTransactionRow)
    checkTable('accounts', parseAccountRow)
    checkTable('members', parseMemberRow)
    checkTable('categories', parseCategoryRow)
    checkTable('recurring_rules', parseRecurringRow)
    checkTable('contribution_settings', parseContributionSettingRow)
    checkTable('attachments', parseAttachmentRow)
    checkTable('budget_targets', parseBudgetTargetRow)

    const totalRows = Object.values(checkedRows).reduce((sum, count) => sum + count, 0)

    return {
      checkedRows,
      totalRows,
      totalFailures,
      failures,
      truncated: totalFailures > maxFailures,
    }
  },
}
