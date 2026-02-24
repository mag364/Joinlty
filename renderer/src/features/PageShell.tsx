import type { ReactNode } from 'react'

const screenDescriptions = {
  Dashboard: 'Overview of household totals and activity for the active month.',
  'Month View': 'Monthly rollup, generation workflow, and category snapshot.',
  Transactions: 'Ledger view for income, expenses, and transfers.',
  Expenses: 'Recurring expenses and contribution rules.',
  Members: 'Household members and contribution participation settings.',
  Accounts: 'Personal and joint account balances and ownership.',
  Income: 'One-time and recurring income stream management.',
  Budget: 'Category budgets by member and joint owners with month progress.',
  Taxes: 'Tax planning, tracking, and filing workflows for Jointly Tax.',
  Reports: 'Category/member/joint trends and analytical summaries.',
  Settings: 'Data directory details, import/export, and AI provider settings.',
} as const

type PageTitle = keyof typeof screenDescriptions

export const PageShell = ({ title, children }: { title: string; children: ReactNode }) => {
  const typedTitle = title as PageTitle
  const showPageHeader =
    typedTitle !== 'Dashboard' &&
    typedTitle !== 'Members' &&
    typedTitle !== 'Accounts' &&
    typedTitle !== 'Income' &&
    typedTitle !== 'Taxes' &&
    typedTitle !== 'Expenses' &&
    typedTitle !== 'Transactions' &&
    typedTitle !== 'Month View' &&
    typedTitle !== 'Reports' &&
    typedTitle !== 'Settings'

  return (
    <section className="space-y-6">
      {showPageHeader && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-600">{screenDescriptions[typedTitle]}</p>
          </div>
        </div>
      )}

      {children}
    </section>
  )
}
