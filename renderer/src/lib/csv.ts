import { api } from '@renderer/lib/api'

type CsvImportTransactionPayload = Parameters<typeof api.createTransaction>[0]

export const parseCsvRows = (csvText: string): string[][] => {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ''
  let inQuotes = false

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index]
    const nextChar = csvText[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue.trim())
      currentValue = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1
      currentRow.push(currentValue.trim())
      if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow)
      currentRow = []
      currentValue = ''
      continue
    }

    currentValue += char
  }

  currentRow.push(currentValue.trim())
  if (currentRow.some((cell) => cell.length > 0)) rows.push(currentRow)

  return rows
}

export const normalizeHeader = (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_')

const parseCsvDate = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

const parseCsvSignedAmount = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed) return null

  const negativeByParens = trimmed.startsWith('(') && trimmed.endsWith(')')
  const sanitized = trimmed.replace(/[(),$]/g, '').replace(/,/g, '').trim()
  const parsed = Number(sanitized)
  if (Number.isNaN(parsed) || parsed === 0) return null
  return negativeByParens ? -Math.abs(parsed) : parsed
}

const findAccountByRef = (
  ref: string,
  accounts: Array<{ id: string; name: string; owner_type: 'member' | 'joint'; owner_id: string }>,
) => {
  const normalized = ref.trim().toLowerCase()
  if (!normalized) return null
  return (
    accounts.find((account) => account.id.toLowerCase() === normalized) ??
    accounts.find((account) => account.name.trim().toLowerCase() === normalized) ??
    null
  )
}

export const mapCsvRowToTransaction = (
  row: Record<string, string>,
  members: Array<{ id: string; name: string }>,
  accounts: Array<{ id: string; name: string; owner_type: 'member' | 'joint'; owner_id: string }>,
): { payload?: CsvImportTransactionPayload; error?: string } => {
  const typeRaw = (row.type ?? row.transaction_type ?? '').trim().toLowerCase()
  let type = (['expense', 'income', 'transfer'].includes(typeRaw) ? typeRaw : null) as
    | 'expense'
    | 'income'
    | 'transfer'
    | null

  const date = parseCsvDate(row.date ?? row.transaction_date ?? '')
  if (!date) return { error: 'Missing/invalid date' }

  const directAmount = parseCsvSignedAmount(row.amount ?? row.value ?? '')
  const debitAmount = parseCsvSignedAmount(row.debit ?? '')
  const creditAmount = parseCsvSignedAmount(row.credit ?? '')
  const signedAmount =
    directAmount ??
    (debitAmount != null || creditAmount != null
      ? (creditAmount == null ? 0 : Math.abs(creditAmount)) - (debitAmount == null ? 0 : Math.abs(debitAmount))
      : null)

  if (signedAmount == null || signedAmount === 0) return { error: 'Missing/invalid amount' }
  const amount = Math.abs(signedAmount)

  const ownerTypeRaw = (row.owner_type ?? '').trim().toLowerCase()
  const ownerType = (ownerTypeRaw === 'joint' ? 'joint' : 'member') as 'member' | 'joint'

  const ownerIdFromCsv = (row.owner_id ?? '').trim()
  const ownerNameFromCsv = (row.owner_name ?? row.member_name ?? '').trim().toLowerCase()
  const matchedMember =
    ownerNameFromCsv.length > 0 ? members.find((member) => member.name.trim().toLowerCase() === ownerNameFromCsv) : undefined

  const ownerId =
    ownerType === 'joint'
      ? ownerIdFromCsv || 'joint-household'
      : ownerIdFromCsv || matchedMember?.id || members[0]?.id || ''

  if (!ownerId) return { error: 'Unable to resolve owner_id' }

  const accountRef = (row.account_id ?? row.account ?? row.account_name ?? '').trim()
  const fromRef = (row.from_account_id ?? row.from_account ?? row.from_account_name ?? '').trim()
  const toRef = (row.to_account_id ?? row.to_account ?? row.to_account_name ?? '').trim()

  if (!type) {
    const hasFromRef = Boolean(fromRef)
    const hasToRef = Boolean(toRef)
    if (hasFromRef && hasToRef) type = 'transfer'
    else type = signedAmount < 0 ? 'expense' : 'income'
  }

  const account = findAccountByRef(accountRef, accounts)
  const fromAccount = findAccountByRef(fromRef, accounts)
  const toAccount = findAccountByRef(toRef, accounts)

  if (type === 'transfer') {
    if (!fromAccount || !toAccount) return { error: 'Transfer requires valid from/to account refs' }
    if (fromAccount.id === toAccount.id) return { error: 'Transfer from/to account cannot match' }
  }

  const tagsRaw = row.tags ?? ''
  const tags = tagsRaw
    .split(/[|;,]/g)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)

  return {
    payload: {
      date,
      amount,
      type,
      category: (row.category ?? '').trim() || null,
      description: (row.description ?? row.vendor ?? '').trim() || null,
      owner_type: ownerType,
      owner_id: ownerId,
      account_id: type === 'transfer' ? null : account?.id ?? null,
      from_account_id: type === 'transfer' ? fromAccount?.id ?? null : null,
      to_account_id: type === 'transfer' ? toAccount?.id ?? null : null,
      tags,
      notes: (row.notes ?? row.note ?? '').trim() || null,
    },
  }
}
