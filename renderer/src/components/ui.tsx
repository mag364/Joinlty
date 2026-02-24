import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => {
  return <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`.trim()}>{children}</section>
}

export const SectionHeader = ({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) => (
  <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {actions}
  </header>
)

export const StatCard = ({
  title,
  value,
  subtitle,
  valueClassName = 'text-slate-900',
  icon: Icon,
  tone = 'neutral',
}: {
  title: string
  value: string
  subtitle?: string
  valueClassName?: string
  icon?: LucideIcon
  tone?: 'neutral'
}) => (
  <Card className="relative p-5 transition-all duration-150 hover:-translate-y-[1px] hover:shadow-md">
    {Icon && (
      <div
        className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg ${
          tone === 'neutral' ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-600'
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
    )}
    <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
    <p className={`mt-2 text-2xl font-semibold ${valueClassName}`}>{value}</p>
    {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
  </Card>
)

export const Pill = ({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'positive' | 'negative'
}) => {
  const toneClass =
    tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'negative'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-slate-200 bg-slate-100 text-slate-700'

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>
}

export const IconButton = ({
  children,
  onClick,
  title,
  className = '',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  title?: string
  className?: string
  type?: 'button' | 'submit' | 'reset'
}) => (
  <button
    type={type}
    title={title}
    onClick={onClick}
    className={`inline-flex items-center justify-center rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100 ${className}`.trim()}
  >
    {children}
  </button>
)