import type {
  Account,
  AccountWithBalance,
  Attachment,
  BudgetTarget,
  Category,
  ContributionSetting,
  GenerationPreviewItem,
  Joint,
  Member,
  RecurringRule,
  Transaction,
} from './types'

export interface AppInfo {
  appVersion: string
  dbPath: string
  storageDir: string
}

export interface ReportsSummary {
  month: string
  income: number
  expense: number
  net: number
}

export interface AIConnectionResult {
  ok: boolean
  message: string
}

export interface AIModelOption {
  id: string
  label: string
}

export interface AISuggestTransactionFieldsRequest {
  description: string
  amount?: number | null
  date?: string | null
  type?: 'expense' | 'income' | 'transfer' | null
  owner_type?: 'member' | 'joint' | null
  owner_id?: string | null
  categories: string[]
  accounts: Array<{
    id: string
    name: string
    owner_type: 'member' | 'joint'
    owner_id: string
    type: 'checking' | 'savings' | 'credit_card'
  }>
  recentTransactions: Array<{
    id: string
    date: string
    amount: number
    type: 'expense' | 'income' | 'transfer'
    category?: string | null
    description?: string | null
    owner_type: 'member' | 'joint'
    owner_id: string
    account_id?: string | null
    from_account_id?: string | null
    to_account_id?: string | null
    tags: string[]
  }>
}

export interface AISuggestTransactionFieldsResult {
  ok: boolean
  message: string
  suggestion?: {
    category?: string | null
    tags: string[]
    owner_type?: 'member' | 'joint' | null
    owner_id?: string | null
    account_id?: string | null
    confidence: 'low' | 'medium' | 'high'
    reasoning: string
  }
}

export interface AIDetectDuplicateTransactionRequest {
  draft: {
    date: string
    amount: number
    type: 'expense' | 'income' | 'transfer'
    category?: string | null
    description?: string | null
    owner_type: 'member' | 'joint'
    owner_id: string
    account_id?: string | null
    from_account_id?: string | null
    to_account_id?: string | null
  }
  recentTransactions: Array<{
    id: string
    date: string
    amount: number
    type: 'expense' | 'income' | 'transfer'
    category?: string | null
    description?: string | null
    owner_type: 'member' | 'joint'
    owner_id: string
    account_id?: string | null
    from_account_id?: string | null
    to_account_id?: string | null
    tags: string[]
  }>
}

export interface AIDetectDuplicateTransactionResult {
  ok: boolean
  message: string
  result?: {
    likelyDuplicate: boolean
    confidence: 'low' | 'medium' | 'high'
    matchedTransactionIds: string[]
    reasoning: string
  }
}

export interface AIExplainMonthRequest {
  month: string
  summary: {
    income: number
    expense: number
    net: number
  }
  categoryTotals: Array<{ category: string; total: number }>
  memberTotals: Array<{ member: string; total: number }>
  trendRows: Array<{ month: string; income: number; expense: number; net: number }>
}

export interface AIExplainMonthResult {
  ok: boolean
  message: string
  explanation?: {
    headline: string
    bullets: string[]
    anomalies: string[]
    actions: string[]
    confidence: 'low' | 'medium' | 'high'
    disclaimers: string[]
  }
}

export interface AIDashboardAssistantRequest {
  question: string
  month: string
  summary: {
    income: number
    expense: number
    net: number
  }
  accounts: Array<{ name: string; balance: number; owner_type: 'member' | 'joint'; type: 'checking' | 'savings' | 'credit_card' }>
  categoryTotals: Array<{ category: string; net: number }>
  memberTotals: Array<{ member: string; net: number }>
  upcomingRecurring: Array<{ date: string; description: string; amount: number; type: 'income' | 'expense' }>
}

export interface AIDashboardAssistantResult {
  ok: boolean
  message: string
  result?: {
    answer: string
    suggestedActions: string[]
    confidence: 'low' | 'medium' | 'high'
  }
}

export interface AISuggestTaxWriteOffsRequest {
  member: {
    id: string
    name: string
  }
  accounts: Array<{
    id: string
    name: string
    type: 'checking' | 'savings' | 'credit_card'
  }>
  transactions: Array<{
    id: string
    date: string
    amount: number
    type: 'expense' | 'income' | 'transfer'
    category?: string | null
    description?: string | null
    account_id?: string | null
    from_account_id?: string | null
    to_account_id?: string | null
    tags: string[]
  }>
}

export interface AISuggestTaxWriteOffsResult {
  ok: boolean
  message: string
  source?: 'ai_provider' | 'local_fallback'
  result?: {
    categories: Array<{
      category: string
      amount: number
      transactionCount: number
      rationale: string
    }>
    totalSuggestedAmount: number
    confidence: 'low' | 'medium' | 'high'
    disclaimers: string[]
  }
}

export interface DebugEnumInventory {
  transactions: { type: string[]; owner_type: string[] }
  accounts: { type: string[]; owner_type: string[] }
  recurring: { rule_type: string[]; owner_type: string[] }
  budget_targets: { owner_type: string[]; period: string[] }
  contribution_settings: { method: string[]; split_mode: string[] }
}

export interface DbIntegrityFailure {
  table: string
  id: string | null
  errorMessage: string
}

export interface DebugDbIntegrityCheckResult {
  checkedRows: Record<string, number>
  totalRows: number
  totalFailures: number
  failures: DbIntegrityFailure[]
  truncated: boolean
}

export interface FullDataBackupAttachment {
  id: string
  transaction_id: string
  original_filename: string
  mime_type: string
  size: number
  created_at: string
  file_data_base64: string | null
}

export interface FullDataBackupPayload {
  format: 'jointly-full-backup-v1'
  exported_at: string
  data: {
    members: Array<Member & { sort_order?: number }>
    joints: Array<{
      id: string
      name: string
      active: boolean
      created_at: string
      updated_at: string
    }>
    accounts: Array<Account & { sort_order?: number }>
    categories: Category[]
    transactions: Transaction[]
    recurring_rules: RecurringRule[]
    contribution_settings: ContributionSetting[]
    generation_log: Array<{
      id: string
      month: string
      source_type: string
      source_id: string
      log_key: string
      transaction_id: string | null
      created_at: string
    }>
    attachments: FullDataBackupAttachment[]
    settings: Array<{ key: string; value: string; updated_at: string }>
    budget_targets: BudgetTarget[]
  }
}

export interface FullDataImportResult {
  ok: true
  importedAt: string
  counts: Record<string, number>
}

export interface CoupleBudgetApi {
  getAppInfo: () => Promise<AppInfo>
  pickFile: () => Promise<string | null>
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  getDeveloperMode: () => Promise<boolean>
  setDeveloperMode: (enabled: boolean) => Promise<{ enabled: boolean }>
  debugEnumInventory: () => Promise<DebugEnumInventory>
  debugDbIntegrityCheck: () => Promise<DebugDbIntegrityCheckResult>

  listMembers: () => Promise<Member[]>
  upsertMember: (payload: Partial<Member> & Pick<Member, 'name'>) => Promise<Member>
  deleteMember: (payload: { id: string }) => Promise<{ ok: true }>
  reorderMembers: (payload: { ids: string[] }) => Promise<{ ok: true }>

  listJoints: () => Promise<Joint[]>
  upsertJoint: (payload: Partial<Joint> & Pick<Joint, 'name'>) => Promise<Joint>
  deleteJoint: (payload: { id: string }) => Promise<{ ok: true }>

  listAccounts: () => Promise<AccountWithBalance[]>
  upsertAccount: (payload: Partial<Account> & Pick<Account, 'name' | 'type' | 'owner_type' | 'owner_id'>) => Promise<Account>
  deleteAccount: (payload: { id: string }) => Promise<{ ok: true }>
  reorderAccounts: (payload: { ids: string[] }) => Promise<{ ok: true }>

  listCategories: () => Promise<Category[]>
  createCategory: (payload: { name: string; kind?: 'income' | 'expense' | null }) => Promise<Category>
  updateCategory: (payload: { id: string; name: string; kind?: 'income' | 'expense' | null; active: boolean }) => Promise<Category>
  deleteCategory: (payload: { id: string }) => Promise<{ ok: true }>

  listTransactions: () => Promise<Transaction[]>
  createTransaction: (payload: Omit<Transaction, 'id' | 'created_at'>) => Promise<Transaction>
  updateTransaction: (payload: { id: string; transaction: Omit<Transaction, 'id' | 'created_at'> }) => Promise<Transaction>
  deleteTransaction: (payload: { id: string }) => Promise<{ ok: true }>

  listRecurringRules: () => Promise<RecurringRule[]>
  upsertRecurringRule: (payload: Partial<RecurringRule> & Pick<RecurringRule, 'name' | 'rule_type' | 'amount' | 'owner_type' | 'owner_id' | 'day_of_month' | 'next_run_date'>) => Promise<RecurringRule>
  deleteRecurringRule: (payload: { id: string }) => Promise<{ ok: true }>

  listContributionSettings: () => Promise<ContributionSetting[]>
  upsertContributionSetting: (payload: Partial<ContributionSetting> & Pick<ContributionSetting, 'member_id' | 'joint_id' | 'contributes'>) => Promise<ContributionSetting>
  deleteContributionSetting: (payload: { id: string }) => Promise<{ ok: true }>

  previewGeneration: (month: string) => Promise<GenerationPreviewItem[]>
  commitGeneration: (month: string) => Promise<{ created: number }>

  listAttachments: (transactionId: string) => Promise<Attachment[]>
  createAttachment: (payload: { transaction_id: string; file_path: string }) => Promise<Attachment>
  openAttachmentFolder: (transactionId: string) => Promise<{ ok: true }>

  getReportsSummary: (month: string) => Promise<ReportsSummary>

  getSettings: () => Promise<Record<string, string>>
  setSetting: (payload: { key: string; value: string }) => Promise<{ ok: true }>
  clearAllData: () => Promise<{ ok: true }>
  exportAllData: () => Promise<FullDataBackupPayload>
  importAllData: (payload: FullDataBackupPayload) => Promise<FullDataImportResult>

  listBudgetTargets: () => Promise<BudgetTarget[]>
  upsertBudgetTarget: (payload: Partial<BudgetTarget> & Pick<BudgetTarget, 'owner_type' | 'owner_id' | 'category' | 'amount'>) => Promise<BudgetTarget>

  testAIConnection: (payload: { provider: 'none' | 'ollama' | 'lmstudio'; baseUrl?: string; model?: string }) => Promise<AIConnectionResult>
  listAIModels: (payload: { provider: 'none' | 'ollama' | 'lmstudio'; baseUrl?: string }) => Promise<AIModelOption[]>
  suggestTransactionFields: (payload: AISuggestTransactionFieldsRequest) => Promise<AISuggestTransactionFieldsResult>
  suggestTaxWriteOffs: (payload: AISuggestTaxWriteOffsRequest) => Promise<AISuggestTaxWriteOffsResult>
  detectDuplicateTransaction: (payload: AIDetectDuplicateTransactionRequest) => Promise<AIDetectDuplicateTransactionResult>
  explainMonth: (payload: AIExplainMonthRequest) => Promise<AIExplainMonthResult>
  dashboardAssistant: (payload: AIDashboardAssistantRequest) => Promise<AIDashboardAssistantResult>
}
