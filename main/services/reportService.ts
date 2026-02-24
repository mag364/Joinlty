import { getDb } from '../dbService'

const monthRange = (month: string) => {
  const [year, mon] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, mon - 1, 1)).toISOString().slice(0, 10)
  const end = new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10)
  return { start, end }
}

export const reportService = {
  summary(month: string) {
    const db = getDb()
    const { start, end } = monthRange(month)

    const income =
      (db
        .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = 'income' AND date BETWEEN ? AND ?`)
        .get(start, end) as { total: number }).total ?? 0

    const expense =
      (db
        .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = 'expense' AND date BETWEEN ? AND ?`)
        .get(start, end) as { total: number }).total ?? 0

    return {
      month,
      income: Number(income),
      expense: Number(expense),
      net: Number(income) - Number(expense),
    }
  },
}
