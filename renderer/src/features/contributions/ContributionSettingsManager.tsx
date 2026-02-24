import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { api } from '@renderer/lib/api'
import type { ContributionSetting, Joint } from '@shared/types'
import { monthEnd, monthStart } from '@renderer/lib/dates'
import { Card, Pill, SectionHeader } from '@renderer/components/ui'

type ContributionSummary = {
  activeSettings: number | null
  totalExpected: number | null
  totalVariance: number | null
}

export const ContributionSettingsManager = ({
  selectedMonth,
  onSelectedMonthChange,
  onSummaryChange,
}: {
  selectedMonth?: string
  onSelectedMonthChange?: (month: string) => void
  onSummaryChange?: (summary: ContributionSummary) => void
}) => {
  const members = useAppStore((state) => state.members)
  const accounts = useAppStore((state) => state.accounts)
  const transactions = useAppStore((state) => state.transactions)

  const [settings, setSettings] = useState<ContributionSetting[]>([])
  const [loading, setLoading] = useState(false)
  const [internalSelectedMonth, setInternalSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const [editingId, setEditingId] = useState<string | undefined>()
  const [memberId, setMemberId] = useState('')
  const [jointOwnerId, setJointOwnerId] = useState('')
  const [jointId, setJointId] = useState('joint-household')
  const [contributes, setContributes] = useState(true)
  const [method, setMethod] = useState<'fixed' | 'percent_income' | 'split'>('fixed')
  const [fixedAmount, setFixedAmount] = useState('')
  const [percentIncome, setPercentIncome] = useState('')
  const [splitMode, setSplitMode] = useState<'equal' | 'weighted'>('equal')
  const [weight, setWeight] = useState('')
  const [fundingAccountId, setFundingAccountId] = useState('')
  const [active, setActive] = useState(true)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [joints, setJoints] = useState<Joint[]>([])

  const jointDestinationAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.owner_type === 'joint' && (account.type === 'checking' || account.type === 'savings'),
      ),
    [accounts],
  )

  const jointOwnerOptions = useMemo(() => {
    const fromJoints = joints.map((joint) => ({ id: joint.id, name: joint.name }))
    const seen = new Set(fromJoints.map((joint) => joint.id))
    const inferredFromAccounts = jointDestinationAccounts
      .filter((account) => !seen.has(account.owner_id))
      .map((account) => ({ id: account.owner_id, name: account.owner_id }))
    const all = [...fromJoints, ...inferredFromAccounts]
    if (all.length === 0) return [{ id: 'joint-household', name: 'Household Joint' }]
    return all
  }, [jointDestinationAccounts, joints])

  const selectedJointOwnerAccounts = useMemo(
    () => jointDestinationAccounts.filter((account) => account.owner_id === jointOwnerId),
    [jointDestinationAccounts, jointOwnerId],
  )

  const memberFundingAccounts = useMemo(
    () => accounts.filter((account) => account.owner_type === 'member' && account.owner_id === memberId),
    [accounts, memberId],
  )

  const jointOptions = useMemo(() => selectedJointOwnerAccounts.map((account) => account.id), [selectedJointOwnerAccounts])

  const effectiveSelectedMonth = selectedMonth ?? internalSelectedMonth

  const updateSelectedMonth = (next: string) => {
    setInternalSelectedMonth(next)
    onSelectedMonthChange?.(next)
  }

  const loadSettings = async () => {
    setLoading(true)
    try {
      const result = await api.listContributionSettings()
      setSettings(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  useEffect(() => {
    const loadJoints = async () => {
      const rows = await api.listJoints()
      setJoints(rows)
    }
    void loadJoints()
  }, [])

  const resetForm = () => {
    setEditingId(undefined)
    setMemberId('')
    setJointOwnerId('')
    setJointId('')
    setContributes(true)
    setMethod('fixed')
    setFixedAmount('')
    setPercentIncome('')
    setSplitMode('equal')
    setWeight('')
    setFundingAccountId('')
    setActive(true)
    setPendingDeleteId(null)
  }

  useEffect(() => {
    if (!jointOwnerId) return
    if (jointOwnerOptions.some((option) => option.id === jointOwnerId)) return
    setJointOwnerId('')
  }, [jointOwnerId, jointOwnerOptions])

  useEffect(() => {
    if (!jointId) return
    if (jointOptions.includes(jointId)) return
    setJointId('')
  }, [jointId, jointOptions])

  useEffect(() => {
    if (!fundingAccountId) return
    if (memberFundingAccounts.some((account) => account.id === fundingAccountId)) return
    setFundingAccountId('')
  }, [fundingAccountId, memberFundingAccounts])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!memberId.trim() || !jointId.trim()) return

    await api.upsertContributionSetting({
      id: editingId,
      member_id: memberId.trim(),
      joint_id: jointId.trim(),
      contributes,
      method: contributes ? method : null,
      fixed_amount: contributes && (method === 'fixed' || method === 'split') ? Number(fixedAmount || 0) : null,
      percent_income: contributes && method === 'percent_income' ? Number(percentIncome || 0) : null,
      split_mode: contributes && method === 'split' ? splitMode : null,
      weight: contributes && method === 'split' && splitMode === 'weighted' ? Number(weight || 0) : null,
      funding_account_id: contributes ? fundingAccountId.trim() || null : null,
      active,
    })

    await loadSettings()
    resetForm()
  }

  const beginEdit = (settingId: string) => {
    const setting = settings.find((candidate) => candidate.id === settingId)
    if (!setting) return
    const accountRef = accounts.find((candidate) => candidate.id === setting.joint_id)
    const resolvedOwnerId = accountRef?.owner_id ?? setting.joint_id

    setEditingId(setting.id)
    setMemberId(setting.member_id)
    setJointOwnerId(resolvedOwnerId)
    if (accountRef) {
      setJointId(accountRef.id)
    } else {
      const ownerAccount = jointDestinationAccounts.find((candidate) => candidate.owner_id === resolvedOwnerId)
      setJointId(ownerAccount?.id ?? setting.joint_id)
    }
    setContributes(setting.contributes)
    setMethod(setting.method ?? 'fixed')
    setFixedAmount(setting.fixed_amount == null ? '' : String(setting.fixed_amount))
    setPercentIncome(setting.percent_income == null ? '' : String(setting.percent_income))
    setSplitMode(setting.split_mode ?? 'equal')
    setWeight(setting.weight == null ? '' : String(setting.weight))
    setFundingAccountId(setting.funding_account_id ?? '')
    setActive(setting.active)
  }

  const removeSetting = async (settingId: string) => {
    if (pendingDeleteId !== settingId) {
      setPendingDeleteId(settingId)
      return
    }

    await api.deleteContributionSetting({ id: settingId })
    setPendingDeleteId(null)
    await loadSettings()

    if (editingId === settingId) {
      resetForm()
    }
  }

  const selectedMemberSettings = useMemo(
    () => settings.filter((setting) => setting.active && setting.contributes),
    [settings],
  )

  const contributionTransfers = useMemo(
    () =>
      transactions.filter((tx) => {
        if (tx.type !== 'transfer') return false
        if (!tx.date.startsWith(effectiveSelectedMonth)) return false
        return tx.category === 'Joint Contribution' || tx.tags.includes('contribution')
      }),
    [effectiveSelectedMonth, transactions],
  )

  const contributionReportRows = useMemo(
    () =>
      selectedMemberSettings.map((setting) => {
        let expected = 0
        if (setting.method === 'fixed' || setting.method === 'split') {
          expected = Number(setting.fixed_amount ?? 0)
        } else if (setting.method === 'percent_income') {
          const memberIncome = transactions
            .filter(
              (tx) =>
                tx.type === 'income' &&
                tx.owner_type === 'member' &&
                tx.owner_id === setting.member_id &&
                tx.date >= monthStart(effectiveSelectedMonth) &&
                tx.date <= monthEnd(effectiveSelectedMonth),
            )
            .reduce((sum, tx) => sum + tx.amount, 0)
          expected = (memberIncome * Number(setting.percent_income ?? 0)) / 100
        }

        const actual = contributionTransfers
          .filter((tx) => tx.owner_type === 'member' && tx.owner_id === setting.member_id)
          .reduce((sum, tx) => sum + tx.amount, 0)

        const member = members.find((candidate) => candidate.id === setting.member_id)

        return {
          settingId: setting.id,
          memberName: member?.name ?? setting.member_id,
          method: setting.method ?? 'none',
          expected,
          actual,
          variance: actual - expected,
        }
      }),
    [contributionTransfers, effectiveSelectedMonth, members, selectedMemberSettings, transactions],
  )

  const contributionSummary = useMemo(
    () => ({
      activeSettings: settings.filter((setting) => setting.active).length,
      totalExpected: contributionReportRows.reduce((sum, row) => sum + row.expected, 0),
      totalVariance: contributionReportRows.reduce((sum, row) => sum + row.variance, 0),
    }),
    [contributionReportRows, settings],
  )

  useEffect(() => {
    if (!onSummaryChange) return
    onSummaryChange(contributionSummary)
  }, [contributionSummary, onSummaryChange])

  const fundingAccountLabel = (accountRef?: string | null) => {
    if (!accountRef) return '—'
    return accounts.find((account) => account.id === accountRef)?.name ?? 'Unknown account'
  }

  const jointLabel = (jointRef: string) => {
    if (jointRef === 'joint-household') return 'Household Joint'
    const account = accounts.find((candidate) => candidate.id === jointRef)
    if (account) return account.name
    const ownerAccount = accounts.find((candidate) => candidate.owner_type === 'joint' && candidate.owner_id === jointRef)
    if (ownerAccount) return `${ownerAccount.name} (legacy joint)`
    return `Joint (${jointRef})`
  }

  return (
    <Card>
      <SectionHeader
        title="Joint Contribution Settings"
        subtitle="Configure who contributes, how much, and which funding accounts are used."
      />

      <div className="space-y-5 p-5">
        <form className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2" onSubmit={onSubmit}>
          <div className="space-y-3">
            <select
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>

            <select
              value={jointOwnerId}
              onChange={(event) => setJointOwnerId(event.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select Joint Account</option>
              {jointOwnerOptions.map((jointOwner) => (
                <option key={jointOwner.id} value={jointOwner.id}>
                  {jointOwner.name}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              <input type="checkbox" checked={contributes} onChange={(event) => setContributes(event.target.checked)} />
              Contributes
            </label>

            <select
              value={method}
              onChange={(event) => setMethod(event.target.value as 'fixed' | 'percent_income' | 'split')}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="fixed">Fixed</option>
              <option value="percent_income">% Income</option>
              <option value="split">Split</option>
            </select>
          </div>

          <div className="space-y-3">
            <select
              value={fundingAccountId}
              onChange={(event) => setFundingAccountId(event.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Funding account</option>
              {memberFundingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>

            <select
              value={jointId}
              onChange={(event) => setJointId(event.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select Funding Destination</option>
              {selectedJointOwnerAccounts.map((jointAccount) => (
                <option key={jointAccount.id} value={jointAccount.id}>
                  {jointAccount.name}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              Active
            </label>

            {(method === 'fixed' || method === 'split') && (
              <input
                type="number"
                step="0.01"
                value={fixedAmount}
                onChange={(event) => setFixedAmount(event.target.value)}
                placeholder="Fixed amount"
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            )}

            {method === 'percent_income' && (
              <input
                type="number"
                step="0.01"
                value={percentIncome}
                onChange={(event) => setPercentIncome(event.target.value)}
                placeholder="Percent income"
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            )}

            {method === 'split' && (
              <select
                value={splitMode}
                onChange={(event) => setSplitMode(event.target.value as 'equal' | 'weighted')}
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="equal">Equal</option>
                <option value="weighted">Weighted</option>
              </select>
            )}

            {method === 'split' && splitMode === 'weighted' && (
              <input
                type="number"
                step="0.01"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder="Weight"
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            )}
          </div>

          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
              {editingId ? 'Update Setting' : 'Add Setting'}
            </button>
            <button type="button" onClick={resetForm} className="rounded border border-slate-300 px-3 py-2 text-sm">
              Clear
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          {loading ? (
            <p className="p-4 text-sm text-slate-500">Loading contribution settings...</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2">Member</th>
                  <th className="px-3 py-2">Destination Account</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Funding Account</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((setting) => (
                  <tr key={setting.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{members.find((m) => m.id === setting.member_id)?.name ?? setting.member_id}</td>
                    <td className="px-3 py-2">{jointLabel(setting.joint_id)}</td>
                    <td className="px-3 py-2">{setting.contributes ? setting.method ?? 'configured' : 'not contributing'}</td>
                    <td className="px-3 py-2">{fundingAccountLabel(setting.funding_account_id)}</td>
                    <td className="px-3 py-2">
                      <Pill tone={setting.active ? 'positive' : 'neutral'}>{setting.active ? 'Active' : 'Inactive'}</Pill>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => beginEdit(setting.id)}>
                          Edit
                        </button>
                        <button
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                          title={pendingDeleteId === setting.id ? 'Click again to confirm delete' : undefined}
                          onClick={() => void removeSetting(setting.id)}
                        >
                          {pendingDeleteId === setting.id ? 'Confirm delete' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected vs Actual Contributions</h3>
            <input
              type="month"
              value={effectiveSelectedMonth}
              onChange={(event) => updateSelectedMonth(event.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-2 py-2">Member</th>
                  <th className="px-2 py-2">Method</th>
                  <th className="px-2 py-2">Expected</th>
                  <th className="px-2 py-2">Actual</th>
                  <th className="px-2 py-2">Variance</th>
                </tr>
              </thead>
              <tbody>
                {contributionReportRows.map((row) => (
                  <tr key={row.settingId} className="border-b border-slate-100">
                    <td className="px-2 py-2">{row.memberName}</td>
                    <td className="px-2 py-2">{row.method}</td>
                    <td className="px-2 py-2">${row.expected.toFixed(2)}</td>
                    <td className="px-2 py-2">${row.actual.toFixed(2)}</td>
                    <td
                      className={`px-2 py-2 ${
                        row.variance < 0 ? 'text-red-600' : row.variance > 0 ? 'text-emerald-600' : 'text-slate-700'
                      }`}
                    >
                      ${row.variance.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {contributionReportRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-center text-sm text-slate-500">
                      No active contribution settings for the selected month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  )
}
