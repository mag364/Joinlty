import type { OwnerType } from '@shared/types'
import { Card, Pill, SectionHeader } from '@renderer/components/ui'
import {
  progressFillClass,
  progressRailClass,
  progressTextClass,
  progressWidthTransitionClass,
} from './progressStyles'

type OwnerRow = {
  owner_type: OwnerType
  owner_id: string
  displayName: string
}

type OwnerSummary = {
  income: number
  expense: number
  net: number
  spent: number
  target: number
}

type CategoryRow = {
  category: string
  spent: number
  target: number
}

interface BudgetOverviewProps {
  periodMode: 'monthly' | 'yearly'
  selectedMonth: string
  owners: OwnerRow[]
  ownerSummaries: Record<string, OwnerSummary>
  topCategories: CategoryRow[]
  selectedOwnerKey: string | null
  onSelectOwner: (ownerKey: string) => void
  variant?: 'full' | 'top-categories' | 'member-budgets'
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const formatMoney = (value: number) => money.format(value)

const ratioFrom = (spent: number, target: number): number | null => {
  if (target <= 0) return null
  return spent / target
}

export const BudgetOverview = ({
  periodMode,
  owners,
  ownerSummaries,
  topCategories,
  selectedOwnerKey,
  onSelectOwner,
  variant = 'full',
}: BudgetOverviewProps) => {
  const showCategories = variant === 'full' || variant === 'top-categories'
  const showMembers = variant === 'full' || variant === 'member-budgets'

  return (
    <>
      {showCategories && (
        <Card>
          <SectionHeader
            title="Top Categories"
            subtitle={`Highest spend categories for the ${periodMode === 'monthly' ? 'selected month' : 'selected year'}.`}
          />
          <div className="overflow-x-auto p-5">
            <table className="min-w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[30%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2 text-right">Spent</th>
                  <th className="px-2 py-2 text-right">Target</th>
                  <th className="px-2 py-2 text-center">Progress</th>
                </tr>
              </thead>
              <tbody>
                {topCategories.map((row) => {
                  const ratio = ratioFrom(row.spent, row.target)
                  const hasTarget = ratio !== null
                  const progressValue = hasTarget ? ratio : row.spent > 0 ? 1 : 0
                  const progressWidth = Math.min(100, Math.max(0, progressValue * 100))

                  return (
                    <tr key={row.category} className="border-b border-slate-100">
                      <td className="px-2 py-2 font-medium text-slate-800">{row.category}</td>
                      <td className="px-2 py-2 text-right font-medium tabular-nums text-slate-700">{formatMoney(row.spent)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-600">
                        {row.target > 0 ? formatMoney(row.target) : '—'}
                      </td>
                      <td className="px-2 py-2">
                        <div className="ml-auto grid grid-cols-[9rem_3rem_3.5rem] items-center gap-2">
                          <div className={`${progressRailClass}`}>
                            <div
                              className={`h-2 rounded-full ${progressFillClass(progressValue, hasTarget)} ${progressWidthTransitionClass}`}
                              style={{ width: `${progressWidth}%` }}
                            />
                          </div>
                          <span className={`text-right text-xs tabular-nums ${progressTextClass(progressValue, hasTarget)}`}>
                            {hasTarget ? `${Math.round(progressValue * 100)}%` : '—'}
                          </span>
                          {hasTarget && progressValue > 1 ? <Pill tone="negative">Over</Pill> : <span />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {topCategories.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-4 text-center text-slate-500">
                      No category activity for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showMembers && (
        <Card>
          <SectionHeader title="Member Budgets" subtitle="Spending against targets for each owner." />
          <div className="space-y-3 p-5">
            {owners.map((owner) => {
              const key = `${owner.owner_type}:${owner.owner_id}`
              const summary = ownerSummaries[key] ?? { income: 0, expense: 0, net: 0, spent: 0, target: 0 }
              const ratio = ratioFrom(summary.spent, summary.target)
              const hasTarget = ratio !== null
              const progressValue = hasTarget ? ratio : summary.spent > 0 ? 1 : 0
              const progressWidth = Math.min(100, Math.max(0, progressValue * 100))
              const isSelected = selectedOwnerKey === key

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => onSelectOwner(key)}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    isSelected
                      ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-200'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-slate-800">{owner.displayName}</h3>
                    {hasTarget && progressValue > 1 && <Pill tone="negative">Over</Pill>}
                  </div>

                  <p className="mt-1 text-sm tabular-nums text-slate-600">
                    {formatMoney(summary.spent)} / {summary.target > 0 ? formatMoney(summary.target) : '—'}
                  </p>

                  <div className={`mt-2 w-full ${progressRailClass}`}>
                    <div
                      className={`h-2 rounded-full ${progressFillClass(progressValue, hasTarget)} ${progressWidthTransitionClass}`}
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                  <p className={`mt-1 text-xs tabular-nums ${progressTextClass(progressValue, hasTarget)}`}>
                    {hasTarget ? `${Math.round(progressValue * 100)}%` : '—'}
                  </p>

                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Income</dt>
                      <dd className="font-medium tabular-nums text-slate-700">{formatMoney(summary.income)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Expense</dt>
                      <dd className="font-medium tabular-nums text-slate-700">{formatMoney(summary.expense)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Net</dt>
                      <dd className={`font-medium tabular-nums ${summary.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {formatMoney(summary.net)}
                      </dd>
                    </div>
                  </dl>
                </button>
              )
            })}
          </div>
        </Card>
      )}
    </>
  )
}
