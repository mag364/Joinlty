import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import {
  Calculator,
  CalendarDays,
  ChartLine,
  CreditCard,
  DollarSign,
  HandCoins,
  House,
  Landmark,
  Link2,
  PieChart,
  ReceiptText,
  RefreshCcw,
  Settings,
  Users,
  Users2,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'
import { api } from '@renderer/lib/api'
import { formatMonthYear } from '@renderer/lib/dates'
import { PageShell } from './features/PageShell'
import { StatCard } from '@renderer/components/ui'
import { DashboardManager } from '@renderer/features/dashboard/DashboardManager'
import { MembersManager } from '@renderer/features/members/MembersManager'
import { ContributionSettingsManager } from '@renderer/features/contributions/ContributionSettingsManager'
import { AccountsManager } from '@renderer/features/accounts/AccountsManager'
import { IncomeManager } from '@renderer/features/income/IncomeManager'
import { BudgetManager } from '@renderer/features/budgets/BudgetManager'
import { RecurringManager } from '@renderer/features/recurring/RecurringManager'
import { TransactionsManager } from '@renderer/features/transactions/TransactionsManager'
import { MonthGenerationManager } from '@renderer/features/month/MonthGenerationManager'
import { ReportsManager } from '@renderer/features/reports/ReportsManager'
import { SettingsManager } from '@renderer/features/settings/SettingsManager'
import { TaxesManager } from '@renderer/features/taxes/TaxesManager'
import { OnboardingWizard } from '@renderer/features/onboarding/OnboardingWizard'
import appLogo from '../../build/icon.png'

const navItems = [
  'Dashboard',
  'Members',
  'Accounts',
  'Income',
  'Budget',
  'Taxes',
  'Expenses',
  'Transactions',
  'Month View',
  'Reports',
  'Settings',
] as const

type NavItem = (typeof navItems)[number]

const navIcons: Record<NavItem, LucideIcon> = {
  Dashboard: House,
  Members: Users2,
  Accounts: Landmark,
  Income: HandCoins,
  Budget: PieChart,
  Taxes: Calculator,
  Expenses: RefreshCcw,
  Transactions: ReceiptText,
  'Month View': CalendarDays,
  Reports: ChartLine,
  Settings,
}

const navSections: Array<{ label: string; items: NavItem[] }> = [
  { label: 'Core', items: ['Dashboard'] },
  { label: 'Household', items: ['Members', 'Accounts'] },
  { label: 'Cashflow', items: ['Income', 'Expenses', 'Transactions'] },
  { label: 'Planning', items: ['Budget', 'Taxes', 'Month View', 'Reports'] },
  { label: 'System', items: ['Settings'] },
]

const toPath = (label: string) => `/${label.toLowerCase().replace(/\s+/g, '-')}`

const MembersTabView = () => {
  const members = useAppStore((state) => state.members)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [addMemberRequestToken, setAddMemberRequestToken] = useState(0)
  const [contributionSummary, setContributionSummary] = useState<{
    activeSettings: number | null
    totalExpected: number | null
    totalVariance: number | null
  }>({
    activeSettings: null,
    totalExpected: null,
    totalVariance: null,
  })

  const activeMembersCount = members.filter((member) => member.active).length

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Members</h1>
          <p className="text-sm text-slate-500">Manage household members and joint contribution participation.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
          onClick={() => setAddMemberRequestToken((current) => current + 1)}
        >
          Add Member
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Active Members" value={`${activeMembersCount}`} subtitle={`${members.length} total members`} icon={Users} />
        <StatCard
          title="Joint Contribution Settings"
          value={contributionSummary.activeSettings == null ? '—' : `${contributionSummary.activeSettings}`}
          subtitle="Active settings"
          icon={Link2}
        />
        <StatCard
          title="Selected Month Total Expected"
          value={contributionSummary.totalExpected == null ? '—' : `$${contributionSummary.totalExpected.toFixed(2)}`}
          subtitle={formatMonthYear(selectedMonth)}
          icon={DollarSign}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <MembersManager addRequestToken={addMemberRequestToken} />
        <ContributionSettingsManager
          selectedMonth={selectedMonth}
          onSelectedMonthChange={setSelectedMonth}
          onSummaryChange={setContributionSummary}
        />
      </div>
    </section>
  )
}

const AccountsTabView = () => {
  const accounts = useAppStore((state) => state.accounts)
  const [addAccountRequestToken, setAddAccountRequestToken] = useState(0)

  const totalAccounts = accounts.length
  const personalCount = accounts.filter((account) => account.owner_type === 'member').length
  const jointCount = accounts.filter((account) => account.owner_type === 'joint').length

  const totalBalance = accounts
    .filter((account) => account.type !== 'credit_card')
    .reduce((sum, account) => sum + Math.max(account.current_balance, 0), 0)

  const totalDebt = accounts
    .filter((account) => account.type === 'credit_card')
    .reduce((sum, account) => sum + Math.abs(account.current_balance), 0)

  const net = totalBalance - totalDebt

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Accounts</h1>
          <p className="text-sm text-slate-500">Personal and joint account balances and ownership.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
          onClick={() => setAddAccountRequestToken((current) => current + 1)}
        >
          Add Account
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Accounts"
          value={`${totalAccounts}`}
          subtitle={`${personalCount} personal • ${jointCount} joint`}
          icon={Wallet}
        />
        <StatCard title="Total Balance" value={`$${totalBalance.toFixed(2)}`} subtitle="Checking + savings" icon={Landmark} />
        <StatCard title="Total Debt" value={`$${totalDebt.toFixed(2)}`} subtitle="Credit card owed" icon={CreditCard} valueClassName="text-red-600" />
        <StatCard title="Net" value={`$${net.toFixed(2)}`} subtitle="Balance - debt" icon={DollarSign} valueClassName={net < 0 ? 'text-red-600' : 'text-emerald-600'} />
      </div>

      <AccountsManager addRequestToken={addAccountRequestToken} />
    </section>
  )
}

const routeElements: Record<string, ReactNode> = {
  [toPath('Dashboard')]: (
    <PageShell title="Dashboard">
      <DashboardManager />
    </PageShell>
  ),
  [toPath('Members')]: (
    <PageShell title="Members">
      <MembersTabView />
    </PageShell>
  ),
  [toPath('Accounts')]: (
    <PageShell title="Accounts">
      <AccountsTabView />
    </PageShell>
  ),
  [toPath('Income')]: (
    <PageShell title="Income">
      <IncomeManager />
    </PageShell>
  ),
  [toPath('Budget')]: (
    <PageShell title="Budget">
      <BudgetManager />
    </PageShell>
  ),
  [toPath('Taxes')]: (
    <PageShell title="Taxes">
      <TaxesManager />
    </PageShell>
  ),
  [toPath('Expenses')]: (
    <PageShell title="Expenses">
      <RecurringManager />
    </PageShell>
  ),
  [toPath('Transactions')]: (
    <PageShell title="Transactions">
      <TransactionsManager />
    </PageShell>
  ),
  [toPath('Month View')]: (
    <PageShell title="Month View">
      <MonthGenerationManager />
    </PageShell>
  ),
  [toPath('Reports')]: (
    <PageShell title="Reports">
      <ReportsManager />
    </PageShell>
  ),
  [toPath('Settings')]: (
    <PageShell title="Settings">
      <SettingsManager />
    </PageShell>
  ),
}

const fallbackElement = routeElements[toPath('Dashboard')]

function App() {
  const refreshCoreData = useAppStore((state) => state.refreshCoreData)
  const loading = useAppStore((state) => state.loading)
  const error = useAppStore((state) => state.error)
  const members = useAppStore((state) => state.members)
  const accounts = useAppStore((state) => state.accounts)
  const [onboardingStatus, setOnboardingStatus] = useState<'checking' | 'show' | 'hidden'>('checking')

  useEffect(() => {
    void refreshCoreData()
  }, [refreshCoreData])

  useEffect(() => {
    if (loading || onboardingStatus !== 'checking') return

    let cancelled = false

    const evaluateOnboarding = async () => {
      try {
        const settings = await api.getSettings()
        const alreadyCompleted = settings.onboarding_v1_completed === 'true'
        if (alreadyCompleted) {
          if (!cancelled) setOnboardingStatus('hidden')
          return
        }

        if (members.length > 0 && accounts.length > 0) {
          await api.setSetting({ key: 'onboarding_v1_completed', value: 'true' })
          if (!cancelled) setOnboardingStatus('hidden')
          return
        }

        if (!cancelled) setOnboardingStatus('show')
      } catch {
        if (cancelled) return
        setOnboardingStatus(members.length === 0 || accounts.length === 0 ? 'show' : 'hidden')
      }
    }

    void evaluateOnboarding()

    return () => {
      cancelled = true
    }
  }, [accounts.length, loading, members.length, onboardingStatus])

  const completeOnboarding = async () => {
    await api.setSetting({ key: 'onboarding_v1_completed', value: 'true' })
    setOnboardingStatus('hidden')
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex h-screen w-[248px] flex-col border-r border-slate-200 bg-white px-3 py-4">
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <h1 className="flex items-center gap-3.5 text-2xl font-semibold text-slate-900">
            <img src={appLogo} alt="Jointly logo" className="h-11 w-11 rounded-lg" />
            <span>Jointly</span>
          </h1>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto pr-1">
          {navSections.map((section) => (
            <section key={section.label} className="space-y-1.5">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{section.label}</p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const path = toPath(item)
                  const Icon = navIcons[item]

                  return (
                    <NavLink
                      key={item}
                      to={path}
                      className={({ isActive }) =>
                        `group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1 ${
                          isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center" aria-hidden="true">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="font-medium">{item}</span>
                    </NavLink>
                  )
                })}
              </div>
            </section>
          ))}
        </nav>

      </aside>

      <main className="flex-1 p-6">
        {loading && <p className="mb-3 text-sm text-slate-500">Loading data...</p>}
        {error && <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Routes>
          {navItems.map((item) => {
            const path = toPath(item)
            return <Route key={item} path={path} element={routeElements[path] ?? fallbackElement} />
          })}
          <Route path="*" element={fallbackElement} />
        </Routes>
      </main>

      {onboardingStatus === 'show' && <OnboardingWizard onComplete={completeOnboarding} />}
    </div>
  )
}

export default App
