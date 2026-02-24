import type { RecurringRule } from '@shared/types'

export const monthStart = (month: string) => `${month}-01`

export const monthEnd = (month: string) => {
  const [year, mon] = month.split('-').map(Number)
  const end = new Date(Date.UTC(year, mon, 0))
  return end.toISOString().slice(0, 10)
}

export const parseDateOnly = (value: string): Date | null => {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const formatDateOnly = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getLocalTodayDate = () => formatDateOnly(new Date())

export const formatMonthYear = (value: string) => {
  const match = value.trim().match(/^(\d{4})-(\d{2})$/)
  if (!match) return value

  const [, year, month] = match
  return `${month}-${year}`
}

const formatLongDateWithOrdinal = (date: Date) => {
  const day = date.getDate()
  const mod100 = day % 100
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? 'th'
      : day % 10 === 1
        ? 'st'
        : day % 10 === 2
          ? 'nd'
          : day % 10 === 3
            ? 'rd'
            : 'th'

  const monthName = date.toLocaleString('en-US', { month: 'long' })
  return `${monthName} ${day}${suffix}, ${date.getFullYear()}`
}

export const getLocalTodayDisplayDate = () => formatLongDateWithOrdinal(new Date())

export const getAvailableTimeZones = () => {
  const intlWithSupportedValues = Intl as unknown as {
    supportedValuesOf?: (key: string) => string[]
  }

  const supported = intlWithSupportedValues.supportedValuesOf?.('timeZone')
  if (supported && supported.length > 0) return supported

  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Asia/Kolkata',
    'Australia/Sydney',
  ]
}

const buildMonthlyRunDate = (year: number, monthIndex: number, dayOfMonth: number) => {
  const safeDay = Math.min(31, Math.max(1, dayOfMonth))
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  return new Date(year, monthIndex, Math.min(safeDay, daysInMonth))
}

export const getNextRecurringRunDate = (
  rule: Pick<RecurringRule, 'day_of_month' | 'next_run_date'>,
  fromDate: Date,
): Date | null => {
  const startDate = parseDateOnly(rule.next_run_date)
  if (!startDate) return null

  let candidate = buildMonthlyRunDate(fromDate.getFullYear(), fromDate.getMonth(), rule.day_of_month)
  if (candidate < fromDate) {
    candidate = buildMonthlyRunDate(fromDate.getFullYear(), fromDate.getMonth() + 1, rule.day_of_month)
  }

  let safety = 0
  while (candidate < startDate && safety < 240) {
    candidate = buildMonthlyRunDate(candidate.getFullYear(), candidate.getMonth() + 1, rule.day_of_month)
    safety += 1
  }

  return candidate
}

export const BUDGET_CATEGORY_EXCLUSIONS = new Set(['Housing', 'Interest', 'Transport'])
