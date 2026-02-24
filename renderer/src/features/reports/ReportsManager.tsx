import { useEffect, useState } from 'react'
import { BarChart3, CircleDollarSign, Coins, Filter, Landmark, PieChart, RefreshCw, TrendingUp, Users } from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'
import { api } from '@renderer/lib/api'
import type { GenerationPreviewItem, RecurringRule } from '@shared/types'
import type { AIExplainMonthResult, ReportsSummary } from '@shared/preload'
import { ownerDisplayName } from '@renderer/lib/owners'
import { formatMonthYear } from '@renderer/lib/dates'
import { Card, Pill, SectionHeader, StatCard } from '@renderer/components/ui'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export const ReportsManager = () => {
  const members = useAppStore((state) => state.members)
  const accounts = useAppStore((state) => state.accounts)
  const transactions = useAppStore((state) => state.transactions)

  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [summary, setSummary] = useState<ReportsSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [generationPreview, setGenerationPreview] = useState<GenerationPreviewItem[]>([])
  const [activeIncomeRules, setActiveIncomeRules] = useState<RecurringRule[]>([])
  const [activeExpenseRules, setActiveExpenseRules] = useState<RecurringRule[]>([])
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'member' | 'joint'>('all')
  const [explanationsByMonth, setExplanationsByMonth] = useState<Record<string, AIExplainMonthResult['explanation']>>({})
  const [explainLoading, setExplainLoading] = useState(false)
  const [explainMessage, setExplainMessage] = useState('')
  const [hasExplainAttempt, setHasExplainAttempt] = useState(false)

  const loadSummary = async () => {
    setLoadingSummary(true)
    setSummaryError(null)
    try {
      const [result, preview, rules] = await Promise.all([
        api.getReportsSummary(month),
        api.previewGeneration(month),
        api.listRecurringRules(),
      ])

      setSummary(result)
      setGenerationPreview(preview)
      setActiveIncomeRules(rules.filter((rule) => rule.rule_type === 'income' && rule.active))
      setActiveExpenseRules(rules.filter((rule) => rule.rule_type === 'expense' && rule.active))
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : 'Failed to load reports data.')
    } finally {
      setLoadingSummary(false)
    }
  }

  useEffect(() => {
    void loadSummary()
  }, [month])

  const monthTransactions = transactions.filter((transaction) => transaction.date.startsWith(month))

  const categorySummaries = Object.entries(
    monthTransactions.reduce<Record<string, { income: number; expense: number }>>((acc, transaction) => {
      const key = transaction.category ?? 'Uncategorized'
      const current = acc[key] ?? { income: 0, expense: 0 }

      if (transaction.type === 'income') {
        current.income += transaction.amount
      } else if (transaction.type === 'expense') {
        current.expense += transaction.amount
      }

      acc[key] = current
      return acc
    }, {}),
  )
    .map(([category, totals]) => ({
      category,
      income: totals.income,
      expense: totals.expense,
      net: totals.income - totals.expense,
    }))
    .filter((row) => Math.abs(row.net) > 0.0001)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

  const memberSummaries = Object.entries(
    monthTransactions.reduce<Record<string, { income: number; expense: number }>>((acc, transaction) => {
      const memberName =
        transaction.owner_type === 'member'
          ? members.find((candidate) => candidate.id === transaction.owner_id)?.name ?? transaction.owner_id
          : 'Joint'

      const current = acc[memberName] ?? { income: 0, expense: 0 }
      if (transaction.type === 'income') {
        current.income += transaction.amount
      } else if (transaction.type === 'expense') {
        current.expense += transaction.amount
      }

      acc[memberName] = current
      return acc
    }, {}),
  )
    .map(([member, totals]) => ({
      member,
      income: totals.income,
      expense: totals.expense,
      net: totals.income - totals.expense,
    }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))

  const jointTotal = monthTransactions
    .filter((transaction) => transaction.owner_type === 'joint')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const personalTotal = monthTransactions
    .filter((transaction) => transaction.owner_type === 'member')
    .reduce((sum, transaction) => sum + transaction.amount, 0)

  const trendMonths = Array.from(new Set(transactions.map((transaction) => transaction.date.slice(0, 7))))
    .sort()
    .slice(-6)
  const trendRows = trendMonths.map((trendMonth) => {
    const txs = transactions.filter((transaction) => transaction.date.startsWith(trendMonth))
    const income = txs.filter((transaction) => transaction.type === 'income').reduce((sum, transaction) => sum + transaction.amount, 0)
    const expense = txs.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0)
    return { month: trendMonth, income, expense, net: income - expense }
  })

  const pendingGeneratedIncome = generationPreview
    .filter((item) => item.transaction.type === 'income')
    .reduce((sum, item) => sum + item.transaction.amount, 0)

  const expectedRecurringIncome = activeIncomeRules.reduce((sum, rule) => sum + rule.amount, 0)
  const recurringSourceRows = [...activeIncomeRules, ...activeExpenseRules]
  const filteredRecurringSourceRows = recurringSourceRows.filter((rule) => {
    if (typeFilter !== 'all' && rule.rule_type !== typeFilter) return false
    if (ownerFilter !== 'all' && rule.owner_type !== ownerFilter) return false
    return true
  })

  const accountName = (accountRef?: string | null) => {
    if (!accountRef) return '—'
    return accounts.find((account) => account.id === accountRef)?.name ?? 'Unknown account'
  }

  const explainMonth = async (forceRefresh = false) => {
    setHasExplainAttempt(true)

    if (!forceRefresh && explanationsByMonth[month]) {
      setExplainMessage('Using cached explanation for this month.')
      return
    }

    setExplainLoading(true)
    setExplainMessage('')
    try {
      const result = await api.explainMonth({
        month,
        summary: {
          income: summary?.income ?? 0,
          expense: summary?.expense ?? 0,
          net: summary?.net ?? 0,
        },
        categoryTotals: categorySummaries.map(({ category, net }) => ({ category, total: net })),
        memberTotals: memberSummaries.map(({ member, net }) => ({ member, total: net })),
        trendRows,
      })

      if (!result.ok || !result.explanation) {
        setExplainMessage(result.message)
        return
      }

      setExplanationsByMonth((prev) => ({ ...prev, [month]: result.explanation }))
      setExplainMessage(result.message)
    } finally {
      setExplainLoading(false)
    }
  }

  const currentExplanation = explanationsByMonth[month]
  const retryEnabled = hasExplainAttempt || Boolean(currentExplanation)

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Category/member/joint trends and analytical summaries.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void loadSummary()}
            disabled={loadingSummary}
            className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loadingSummary ? 'animate-spin' : ''}`} />
            {loadingSummary ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {summaryError && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{summaryError}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Recorded Income" value={money.format(summary?.income ?? 0)} subtitle={formatMonthYear(month)} icon={CircleDollarSign} valueClassName="tabular-nums" />
        <StatCard title="Pending Generated Income" value={money.format(pendingGeneratedIncome)} subtitle={formatMonthYear(month)} icon={Landmark} valueClassName="tabular-nums" />
        <StatCard
          title="Expected Income / Month"
          value={money.format(expectedRecurringIncome)}
          subtitle="Active rules total"
          icon={PieChart}
          valueClassName="tabular-nums"
        />
        <StatCard
          title="Active Income Sources"
          value={`${activeIncomeRules.length}`}
          subtitle="Recurring income rules"
          icon={BarChart3}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Expense" value={money.format(summary?.expense ?? 0)} subtitle="Recorded this month" icon={Coins} valueClassName="tabular-nums" />
        <StatCard
          title="Net"
          value={money.format(summary?.net ?? 0)}
          subtitle="Recorded Income - Expense"
          icon={TrendingUp}
          valueClassName={`tabular-nums ${(summary?.net ?? 0) < 0 ? 'text-red-700' : 'text-emerald-700'}`}
        />
        <StatCard
          title="Joint vs Personal"
          value={`Joint ${money.format(jointTotal)}`}
          subtitle={`Personal ${money.format(personalTotal)}`}
          icon={Users}
          valueClassName="text-base font-semibold text-slate-900"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <SectionHeader title="Trend (last 6 months)" subtitle="Income, expense, and net trend lines by month." />
            <div className="p-5">
              {trendRows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">No trend data available yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Month</th>
                        <th className="px-3 py-2 text-right">Income</th>
                        <th className="px-3 py-2 text-right">Expense</th>
                        <th className="px-3 py-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendRows.map((row) => (
                        <tr key={row.month} className="border-t border-slate-100 transition hover:bg-slate-50">
                          <td className="px-3 py-3 text-slate-700">{formatMonthYear(row.month)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-700">{money.format(row.income)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-700">{money.format(row.expense)}</td>
                          <td className={`px-3 py-3 text-right tabular-nums font-medium ${row.net < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {money.format(row.net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Recurring Sources" subtitle="Active recurring income and expense rules with ownership details." />
            <div className="p-5">
              {filteredRecurringSourceRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  No recurring sources match the current filters.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Source</th>
                        <th className="px-3 py-2">Schedule</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecurringSourceRows.map((rule) => (
                        <tr key={rule.id} className="border-t border-slate-100 transition hover:bg-slate-50">
                          <td className="px-3 py-3">
                            <p className="font-medium text-slate-900">{rule.name}</p>
                            <p className="text-xs text-slate-500">
                              {rule.owner_type === 'member' ? 'Member' : 'Joint'}: {ownerDisplayName(rule.owner_type, rule.owner_id, members)} • Deposit: {accountName(rule.account_id)}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-slate-700">Monthly day {rule.day_of_month}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-medium text-slate-900">{money.format(rule.amount)}</td>
                          <td className="px-3 py-3">
                            <Pill tone={rule.rule_type === 'income' ? 'positive' : 'negative'}>{rule.rule_type}</Pill>
                          </td>
                          <td className="px-3 py-3">
                            <Pill tone={rule.active ? 'positive' : 'neutral'}>{rule.active ? 'Active' : 'Inactive'}</Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

        </div>

        <div className="space-y-6 self-start xl:sticky xl:top-6">
          <Card>
            <SectionHeader
              title="Explain My Month"
              subtitle="Generate a concise AI narrative for this month’s performance."
              actions={
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void explainMonth(false)}
                    disabled={explainLoading}
                    className="rounded bg-slate-900 px-3 py-2 text-xs text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {explainLoading ? 'Generating...' : 'Generate Explanation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void explainMonth(true)}
                    disabled={explainLoading || !retryEnabled}
                    className="rounded border border-slate-300 px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Retry
                  </button>
                </div>
              }
            />

            <div className="space-y-3 p-5 text-sm text-slate-700">
              {explainLoading && (
                <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">Generating AI explanation...</p>
              )}

              {explainMessage && (
                <p className={`rounded px-3 py-2 text-sm ${currentExplanation ? 'border border-slate-200 bg-slate-50 text-slate-600' : 'border border-amber-200 bg-amber-50 text-amber-700'}`}>
                  {explainMessage}
                </p>
              )}

              {currentExplanation ? (
                <div className="space-y-4 leading-relaxed">
                  <p className="font-medium text-slate-900">{currentExplanation.headline}</p>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Highlights</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {currentExplanation.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anomalies</p>
                    {currentExplanation.anomalies.length === 0 ? (
                      <p className="mt-1 text-slate-500">No major anomalies detected.</p>
                    ) : (
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {currentExplanation.anomalies.map((anomaly) => (
                          <li key={anomaly}>{anomaly}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested Actions</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {currentExplanation.actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-xs text-slate-500">Confidence: {currentExplanation.confidence}</p>
                  {currentExplanation.disclaimers.length > 0 && (
                    <p className="text-xs text-slate-500">{currentExplanation.disclaimers.join(' ')}</p>
                  )}
                </div>
              ) : (
                <p className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">Generate a concise AI narrative for this month’s performance.</p>
              )}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Filters" subtitle="Filter recurring source rows by type and owner." />
            <div className="grid gap-3 p-5">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Type</span>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | 'income' | 'expense')} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="all">All</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Owner</span>
                <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value as 'all' | 'member' | 'joint')} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="all">All</option>
                  <option value="member">Member</option>
                  <option value="joint">Joint</option>
                </select>
              </label>

              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p className="font-medium text-slate-700">{filteredRecurringSourceRows.length} source(s) shown</p>
                <p className="mt-0.5">Filters apply to the Income Sources table.</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTypeFilter('all')
                  setOwnerFilter('all')
                }}
                className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Filter className="h-4 w-4" />
                Reset Filters
              </button>
            </div>
          </Card>

          <Card>
            <SectionHeader title="By Member" subtitle="Member and joint totals for the selected month." />
            <div className="p-5">
              {memberSummaries.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">No member totals available for this month.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Member</th>
                        <th className="px-3 py-2 text-right">Income</th>
                        <th className="px-3 py-2 text-right">Expense</th>
                        <th className="px-3 py-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberSummaries.map((row) => (
                        <tr key={row.member} className="border-t border-slate-100">
                          <td className="px-3 py-3 font-medium text-slate-900">{row.member}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{money.format(row.income)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-700">{money.format(row.expense)}</td>
                          <td className={`px-3 py-3 text-right tabular-nums font-medium ${row.net < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {money.format(row.net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <SectionHeader title="By Category" subtitle="Top category totals for the selected month." />
            <div className="p-5">
              {categorySummaries.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">No category totals available for this month.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2 text-right">Income</th>
                        <th className="px-3 py-2 text-right">Expense</th>
                        <th className="px-3 py-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categorySummaries.map((row) => (
                        <tr key={row.category} className="border-t border-slate-100">
                          <td className="px-3 py-3 font-medium text-slate-900">{row.category}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-emerald-700">{money.format(row.income)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-700">{money.format(row.expense)}</td>
                          <td className={`px-3 py-3 text-right tabular-nums font-medium ${row.net < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {money.format(row.net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
