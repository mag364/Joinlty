import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarClock, Filter, ListChecks, Repeat, TrendingDown } from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'
import { api } from '@renderer/lib/api'
import type { RecurringRule } from '@shared/types'
import { getLocalTodayDate } from '@renderer/lib/dates'
import { ownerDisplayName } from '@renderer/lib/owners'
import { Card, Pill, SectionHeader, StatCard } from '@renderer/components/ui'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

type OwnerFilter = 'all' | 'member' | 'joint'
type ActiveFilter = 'all' | 'active'
type MemberFilter = 'all' | string

export const RecurringManager = () => {
  const members = useAppStore((state) => state.members)
  const accounts = useAppStore((state) => state.accounts)
  const createTransaction = useAppStore((state) => state.createTransaction)

  const [rules, setRules] = useState<RecurringRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [showOneTimeExpenseModal, setShowOneTimeExpenseModal] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [ownerType, setOwnerType] = useState<'member' | 'joint'>('member')
  const [ownerId, setOwnerId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [nextRunDate, setNextRunDate] = useState(() => getLocalTodayDate())
  const [active, setActive] = useState(true)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const [expenseDate, setExpenseDate] = useState(() => getLocalTodayDate())
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseName, setExpenseName] = useState('')
  const [expenseOwnerType, setExpenseOwnerType] = useState<'member' | 'joint'>('member')
  const [expenseOwnerId, setExpenseOwnerId] = useState('')
  const [expenseAccountId, setExpenseAccountId] = useState('')
  const [expenseNotes, setExpenseNotes] = useState('')

  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all')

  const loadRules = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.listRecurringRules()
      setRules(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load recurring rules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRules()
  }, [])

  const resetForm = () => {
    setEditingId(undefined)
    setName('')
    setAmount('')
    setCategory('')
    setOwnerType('member')
    setOwnerId('')
    setAccountId('')
    setDayOfMonth('1')
    setNextRunDate(getLocalTodayDate())
    setActive(true)
    setPendingDeleteId(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    resetForm()
  }

  const ruleFormValid = !!name.trim() && Number(amount) > 0 && !!ownerId.trim() && Number(dayOfMonth) >= 1 && Number(dayOfMonth) <= 31

  const oneTimeExpenseValid =
    !!expenseDate &&
    Number(expenseAmount) > 0 &&
    !!expenseName.trim() &&
    !!expenseOwnerId.trim() &&
    !!expenseAccountId.trim()

  const resetOneTimeExpenseForm = () => {
    setExpenseDate(getLocalTodayDate())
    setExpenseAmount('')
    setExpenseName('')
    setExpenseOwnerType('member')
    setExpenseOwnerId('')
    setExpenseAccountId('')
    setExpenseNotes('')
  }

  const closeOneTimeExpenseModal = () => {
    setShowOneTimeExpenseModal(false)
    resetOneTimeExpenseForm()
  }

  const createOneTimeExpense = async (event: FormEvent) => {
    event.preventDefault()
    const parsedAmount = Number(expenseAmount)
    if (!expenseDate || Number.isNaN(parsedAmount) || parsedAmount <= 0 || !expenseName.trim() || !expenseOwnerId.trim() || !expenseAccountId.trim()) return

    await createTransaction({
      date: expenseDate,
      amount: parsedAmount,
      type: 'expense',
      category: 'Expense',
      description: expenseName.trim(),
      owner_type: expenseOwnerType,
      owner_id: expenseOwnerId.trim(),
      account_id: expenseAccountId.trim(),
      from_account_id: null,
      to_account_id: null,
      tags: ['expense', 'one-time'],
      notes: expenseNotes.trim() || null,
    })

    closeOneTimeExpenseModal()
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const parsedAmount = Number(amount)
    const parsedDay = Number(dayOfMonth)
    if (!name.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0 || !ownerId.trim() || Number.isNaN(parsedDay)) return

    await api.upsertRecurringRule({
      id: editingId,
      rule_type: 'expense',
      name: name.trim(),
      amount: parsedAmount,
      category: category.trim() || null,
      owner_type: ownerType,
      owner_id: ownerId.trim(),
      account_id: accountId.trim() || null,
      day_of_month: Math.min(31, Math.max(1, parsedDay)),
      next_run_date: nextRunDate,
      active,
    })

    await loadRules()
    closeModal()
  }

  const beginEdit = (ruleId: string) => {
    const rule = rules.find((candidate) => candidate.id === ruleId)
    if (!rule) return
    setEditingId(rule.id)
    setName(rule.name)
    setAmount(String(rule.amount))
    setCategory(rule.category ?? '')
    setOwnerType(rule.owner_type)
    setOwnerId(rule.owner_id)
    setAccountId(rule.account_id ?? '')
    setDayOfMonth(String(rule.day_of_month))
    setNextRunDate(rule.next_run_date)
    setActive(rule.active)
    setShowModal(true)
  }

  const removeRule = async (ruleId: string) => {
    if (pendingDeleteId !== ruleId) {
      setPendingDeleteId(ruleId)
      return
    }

    await api.deleteRecurringRule({ id: ruleId })
    setPendingDeleteId(null)
    await loadRules()

    if (editingId === ruleId) {
      closeModal()
    }
  }

  const expenseRules = useMemo(() => rules.filter((rule) => rule.rule_type === 'expense'), [rules])

  const filteredRules = useMemo(
    () =>
      expenseRules.filter((rule) => {
        if (ownerFilter !== 'all' && rule.owner_type !== ownerFilter) return false
        if (ownerFilter === 'member' && memberFilter !== 'all' && rule.owner_id !== memberFilter) return false
        if (activeFilter === 'active' && !rule.active) return false
        return true
      }),
    [expenseRules, ownerFilter, memberFilter, activeFilter],
  )

  const activeRules = expenseRules.filter((rule) => rule.active)
  const activeMonthlyTotal = activeRules.reduce((sum, rule) => sum + rule.amount, 0)

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500">Recurring expense rules.</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
        >
          Add Recurring Expense
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Active Rules" value={`${activeRules.length}`} subtitle={`${expenseRules.length} total rules`} icon={ListChecks} />
        <StatCard title="Expense Rules" value={`${expenseRules.length}`} subtitle="Recurring outflows" icon={TrendingDown} />
        <StatCard title="Filtered Rules" value={`${filteredRules.length}`} subtitle="Current filter results" icon={Filter} />
        <StatCard title="Monthly Total" value={money.format(activeMonthlyTotal)} subtitle="Active rules amount" icon={Repeat} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionHeader
            title="Recurring Expense Rules"
            subtitle="Manage recurring expense rules across your household."
            actions={
              <button
                type="button"
                onClick={() => setShowOneTimeExpenseModal(true)}
                className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              >
                One-time Expense
              </button>
            }
          />

          <div className="space-y-4 p-5">
            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p>{error}</p>
                <button type="button" onClick={() => void loadRules()} className="mt-2 rounded border border-red-300 px-2 py-1 text-xs text-red-700 transition hover:bg-red-100">
                  Retry
                </button>
              </div>
            )}

            {loading ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Loading recurring rules...</div>
            ) : filteredRules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm font-medium text-slate-700">No recurring rules found.</p>
                <p className="mt-1 text-sm text-slate-500">Try changing filters or create a new recurring rule.</p>
                <button type="button" onClick={openAddModal} className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm text-white">
                  Add Rule
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[40%]" />
                    <col className="w-[18%]" />
                    <col className="w-[16%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Rule</th>
                      <th className="px-3 py-2">Schedule</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRules.map((rule) => {
                      const ownerLabel = ownerDisplayName(rule.owner_type, rule.owner_id, members)
                      const categoryLabel = rule.category?.trim() ? rule.category : null
                      const meta = categoryLabel ? `${categoryLabel} • ${ownerLabel}` : ownerLabel

                      return (
                        <tr
                          key={rule.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => beginEdit(rule.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              beginEdit(rule.id)
                            }
                          }}
                          className="border-t border-slate-100 transition hover:bg-slate-50"
                        >
                          <td className="px-3 py-3">
                            <p className="font-medium text-slate-900">{rule.name}</p>
                            <p className="text-xs text-slate-500">{meta}</p>
                          </td>
                          <td className="px-3 py-3 text-slate-700">
                            <p>Monthly day {rule.day_of_month}</p>
                            <p className="text-xs text-slate-500">Next run: {rule.next_run_date}</p>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums font-medium text-slate-900">{money.format(rule.amount)}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={rule.active ? 'positive' : 'neutral'}>{rule.active ? 'Active' : 'Inactive'}</Pill>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-center gap-2">
                              <button
                                type="button"
                                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  beginEdit(rule.id)
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50"
                                title={pendingDeleteId === rule.id ? 'Click again to confirm delete' : undefined}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void removeRule(rule.id)
                                }}
                              >
                                {pendingDeleteId === rule.id ? 'Confirm' : 'Delete'}
                              </button>
                            </div>
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

        <div className="space-y-6">
          <Card>
            <SectionHeader title="Filters" subtitle="Narrow down recurring rules." />
            <div className="grid gap-3 p-5">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Owner</span>
                <select
                  value={ownerFilter}
                  onChange={(event) => {
                    const nextOwnerFilter = event.target.value as OwnerFilter
                    setOwnerFilter(nextOwnerFilter)
                    if (nextOwnerFilter !== 'member') {
                      setMemberFilter('all')
                    }
                  }}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="member">Member</option>
                  <option value="joint">Joint</option>
                </select>
              </label>

              {ownerFilter === 'member' && (
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Member</span>
                  <select
                    value={memberFilter}
                    onChange={(event) => setMemberFilter(event.target.value as MemberFilter)}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">All members</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</span>
                <select
                  value={activeFilter}
                  onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="active">Active only</option>
                </select>
              </label>

              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p className="font-medium text-slate-700">{filteredRules.length} rule(s) shown</p>
                <p className="mt-0.5">Filters apply to the list on the left.</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOwnerFilter('all')
                  setMemberFilter('all')
                  setActiveFilter('all')
                }}
                className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                <Filter className="h-4 w-4" />
                Reset Filters
              </button>
            </div>
          </Card>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <SectionHeader
              title={editingId ? 'Edit Rule' : 'Add Rule'}
              subtitle={editingId ? 'Update this recurring expense rule.' : 'Create a recurring expense rule.'}
              actions={<CalendarClock className="h-4 w-4 text-slate-500" />}
            />

            <form className="grid gap-3 p-5 md:grid-cols-2" onSubmit={onSubmit}>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Rule name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Amount</span>
                <input type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Category</span>
                <input value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Owner type</span>
                <select
                  value={ownerType}
                  onChange={(event) => setOwnerType(event.target.value as 'member' | 'joint')}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="member">Member</option>
                  <option value="joint">Joint</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Owner</span>
                <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  <option value="">{ownerType === 'joint' ? 'Select joint owner' : 'Select member'}</option>
                  {ownerType === 'joint' ? (
                    <option value="joint-household">Household Joint</option>
                  ) : (
                    members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Account (optional)</span>
                <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  <option value="">No account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Day of month</span>
                <input type="number" min="1" max="31" value={dayOfMonth} onChange={(event) => setDayOfMonth(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Next run date</span>
                <input type="date" value={nextRunDate} onChange={(event) => setNextRunDate(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm">
                <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active
              </label>

              <div className="flex gap-2 md:col-span-2 md:justify-end">
                <button type="button" onClick={closeModal} className="rounded border border-slate-300 px-3 py-2 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!ruleFormValid}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editingId ? 'Save Rule' : 'Add Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOneTimeExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <SectionHeader title="One-time Expense" subtitle="Record a one-time expense transaction." />
            <form className="grid gap-3 p-5 md:grid-cols-2" onSubmit={createOneTimeExpense}>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Date</span>
                <input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Amount</span>
                <input type="number" step="0.01" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Expense name</span>
                <input value={expenseName} onChange={(event) => setExpenseName(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Owner type</span>
                <select
                  value={expenseOwnerType}
                  onChange={(event) => setExpenseOwnerType(event.target.value as 'member' | 'joint')}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="member">Member</option>
                  <option value="joint">Joint</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Owner</span>
                <select value={expenseOwnerId} onChange={(event) => setExpenseOwnerId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  <option value="">{expenseOwnerType === 'joint' ? 'Select joint owner' : 'Select member'}</option>
                  {expenseOwnerType === 'joint' ? (
                    <option value="joint-household">Household Joint</option>
                  ) : (
                    members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Account</span>
                <select value={expenseAccountId} onChange={(event) => setExpenseAccountId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Notes</span>
                <input value={expenseNotes} onChange={(event) => setExpenseNotes(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <div className="flex gap-2 md:col-span-2 md:justify-end">
                <button type="button" onClick={closeOneTimeExpenseModal} className="rounded border border-slate-300 px-3 py-2 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!oneTimeExpenseValid}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  One-time Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
