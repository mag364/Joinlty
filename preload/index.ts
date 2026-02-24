import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import type { CoupleBudgetApi } from '../shared/preload'

const api: CoupleBudgetApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appGetInfo),
  pickFile: () => ipcRenderer.invoke(IPC_CHANNELS.appPickFile),
  minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.windowMinimize),
  maximizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.windowMaximize),
  closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.windowClose),
  getDeveloperMode: () => ipcRenderer.invoke(IPC_CHANNELS.developerModeGet),
  setDeveloperMode: (enabled) => ipcRenderer.invoke(IPC_CHANNELS.developerModeSet, enabled),
  debugEnumInventory: () => ipcRenderer.invoke(IPC_CHANNELS.debugEnumInventory),
  debugDbIntegrityCheck: () => ipcRenderer.invoke(IPC_CHANNELS.debugDbIntegrityCheck),

  listMembers: () => ipcRenderer.invoke(IPC_CHANNELS.membersList),
  upsertMember: (payload) => ipcRenderer.invoke(IPC_CHANNELS.membersUpsert, payload),
  deleteMember: (payload) => ipcRenderer.invoke(IPC_CHANNELS.membersDelete, payload),
  reorderMembers: (payload) => ipcRenderer.invoke(IPC_CHANNELS.membersReorder, payload),

  listJoints: () => ipcRenderer.invoke(IPC_CHANNELS.jointsList),
  upsertJoint: (payload) => ipcRenderer.invoke(IPC_CHANNELS.jointsUpsert, payload),
  deleteJoint: (payload) => ipcRenderer.invoke(IPC_CHANNELS.jointsDelete, payload),

  listAccounts: () => ipcRenderer.invoke(IPC_CHANNELS.accountsList),
  upsertAccount: (payload) => ipcRenderer.invoke(IPC_CHANNELS.accountsUpsert, payload),
  deleteAccount: (payload) => ipcRenderer.invoke(IPC_CHANNELS.accountsDelete, payload),
  reorderAccounts: (payload) => ipcRenderer.invoke(IPC_CHANNELS.accountsReorder, payload),

  listCategories: () => ipcRenderer.invoke(IPC_CHANNELS.categoriesList),
  createCategory: (payload) => ipcRenderer.invoke(IPC_CHANNELS.categoriesCreate, payload),
  updateCategory: (payload) => ipcRenderer.invoke(IPC_CHANNELS.categoriesUpdate, payload),
  deleteCategory: (payload) => ipcRenderer.invoke(IPC_CHANNELS.categoriesDelete, payload),

  listTransactions: () => ipcRenderer.invoke(IPC_CHANNELS.transactionsList),
  createTransaction: (payload) => ipcRenderer.invoke(IPC_CHANNELS.transactionsCreate, payload),
  updateTransaction: (payload) => ipcRenderer.invoke(IPC_CHANNELS.transactionsUpdate, payload),
  deleteTransaction: (payload) => ipcRenderer.invoke(IPC_CHANNELS.transactionsDelete, payload),

  listRecurringRules: () => ipcRenderer.invoke(IPC_CHANNELS.recurringList),
  upsertRecurringRule: (payload) => ipcRenderer.invoke(IPC_CHANNELS.recurringUpsert, payload),
  deleteRecurringRule: (payload) => ipcRenderer.invoke(IPC_CHANNELS.recurringDelete, payload),

  listContributionSettings: () => ipcRenderer.invoke(IPC_CHANNELS.contributionsList),
  upsertContributionSetting: (payload) => ipcRenderer.invoke(IPC_CHANNELS.contributionsUpsert, payload),
  deleteContributionSetting: (payload) => ipcRenderer.invoke(IPC_CHANNELS.contributionsDelete, payload),

  previewGeneration: (month) => ipcRenderer.invoke(IPC_CHANNELS.generationPreview, month),
  commitGeneration: (month) => ipcRenderer.invoke(IPC_CHANNELS.generationCommit, month),

  listAttachments: (transactionId) => ipcRenderer.invoke(IPC_CHANNELS.attachmentsList, transactionId),
  createAttachment: (payload) => ipcRenderer.invoke(IPC_CHANNELS.attachmentsCreate, payload),
  openAttachmentFolder: (transactionId) =>
    ipcRenderer.invoke(IPC_CHANNELS.attachmentsOpenFolder, { transaction_id: transactionId }),

  getReportsSummary: (month) => ipcRenderer.invoke(IPC_CHANNELS.reportsSummary, month),

  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
  setSetting: (payload) => ipcRenderer.invoke(IPC_CHANNELS.settingsSet, payload),
  clearAllData: () => ipcRenderer.invoke(IPC_CHANNELS.settingsClearAll),
  exportAllData: () => ipcRenderer.invoke(IPC_CHANNELS.settingsExportAllData),
  importAllData: (payload) => ipcRenderer.invoke(IPC_CHANNELS.settingsImportAllData, payload),

  listBudgetTargets: () => ipcRenderer.invoke(IPC_CHANNELS.budgetTargetsList),
  upsertBudgetTarget: (payload) => ipcRenderer.invoke(IPC_CHANNELS.budgetTargetsUpsert, payload),

  testAIConnection: (payload) => ipcRenderer.invoke(IPC_CHANNELS.aiTestConnection, payload),
  listAIModels: (payload) => ipcRenderer.invoke(IPC_CHANNELS.aiListModels, payload),
  suggestTransactionFields: (payload) => ipcRenderer.invoke(IPC_CHANNELS.aiSuggestTransactionFields, payload),
  suggestTaxWriteOffs: (payload) => ipcRenderer.invoke(IPC_CHANNELS.aiSuggestTaxWriteOffs, payload),
  detectDuplicateTransaction: (payload) => ipcRenderer.invoke(IPC_CHANNELS.aiDetectDuplicateTransaction, payload),
  explainMonth: (payload) => ipcRenderer.invoke(IPC_CHANNELS.aiExplainMonth, payload),
  dashboardAssistant: (payload) => ipcRenderer.invoke(IPC_CHANNELS.aiDashboardAssistant, payload),
}

contextBridge.exposeInMainWorld('coupleBudget', api)
