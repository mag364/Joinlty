import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Bot, CheckCheck, Filter, ListChecks, PlusCircle, ReceiptText } from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'
import { api } from '@renderer/lib/api'
import type { Category } from '@shared/types'
import { formatMonthYear, getLocalTodayDate } from '@renderer/lib/dates'
import { Card, Pill, SectionHeader, StatCard } from '@renderer/components/ui'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export const TransactionsManager = () => {
  const members = useAppStore((state) => state.members)
  const accounts = useAppStore((state) => state.accounts)
  const transactions = useAppStore((state) => state.transactions)
  const createTransaction = useAppStore((state) => state.createTransaction)
  const updateTransaction = useAppStore((state) => state.updateTransaction)
  const deleteTransaction = useAppStore((state) => state.deleteTransaction)

  const [showModal, setShowModal] = useState(false)
  const [date, setDate] = useState(() => getLocalTodayDate())
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [txType, setTxType] = useState<'expense' | 'income' | 'transfer'>('expense')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [ownerType, setOwnerType] = useState<'member' | 'joint'>('member')
  const [ownerId, setOwnerId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [suggestingFields, setSuggestingFields] = useState(false)
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false)
  const [aiAssistMessage, setAiAssistMessage] = useState<string>('')
  const [duplicateWarning, setDuplicateWarning] = useState<{
    likelyDuplicate: boolean
    confidence: 'low' | 'medium' | 'high'
    matchedTransactionIds: string[]
    reasoning: string
  } | null>(null)
  const [managedCategories, setManagedCategories] = useState<Category[]>([])

  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income' | 'transfer'>('all')
  const [filterOwnerType, setFilterOwnerType] = useState<'all' | 'member' | 'joint'>('all')
  const [filterMemberId, setFilterMemberId] = useState('all')
  const [filterTerm, setFilterTerm] = useState('')
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('couplebudget:tx-expanded-years')
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  })
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('couplebudget:tx-expanded-months')
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  })

  const [editingHasUploads, setEditingHasUploads] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const confirmWithRefocus = (message: string) => {
    const confirmed = window.confirm(message)
    requestAnimationFrame(() => {
      window.focus()
    })
    return confirmed
  }

  const loadManagedCategories = async () => {
    const rows = await api.listCategories()
    setManagedCategories(rows)
  }

  useEffect(() => {
    void loadManagedCategories()
  }, [])

  const categorySuggestions = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...managedCategories.filter((entry) => entry.active).map((entry) => entry.name.trim()),
          ...transactions.map((tx) => tx.category?.trim()).filter((value): value is string => Boolean(value)),
        ].filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b))
  }, [managedCategories, transactions])

  const uploadAttachmentForTransaction = async (transactionId: string) => {
    const selectedPath = await api.pickFile()
    if (!selectedPath) return

    await api.createAttachment({
      transaction_id: transactionId,
      file_path: selectedPath,
    })
  }

  const checkEditingTransactionHasUploads = async (transactionId: string) => {
    const existing = await api.listAttachments(transactionId)
    setEditingHasUploads(existing.length > 0)
  }

  const viewUploadsForEditingTransaction = async () => {
    if (!editingTransactionId) return
    await api.openAttachmentFolder(editingTransactionId)
  }

  const accountLabel = (accountRef?: string | null) => {
    if (!accountRef) return '—'
    const account = accounts.find((candidate) => candidate.id === accountRef)
    return account ? account.name : 'Unknown account'
  }

  const ownerLabel = (ownerRef: string) => {
    if (ownerRef === 'joint-household') return 'Household Joint'
    const member = members.find((candidate) => candidate.id === ownerRef)
    return member ? member.name : ownerRef
  }

  const selectableAccounts = accounts.filter((account) => {
    if (ownerType === 'member') {
      if (!ownerId) return account.owner_type === 'member'
      return account.owner_type === 'member' && account.owner_id === ownerId
    }

    if (!ownerId) return account.owner_type === 'joint'
    return account.owner_type === 'joint' && account.owner_id === ownerId
  })

  const resetForm = () => {
    setEditingTransactionId(null)
    setDate(getLocalTodayDate())
    setAmount('')
    setTxType('expense')
    setCategory('')
    setDescription('')
    setOwnerType('member')
    setOwnerId('')
    setAccountId('')
    setFromAccountId('')
    setToAccountId('')
    setTags('')
    setNotes('')
    setAiAssistMessage('')
    setDuplicateWarning(null)
    setEditingHasUploads(false)
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

  const suggestFromDescription = async () => {
    const trimmedDescription = description.trim()
    if (!trimmedDescription) {
      setAiAssistMessage('Add a description first, then click Suggest.')
      return
    }

    setSuggestingFields(true)
    setAiAssistMessage('')
    try {
      const result = await api.suggestTransactionFields({
        description: trimmedDescription,
        amount: amount ? Number(amount) : null,
        date,
        type: txType,
        owner_type: ownerType,
        owner_id: ownerId || null,
        categories: categorySuggestions,
        accounts: accounts.map((account) => ({
          id: account.id,
          name: account.name,
          owner_type: account.owner_type,
          owner_id: account.owner_id,
          type: account.type,
        })),
        recentTransactions: transactions.slice(0, 200).map((tx) => ({
          id: tx.id,
          date: tx.date,
          amount: tx.amount,
          type: tx.type,
          category: tx.category ?? null,
          description: tx.description ?? null,
          owner_type: tx.owner_type,
          owner_id: tx.owner_id,
          account_id: tx.account_id ?? null,
          from_account_id: tx.from_account_id ?? null,
          to_account_id: tx.to_account_id ?? null,
          tags: tx.tags,
        })),
      })

      if (!result.ok || !result.suggestion) {
        setAiAssistMessage(result.message)
        return
      }

      if (!category.trim() && result.suggestion.category) setCategory(result.suggestion.category)
      if (!tags.trim() && result.suggestion.tags.length > 0) setTags(result.suggestion.tags.join(', '))
      if (!ownerId && result.suggestion.owner_type && result.suggestion.owner_id) {
        setOwnerType(result.suggestion.owner_type)
        setOwnerId(result.suggestion.owner_id)
      }

      if (txType !== 'transfer' && !accountId && result.suggestion.account_id) {
        setAccountId(result.suggestion.account_id)
      }

      setAiAssistMessage(`${result.message} (${result.suggestion.confidence} confidence)`)
    } finally {
      setSuggestingFields(false)
    }
  }

  const checkDuplicateRisk = async () => {
    const parsedAmount = Number(amount)
    if (!date || Number.isNaN(parsedAmount) || parsedAmount <= 0 || !ownerId.trim()) {
      setAiAssistMessage('Set date, amount, and owner before duplicate check.')
      return null
    }

    setDuplicateCheckLoading(true)
    setAiAssistMessage('')
    try {
      const response = await api.detectDuplicateTransaction({
        draft: {
          date,
          amount: parsedAmount,
          type: txType,
          category: category.trim() || null,
          description: description.trim() || null,
          owner_type: ownerType,
          owner_id: ownerId.trim(),
          account_id: txType === 'transfer' ? null : accountId.trim() || null,
          from_account_id: txType === 'transfer' ? fromAccountId.trim() || null : null,
          to_account_id: txType === 'transfer' ? toAccountId.trim() || null : null,
        },
        recentTransactions: transactions.slice(0, 300).map((tx) => ({
          id: tx.id,
          date: tx.date,
          amount: tx.amount,
          type: tx.type,
          category: tx.category ?? null,
          description: tx.description ?? null,
          owner_type: tx.owner_type,
          owner_id: tx.owner_id,
          account_id: tx.account_id ?? null,
          from_account_id: tx.from_account_id ?? null,
          to_account_id: tx.to_account_id ?? null,
          tags: tx.tags,
        })),
      })

      setAiAssistMessage(response.message)
      setDuplicateWarning(response.result ?? null)
      return response.result ?? null
    } finally {
      setDuplicateCheckLoading(false)
    }
  }

  const triggerSuggestFromPanel = async () => {
    if (!showModal) {
      setShowModal(true)
      setAiAssistMessage('Add details in the modal, then click Suggest again.')
      return
    }
    await suggestFromDescription()
  }

  const triggerDuplicateFromPanel = async () => {
    if (!showModal) {
      setShowModal(true)
      setAiAssistMessage('Fill required fields in the modal, then click Check Duplicate again.')
      return
    }
    await checkDuplicateRisk()
  }

  const transactionFormValid = (() => {
    const parsedAmount = Number(amount)
    if (!date || Number.isNaN(parsedAmount) || parsedAmount <= 0 || !ownerId.trim()) return false
    if (txType === 'transfer') {
      return !!fromAccountId.trim() && !!toAccountId.trim() && fromAccountId !== toAccountId
    }
    return !!accountId.trim()
  })()

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const parsedAmount = Number(amount)
    if (!date || Number.isNaN(parsedAmount) || parsedAmount <= 0 || !ownerId.trim()) return

    if (txType === 'transfer') {
      if (!fromAccountId.trim() || !toAccountId.trim() || fromAccountId === toAccountId) return
    } else {
      if (!accountId.trim()) return
    }

    const payload = {
      date,
      amount: parsedAmount,
      type: txType,
      category: category.trim() || null,
      description: description.trim() || null,
      owner_type: ownerType,
      owner_id: ownerId.trim(),
      account_id: txType === 'transfer' ? null : accountId.trim(),
      from_account_id: txType === 'transfer' ? fromAccountId.trim() : null,
      to_account_id: txType === 'transfer' ? toAccountId.trim() : null,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      notes: notes.trim() || null,
    }

    if (!editingTransactionId) {
      const duplicateResult = await checkDuplicateRisk()
      if (duplicateResult?.likelyDuplicate) {
        const proceed = confirmWithRefocus(
          `Potential duplicate detected (${duplicateResult.confidence}).\n${duplicateResult.reasoning}\nMatches: ${duplicateResult.matchedTransactionIds.join(', ') || 'n/a'}\n\nCreate anyway?`,
        )
        if (!proceed) return
      }
    }

    if (editingTransactionId) {
      await updateTransaction({ id: editingTransactionId, transaction: payload })
    } else {
      await createTransaction(payload)
    }

    closeModal()
  }

  const beginEdit = (transactionId: string) => {
    const transaction = transactions.find((candidate) => candidate.id === transactionId)
    if (!transaction) return

    setEditingTransactionId(transaction.id)
    setDate(transaction.date)
    setAmount(String(transaction.amount))
    setTxType(transaction.type)
    setCategory(transaction.category ?? '')
    setDescription(transaction.description ?? '')
    setOwnerType(transaction.owner_type)
    setOwnerId(transaction.owner_id)
    setAccountId(transaction.account_id ?? '')
    setFromAccountId(transaction.from_account_id ?? '')
    setToAccountId(transaction.to_account_id ?? '')
    setTags(transaction.tags.join(', '))
    setNotes(transaction.notes ?? '')
    setEditingHasUploads(false)
    setShowModal(true)
    void checkEditingTransactionHasUploads(transaction.id)
  }

  const removeTransaction = async (transactionId: string) => {
    if (pendingDeleteId !== transactionId) {
      setPendingDeleteId(transactionId)
      return
    }

    await deleteTransaction({ id: transactionId })
    setPendingDeleteId(null)

    if (editingTransactionId === transactionId) {
      closeModal()
    }
  }

  const filteredTransactions = transactions.filter((transaction) => {
    if (filterType !== 'all' && transaction.type !== filterType) return false
    if (filterOwnerType !== 'all' && transaction.owner_type !== filterOwnerType) return false
    if (filterOwnerType === 'member' && filterMemberId !== 'all' && transaction.owner_id !== filterMemberId) return false

    if (!filterTerm.trim()) return true
    const term = filterTerm.trim().toLowerCase()
    return (
      transaction.description?.toLowerCase().includes(term) ||
      transaction.category?.toLowerCase().includes(term) ||
      transaction.owner_id.toLowerCase().includes(term) ||
      transaction.tags.some((tag) => tag.toLowerCase().includes(term))
    )
  })

  const groupedTransactions = filteredTransactions.reduce<Record<string, Record<string, typeof filteredTransactions>>>(
    (acc, transaction) => {
      const year = transaction.date.slice(0, 4)
      const month = transaction.date.slice(0, 7)
      if (!acc[year]) acc[year] = {}
      if (!acc[year][month]) acc[year][month] = []
      acc[year][month].push(transaction)
      return acc
    },
    {},
  )

  const sortedYears = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a))

  const toggleYear = (year: string) => {
    setExpandedYears((prev) => ({ ...prev, [year]: !(prev[year] ?? true) }))
  }

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => ({ ...prev, [month]: !(prev[month] ?? true) }))
  }

  useEffect(() => {
    localStorage.setItem('couplebudget:tx-expanded-years', JSON.stringify(expandedYears))
  }, [expandedYears])

  useEffect(() => {
    localStorage.setItem('couplebudget:tx-expanded-months', JSON.stringify(expandedMonths))
  }, [expandedMonths])

  useEffect(() => {
    if (txType === 'transfer') return
    if (!accountId) return
    const exists = selectableAccounts.some((account) => account.id === accountId)
    if (!exists) setAccountId('')
  }, [txType, accountId, selectableAccounts])

  useEffect(() => {
    if (filterOwnerType !== 'member') {
      setFilterMemberId('all')
      return
    }

    if (filterMemberId === 'all') return
    const stillExists = members.some((member) => member.id === filterMemberId)
    if (!stillExists) setFilterMemberId('all')
  }, [filterOwnerType, filterMemberId, members])

  useEffect(() => {
    if (!showModal || !editingTransactionId) return

    const refreshUploadState = () => {
      void checkEditingTransactionHasUploads(editingTransactionId)
    }

    window.addEventListener('focus', refreshUploadState)
    document.addEventListener('visibilitychange', refreshUploadState)

    return () => {
      window.removeEventListener('focus', refreshUploadState)
      document.removeEventListener('visibilitychange', refreshUploadState)
    }
  }, [showModal, editingTransactionId])

  const incomeTotal = filteredTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const expenseTotal = filteredTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const net = incomeTotal - expenseTotal

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500">Ledger view for income, expenses, and transfers.</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
        >
          Add Transaction
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Transactions" value={`${filteredTransactions.length}`} subtitle="Current filtered view" icon={ListChecks} />
        <StatCard title="Income" value={money.format(incomeTotal)} subtitle="Filtered total" icon={PlusCircle} valueClassName="tabular-nums text-emerald-700" />
        <StatCard title="Expense" value={money.format(expenseTotal)} subtitle="Filtered total" icon={ReceiptText} valueClassName="tabular-nums text-rose-700" />
        <StatCard title="Net" value={money.format(net)} subtitle="Income - expense" icon={Filter} valueClassName={`tabular-nums ${net < 0 ? 'text-rose-700' : 'text-emerald-700'}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionHeader title="Ledger" subtitle="Grouped by year and month for quick scanning and edits." />

          <div className="space-y-4 p-5">
            {sortedYears.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm font-medium text-slate-700">No transactions match the current filters.</p>
                <button type="button" onClick={openAddModal} className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm text-white">
                  Add Transaction
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedYears.map((year) => {
                  const yearExpanded = expandedYears[year] ?? true
                  const months = Object.keys(groupedTransactions[year]).sort((a, b) => b.localeCompare(a))

                  return (
                    <section key={year} className="overflow-hidden rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => toggleYear(year)}
                        className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700"
                      >
                        <span>{year}</span>
                        <span>{yearExpanded ? '−' : '+'}</span>
                      </button>

                      {yearExpanded && (
                        <div className="space-y-2 p-2">
                          {months.map((month) => {
                            const monthExpanded = expandedMonths[month] ?? true
                            const monthRows = groupedTransactions[year][month]

                            return (
                              <section key={month} className="overflow-hidden rounded border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => toggleMonth(month)}
                                  className="flex w-full items-center justify-between bg-white px-4 py-2 text-left text-sm font-medium text-slate-700"
                                >
                                  <span>{formatMonthYear(month)}</span>
                                  <span>{monthExpanded ? '−' : '+'}</span>
                                </button>

                                {monthExpanded && (
                                  <div className="overflow-auto">
                                    <table className="min-w-full text-sm">
                                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                                        <tr>
                                          <th className="px-3 py-2">Date</th>
                                          <th className="px-3 py-2">Details</th>
                                          <th className="px-3 py-2">Account Flow</th>
                                          <th className="px-3 py-2">Type</th>
                                          <th className="px-3 py-2 text-right">Amount</th>
                                          <th className="px-3 py-2 text-center">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {monthRows.map((transaction) => {
                                          const amountTone =
                                            transaction.type === 'income'
                                              ? 'text-emerald-700'
                                              : transaction.type === 'expense'
                                                ? 'text-rose-700'
                                                : 'text-slate-700'
                                          const signedAmount =
                                            transaction.type === 'income'
                                              ? `+${money.format(transaction.amount)}`
                                              : transaction.type === 'expense'
                                                ? `-${money.format(transaction.amount)}`
                                                : money.format(transaction.amount)

                                          return (
                                            <tr
                                              key={transaction.id}
                                              role="button"
                                              tabIndex={0}
                                              onClick={() => beginEdit(transaction.id)}
                                              onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                  event.preventDefault()
                                                  beginEdit(transaction.id)
                                                }
                                              }}
                                              className="border-t border-slate-100 align-top transition hover:bg-slate-50"
                                            >
                                              <td className="px-3 py-3 text-slate-700">{transaction.date}</td>
                                              <td className="px-3 py-3">
                                                <p className="font-medium text-slate-900">{transaction.description ?? 'No description'}</p>
                                                <p className="text-xs text-slate-500">{transaction.category ?? 'Uncategorized'}</p>
                                                {transaction.tags.length > 0 && <p className="text-xs text-slate-500">tags: {transaction.tags.join(', ')}</p>}
                                              </td>
                                              <td className="px-3 py-3 text-slate-700">
                                                <p>
                                                  {transaction.type === 'transfer'
                                                    ? `${accountLabel(transaction.from_account_id)} → ${accountLabel(transaction.to_account_id)}`
                                                    : accountLabel(transaction.account_id)}
                                                </p>
                                                <p className="text-xs text-slate-500">Owner: {ownerLabel(transaction.owner_id)}</p>
                                              </td>
                                              <td className="px-3 py-3">
                                                <Pill tone={transaction.type === 'income' ? 'positive' : transaction.type === 'expense' ? 'negative' : 'neutral'}>
                                                  {transaction.type}
                                                </Pill>
                                              </td>
                                              <td className={`px-3 py-3 text-right font-medium tabular-nums ${amountTone}`}>{signedAmount}</td>
                                              <td className="px-3 py-3">
                                                <div className="flex justify-center gap-2">
                                                  <button
                                                    type="button"
                                                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                                                    onClick={(event) => {
                                                      event.stopPropagation()
                                                      beginEdit(transaction.id)
                                                    }}
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                                                    onClick={(event) => {
                                                      event.stopPropagation()
                                                      void uploadAttachmentForTransaction(transaction.id)
                                                    }}
                                                  >
                                                    Upload
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50"
                                                    title={pendingDeleteId === transaction.id ? 'Click again to confirm delete' : undefined}
                                                    onClick={(event) => {
                                                      event.stopPropagation()
                                                      void removeTransaction(transaction.id)
                                                    }}
                                                  >
                                                    {pendingDeleteId === transaction.id ? 'Confirm' : 'Delete'}
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
                              </section>
                            )
                          })}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6 self-start xl:sticky xl:top-6">
          <Card>
            <SectionHeader title="Quick Actions" subtitle="Create and enrich transaction drafts." />
            <div className="grid gap-2 p-5">
              <button
                type="button"
                disabled={suggestingFields}
                onClick={() => void triggerSuggestFromPanel()}
                className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Bot className="h-4 w-4" />
                {suggestingFields ? 'Suggesting...' : 'Suggest'}
              </button>
              <button
                type="button"
                disabled={duplicateCheckLoading}
                onClick={() => void triggerDuplicateFromPanel()}
                className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCheck className="h-4 w-4" />
                {duplicateCheckLoading ? 'Checking...' : 'Check Duplicate'}
              </button>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Filters" subtitle="Filter the ledger view." />
            <div className="grid gap-3 p-5">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Type</span>
                <select value={filterType} onChange={(event) => setFilterType(event.target.value as 'all' | 'expense' | 'income' | 'transfer')} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  <option value="all">All</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Owner</span>
                <select value={filterOwnerType} onChange={(event) => setFilterOwnerType(event.target.value as 'all' | 'member' | 'joint')} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  <option value="all">All Owners</option>
                  <option value="member">Member</option>
                  <option value="joint">Joint</option>
                </select>
              </label>

              {filterOwnerType === 'member' && (
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Member</span>
                  <select value={filterMemberId} onChange={(event) => setFilterMemberId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                    <option value="all">All Members</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Search</span>
                <input
                  value={filterTerm}
                  onChange={(event) => setFilterTerm(event.target.value)}
                  placeholder="description, category, tag"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </Card>

        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <SectionHeader
              title={editingTransactionId ? 'Edit Transaction' : 'Add Transaction'}
              subtitle="Create and manage expense, income, and transfer entries."
            />

            <form className="grid gap-3 p-5 md:grid-cols-2" onSubmit={onSubmit}>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Date</span>
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Amount</span>
                <input type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Type</span>
                <select value={txType} onChange={(event) => setTxType(event.target.value as 'expense' | 'income' | 'transfer')} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Category</span>
                <input value={category} onChange={(event) => setCategory(event.target.value)} list="transaction-category-suggestions" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <datalist id="transaction-category-suggestions">
                {categorySuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>

              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Description</span>
                <input value={description} onChange={(event) => setDescription(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <div className="flex flex-wrap gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => void suggestFromDescription()}
                  className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  disabled={suggestingFields}
                >
                  {suggestingFields ? 'Suggesting...' : 'Suggest'}
                </button>
                <button
                  type="button"
                  onClick={() => void checkDuplicateRisk()}
                  className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                  disabled={duplicateCheckLoading}
                >
                  {duplicateCheckLoading ? 'Checking...' : 'Check Duplicate'}
                </button>
              </div>

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

              {txType !== 'transfer' ? (
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Account</span>
                  <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Select account</option>
                    {selectableAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">From account</span>
                    <select value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                      <option value="">From account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">To account</span>
                    <select value={toAccountId} onChange={(event) => setToAccountId(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                      <option value="">To account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Tags</span>
                <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="comma separated" className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Notes</span>
                <input value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              </label>

              {(aiAssistMessage || duplicateWarning?.likelyDuplicate) && (
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:col-span-2">
                  {aiAssistMessage && <p>{aiAssistMessage}</p>}
                  {duplicateWarning?.likelyDuplicate && <p className="mt-1 text-amber-700">Potential duplicate ({duplicateWarning.confidence}): {duplicateWarning.reasoning}</p>}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 md:col-span-2">
                <div>
                  {editingTransactionId && editingHasUploads && (
                    <button
                      type="button"
                      onClick={() => void viewUploadsForEditingTransaction()}
                      className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                    >
                      View Uploads
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={closeModal} className="rounded border border-slate-300 px-3 py-2 text-sm">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!transactionFormValid}
                    className="rounded bg-slate-900 px-3 py-2 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editingTransactionId ? 'Save' : 'Add Transaction'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
