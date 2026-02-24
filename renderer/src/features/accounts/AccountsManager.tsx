import { useEffect, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import { GripVertical } from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'
import { api } from '@renderer/lib/api'
import { getLocalTodayDate } from '@renderer/lib/dates'
import { Card, SectionHeader } from '@renderer/components/ui'
import type { Joint } from '@shared/types'

export const AccountsManager = ({ addRequestToken = 0 }: { addRequestToken?: number }) => {
  const members = useAppStore((state) => state.members)
  const accounts = useAppStore((state) => state.accounts)
  const upsertAccount = useAppStore((state) => state.upsertAccount)
  const deleteAccount = useAppStore((state) => state.deleteAccount)
  const reorderAccounts = useAppStore((state) => state.reorderAccounts)
  const createTransaction = useAppStore((state) => state.createTransaction)

  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [panelOpen, setPanelOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'checking' | 'savings' | 'credit_card'>('checking')
  const [ownerType, setOwnerType] = useState<'member' | 'joint'>('member')
  const [ownerId, setOwnerId] = useState('')
  const [startingBalance, setStartingBalance] = useState('0')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null)
  const [dragOverAccountId, setDragOverAccountId] = useState<string | null>(null)
  const [joints, setJoints] = useState<Joint[]>([])
  const [jointName, setJointName] = useState('')
  const [editingJointId, setEditingJointId] = useState<string | undefined>(undefined)
  const [pendingJointDeleteId, setPendingJointDeleteId] = useState<string | null>(null)

  const [payoffDate, setPayoffDate] = useState(() => getLocalTodayDate())
  const [payoffFromAccountId, setPayoffFromAccountId] = useState('')
  const [payoffCreditCardId, setPayoffCreditCardId] = useState('')
  const [payoffAmount, setPayoffAmount] = useState('')
  const [payoffNotes, setPayoffNotes] = useState('')

  useEffect(() => {
    if (addRequestToken < 1) return
    setEditingId(undefined)
    setName('')
    setType('checking')
    setOwnerType('member')
    setOwnerId('')
    setStartingBalance('0')
    setPendingDeleteId(null)
    setPanelOpen(true)
  }, [addRequestToken])

  const loadJoints = async () => {
    const rows = await api.listJoints()
    setJoints(rows)
  }

  useEffect(() => {
    void loadJoints()
  }, [])

  useEffect(() => {
    if (ownerType !== 'joint') return
    if (ownerId) return
    if (joints.length === 0) return
    setOwnerId(joints[0].id)
  }, [ownerType, ownerId, joints])

  const resetForm = () => {
    setEditingId(undefined)
    setName('')
    setType('checking')
    setOwnerType('member')
    setOwnerId('')
    setStartingBalance('0')
    setPendingDeleteId(null)
  }

  const fundingAccounts = accounts.filter((account) => account.type !== 'credit_card')
  const creditCardAccounts = accounts.filter((account) => account.type === 'credit_card')

  const createCreditCardPayment = async (event: FormEvent) => {
    event.preventDefault()
    const parsedAmount = Number(payoffAmount)
    const creditCard = accounts.find((account) => account.id === payoffCreditCardId)
    if (!payoffFromAccountId || !payoffCreditCardId || !creditCard) return
    if (payoffFromAccountId === payoffCreditCardId) return
    if (!payoffDate || Number.isNaN(parsedAmount) || parsedAmount <= 0) return

    await createTransaction({
      date: payoffDate,
      amount: parsedAmount,
      type: 'transfer',
      category: 'Credit Card Payment',
      description: `Credit card payment: ${creditCard.name}`,
      owner_type: creditCard.owner_type,
      owner_id: creditCard.owner_id,
      account_id: null,
      from_account_id: payoffFromAccountId,
      to_account_id: payoffCreditCardId,
      tags: ['credit-card', 'payoff'],
      notes: payoffNotes.trim() || null,
    })

    setPayoffAmount('')
    setPayoffNotes('')
  }

  const accountOwnerLabel = (ownerTypeValue: 'member' | 'joint', ownerIdValue: string) => {
    if (ownerTypeValue === 'joint') {
      return joints.find((joint) => joint.id === ownerIdValue)?.name ?? ownerIdValue
    }
    return members.find((member) => member.id === ownerIdValue)?.name ?? ownerIdValue
  }

  const saveJoint = async (event: FormEvent) => {
    event.preventDefault()
    const nameValue = jointName.trim()
    if (!nameValue) return
    await api.upsertJoint({ id: editingJointId, name: nameValue, active: true })
    setJointName('')
    setEditingJointId(undefined)
    setPendingJointDeleteId(null)
    await loadJoints()
  }

  const beginJointEdit = (jointId: string) => {
    const joint = joints.find((candidate) => candidate.id === jointId)
    if (!joint) return
    setEditingJointId(joint.id)
    setJointName(joint.name)
    setPendingJointDeleteId(null)
  }

  const removeJoint = async (jointId: string) => {
    if (pendingJointDeleteId !== jointId) {
      setPendingJointDeleteId(jointId)
      return
    }

    await api.deleteJoint({ id: jointId })
    setPendingJointDeleteId(null)
    if (editingJointId === jointId) {
      setEditingJointId(undefined)
      setJointName('')
    }
    if (ownerId === jointId) {
      setOwnerId('')
    }
    await loadJoints()
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !ownerId.trim()) return

    await upsertAccount({
      id: editingId,
      name: name.trim(),
      type,
      owner_type: ownerType,
      owner_id: ownerId.trim(),
      starting_balance: Number(startingBalance || '0'),
    })

    resetForm()
    setPanelOpen(false)
  }

  const beginEdit = (accountId: string) => {
    const account = accounts.find((candidate) => candidate.id === accountId)
    if (!account) return
    setEditingId(account.id)
    setName(account.name)
    setType(account.type)
    setOwnerType(account.owner_type)
    setOwnerId(account.owner_id)
    setStartingBalance(String(account.starting_balance))
    setPanelOpen(true)
  }

  const removeAccount = async (accountId: string) => {
    if (pendingDeleteId !== accountId) {
      setPendingDeleteId(accountId)
      return
    }

    await deleteAccount({ id: accountId })
    setPendingDeleteId(null)

    if (editingId === accountId) {
      resetForm()
    }
  }

  const handleDropReorder = async (targetAccountId: string) => {
    if (!draggedAccountId || draggedAccountId === targetAccountId) {
      setDragOverAccountId(null)
      return
    }

    const sourceIndex = accounts.findIndex((account) => account.id === draggedAccountId)
    const targetIndex = accounts.findIndex((account) => account.id === targetAccountId)
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggedAccountId(null)
      setDragOverAccountId(null)
      return
    }

    const reordered = [...accounts]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    setDraggedAccountId(null)
    setDragOverAccountId(null)
    await reorderAccounts({ ids: reordered.map((account) => account.id) })
  }

  const paymentAmountValue = Number(payoffAmount)
  const paymentDisabled =
    !payoffDate ||
    !payoffFromAccountId ||
    !payoffCreditCardId ||
    payoffFromAccountId === payoffCreditCardId ||
    Number.isNaN(paymentAmountValue) ||
    paymentAmountValue <= 0

  const moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })

  const formatMoney = (amount: number) => moneyFormatter.format(amount)

  return (
    <section className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <SectionHeader title="Accounts" subtitle="Track ownership, balances, and account ordering across your household." />

        <div className="space-y-4 p-5">
          {panelOpen && (
            <form className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2" onSubmit={onSubmit}>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Account name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Everyday checking"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Type</span>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value as 'checking' | 'savings' | 'credit_card')}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Owner type</span>
                <select
                  value={ownerType}
                  onChange={(event) => setOwnerType(event.target.value as 'member' | 'joint')}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="member">Member</option>
                  <option value="joint">Joint</option>
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {ownerType === 'joint' ? 'Joint owner' : 'Member'}
                </span>
                <select
                  value={ownerId}
                  onChange={(event) => setOwnerId(event.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">{ownerType === 'joint' ? 'Select joint owner' : 'Select member'}</option>
                  {ownerType === 'joint' ? (
                    joints.map((joint) => (
                      <option key={joint.id} value={joint.id}>
                        {joint.name}
                      </option>
                    ))
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
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Starting balance</span>
                <input
                  type="number"
                  step="0.01"
                  value={startingBalance}
                  onChange={(event) => setStartingBalance(event.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <div className="flex items-end gap-2">
                <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
                  {editingId ? 'Update Account' : 'Add Account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setPanelOpen(false)
                  }}
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {accounts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-700">No accounts yet.</p>
              <p className="mt-1 text-sm text-slate-500">Create your first checking, savings, or credit card account.</p>
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="mt-4 rounded bg-slate-900 px-3 py-2 text-sm text-white"
              >
                Add Account
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => beginEdit(account.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      beginEdit(account.id)
                    }
                  }}
                  onDragOver={(event: DragEvent<HTMLDivElement>) => {
                    event.preventDefault()
                    if (draggedAccountId) setDragOverAccountId(account.id)
                  }}
                  onDrop={(event: DragEvent<HTMLDivElement>) => {
                    event.preventDefault()
                    void handleDropReorder(account.id)
                  }}
                  onDragLeave={() => {
                    if (dragOverAccountId === account.id) setDragOverAccountId(null)
                  }}
                  className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 shadow-sm transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-[1px] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                    dragOverAccountId === account.id ? 'border-slate-400 ring-1 ring-slate-300' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      title="Drag this handle onto another account card to reorder"
                      draggable
                      onClick={(event) => {
                        event.stopPropagation()
                      }}
                      onMouseDown={(event) => {
                        event.stopPropagation()
                      }}
                      onDragStart={(event: DragEvent<HTMLSpanElement>) => {
                        event.stopPropagation()
                        event.dataTransfer.effectAllowed = 'move'
                        setDraggedAccountId(account.id)
                      }}
                      onDragEnd={() => {
                        setDraggedAccountId(null)
                        setDragOverAccountId(null)
                      }}
                      className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{account.name}</p>
                      <p className="text-xs text-slate-500">
                        {account.type.replace('_', ' ')} • {account.owner_type === 'member' ? 'Member' : 'Joint'}: {accountOwnerLabel(account.owner_type, account.owner_id)}
                        {Math.abs(account.starting_balance) > 0.004 ? ` • Started at ${formatMoney(account.starting_balance)}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <div className="select-none text-right tabular-nums">
                      {account.type === 'credit_card' ? (
                        <p className="text-base font-semibold text-red-600">Owed {formatMoney(Math.abs(account.current_balance))}</p>
                      ) : (
                        <p className="text-base font-semibold text-slate-900">{formatMoney(account.current_balance)}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        beginEdit(account.id)
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      title={pendingDeleteId === account.id ? 'Click again to confirm delete' : undefined}
                      onClick={(event) => {
                        event.stopPropagation()
                        void removeAccount(account.id)
                      }}
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50"
                    >
                      {pendingDeleteId === account.id ? 'Confirm' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="h-fit">
          <SectionHeader
            title="Joint Owners"
            subtitle="Create additional joint owners (for example, Business Joint) for account ownership."
          />

          <div className="space-y-3 p-5">
            <form className="flex flex-wrap gap-2" onSubmit={saveJoint}>
              <input
                value={jointName}
                onChange={(event) => setJointName(event.target.value)}
                placeholder="Joint owner name"
                className="min-w-[220px] flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
                {editingJointId ? 'Update Joint Owner' : 'Add Joint Owner'}
              </button>
              {(editingJointId || jointName) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingJointId(undefined)
                    setJointName('')
                    setPendingJointDeleteId(null)
                  }}
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  Clear
                </button>
              )}
            </form>

            {joints.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {joints.map((joint) => (
                  <div key={joint.id} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700">
                    <span>{joint.name}</span>
                    <button type="button" onClick={() => beginJointEdit(joint.id)} className="text-slate-600 underline underline-offset-2">
                      Edit
                    </button>
                    <button type="button" onClick={() => void removeJoint(joint.id)} className="text-red-600 underline underline-offset-2">
                      {pendingJointDeleteId === joint.id ? 'Confirm' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="h-fit">
          <SectionHeader
            title="Pay Credit Card"
            subtitle="Create a transfer from a funding account to reduce a credit card balance."
          />

          <form className="grid gap-3 p-5" onSubmit={createCreditCardPayment}>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Date</span>
            <input
              type="date"
              value={payoffDate}
              onChange={(event) => setPayoffDate(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">From account</span>
            <select
              value={payoffFromAccountId}
              onChange={(event) => setPayoffFromAccountId(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select funding account</option>
              {fundingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Credit card account</span>
            <select
              value={payoffCreditCardId}
              onChange={(event) => setPayoffCreditCardId(event.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select credit card account</option>
              {creditCardAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Payment amount</span>
            <input
              type="number"
              step="0.01"
              value={payoffAmount}
              onChange={(event) => setPayoffAmount(event.target.value)}
              placeholder="0.00"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Notes (optional)</span>
            <input
              value={payoffNotes}
              onChange={(event) => setPayoffNotes(event.target.value)}
              placeholder="Statement payoff"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          {paymentDisabled && (
            <p className="text-xs text-slate-500">
              Select date, funding account, credit card account, and a positive payment amount to continue.
            </p>
          )}

          <div className="flex justify-stretch md:justify-end">
            <button
              type="submit"
              disabled={paymentDisabled}
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            >
              Create Payment Transfer
            </button>
          </div>
          </form>
        </Card>
      </div>
    </section>
  )
}
