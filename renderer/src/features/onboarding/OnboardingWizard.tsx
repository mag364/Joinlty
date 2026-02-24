import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'

interface OnboardingWizardProps {
  onComplete: () => Promise<void>
}

export const OnboardingWizard = ({ onComplete }: OnboardingWizardProps) => {
  const members = useAppStore((state) => state.members)
  const accounts = useAppStore((state) => state.accounts)
  const upsertMember = useAppStore((state) => state.upsertMember)
  const upsertAccount = useAppStore((state) => state.upsertAccount)

  const [step, setStep] = useState<1 | 2>(1)
  const [memberName, setMemberName] = useState('')
  const [memberType, setMemberType] = useState<'person' | 'property' | 'business'>('person')
  const [memberActive, setMemberActive] = useState(true)

  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<'checking' | 'savings' | 'credit_card'>('checking')
  const [ownerType, setOwnerType] = useState<'member' | 'joint'>('member')
  const [ownerId, setOwnerId] = useState('')
  const [startingBalance, setStartingBalance] = useState('0')
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canContinueToAccounts = members.length > 0
  const canFinish = accounts.length > 0 && !finishing

  useEffect(() => {
    if (ownerType === 'joint') {
      setOwnerId('joint-household')
      return
    }

    if (members.length === 0) {
      setOwnerId('')
      return
    }

    const ownerExists = members.some((member) => member.id === ownerId)
    if (!ownerExists) {
      setOwnerId(members[0].id)
    }
  }, [members, ownerId, ownerType])

  const memberCountLabel = useMemo(() => {
    if (members.length === 1) return '1 member'
    return `${members.length} members`
  }, [members.length])

  const accountCountLabel = useMemo(() => {
    if (accounts.length === 1) return '1 account'
    return `${accounts.length} accounts`
  }, [accounts.length])

  const submitMember = async (event: FormEvent) => {
    event.preventDefault()
    if (!memberName.trim()) return

    setError(null)
    try {
      await upsertMember({
        name: memberName.trim(),
        member_type: memberType,
        active: memberActive,
      })
      setMemberName('')
      setMemberType('person')
      setMemberActive(true)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to add member')
    }
  }

  const submitAccount = async (event: FormEvent) => {
    event.preventDefault()
    if (!accountName.trim() || !ownerId.trim()) return

    setError(null)
    try {
      await upsertAccount({
        name: accountName.trim(),
        type: accountType,
        owner_type: ownerType,
        owner_id: ownerId,
        starting_balance: Number(startingBalance || '0'),
      })
      setAccountName('')
      setAccountType('checking')
      setOwnerType('member')
      setStartingBalance('0')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to add account')
    }
  }

  const completeWizard = async () => {
    if (!canFinish) return
    setError(null)
    setFinishing(true)
    try {
      await onComplete()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to finish onboarding')
      setFinishing(false)
    }
  }

  const skipWizard = async () => {
    if (finishing) return
    setError(null)
    setFinishing(true)
    try {
      await onComplete()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to skip onboarding')
      setFinishing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <header className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">First-Time Setup</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Welcome to Jointly</h2>
              <p className="mt-1 text-sm text-slate-600">Add your first member(s) and account(s) so you can start budgeting.</p>
              <p className="mt-2 text-xs font-medium text-slate-500">Step {step} of 2</p>
            </div>
            <button
              type="button"
              onClick={() => void skipWizard()}
              disabled={finishing}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Skip Wizard
            </button>
          </div>
        </header>

        <div className="p-6">
          {step === 1 ? (
            <section className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Current progress: {memberCountLabel}</div>
              <form className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-3" onSubmit={submitMember}>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Member name</span>
                  <input
                    value={memberName}
                    onChange={(event) => setMemberName(event.target.value)}
                    placeholder="Alex"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Type</span>
                  <select
                    value={memberType}
                    onChange={(event) => setMemberType(event.target.value as 'person' | 'property' | 'business')}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="person">Person</option>
                    <option value="property">Property</option>
                    <option value="business">Business</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2">
                  <input type="checkbox" checked={memberActive} onChange={(event) => setMemberActive(event.target.checked)} />
                  Active member
                </label>

                <div className="flex items-end justify-end md:col-span-1">
                  <button type="submit" className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white md:w-auto">
                    Add Member
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {members.length === 0 ? (
                  <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500">No members yet. Add at least one to continue.</p>
                ) : (
                  members.map((member) => (
                    <div key={member.id} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      {member.name} <span className="text-xs text-slate-500">({member.member_type})</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : (
            <section className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Current progress: {accountCountLabel}</div>
              <form className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2" onSubmit={submitAccount}>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Account name</span>
                  <input
                    value={accountName}
                    onChange={(event) => setAccountName(event.target.value)}
                    placeholder="Everyday checking"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Type</span>
                  <select
                    value={accountType}
                    onChange={(event) => setAccountType(event.target.value as 'checking' | 'savings' | 'credit_card')}
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
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Owner</span>
                  <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                    {ownerType === 'joint' ? (
                      <option value="joint-household">Household Joint</option>
                    ) : (
                      <>
                        <option value="">Select member</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </label>

                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Starting balance</span>
                  <input
                    type="number"
                    step="0.01"
                    value={startingBalance}
                    onChange={(event) => setStartingBalance(event.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>

                <div className="flex justify-end md:col-span-2">
                  <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
                    Add Account
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {accounts.length === 0 ? (
                  <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-500">No accounts yet. Add at least one to finish setup.</p>
                ) : (
                  accounts.map((account) => (
                    <div key={account.id} className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      {account.name} <span className="text-xs text-slate-500">({account.type.replace('_', ' ')})</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {error && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={step === 1}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>

            <div className="flex gap-2">
              {step === 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canContinueToAccounts}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue to Accounts
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void completeWizard()}
                  disabled={!canFinish}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {finishing ? 'Finishing...' : 'Finish Setup'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
