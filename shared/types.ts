export type UUID = string

export type OwnerType = 'member' | 'joint'
export type MemberType = 'person' | 'property' | 'business'
export type AccountType = 'checking' | 'savings' | 'credit_card'
export type TransactionType = 'expense' | 'income' | 'transfer'
export type RuleType = 'expense' | 'income' | 'contribution'
export type BudgetPeriod = 'monthly' | 'yearly'
export type ContributionMethod = 'fixed' | 'percent_income' | 'split'
export type SplitMode = 'equal' | 'weighted'

export interface Member {
  id: UUID
  name: string
  member_type: MemberType
  color?: string | null
  avatar?: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Joint {
  id: UUID
  name: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: UUID
  name: string
  kind?: 'income' | 'expense' | null
  active: boolean
  created_at: string
}

export interface BudgetTarget {
  id: UUID
  owner_type: OwnerType
  owner_id: UUID
  category: string
  amount: number
  period: BudgetPeriod
  active: boolean
  updated_at: string
}

export interface Account {
  id: UUID
  name: string
  type: AccountType
  owner_type: OwnerType
  owner_id: UUID
  starting_balance: number
  created_at: string
  updated_at: string
}

export interface AccountWithBalance extends Account {
  current_balance: number
}

export interface Transaction {
  id: UUID
  date: string
  amount: number
  type: TransactionType
  category?: string | null
  description?: string | null
  owner_type: OwnerType
  owner_id: UUID
  account_id?: UUID | null
  from_account_id?: UUID | null
  to_account_id?: UUID | null
  tags: string[]
  notes?: string | null
  created_at: string
}

export interface RecurringRule {
  id: UUID
  rule_type: RuleType
  name: string
  amount: number
  category?: string | null
  owner_type: OwnerType
  owner_id: UUID
  account_id?: UUID | null
  schedule: 'monthly'
  day_of_month: number
  next_run_date: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface ContributionSetting {
  id: UUID
  member_id: UUID
  joint_id: UUID
  contributes: boolean
  method?: ContributionMethod | null
  fixed_amount?: number | null
  percent_income?: number | null
  split_mode?: SplitMode | null
  weight?: number | null
  funding_account_id?: UUID | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Attachment {
  id: UUID
  transaction_id: UUID
  original_filename: string
  file_path: string
  mime_type: string
  size: number
  created_at: string
}

export interface GenerationPreviewItem {
  source_type: 'recurring_rule' | 'contribution_setting'
  source_id: UUID
  month: string
  transaction: Omit<Transaction, 'id' | 'created_at'>
  log_key: string
}
