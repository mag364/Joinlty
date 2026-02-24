import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { DollarSign, Receipt, Scale, Target } from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'
import { api } from '@renderer/lib/api'
import type { BudgetPeriod, BudgetTarget, Category } from '@shared/types'
import { BUDGET_CATEGORY_EXCLUSIONS, formatMonthYear } from '@renderer/lib/dates'
import { BudgetOverview } from './BudgetOverview'
import {
  progressFillClass,
  progressRailClass,
  progressTextClass,
  progressWidthTransitionClass,
} from './progressStyles'
import { Card, Pill, SectionHeader, StatCard } from '@renderer/components/ui'

export const BudgetManager = () => {
  const members = useAppStore((state) => state.members)
  const accounts = useAppStore((state) => state.accounts)
  const transactions = useAppStore((state) => state.transactions)

  const currentMonthKey = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  const [month, setMonth] = useState(() => currentMonthKey())
  const [periodMode, setPeriodMode] = useState<BudgetPeriod>('monthly')
  const [categories, setCategories] = useState<Category[]>([])
  const [budgetTargets, setBudgetTargets] = useState<BudgetTarget[]>([])
  const [loading, setLoading] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryKind, setNewCategoryKind] = useState<'expense' | 'income' | ''>('expense')
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({})
  const [budgetPeriodDrafts, setBudgetPeriodDrafts] = useState<Record<string, BudgetPeriod>>({})
  const [expandedOwners, setExpandedOwners] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('couplebudget:budget-expanded-owners')
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  })
  const [hideIrrelevantByOwner, setHideIrrelevantByOwner] = useState<Record<string, boolean>>({})
  const [showHiddenByOwner, setShowHiddenByOwner] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('couplebudget:budget-show-hidden-by-owner')
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  })
  const [hiddenCategoryRows, setHiddenCategoryRows] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('couplebudget:budget-hidden-category-rows')
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  })
  const [budgetTrackerCollapsed, setBudgetTrackerCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('budgetTrackerCollapsed') === 'true'
    } catch {
      return false
    }
  })
  const [selectedOwnerKey, setSelectedOwnerKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem('budget:selected-owner-key') || null
    } catch {
      return null
    }
  })
  const trackerSectionRef = useRef<HTMLElement | null>(null)

  const loadBudgetData = async () => {
    setLoading(true)
    try {
      const [categoryRows, targetRows] = await Promise.all([api.listCategories(), api.listBudgetTargets()])
      setCategories(categoryRows)
      setBudgetTargets(targetRows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBudgetData()
  }, [])

  useEffect(() => {
    let lastKnownCurrentMonth = currentMonthKey()

    const syncCurrentMonth = () => {
      const latestCurrentMonth = currentMonthKey()
      if (latestCurrentMonth === lastKnownCurrentMonth) return

      setMonth((prev) => (prev === lastKnownCurrentMonth ? latestCurrentMonth : prev))
      lastKnownCurrentMonth = latestCurrentMonth
    }

    const timer = window.setInterval(syncCurrentMonth, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const categoryNames = useMemo(
    () =>
      Array.from(
        new Set([
          ...categories.filter((category) => category.active).map((category) => category.name),
          ...transactions.map((transaction) => transaction.category?.trim()).filter((value): value is string => Boolean(value)),
        ]),
      )
        .filter((name) => !BUDGET_CATEGORY_EXCLUSIONS.has(name))
        .sort((a, b) => a.localeCompare(b)),
    [categories, transactions],
  )

  const owners = useMemo<Array<{ owner_type: 'member' | 'joint'; owner_id: string; label: string }>>(() => {
    const personMembers = members.filter((member) => (member.member_type ?? 'person') === 'person')
    const nonPersonMembers = members.filter((member) => (member.member_type ?? 'person') !== 'person')

    return [
      ...personMembers.map((member) => ({ owner_type: 'member' as const, owner_id: member.id, label: member.name })),
      { owner_type: 'joint' as const, owner_id: 'joint-household', label: 'Household Joint' },
      ...nonPersonMembers.map((member) => ({ owner_type: 'member' as const, owner_id: member.id, label: member.name })),
    ]
  }, [members])

  useEffect(() => {
    setExpandedOwners((prev) => {
      let changed = false
      const next: Record<string, boolean> = { ...prev }
      for (const owner of owners) {
        const key = `${owner.owner_type}:${owner.owner_id}`
        if (!(key in next)) {
          next[key] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [owners])

  useEffect(() => {
    localStorage.setItem('couplebudget:budget-expanded-owners', JSON.stringify(expandedOwners))
  }, [expandedOwners])

  useEffect(() => {
    setHideIrrelevantByOwner((prev) => {
      let changed = false
      const next: Record<string, boolean> = { ...prev }
      for (const owner of owners) {
        const key = `${owner.owner_type}:${owner.owner_id}`
        if (!(key in next)) {
          next[key] = false
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [owners])

  useEffect(() => {
    setShowHiddenByOwner((prev) => {
      let changed = false
      const next: Record<string, boolean> = { ...prev }
      for (const owner of owners) {
        const key = `${owner.owner_type}:${owner.owner_id}`
        if (!(key in next)) {
          next[key] = false
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [owners])

  useEffect(() => {
    localStorage.setItem('couplebudget:budget-show-hidden-by-owner', JSON.stringify(showHiddenByOwner))
  }, [showHiddenByOwner])

  useEffect(() => {
    localStorage.setItem('couplebudget:budget-hidden-category-rows', JSON.stringify(hiddenCategoryRows))
  }, [hiddenCategoryRows])

  useEffect(() => {
    localStorage.setItem('budgetTrackerCollapsed', String(budgetTrackerCollapsed))
  }, [budgetTrackerCollapsed])

  useEffect(() => {
    if (selectedOwnerKey) {
      localStorage.setItem('budget:selected-owner-key', selectedOwnerKey)
      trackerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      localStorage.removeItem('budget:selected-owner-key')
    }
  }, [selectedOwnerKey])

  useEffect(() => {
    const nextDrafts: Record<string, string> = {}
    const nextPeriodDrafts: Record<string, BudgetPeriod> = {}
    for (const owner of owners) {
      for (const category of categoryNames) {
        const key = `${owner.owner_type}:${owner.owner_id}:${category}`
        const target = budgetTargets.find(
          (item) => item.owner_type === owner.owner_type && item.owner_id === owner.owner_id && item.category === category,
        )
        nextDrafts[key] = target ? String(target.amount) : ''
        nextPeriodDrafts[key] = target?.period ?? 'monthly'
      }
    }
    setBudgetDrafts(nextDrafts)
    setBudgetPeriodDrafts(nextPeriodDrafts)
  }, [budgetTargets, categoryNames, owners])

  const addCategory = async (event: FormEvent) => {
    event.preventDefault()
    const name = newCategoryName.trim()
    if (!name) return
    await api.createCategory({ name, kind: newCategoryKind || null })
    setNewCategoryName('')
    setNewCategoryKind('expense')
    await loadBudgetData()
  }

  const saveBudgetTarget = async (ownerType: 'member' | 'joint', ownerId: string, category: string) => {
    const key = `${ownerType}:${ownerId}:${category}`
    const parsed = Number(budgetDrafts[key] || 0)
    const period = budgetPeriodDrafts[key] ?? 'monthly'
    if (Number.isNaN(parsed) || parsed < 0) return

    await api.upsertBudgetTarget({
      owner_type: ownerType,
      owner_id: ownerId,
      category,
      amount: parsed,
      period,
      active: true,
    })

    const refreshed = await api.listBudgetTargets()
    setBudgetTargets(refreshed)
  }

  const accountById = useMemo(() => {
    const lookup = new Map<string, (typeof accounts)[number]>()
    for (const account of accounts) {
      lookup.set(account.id, account)
    }
    return lookup
  }, [accounts])

  const normalizeCategoryKey = (value: string) => value.trim().toLowerCase()

  const resolveMemberOwnerId = useCallback((rawOwnerId: string) => {
    const byId = members.find((member) => member.id === rawOwnerId)
    if (byId) return byId.id

    const byName = members.find((member) => member.name.trim().toLowerCase() === rawOwnerId.trim().toLowerCase())
    return byName?.id ?? rawOwnerId
  }, [members])

  const expenseOwnerForBudget = useCallback((tx: (typeof transactions)[number]) => {
    const account = tx.account_id ? accountById.get(tx.account_id) : undefined

    if (account?.type === 'credit_card') {
      return {
        owner_type: account.owner_type,
        owner_id: account.owner_type === 'member' ? resolveMemberOwnerId(account.owner_id) : account.owner_id,
      }
    }

    return {
      owner_type: tx.owner_type,
      owner_id: tx.owner_type === 'member' ? resolveMemberOwnerId(tx.owner_id) : tx.owner_id,
    }
  }, [accountById, resolveMemberOwnerId])

  const monthExpenses = transactions.filter((tx) => tx.type === 'expense' && tx.date.startsWith(month))
  const year = month.slice(0, 4)
  const yearExpenses = transactions.filter((tx) => tx.type === 'expense' && tx.date.startsWith(`${year}-`))
  const monthTransactions = transactions.filter((tx) => tx.date.startsWith(month))
  const yearTransactions = transactions.filter((tx) => tx.date.startsWith(`${year}-`))

  const selectedExpenseRows = periodMode === 'yearly' ? yearExpenses : monthExpenses
  const selectedTransactions = periodMode === 'yearly' ? yearTransactions : monthTransactions

  const spentForOwnerCategory = useCallback((ownerType: 'member' | 'joint', ownerId: string, category: string, period?: BudgetPeriod) => {
    const categoryKey = normalizeCategoryKey(category)
    const sourceRows = period ? (period === 'yearly' ? yearExpenses : monthExpenses) : selectedExpenseRows

    return sourceRows
      .filter((tx) => {
        const owner = expenseOwnerForBudget(tx)
        return (
          owner.owner_type === ownerType &&
          owner.owner_id === ownerId &&
          normalizeCategoryKey((tx.category ?? 'Uncategorized')) === categoryKey
        )
      })
      .reduce((sum, tx) => sum + tx.amount, 0)
  }, [monthExpenses, yearExpenses, selectedExpenseRows, expenseOwnerForBudget])

  const ownersForOverview = useMemo(
    () => owners.map((owner) => ({ owner_type: owner.owner_type, owner_id: owner.owner_id, displayName: owner.label })),
    [owners],
  )

  const selectedOwner = useMemo(() => {
    if (!selectedOwnerKey) return null
    return owners.find((owner) => `${owner.owner_type}:${owner.owner_id}` === selectedOwnerKey) ?? null
  }, [owners, selectedOwnerKey])

  const renderedOwners = useMemo(() => {
    if (!selectedOwnerKey) return owners
    return owners.filter((owner) => `${owner.owner_type}:${owner.owner_id}` === selectedOwnerKey)
  }, [owners, selectedOwnerKey])

  const ownerSummaries = useMemo(() => {
    const summary: Record<string, { income: number; expense: number; net: number; spent: number; target: number }> = {}
    const filteredTargets = budgetTargets.filter((target) => target.active && target.period === periodMode)

    for (const owner of owners) {
      const key = `${owner.owner_type}:${owner.owner_id}`
      const ownerRows = selectedTransactions.filter((tx) => {
        const resolved = expenseOwnerForBudget(tx)
        return resolved.owner_type === owner.owner_type && resolved.owner_id === owner.owner_id
      })

      const income = ownerRows.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0)
      const expense = ownerRows.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0)
      const target = filteredTargets
        .filter((item) => item.owner_type === owner.owner_type && item.owner_id === owner.owner_id)
        .reduce((sum, item) => sum + item.amount, 0)

      summary[key] = {
        income,
        expense,
        net: income - expense,
        spent: expense,
        target,
      }
    }

    return summary
  }, [owners, selectedTransactions, budgetTargets, periodMode, expenseOwnerForBudget])

  const householdSummary = useMemo(
    () =>
      Object.values(ownerSummaries).reduce(
        (totals, current) => {
          totals.income += current.income
          totals.expense += current.expense
          totals.net += current.net
          totals.target += current.target
          return totals
        },
        { income: 0, expense: 0, net: 0, target: 0 },
      ),
    [ownerSummaries],
  )

  const budgetUtilizationLabel =
    householdSummary.target > 0
      ? `${Math.round((householdSummary.expense / householdSummary.target) * 100)}% of target`
      : 'No active targets'

  const topCategories = useMemo(() => {
    const filteredTargets = budgetTargets.filter((target) => target.active && target.period === periodMode)
    const categoryPeriods = budgetTargets
      .filter((target) => target.active)
      .reduce<Record<string, Set<BudgetPeriod>>>((acc, target) => {
        const key = normalizeCategoryKey(target.category)
        if (!acc[key]) acc[key] = new Set<BudgetPeriod>()
        acc[key].add(target.period)
        return acc
      }, {})

    const monthlyOnlyCategoryKeys = new Set(
      Object.entries(categoryPeriods)
        .filter(([, periods]) => periods.has('monthly') && !periods.has('yearly'))
        .map(([categoryKey]) => categoryKey),
    )

    const categorySet = new Set<string>([
      ...categoryNames,
      ...filteredTargets.map((target) => target.category),
      ...selectedExpenseRows.map((tx) => tx.category?.trim()).filter((value): value is string => Boolean(value)),
    ])

    return Array.from(categorySet)
      .filter((category) => monthlyOnlyCategoryKeys.has(normalizeCategoryKey(category)))
      .map((category) => {
        const spent = owners.reduce(
          (sum, owner) => sum + spentForOwnerCategory(owner.owner_type, owner.owner_id, category, periodMode),
          0,
        )
        const target = filteredTargets.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0)

        return { category, spent, target }
      })
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 10)
  }, [budgetTargets, periodMode, categoryNames, selectedExpenseRows, owners, spentForOwnerCategory])

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPeriodMode('monthly')}
              className={`rounded-md px-3 py-1.5 ${periodMode === 'monthly' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('yearly')}
              className={`rounded-md px-3 py-1.5 ${periodMode === 'yearly' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Yearly
            </button>
          </div>
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => void loadBudgetData()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Household Income" value={`$${householdSummary.income.toFixed(2)}`} subtitle="Selected period" icon={DollarSign} />
        <StatCard title="Household Expense" value={`$${householdSummary.expense.toFixed(2)}`} subtitle="Selected period" icon={Receipt} />
        <StatCard
          title="Household Net"
          value={`$${householdSummary.net.toFixed(2)}`}
          subtitle="Income - expense"
          valueClassName={householdSummary.net < 0 ? 'text-red-600 tabular-nums' : 'text-slate-900 tabular-nums'}
          icon={Scale}
        />
        <StatCard
          title="Budget Utilization"
          value={householdSummary.target > 0 ? `$${householdSummary.target.toFixed(2)}` : '—'}
          subtitle={budgetUtilizationLabel}
          valueClassName="tabular-nums"
          icon={Target}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <BudgetOverview
            periodMode={periodMode}
            selectedMonth={month}
            owners={ownersForOverview}
            ownerSummaries={ownerSummaries}
            topCategories={topCategories}
            selectedOwnerKey={selectedOwnerKey}
            onSelectOwner={(ownerKey) => setSelectedOwnerKey(ownerKey)}
            variant="top-categories"
          />

          <section ref={trackerSectionRef}>
            <Card>
            <SectionHeader
              title="Budget Tracker"
              subtitle="Set category targets and monitor per-owner progress for the selected period."
              actions={
                <div className="flex items-center gap-2">
                  {selectedOwnerKey && (
                    <button
                      type="button"
                      onClick={() => setSelectedOwnerKey(null)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100"
                    >
                      Show All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setBudgetTrackerCollapsed((prev) => !prev)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100"
                  >
                    {budgetTrackerCollapsed ? 'Show' : 'Hide'}
                  </button>
                </div>
              }
            />

            {!budgetTrackerCollapsed && (
              <div className="space-y-4 p-5">
                {selectedOwner && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill>
                      Filtered to: {selectedOwner.label} ({selectedOwner.owner_type === 'member' ? 'Member' : 'Joint'})
                    </Pill>
                    <button
                      type="button"
                      onClick={() => setSelectedOwnerKey(null)}
                      className="text-xs font-medium text-slate-600 underline underline-offset-2"
                    >
                      Clear
                    </button>
                  </div>
                )}

                <form className="grid gap-2 md:grid-cols-4" onSubmit={addCategory}>
                  <input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="New category name"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={newCategoryKind}
                    onChange={(event) => setNewCategoryKind(event.target.value as 'expense' | 'income' | '')}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
                    Add Category
                  </button>
                  <p className="self-center text-xs text-slate-500">
                    Categories include those created in Transactions and in this form.
                  </p>
                </form>

                <div className="space-y-4">
        {renderedOwners.map((owner) => (
          <section key={`${owner.owner_type}:${owner.owner_id}`} className="rounded-lg border border-slate-200 p-3">
            {(() => {
              const ownerKey = `${owner.owner_type}:${owner.owner_id}`
              const hiddenCount = categoryNames.filter((category) => hiddenCategoryRows[`${ownerKey}:${category}`]).length
              const visibleCategories = categoryNames.filter((category) => {
                const rowKey = `${ownerKey}:${category}`
                const isHidden = hiddenCategoryRows[rowKey] ?? false
                if (isHidden && !(showHiddenByOwner[ownerKey] ?? false)) return false

                if (hideIrrelevantByOwner[ownerKey]) {
                    const draftKey = `${owner.owner_type}:${owner.owner_id}:${category}`
                    const budgetAmount = Number(budgetDrafts[draftKey] || 0)
                    const period = budgetPeriodDrafts[draftKey] ?? 'monthly'
                    const spent = spentForOwnerCategory(owner.owner_type, owner.owner_id, category, period)

                    return budgetAmount > 0 || spent > 0
                }

                return true
              })

              return (
                <>
            <button
              type="button"
              onClick={() =>
                setExpandedOwners((prev) => {
                  return { ...prev, [ownerKey]: !(prev[ownerKey] ?? true) }
                })
              }
              className="flex w-full items-center justify-between text-left"
            >
              <h3 className="text-sm font-semibold text-slate-700">
                {owner.label} <span className="text-xs uppercase text-slate-500">({owner.owner_type})</span>
              </h3>
              <span className="text-sm text-slate-500">
                {expandedOwners[ownerKey] ?? true ? '−' : '+'}
              </span>
            </button>

            <div className="mt-2 flex items-center justify-end">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={hideIrrelevantByOwner[ownerKey] ?? false}
                    onChange={(event) =>
                      setHideIrrelevantByOwner((prev) => ({
                        ...prev,
                        [ownerKey]: event.target.checked,
                      }))
                    }
                  />
                  Hide categories that don't apply
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={showHiddenByOwner[ownerKey] ?? false}
                    onChange={(event) =>
                      setShowHiddenByOwner((prev) => ({
                        ...prev,
                        [ownerKey]: event.target.checked,
                      }))
                    }
                  />
                  Show hidden ({hiddenCount})
                </label>
              </div>
            </div>

            {(expandedOwners[ownerKey] ?? true) && (
              <div className="mt-2 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2">Budget</th>
                    <th className="px-2 py-2">Period</th>
                    <th className="px-2 py-2">Spent</th>
                    <th className="px-2 py-2">Progress</th>
                    <th className="px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCategories.map((category) => {
                    const key = `${owner.owner_type}:${owner.owner_id}:${category}`
                    const budgetAmount = Number(budgetDrafts[key] || 0)
                    const period = budgetPeriodDrafts[key] ?? 'monthly'
                    const spent = spentForOwnerCategory(owner.owner_type, owner.owner_id, category, period)

                    const hasBudget = budgetAmount > 0
                    const ratio = hasBudget ? spent / budgetAmount : 0
                    const barWidth = hasBudget ? Math.min(100, Math.round(ratio * 100)) : spent > 0 ? 100 : 0

                    return (
                      <tr key={key} className="border-b border-slate-100">
                        <td className="px-2 py-2">{category}</td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={budgetDrafts[key] ?? ''}
                            onChange={(event) => setBudgetDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
                            className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={period}
                            onChange={(event) =>
                              setBudgetPeriodDrafts((prev) => ({
                                ...prev,
                                [key]: event.target.value as BudgetPeriod,
                              }))
                            }
                            className="rounded border border-slate-300 px-2 py-1 text-sm"
                          >
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </td>
                        <td className="px-2 py-2 tabular-nums">${spent.toFixed(2)} <span className="text-xs text-slate-500">({period === 'yearly' ? year : formatMonthYear(month)})</span></td>
                        <td className="px-2 py-2">
                          <div className={`w-56 ${progressRailClass}`}>
                            <div
                              className={`h-2 rounded-full ${progressFillClass(ratio, hasBudget)} ${progressWidthTransitionClass}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <p className={`mt-1 text-xs tabular-nums ${progressTextClass(ratio, hasBudget)}`}>
                            {hasBudget ? `${(ratio * 100).toFixed(0)}% of ${period} budget` : spent > 0 ? 'No budget set' : '0%'}
                          </p>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                              onClick={() => void saveBudgetTarget(owner.owner_type, owner.owner_id, category)}
                            >
                              Save
                            </button>
                            <button
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                              onClick={() =>
                                setHiddenCategoryRows((prev) => {
                                  const rowKey = `${ownerKey}:${category}`
                                  return {
                                    ...prev,
                                    [rowKey]: !(prev[rowKey] ?? false),
                                  }
                                })
                              }
                            >
                              {hiddenCategoryRows[`${ownerKey}:${category}`] ? 'Unhide' : 'Hide'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {visibleCategories.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2 py-3 text-center text-slate-500">
                        No matching categories. Turn off the hide filter or add categories/transactions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            )}
                </>
              )
            })()}
          </section>
        ))}
                </div>
              </div>
            )}
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <BudgetOverview
            periodMode={periodMode}
            selectedMonth={month}
            owners={ownersForOverview}
            ownerSummaries={ownerSummaries}
            topCategories={topCategories}
            selectedOwnerKey={selectedOwnerKey}
            onSelectOwner={(ownerKey) => setSelectedOwnerKey(ownerKey)}
            variant="member-budgets"
          />
        </div>
      </div>
    </section>
  )
}
