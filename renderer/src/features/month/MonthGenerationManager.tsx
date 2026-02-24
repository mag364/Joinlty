import { useMemo, useState } from 'react'
import { CalendarClock, CalendarRange, CheckCircle2, Clock3, ListChecks } from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'
import { api } from '@renderer/lib/api'
import type { GenerationPreviewItem } from '@shared/types'
import { formatMonthYear, getLocalTodayDate } from '@renderer/lib/dates'
import { Card, Pill, SectionHeader, StatCard } from '@renderer/components/ui'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export const MonthGenerationManager = () => {
  const refreshCoreData = useAppStore((state) => state.refreshCoreData)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [preview, setPreview] = useState<GenerationPreviewItem[]>([])
  const [hasLoadedPreview, setHasLoadedPreview] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCreated, setLastCreated] = useState<number | null>(null)
  const today = getLocalTodayDate()
  const duePreview = useMemo(() => preview.filter((item) => item.transaction.date <= today), [preview, today])
  const futurePreview = useMemo(() => preview.filter((item) => item.transaction.date > today), [preview, today])

  const loadPreview = async () => {
    setLoadingPreview(true)
    setError(null)
    try {
      const result = await api.previewGeneration(month)
      setPreview(result)
      setHasLoadedPreview(true)
      setLastCreated(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load month preview.')
    } finally {
      setLoadingPreview(false)
    }
  }

  const commit = async () => {
    setCommitting(true)
    setError(null)
    try {
      const result = await api.commitGeneration(month)
      setLastCreated(result.created)
      await loadPreview()
      await refreshCoreData()
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : 'Failed to commit month generation.')
    } finally {
      setCommitting(false)
    }
  }

  const incomeItems = preview.filter((item) => item.transaction.type === 'income')
  const expenseItems = preview.filter((item) => item.transaction.type === 'expense')
  const incomeTotal = incomeItems.reduce((sum, item) => sum + item.transaction.amount, 0)
  const expenseTotal = expenseItems.reduce((sum, item) => sum + item.transaction.amount, 0)

  const showIncome = hasLoadedPreview && preview.length > 0
  const showExpense = hasLoadedPreview && preview.length > 0

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Month View</h1>
          <p className="text-sm text-slate-500">Monthly rollup, generation workflow, and category snapshot.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadPreview()}
            className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            {loadingPreview ? 'Loading...' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => void commit()}
            disabled={committing || duePreview.length === 0}
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {committing ? 'Committing...' : 'Commit'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Preview Items" value={hasLoadedPreview ? `${preview.length}` : '—'} subtitle={formatMonthYear(month)} icon={ListChecks} />
        <StatCard title="Income" value={showIncome ? money.format(incomeTotal) : '—'} subtitle="Preview total" icon={CalendarClock} valueClassName="tabular-nums" />
        <StatCard title="Expense" value={showExpense ? money.format(expenseTotal) : '—'} subtitle="Preview total" icon={CheckCircle2} valueClassName="tabular-nums" />
        <StatCard title="Future Items" value={hasLoadedPreview ? `${futurePreview.length}` : '—'} subtitle={`${duePreview.length} due now`} icon={Clock3} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionHeader title="Preview Items" subtitle="Preview generated transactions before committing." />

          <div className="space-y-4 p-5">
            {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            {loadingPreview ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Loading preview items...</div>
            ) : preview.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm font-medium text-slate-700">No pending generated items for selected month.</p>
                <button type="button" onClick={() => void loadPreview()} className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm text-white">
                  Preview
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((item) => {
                      const isDue = item.transaction.date <= today
                      return (
                        <tr key={item.log_key} className="border-t border-slate-100 transition hover:bg-slate-50">
                          <td className="px-3 py-3 capitalize text-slate-700">{item.source_type}</td>
                          <td className="px-3 py-3 text-slate-700">{item.transaction.date}</td>
                          <td className="px-3 py-3">
                            <Pill tone={item.transaction.type === 'income' ? 'positive' : item.transaction.type === 'expense' ? 'negative' : 'neutral'}>
                              {item.transaction.type}
                            </Pill>
                          </td>
                          <td className="px-3 py-3 text-slate-800">{item.transaction.description ?? '—'}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-medium text-slate-900">{money.format(item.transaction.amount)}</td>
                          <td className="px-3 py-3">
                            <Pill tone={isDue ? 'positive' : 'neutral'}>{isDue ? 'Due' : 'Future'}</Pill>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6 self-start xl:sticky xl:top-6">
          <Card>
            <SectionHeader title="Month Generation" subtitle="Generate preview items for a month and commit them when ready." />
            <div className="space-y-3 p-5">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Month</span>
                <div className="relative">
                  <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="month"
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 pl-9 text-sm"
                  />
                </div>
              </label>

              {committing || loadingPreview ? (
                <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {committing ? 'Committing month generation...' : 'Loading month preview...'}
                </p>
              ) : null}

              {lastCreated !== null && (
                <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Created transactions: {lastCreated}</p>
              )}

              {preview.length > 0 && duePreview.length === 0 && (
                <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">No due items yet (all are future-dated).</p>
              )}

              {(duePreview.length === 0 || !hasLoadedPreview) && (
                <p className="text-xs text-slate-500">Preview for the selected month first. Commit is enabled when due items are present.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
