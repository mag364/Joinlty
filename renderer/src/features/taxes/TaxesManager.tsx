import { useMemo, useState } from 'react'
import { Card, SectionHeader } from '@renderer/components/ui'
import { api } from '@renderer/lib/api'
import { useAppStore } from '@renderer/store/useAppStore'
import type { AISuggestTaxWriteOffsResult } from '@shared/preload'

export const TaxesManager = () => {
  const members = useAppStore((state) => state.members)
  const accounts = useAppStore((state) => state.accounts)
  const transactions = useAppStore((state) => state.transactions)

  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [loadingWriteOffs, setLoadingWriteOffs] = useState(false)
  const [writeOffError, setWriteOffError] = useState<string | null>(null)
  const [writeOffResult, setWriteOffResult] = useState<AISuggestTaxWriteOffsResult['result'] | null>(null)
  const [writeOffSource, setWriteOffSource] = useState<AISuggestTaxWriteOffsResult['source'] | null>(null)

  const selectedMemberAccounts = useMemo(
    () => accounts.filter((account) => account.owner_type === 'member' && account.owner_id === selectedMemberId),
    [accounts, selectedMemberId],
  )

  const selectedMemberName = members.find((member) => member.id === selectedMemberId)?.name

  const selectedMemberAccountIds = useMemo(() => new Set(selectedMemberAccounts.map((account) => account.id)), [selectedMemberAccounts])

  const selectedMemberTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          (transaction.account_id != null && selectedMemberAccountIds.has(transaction.account_id)) ||
          (transaction.from_account_id != null && selectedMemberAccountIds.has(transaction.from_account_id)) ||
          (transaction.to_account_id != null && selectedMemberAccountIds.has(transaction.to_account_id)),
      ),
    [transactions, selectedMemberAccountIds],
  )

  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })

  const generateTaxReport = async () => {
    if (!selectedMemberId || !selectedMemberName) return

    setLoadingWriteOffs(true)
    setWriteOffError(null)

    try {
      const response = await api.suggestTaxWriteOffs({
        member: {
          id: selectedMemberId,
          name: selectedMemberName,
        },
        accounts: selectedMemberAccounts.map((account) => ({
          id: account.id,
          name: account.name,
          type: account.type,
        })),
        transactions: selectedMemberTransactions.map((transaction) => ({
          id: transaction.id,
          date: transaction.date,
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category,
          description: transaction.description,
          account_id: transaction.account_id,
          from_account_id: transaction.from_account_id,
          to_account_id: transaction.to_account_id,
          tags: transaction.tags,
        })),
      })

      if (!response.ok || !response.result) {
        setWriteOffResult(null)
        setWriteOffSource(null)
        setWriteOffError(response.message)
        return
      }

      setWriteOffResult(response.result)
      setWriteOffSource(response.source ?? null)
    } catch (error) {
      setWriteOffResult(null)
      setWriteOffSource(null)
      setWriteOffError(error instanceof Error ? error.message : 'Failed to generate tax report.')
    } finally {
      setLoadingWriteOffs(false)
    }
  }

  return (
    <section className="space-y-6">
      <Card>
        <SectionHeader title="Member Selection" subtitle="Choose a member and generate their tax report." />

        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[260px] flex-1 text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Member</span>
              <select
                value={selectedMemberId}
                onChange={(event) => setSelectedMemberId(event.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select member</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              disabled={!selectedMemberId}
              onClick={() => void generateTaxReport()}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingWriteOffs ? 'Generating...' : 'Generate Tax Report'}
            </button>
          </div>

          <p className="text-sm text-slate-600">
            Accounts:{' '}
            {selectedMemberId
              ? selectedMemberAccounts.length > 0
                ? selectedMemberAccounts.map((account) => account.name).join(', ')
                : `No accounts found for ${selectedMemberName ?? 'selected member'}.`
              : 'Select a member to view their accounts.'}
          </p>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Suggested Write Offs" subtitle="AI-generated write-off category breakdown based on selected member account transactions." />

        <div className="space-y-3 p-5">
          {writeOffError && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{writeOffError}</p>}

          {!writeOffResult && !writeOffError && (
            <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Select a member and click <strong>Generate Tax Report</strong> to see suggested write-offs.
            </p>
          )}

          {writeOffResult && (
            <>
              <div className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                Source: {writeOffSource === 'ai_provider' ? 'AI Provider' : 'Local Fallback'}
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-right">Transactions</th>
                      <th className="px-3 py-2">Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {writeOffResult.categories.map((row) => (
                      <tr key={row.category} className="border-t border-slate-100">
                        <td className="px-3 py-3 font-medium text-slate-900">{row.category}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-900">{money.format(row.amount)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{row.transactionCount}</td>
                        <td className="px-3 py-3 text-slate-600">{row.rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">Total Suggested Write-Offs:</span> {money.format(writeOffResult.totalSuggestedAmount)}
                </p>
                <p>
                  <span className="font-semibold">Confidence:</span> {writeOffResult.confidence}
                </p>
              </div>

              {writeOffResult.disclaimers.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
                  {writeOffResult.disclaimers.map((disclaimer) => (
                    <li key={disclaimer}>{disclaimer}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </Card>
    </section>
  )
}