import type { CoupleBudgetApi, FullDataBackupPayload, FullDataImportResult } from '@shared/preload'

export const isElectronRuntime = typeof window !== 'undefined' && typeof window.coupleBudget !== 'undefined'

const appInfoFallback = async () => ({
  appVersion: 'dev-browser',
  dbPath: 'Unavailable (open app via Electron)',
  storageDir: 'Unavailable (open app via Electron)',
})
const pickFileFallback = async () => null

const membersFallback = async () => []
const jointsFallback = async () => []
const accountsFallback = async () => []
const categoriesFallback = async () => []
const createCategoryFallback = async (payload: { name: string; kind?: 'income' | 'expense' | null }) => ({
  id: 'browser-preview',
  name: payload.name,
  kind: payload.kind ?? null,
  active: true,
  created_at: new Date().toISOString(),
})
const updateCategoryFallback = async (payload: { id: string; name: string; kind?: 'income' | 'expense' | null; active: boolean }) => ({
  id: payload.id,
  name: payload.name,
  kind: payload.kind ?? null,
  active: payload.active,
  created_at: new Date().toISOString(),
})
const deleteCategoryFallback = async () => ({ ok: true as const })
const transactionsFallback = async () => []
const recurringFallback = async () => []
const contributionsFallback = async () => []
const deleteContributionSettingFallback = async () => ({ ok: true as const })
const generationPreviewFallback = async () => []
const generationCommitFallback = async () => ({ created: 0 })
const attachmentsFallback = async () => []
const openAttachmentFolderFallback = async () => ({ ok: true as const })
const reportsFallback = async (month: string) => ({ month, income: 0, expense: 0, net: 0 })
const settingsFallback = async () => ({})
const setSettingFallback = async () => ({ ok: true as const })
const clearAllDataFallback = async () => ({ ok: true as const })
const exportAllDataFallback = async (): Promise<FullDataBackupPayload> => ({
  format: 'jointly-full-backup-v1',
  exported_at: new Date().toISOString(),
  data: {
    members: [],
    joints: [],
    accounts: [],
    categories: [],
    transactions: [],
    recurring_rules: [],
    contribution_settings: [],
    generation_log: [],
    attachments: [],
    settings: [],
    budget_targets: [],
  },
})
const importAllDataFallback = async (): Promise<FullDataImportResult> => ({
  ok: true,
  importedAt: new Date().toISOString(),
  counts: {},
})
const budgetTargetsFallback = async () => []
const upsertBudgetTargetFallback = async (payload: {
  id?: string
  owner_type: 'member' | 'joint'
  owner_id: string
  category: string
  amount: number
  period?: 'monthly' | 'yearly'
  active?: boolean
}) => ({
  id: payload.id ?? 'browser-preview',
  owner_type: payload.owner_type,
  owner_id: payload.owner_id,
  category: payload.category,
  amount: payload.amount,
  period: payload.period ?? 'monthly',
  active: payload.active ?? true,
  updated_at: new Date().toISOString(),
})
const aiFallback = async () => ({ ok: false, message: 'AI unavailable outside Electron runtime.' })
const aiModelsFallback = async () => []
const aiSuggestFallback = async () => ({
  ok: false,
  message: 'AI suggestions unavailable outside Electron runtime.',
} as const)
const aiSuggestTaxWriteOffsFallback = async () => ({
  ok: false,
  message: 'Tax write-off suggestions unavailable outside Electron runtime.',
} as const)
const aiDuplicateFallback = async () => ({
  ok: true,
  message: 'Duplicate detection unavailable outside Electron runtime.',
  result: {
    likelyDuplicate: false,
    confidence: 'low' as const,
    matchedTransactionIds: [],
    reasoning: 'Fallback mode.',
  },
})
const aiExplainMonthFallback = async () => ({
  ok: false,
  message: 'Monthly explanation unavailable outside Electron runtime.',
} as const)
const aiDashboardAssistantFallback = async () => ({
  ok: false,
  message: 'Dashboard assistant unavailable outside Electron runtime.',
} as const)
const windowControlFallback = async () => {}
const getDeveloperModeFallback = async () => true
const setDeveloperModeFallback = async (enabled: boolean) => ({ enabled })
const debugEnumInventoryFallback = async () => ({
  transactions: { type: [], owner_type: [] },
  accounts: { type: [], owner_type: [] },
  recurring: { rule_type: [], owner_type: [] },
  budget_targets: { owner_type: [], period: [] },
  contribution_settings: { method: [], split_mode: [] },
})
const debugDbIntegrityCheckFallback = async () => ({
  checkedRows: {
    transactions: 0,
    accounts: 0,
    members: 0,
    categories: 0,
    recurring_rules: 0,
    contribution_settings: 0,
    attachments: 0,
    budget_targets: 0,
  },
  totalRows: 0,
  totalFailures: 0,
  failures: [],
  truncated: false,
})

const fallbackApi: CoupleBudgetApi = {
  getAppInfo: appInfoFallback,
  pickFile: pickFileFallback,
  minimizeWindow: windowControlFallback,
  maximizeWindow: windowControlFallback,
  closeWindow: windowControlFallback,
  getDeveloperMode: getDeveloperModeFallback,
  setDeveloperMode: setDeveloperModeFallback,
  debugEnumInventory: debugEnumInventoryFallback,
  debugDbIntegrityCheck: debugDbIntegrityCheckFallback,
  listMembers: membersFallback,
  upsertMember: async (payload) => ({
    id: payload.id ?? 'browser-preview',
    name: payload.name,
    member_type: payload.member_type ?? 'person',
    color: payload.color ?? null,
    avatar: payload.avatar ?? null,
    active: payload.active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  deleteMember: async () => ({ ok: true as const }),
  reorderMembers: async () => ({ ok: true as const }),
  listJoints: jointsFallback,
  upsertJoint: async (payload) => ({
    id: payload.id ?? 'browser-preview',
    name: payload.name,
    active: payload.active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  deleteJoint: async () => ({ ok: true as const }),
  listAccounts: accountsFallback,
  upsertAccount: async (payload) => ({
    id: payload.id ?? 'browser-preview',
    name: payload.name,
    type: payload.type,
    owner_type: payload.owner_type,
    owner_id: payload.owner_id,
    starting_balance: payload.starting_balance ?? 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  deleteAccount: async () => ({ ok: true as const }),
  reorderAccounts: async () => ({ ok: true as const }),
  listCategories: categoriesFallback,
  createCategory: createCategoryFallback,
  updateCategory: updateCategoryFallback,
  deleteCategory: deleteCategoryFallback,
  listTransactions: transactionsFallback,
  createTransaction: async (payload) => ({ ...payload, id: 'browser-preview', created_at: new Date().toISOString() }),
  updateTransaction: async (payload) => ({ ...payload.transaction, id: payload.id, created_at: new Date().toISOString() }),
  deleteTransaction: async () => ({ ok: true as const }),
  listRecurringRules: recurringFallback,
  upsertRecurringRule: async (payload) => ({
    id: payload.id ?? 'browser-preview',
    rule_type: payload.rule_type,
    name: payload.name,
    amount: payload.amount,
    category: payload.category ?? null,
    owner_type: payload.owner_type,
    owner_id: payload.owner_id,
    account_id: payload.account_id ?? null,
    schedule: 'monthly',
    day_of_month: payload.day_of_month,
    next_run_date: payload.next_run_date,
    active: payload.active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  deleteRecurringRule: async () => ({ ok: true as const }),
  listContributionSettings: contributionsFallback,
  upsertContributionSetting: async (payload) => ({
    id: payload.id ?? 'browser-preview',
    member_id: payload.member_id,
    joint_id: payload.joint_id,
    contributes: payload.contributes,
    method: payload.method ?? null,
    fixed_amount: payload.fixed_amount ?? null,
    percent_income: payload.percent_income ?? null,
    split_mode: payload.split_mode ?? null,
    weight: payload.weight ?? null,
    funding_account_id: payload.funding_account_id ?? null,
    active: payload.active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  deleteContributionSetting: deleteContributionSettingFallback,
  previewGeneration: generationPreviewFallback,
  commitGeneration: generationCommitFallback,
  listAttachments: attachmentsFallback,
  createAttachment: async (payload) => ({
    id: 'browser-preview',
    transaction_id: payload.transaction_id,
    original_filename: payload.file_path,
    file_path: payload.file_path,
    mime_type: 'application/octet-stream',
    size: 0,
    created_at: new Date().toISOString(),
  }),
  openAttachmentFolder: openAttachmentFolderFallback,
  getReportsSummary: reportsFallback,
  getSettings: settingsFallback,
  setSetting: setSettingFallback,
  clearAllData: clearAllDataFallback,
  exportAllData: exportAllDataFallback,
  importAllData: importAllDataFallback,
  listBudgetTargets: budgetTargetsFallback,
  upsertBudgetTarget: upsertBudgetTargetFallback,
  testAIConnection: aiFallback,
  listAIModels: aiModelsFallback,
  suggestTransactionFields: aiSuggestFallback,
  suggestTaxWriteOffs: aiSuggestTaxWriteOffsFallback,
  detectDuplicateTransaction: aiDuplicateFallback,
  explainMonth: aiExplainMonthFallback,
  dashboardAssistant: aiDashboardAssistantFallback,
}

export const api: CoupleBudgetApi = window.coupleBudget ?? fallbackApi
