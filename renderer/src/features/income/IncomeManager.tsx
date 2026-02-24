import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Calendar, DollarSign, Filter, Repeat, Wallet } from 'lucide-react'
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

export const IncomeManager = () => {
  const members = useAppStore((state) => state.members)
  const accounts = useAppStore((state) => state.accounts)
  const transactions = useAppStore((state) => state.transactions)
  const createTransaction = useAppStore((state) => state.createTransaction)

  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [showSourcePanel, setShowSourcePanel] = useState(false)
  const [rulesLoading, setRulesLoading] = useState(true)
  const [rulesError, setRulesError] = useState<string | null>(null)

  const [date, setDate] = useState(() => getLocalTodayDate())
  const [amount, setAmount] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [ownerType, setOwnerType] = useState<'member' | 'joint'>('member')
  const [ownerId, setOwnerId] = useState('')
  const [depositAccountId, setDepositAccountId] = useState('')
  const [notes, setNotes] = useState('')

  const [incomeRules, setIncomeRules] = useState<RecurringRule[]>([])
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [editingRuleId, setEditingRuleId] = useState<string | undefined>()
  const [ruleSourceName, setRuleSourceName] = useState('')
  const [ruleAmount, setRuleAmount] = useState('')
  const [ruleOwnerType, setRuleOwnerType] = useState<'member' | 'joint'>('member')
  const [ruleOwnerId, setRuleOwnerId] = useState('')
  const [ruleDepositAccountId, setRuleDepositAccountId] = useState('')
  const [ruleDayOfMonth, setRuleDayOfMonth] = useState('1')
  const [ruleNextRunDate, setRuleNextRunDate] = useState(() => getLocalTodayDate())
  const [ruleActive, setRuleActive] = useState(true)

  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all')

  const loadIncomeRules = async () => {
    setRulesLoading(true)
    setRulesError(null)
    try {
      const rules = await api.listRecurringRules()
      setIncomeRules(rules.filter((rule) => rule.rule_type === 'income'))
    } catch (error) {
      setRulesError(error instanceof Error ? error.message : 'Failed to load recurring income sources.')
    } finally {
      setRulesLoading(false)
    }
  }

  useEffect(() => {
    void loadIncomeRules()
  }, [])

  const resetOneTimeForm = () => {
    setDate(getLocalTodayDate())
    setAmount('')
    setSourceName('')
    setOwnerType('member')
    setOwnerId('')
    setDepositAccountId('')
    setNotes('')
  }

  const closeIncomeModal = () => {
    setShowIncomeModal(false)
    resetOneTimeForm()
  }

  const oneTimeIncomeValid =
    !!date && Number(amount) > 0 && !!sourceName.trim() && !!ownerId.trim() && !!depositAccountId.trim()

  const createOneTimeIncome = async (event: FormEvent) => {
    event.preventDefault()
    const parsedAmount = Number(amount)
    if (!date || Number.isNaN(parsedAmount) || parsedAmount <= 0 || !sourceName.trim() || !ownerId.trim() || !depositAccountId.trim()) return

    await createTransaction({
      date,
      amount: parsedAmount,
      type: 'income',
      category: 'Income',
      description: sourceName.trim(),
      owner_type: ownerType,
      owner_id: ownerId.trim(),
      account_id: depositAccountId.trim(),
      from_account_id: null,
      to_account_id: null,
      tags: ['income', 'one-time'],
      notes: notes.trim() || null,
    })

    closeIncomeModal()
  }

  const resetRuleForm = () => {
    setEditingRuleId(undefined)
    setRuleSourceName('')
    setRuleAmount('')
    setRuleOwnerType('member')
    setRuleOwnerId('')
    setRuleDepositAccountId('')
    setRuleDayOfMonth('1')
    setRuleNextRunDate(getLocalTodayDate())
    setRuleActive(true)
  }

  const closeSourcePanel = () => {
    setShowSourcePanel(false)
    resetRuleForm()
    setPendingDeleteId(null)
  }

  const saveIncomeRule = async (event: FormEvent) => {
    event.preventDefault()
    const parsedAmount = Number(ruleAmount)
    const parsedDay = Number(ruleDayOfMonth)
    if (!ruleSourceName.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0 || !ruleOwnerId.trim() || !ruleDepositAccountId.trim() || Number.isNaN(parsedDay)) return

    await api.upsertRecurringRule({
      id: editingRuleId,
      rule_type: 'income',
      name: ruleSourceName.trim(),
      amount: parsedAmount,
      category: 'Income',
      owner_type: ruleOwnerType,
      owner_id: ruleOwnerId.trim(),
      account_id: ruleDepositAccountId.trim(),
      day_of_month: Math.min(31, Math.max(1, parsedDay)),
      next_run_date: ruleNextRunDate,
      active: ruleActive,
    })

    await loadIncomeRules()
    closeSourcePanel()
  }

  const editRule = (ruleId: string) => {
    const rule = incomeRules.find((candidate) => candidate.id === ruleId)
    if (!rule) return
    setEditingRuleId(rule.id)
    setRuleSourceName(rule.name)
    setRuleAmount(String(rule.amount))
    setRuleOwnerType(rule.owner_type)
    setRuleOwnerId(rule.owner_id)
    setRuleDepositAccountId(rule.account_id ?? '')
    setRuleDayOfMonth(String(rule.day_of_month))
    setRuleNextRunDate(rule.next_run_date)
    setRuleActive(rule.active)
    setShowSourcePanel(true)
  }

  const removeRule = async (ruleId: string) => {
    if (pendingDeleteId !== ruleId) {
      setPendingDeleteId(ruleId)
      return
    }

    await api.deleteRecurringRule({ id: ruleId })
    setPendingDeleteId(null)
    await loadIncomeRules()

    if (editingRuleId === ruleId) {
      closeSourcePanel()
    }
  }

  const oneTimeIncomeCount = transactions.filter((transaction) => transaction.type === 'income' && !transaction.tags.includes('generated')).length
  const activeSourceCount = incomeRules.filter((rule) => rule.active).length
  const monthlyRecurringTotal = incomeRules.filter((rule) => rule.active).reduce((sum, rule) => sum + rule.amount, 0)

  const upcomingSevenDaysCount = useMemo(() => {
    const today = new Date(`${getLocalTodayDate()}T00:00:00`)
    const limit = new Date(today)
    limit.setDate(limit.getDate() + 7)
    return incomeRules.filter((rule) => {
      if (!rule.active || !rule.next_run_date) return false
      const runDate = new Date(`${rule.next_run_date}T00:00:00`)
      return runDate >= today && runDate <= limit
    }).length
  }, [incomeRules])

  const filteredIncomeRules = useMemo(
    () =>
      incomeRules.filter((rule) => {
        if (ownerFilter !== 'all' && rule.owner_type !== ownerFilter) return false
        if (ownerFilter === 'member' && memberFilter !== 'all' && rule.owner_id !== memberFilter) return false
        if (activeFilter === 'active' && !rule.active) return false
        return true
      }),
    [incomeRules, ownerFilter, memberFilter, activeFilter],
  )

  const accountName = (accountRef?: string | null) => {
    if (!accountRef) return '—'
    return accounts.find((account) => account.id === accountRef)?.name ?? 'Unknown account'
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Income</h1>
          <p className="text-sm text-slate-500">One-time and recurring income stream management.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetRuleForm()
            setShowSourcePanel(true)
          }}
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
        >
          Add Recurring Income
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="One-time Recorded" value={`${oneTimeIncomeCount}`} subtitle="Income transactions" icon={Wallet} />
        <StatCard title="Active Sources" value={`${activeSourceCount}`} subtitle={`${incomeRules.length} total sources`} icon={Repeat} />
        <StatCard title="Monthly Recurring" value={money.format(monthlyRecurringTotal)} subtitle="Active source total" icon={DollarSign} />
        <StatCard title="Next 7 Days" value={`${upcomingSevenDaysCount}`} subtitle="Scheduled deposits" icon={Calendar} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionHeader
            title="Recurring Income Sources"
            subtitle="Manage monthly recurring deposits and ownership."
            actions={
              <button
                type="button"
                onClick={() => setShowIncomeModal(true)}
                className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              >
                One-time Income
              </button>
            }
          />

          <div className="space-y-4 p-5">
            {showSourcePanel && (
              <form className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2" onSubmit={saveIncomeRule}>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Source name</span>
                  <input value={ruleSourceName} onChange={(event) => setRuleSourceName(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Monthly amount</span>
                  <input type="number" step="0.01" value={ruleAmount} onChange={(event) => setRuleAmount(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Owner type</span>
                  <select value={ruleOwnerType} onChange={(event) => setRuleOwnerType(event.target.value as 'member' | 'joint')} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="member">Member</option>
                    <option value="joint">Joint</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Owner</span>
                  <select value={ruleOwnerId} onChange={(event) => setRuleOwnerId(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">{ruleOwnerType === 'joint' ? 'Select joint owner' : 'Select member'}</option>
                    {ruleOwnerType === 'joint' ? (
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
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Deposit account</span>
                  <select value={ruleDepositAccountId} onChange={(event) => setRuleDepositAccountId(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">Select account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Day of month</span>
                  <input type="number" min="1" max="31" value={ruleDayOfMonth} onChange={(event) => setRuleDayOfMonth(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Next run date</span>
                  <input type="date" value={ruleNextRunDate} onChange={(event) => setRuleNextRunDate(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" />
                </label>
                <label className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                  <input type="checkbox" checked={ruleActive} onChange={(event) => setRuleActive(event.target.checked)} /> Active
                </label>
                <div className="flex items-end gap-2">
                  <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
                    {editingRuleId ? 'Update Source' : 'Add Recurring Income'}
                  </button>
                  <button type="button" onClick={closeSourcePanel} className="rounded border border-slate-300 px-3 py-2 text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {rulesError && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{rulesError}</p>}

            {rulesLoading ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Loading recurring income sources...</div>
            ) : filteredIncomeRules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm font-medium text-slate-700">No recurring income sources found.</p>
                <button
                  type="button"
                  onClick={() => {
                    resetRuleForm()
                    setShowSourcePanel(true)
                  }}
                  className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  Add Recurring Income
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
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Schedule</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIncomeRules.map((rule) => {
                      const ownerLabel = `${rule.owner_type === 'member' ? 'Member' : 'Joint'}: ${ownerDisplayName(rule.owner_type, rule.owner_id, members)}`
                      const depositLabel = `Deposit: ${accountName(rule.account_id)}`
                      const meta = `${ownerLabel} • ${depositLabel}`

                      return (
                        <tr
                          key={rule.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => editRule(rule.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              editRule(rule.id)
                            }
                          }}
                          className="border-t border-slate-100 transition hover:bg-slate-50"
                        >
                          <td className="px-3 py-3">
                            <p className="font-medium text-slate-800">{rule.name}</p>
                            <p className="text-xs text-slate-500">{meta}</p>
                          </td>
                          <td className="px-3 py-3">Monthly day {rule.day_of_month}</td>
                          <td className="px-3 py-3 text-right font-medium tabular-nums">{money.format(rule.amount)}</td>
                          <td className="px-3 py-3">
                            <Pill tone={rule.active ? 'positive' : 'neutral'}>{rule.active ? 'Active' : 'Inactive'}</Pill>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  editRule(rule.id)
                                }}
                                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
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
            <SectionHeader title="Filters" subtitle="Narrow down recurring income sources." />
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
                <p className="font-medium text-slate-700">{filteredIncomeRules.length} source(s) shown</p>
                <p className="mt-0.5">Filters apply to recurring income list.</p>
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

      {showIncomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <SectionHeader title="Add Income" subtitle="Record a one-time income deposit." />
            <form className="grid gap-3 p-5 md:grid-cols-2" onSubmit={createOneTimeIncome}>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Date</span>
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Amount</span>
                <input type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Source name</span>
                <input value={sourceName} onChange={(event) => setSourceName(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Owner type</span>
                <select value={ownerType} onChange={(event) => setOwnerType(event.target.value as 'member' | 'joint')} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
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
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Deposit account</span>
                <select value={depositAccountId} onChange={(event) => setDepositAccountId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
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
                <input value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <div className="flex gap-2 md:col-span-2 md:justify-end">
                <button type="button" onClick={closeIncomeModal} className="rounded border border-slate-300 px-3 py-2 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!oneTimeIncomeValid}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  One-time Income
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
