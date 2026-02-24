import { useEffect, useState } from 'react'
import { useAppStore } from '@renderer/store/useAppStore'
import { api } from '@renderer/lib/api'
import type { GenerationPreviewItem } from '@shared/types'
import type { AIDashboardAssistantRequest } from '@shared/preload'
import { formatDateOnly, formatMonthYear, getLocalTodayDate, getLocalTodayDisplayDate, parseDateOnly } from '@renderer/lib/dates'
import { AlertTriangle, CircleCheck, CreditCard, Landmark, Loader2, PiggyBank, Plus, Sparkles, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type StatCardProps = {
  title: string
  value: string
  subtitle?: string
  icon?: LucideIcon
  showIconContainer?: boolean
  valueClassName?: string
}

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  showIconContainer = true,
  valueClassName = 'text-slate-900',
}: StatCardProps) => (
  <div className="group relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md">
    {showIconContainer && Icon && (
      <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon className="h-5 w-5" />
      </div>
    )}

    <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
    <p className={`mt-2 text-2xl font-semibold ${valueClassName}`}>{value}</p>

    {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
  </div>
)

const SectionCard = ({
  title,
  children,
  actions,
}: {
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}) => (
  <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 text-sm font-semibold uppercase tracking-wide text-slate-700">
      <span>{title}</span>
      {actions}
    </header>
    <div className="p-6">{children}</div>
  </section>
)

type AssistantSource = 'provider' | 'fallback'
type AssistantResponse = { answer: string; suggestedActions: string[]; source: AssistantSource }
type AssistantCardsCache = {
  dailyBrief: string
  riskAlert: string
  smartActions: string[]
  assistantSource: AssistantSource
  lastAiRefreshAt: string
  aiConfigKey: string
}

let dashboardAssistantCardsCache: AssistantCardsCache | null = null

export const DashboardManager = () => {
  const navigate = useNavigate()
  const members = useAppStore((state) => state.members)
  const accounts = useAppStore((state) => state.accounts)
  const transactions = useAppStore((state) => state.transactions)

  const [pendingGeneratedIncome, setPendingGeneratedIncome] = useState<GenerationPreviewItem[]>([])
  const [loadingRules, setLoadingRules] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [loadingAssistantCards, setLoadingAssistantCards] = useState(false)
  const [loadingDailyBrief, setLoadingDailyBrief] = useState(false)
  const [assistantCardsInitialized, setAssistantCardsInitialized] = useState(false)
  const [dailyBrief, setDailyBrief] = useState<string>('')
  const [riskAlert, setRiskAlert] = useState<string>('')
  const [smartActions, setSmartActions] = useState<string[]>([])
  const [assistantMessage, setAssistantMessage] = useState('')
  const [assistantSource, setAssistantSource] = useState<AssistantSource | null>(null)
  const [lastAiRefreshAt, setLastAiRefreshAt] = useState<string | null>(null)
  const [askPrompt, setAskPrompt] = useState('')
  const [askResult, setAskResult] = useState<{ answer: string; suggestedActions: string[] } | null>(null)
  const [askSource, setAskSource] = useState<AssistantSource | null>(null)
  const [askLoading, setAskLoading] = useState(false)
  const [aiConfigKey, setAiConfigKey] = useState('')

  const month = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()
  const currentDateLabel = getLocalTodayDisplayDate()

  const loadRecurringRules = async () => {
    setLoadingRules(true)
    try {
      const currentMonthDate = new Date()
      const currentMonth = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`
      const nextMonthDate = new Date(currentMonthDate)
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1)
      const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`

      const [currentMonthPreview, nextMonthPreview] = await Promise.all([
        api.previewGeneration(currentMonth),
        api.previewGeneration(nextMonth),
      ])

      const upcomingIncomePreview = [...currentMonthPreview, ...nextMonthPreview].filter(
        (item) => item.source_type === 'recurring_rule' && item.transaction.type === 'income',
      )

      setPendingGeneratedIncome(upcomingIncomePreview)
    } finally {
      setLoadingRules(false)
    }
  }

  useEffect(() => {
    void loadRecurringRules()

    let cancelled = false

    const initializeAssistantCache = async () => {
      try {
        const nextAiConfigKey = await buildAiConfigKey()
        if (cancelled) return

        setAiConfigKey(nextAiConfigKey)

        if (dashboardAssistantCardsCache && dashboardAssistantCardsCache.aiConfigKey === nextAiConfigKey) {
          setDailyBrief(dashboardAssistantCardsCache.dailyBrief)
          setRiskAlert(dashboardAssistantCardsCache.riskAlert)
          setSmartActions(dashboardAssistantCardsCache.smartActions)
          setAssistantSource(dashboardAssistantCardsCache.assistantSource)
          setLastAiRefreshAt(dashboardAssistantCardsCache.lastAiRefreshAt)
          setAssistantCardsInitialized(true)
          return
        }

        dashboardAssistantCardsCache = null
      } catch {
        if (cancelled) return
        setAiConfigKey('unknown')
        dashboardAssistantCardsCache = null
      }
    }

    void initializeAssistantCache()

    setIsVisible(true)

    return () => {
      cancelled = true
    }
  }, [])

  const monthTransactions = transactions.filter((transaction) => transaction.date.startsWith(month))
  const today = getLocalTodayDate()
  const todayTransactions = transactions.filter((transaction) => transaction.date === today)
  const totalBalance = accounts.reduce((sum, account) => sum + account.current_balance, 0)
  const incomeCount = transactions.filter((transaction) => transaction.type === 'income').length
  const expenseCount = transactions.filter((transaction) => transaction.type === 'expense').length
  const transferCount = transactions.filter((transaction) => transaction.type === 'transfer').length

  const monthIncome = monthTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const monthExpense = monthTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const monthNet = monthIncome - monthExpense

  const todayIncome = todayTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const todayExpense = todayTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const todayTransferCount = todayTransactions.filter((transaction) => transaction.type === 'transfer').length
  const todayNet = todayIncome - todayExpense

  const personalAccountRows = members.map((member) => {
    const depositAccounts = accounts.filter(
      (account) =>
        account.owner_type === 'member' &&
        account.owner_id === member.id &&
        account.type !== 'credit_card',
    )

    const checkingTotal = depositAccounts
      .filter((account) => account.type === 'checking')
      .reduce((sum, account) => sum + account.current_balance, 0)

    const savingsTotal = depositAccounts
      .filter((account) => account.type === 'savings')
      .reduce((sum, account) => sum + account.current_balance, 0)

    return {
      memberId: member.id,
      memberName: member.name,
      memberType: member.member_type,
      checkingTotal,
      savingsTotal,
      total: depositAccounts.reduce((sum, account) => sum + account.current_balance, 0),
      depositAccounts,
    }
  })

  const personAccountRows = personalAccountRows.filter((row) => (row.memberType ?? 'person') === 'person')
  const nonPersonAccountRows = personalAccountRows.filter((row) => (row.memberType ?? 'person') !== 'person')

  const jointCheckingTotal = accounts
    .filter((account) => account.owner_type === 'joint' && account.type === 'checking')
    .reduce((sum, account) => sum + account.current_balance, 0)
  const jointSavingsTotal = accounts
    .filter((account) => account.owner_type === 'joint' && account.type === 'savings')
    .reduce((sum, account) => sum + account.current_balance, 0)
  const jointCheckingSavingsTotal = jointCheckingTotal + jointSavingsTotal

  const todayDate = parseDateOnly(today)
  const nextWeekDate = (() => {
    if (!todayDate) {
      const fallback = new Date()
      fallback.setDate(fallback.getDate() + 7)
      return fallback
    }

    const date = new Date(todayDate)
    date.setDate(date.getDate() + 7)
    date.setHours(23, 59, 59, 999)
    return date
  })()

  const upcomingRecurring = pendingGeneratedIncome
    .map((item) => {
      const nextRun = parseDateOnly(item.transaction.date)
      if (!nextRun) return null
      return {
        item,
        nextRun,
      }
    })
    .filter((entry): entry is { item: GenerationPreviewItem; nextRun: Date } => entry !== null)
    .filter((entry) => entry.nextRun >= (todayDate as Date) && entry.nextRun <= nextWeekDate)

  const expectedUpcomingRevenue = upcomingRecurring.reduce((sum, entry) => sum + entry.item.transaction.amount, 0)
  const nextFiveRuns = [...upcomingRecurring].sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime()).slice(0, 5)

  const memberRows = members
    .map((member) => {
      const txs = monthTransactions.filter((transaction) => transaction.owner_type === 'member' && transaction.owner_id === member.id)
      const income = txs.filter((transaction) => transaction.type === 'income').reduce((sum, transaction) => sum + transaction.amount, 0)
      const expense = txs.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0)
      return {
        id: member.id,
        name: member.name,
        income,
        expense,
        net: income - expense,
      }
    })
    .filter((row) => row.income > 0 || row.expense > 0)

  const memberIncomeInline = memberRows.length > 0
    ? memberRows.map((row) => `${row.name}: $${row.income.toFixed(2)}`).join(' • ')
    : 'No member income this month'

  const memberExpenseInline = memberRows.length > 0
    ? memberRows.map((row) => `${row.name}: $${row.expense.toFixed(2)}`).join(' • ')
    : 'No member expenses this month'

  const memberNetInline = memberRows.length > 0
    ? memberRows.map((row) => `${row.name}: $${row.net.toFixed(2)}`).join(' • ')
    : 'No member net data this month'

  const monthNetColorClass = monthNet >= 0 ? 'text-emerald-600' : 'text-red-600'

  const categoryTotals = Object.entries(
    monthTransactions.reduce<Record<string, { income: number; expense: number }>>((acc, transaction) => {
      const key = transaction.category ?? 'Uncategorized'
      const current = acc[key] ?? { income: 0, expense: 0 }
      if (transaction.type === 'income') current.income += transaction.amount
      if (transaction.type === 'expense') current.expense += transaction.amount
      acc[key] = current
      return acc
    }, {}),
  ).map(([category, totals]) => ({ category, net: totals.income - totals.expense }))

  const buildAssistantPayload = (question: string): AIDashboardAssistantRequest => ({
    question,
    month,
    summary: {
      income: monthIncome,
      expense: monthExpense,
      net: monthNet,
    },
    accounts: accounts.map((account) => ({
      name: account.name,
      balance: account.current_balance,
      owner_type: account.owner_type,
      type: account.type,
    })),
    categoryTotals,
    memberTotals: memberRows.map((row) => ({ member: row.name, net: row.net })),
    upcomingRecurring: upcomingRecurring.map((entry) => ({
      date: entry.item.transaction.date,
      description: entry.item.transaction.description ?? 'Recurring item',
      amount: entry.item.transaction.amount,
      type: entry.item.transaction.type === 'income' ? 'income' : 'expense',
    })),
  })

  const askAssistant = async (question: string): Promise<AssistantResponse> => {
    const response = await api.dashboardAssistant(buildAssistantPayload(question))
    if (!response.ok || !response.result) {
      return {
        answer: response.message,
        suggestedActions: [] as string[],
        source: 'fallback',
      }
    }

    const source: AssistantSource = response.message.toLowerCase().includes('with ai provider') ? 'provider' : 'fallback'

    return {
      answer: response.result.answer,
      suggestedActions: response.result.suggestedActions,
      source,
    }
  }

  const buildAiConfigKey = async () => {
    const settings = await api.getSettings()
    return `${settings.ai_provider ?? 'none'}|${settings.ai_base_url ?? ''}|${settings.ai_model ?? ''}`
  }

  const buildDailyBriefQuestion = () => {
    const highlights = todayTransactions
      .slice(0, 5)
      .map((transaction) => transaction.description ?? transaction.category ?? transaction.type)
      .join(' | ')

    return [
      'Generate a concise daily brief for TODAY ONLY (do not include month summary).',
      `DAILY_CONTEXT date=${today}; tx_count=${todayTransactions.length}; income=${todayIncome.toFixed(2)}; expense=${todayExpense.toFixed(2)}; transfer_count=${todayTransferCount}; net=${todayNet.toFixed(2)}; highlights=${highlights || 'none'}`,
      'Respond with a short, practical summary of today\'s activity.',
    ].join(' ')
  }

  const refreshDailyBrief = async () => {
    setLoadingDailyBrief(true)
    setAssistantMessage('')
    try {
      const brief = await askAssistant(buildDailyBriefQuestion())
      setDailyBrief(brief.answer)
      setAssistantSource(brief.source)

      const refreshedAt = new Date().toLocaleTimeString()
      setLastAiRefreshAt(refreshedAt)

      dashboardAssistantCardsCache = {
        dailyBrief: brief.answer,
        riskAlert,
        smartActions,
        assistantSource: brief.source,
        lastAiRefreshAt: refreshedAt,
        aiConfigKey,
      }
    } catch (error) {
      setAssistantMessage(error instanceof Error ? error.message : 'Unable to refresh daily brief right now.')
    } finally {
      setAssistantCardsInitialized(true)
      setLoadingDailyBrief(false)
    }
  }

  const refreshAssistantCards = async () => {
    setLoadingAssistantCards(true)
    setAssistantMessage('')
    try {
      const [brief, risk, actions] = await Promise.all([
        askAssistant(buildDailyBriefQuestion()),
        askAssistant('Are there any cashflow risk alerts I should know about right now?'),
        askAssistant('Give me 3 smart budgeting actions I should take next.'),
      ])

      const nextSmartActions = (actions.suggestedActions.length > 0 ? actions.suggestedActions : [actions.answer]).slice(0, 3)

      setDailyBrief(brief.answer)
      setRiskAlert(risk.answer)
      setSmartActions(nextSmartActions)
      setAssistantSource(brief.source)
      const refreshedAt = new Date().toLocaleTimeString()
      setLastAiRefreshAt(refreshedAt)

      dashboardAssistantCardsCache = {
        dailyBrief: brief.answer,
        riskAlert: risk.answer,
        smartActions: nextSmartActions,
        assistantSource: brief.source,
        lastAiRefreshAt: refreshedAt,
        aiConfigKey,
      }
    } catch (error) {
      setAssistantMessage(error instanceof Error ? error.message : 'Unable to generate dashboard AI insights right now.')
    } finally {
      setAssistantCardsInitialized(true)
      setLoadingAssistantCards(false)
    }
  }

  const submitAskDashboard = async () => {
    const question = askPrompt.trim()
    if (!question) return
    setAskLoading(true)
    try {
      const answer = await askAssistant(question)
      setAskResult(answer)
      setAskSource(answer.source)
    } finally {
      setAskLoading(false)
    }
  }

  useEffect(() => {
    if (loadingRules || !aiConfigKey) return
    if (dashboardAssistantCardsCache && dashboardAssistantCardsCache.aiConfigKey === aiConfigKey) return
    void refreshAssistantCards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingRules, aiConfigKey, month, transactions.length, accounts.length, pendingGeneratedIncome.length])

  return (
    <article
      className={`space-y-8 transition-all duration-300 ease-out ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Household Dashboard</h2>
          <p className="text-sm text-slate-500">Live overview of accounts, activity, and upcoming recurring income for {currentDateLabel}.</p>
        </div>

        <button
          onClick={() => void loadRecurringRules()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md"
        >
          {loadingRules ? <Loader2 className="h-4 w-4 animate-spin" /> : <Loader2 className="h-4 w-4" />}
          {loadingRules ? 'Refreshing...' : 'Refresh Dashboard'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Members" value={`${members.length}`} subtitle="Active household members" icon={Users} />
        <StatCard title="Accounts" value={`${accounts.length}`} subtitle="Linked cash and credit accounts" icon={Wallet} />
        <StatCard
          title="Transactions"
          value={`${transactions.length}`}
          subtitle={`I:${incomeCount} / E:${expenseCount} / T:${transferCount}`}
          icon={CreditCard}
        />
        <StatCard title="Total Balance" value={`$${totalBalance.toFixed(2)}`} subtitle="Combined tracked balance" icon={Landmark} />
      </div>

      <SectionCard title={`Current Month Summary (${formatMonthYear(month)})`}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Income"
            value={`$${monthIncome.toFixed(2)}`}
            subtitle={memberIncomeInline}
            icon={TrendingUp}
            valueClassName="text-emerald-600"
          />
          <StatCard
            title="Expense"
            value={`$${monthExpense.toFixed(2)}`}
            subtitle={memberExpenseInline}
            icon={TrendingDown}
            valueClassName="text-slate-900"
          />
          <StatCard
            title="Net"
            value={`$${monthNet.toFixed(2)}`}
            subtitle={memberNetInline}
            icon={Wallet}
            valueClassName={monthNetColorClass}
          />
          <StatCard
            title="Upcoming Recurring Revenue (7d)"
            value={`$${expectedUpcomingRevenue.toFixed(2)}`}
            subtitle={`${upcomingRecurring.length} income item(s)`}
            icon={PiggyBank}
          />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title="Account(s) Breakdown">
          <div className="space-y-3 text-sm">
            {personAccountRows.map((row) => (
              <div key={row.memberId} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p>
                  {row.memberName} Earnings: <span className="font-semibold">${row.total.toFixed(2)}</span>
                </p>
                {row.depositAccounts.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {row.depositAccounts.map((account) => `${account.name}: $${account.current_balance.toFixed(2)}`).join(' • ')}
                  </p>
                )}
              </div>
            ))}

            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p>
                Joint: <span className="font-semibold">${jointCheckingSavingsTotal.toFixed(2)}</span>
              </p>
            </div>

            {nonPersonAccountRows.map((row) => (
              <div key={row.memberId} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p>
                  {row.memberName} Earnings: <span className="font-semibold">${row.total.toFixed(2)}</span>
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Next recurring income items (7d)">
          <ul className="space-y-2 text-sm text-slate-700">
            {nextFiveRuns.map((item) => (
              <li key={item.item.log_key} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                {item.item.transaction.description ?? 'Recurring income'} — {formatDateOnly(item.nextRun)} (${item.item.transaction.amount.toFixed(2)})
              </li>
            ))}

            {nextFiveRuns.length === 0 && (
              <li className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
                <CircleCheck className="h-4 w-4" />
                No recurring income items due in the next 7 days.
              </li>
            )}
          </ul>
        </SectionCard>

        <SectionCard title="Quick Actions">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate('/transactions')}
              className="inline-flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-md"
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Transaction
              </span>
              <span aria-hidden="true">→</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/income')}
              className="inline-flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-md"
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Income
              </span>
              <span aria-hidden="true">→</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/accounts')}
              className="inline-flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-md"
            >
              <span className="inline-flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Pay Credit Card
              </span>
              <span aria-hidden="true">→</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/budget')}
              className="inline-flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-md"
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Budget
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Ask the Dashboard">
        <div className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              value={askPrompt}
              onChange={(event) => setAskPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && askPrompt.trim() && !askLoading) {
                  event.preventDefault()
                  void submitAskDashboard()
                }
              }}
              placeholder="Why is my net down this month?"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void submitAskDashboard()}
              disabled={askLoading || !askPrompt.trim()}
              className="inline-flex items-center justify-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {askLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Ask
            </button>
          </div>

          {askResult && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {askSource && <p className="mb-2 text-xs text-slate-500">Source: {askSource === 'provider' ? 'Provider AI' : 'Local fallback'}</p>}
              <p>{askResult.answer}</p>
              {askResult.suggestedActions.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5">
                  {askResult.suggestedActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="AI Daily Brief"
          actions={
            <button
              type="button"
              onClick={() => void refreshDailyBrief()}
              disabled={loadingDailyBrief || loadingAssistantCards}
              className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium normal-case tracking-normal text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingDailyBrief ? 'Refreshing Day...' : 'Refresh Day'}
            </button>
          }
        >
          <div className="space-y-3 text-sm text-slate-700">
            {assistantSource && <p className="text-xs text-slate-500">Source: {assistantSource === 'provider' ? 'Provider AI' : 'Local fallback'}</p>}
            {!assistantCardsInitialized || loadingAssistantCards || loadingDailyBrief ? (
              <p className="inline-flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating Daily Brief...
              </p>
            ) : (
              <p>{dailyBrief || 'No brief available yet.'}</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Cashflow Risk Alert">
          <div className="space-y-3 text-sm text-slate-700">
            {loadingAssistantCards ? (
              <p className="inline-flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating Cashflow Risk Alert...
              </p>
            ) : (
              <p className="inline-flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                <span>{riskAlert || 'No risk alerts right now.'}</span>
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Smart Actions">
          <div className="space-y-3 text-sm text-slate-700">
            {loadingAssistantCards ? (
              <p className="inline-flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Refreshing Smart Actions...
              </p>
            ) : smartActions.length > 0 ? (
              <ul className="space-y-2">
                {smartActions.map((action) => (
                  <li key={action} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    {action}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No action suggestions available yet.</p>
            )}

            {lastAiRefreshAt && <p className="text-xs text-slate-500">Last updated: {lastAiRefreshAt}</p>}

            {assistantMessage && <p className="text-xs text-amber-700">{assistantMessage}</p>}
          </div>
        </SectionCard>
      </div>

    </article>
  )
}
