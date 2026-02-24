import { create } from 'zustand'
import type { AccountWithBalance, Member, Transaction } from '@shared/types'
import type { AppInfo } from '@shared/preload'
import { api, isElectronRuntime } from '@renderer/lib/api'

interface UpsertMemberInput {
  id?: string
  name: string
  member_type?: 'person' | 'property' | 'business'
  color?: string | null
  avatar?: string | null
  active?: boolean
}

interface UpsertAccountInput {
  id?: string
  name: string
  type: 'checking' | 'savings' | 'credit_card'
  owner_type: 'member' | 'joint'
  owner_id: string
  starting_balance?: number
}

interface CreateTransactionInput {
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
  notes?: string | null
}

interface AppState {
  appInfo: AppInfo | null
  members: Member[]
  accounts: AccountWithBalance[]
  transactions: Transaction[]
  loading: boolean
  error: string | null
  refreshCoreData: () => Promise<void>
  upsertMember: (payload: UpsertMemberInput) => Promise<void>
  deleteMember: (payload: { id: string }) => Promise<void>
  reorderMembers: (payload: { ids: string[] }) => Promise<void>
  upsertAccount: (payload: UpsertAccountInput) => Promise<void>
  deleteAccount: (payload: { id: string }) => Promise<void>
  reorderAccounts: (payload: { ids: string[] }) => Promise<void>
  createTransaction: (payload: CreateTransactionInput) => Promise<void>
  updateTransaction: (payload: { id: string; transaction: CreateTransactionInput }) => Promise<void>
  deleteTransaction: (payload: { id: string }) => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  appInfo: null,
  members: [],
  accounts: [],
  transactions: [],
  loading: false,
  error: null,
  async refreshCoreData() {
    if (!isElectronRuntime) {
      const appInfo = await api.getAppInfo()
      set({
        appInfo,
        members: [],
        accounts: [],
        transactions: [],
        loading: false,
        error: 'Preview mode: running in browser without Electron IPC.',
      })
      return
    }

    set({ loading: true, error: null })
    try {
      const [appInfo, members, accounts, transactions] = await Promise.all([
        api.getAppInfo(),
        api.listMembers(),
        api.listAccounts(),
        api.listTransactions(),
      ])
      set({ appInfo, members, accounts, transactions, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
  async upsertMember(payload) {
    set({ loading: true, error: null })
    try {
      await api.upsertMember(payload)
      const [members, accounts] = await Promise.all([api.listMembers(), api.listAccounts()])
      set({ members, accounts, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to save member',
      })
    }
  },
  async deleteMember(payload) {
    set({ loading: true, error: null })
    try {
      await api.deleteMember(payload)
      const [members, accounts, transactions] = await Promise.all([
        api.listMembers(),
        api.listAccounts(),
        api.listTransactions(),
      ])
      set({ members, accounts, transactions, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to delete member',
      })
    }
  },
  async reorderMembers(payload) {
    set({ loading: true, error: null })
    try {
      await api.reorderMembers(payload)
      const members = await api.listMembers()
      set({ members, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to reorder members',
      })
    }
  },
  async upsertAccount(payload) {
    set({ loading: true, error: null })
    try {
      await api.upsertAccount(payload)
      const accounts = await api.listAccounts()
      set({ accounts, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to save account',
      })
    }
  },
  async deleteAccount(payload) {
    set({ loading: true, error: null })
    try {
      await api.deleteAccount(payload)
      const [accounts, transactions] = await Promise.all([api.listAccounts(), api.listTransactions()])
      set({ accounts, transactions, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to delete account',
      })
    }
  },
  async reorderAccounts(payload) {
    set({ loading: true, error: null })
    try {
      await api.reorderAccounts(payload)
      const accounts = await api.listAccounts()
      set({ accounts, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to reorder accounts',
      })
    }
  },
  async createTransaction(payload) {
    set({ loading: true, error: null })
    try {
      await api.createTransaction(payload)
      const [transactions, accounts] = await Promise.all([api.listTransactions(), api.listAccounts()])
      set({ transactions, accounts, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to create transaction',
      })
    }
  },
  async updateTransaction(payload) {
    set({ loading: true, error: null })
    try {
      await api.updateTransaction(payload)
      const [transactions, accounts] = await Promise.all([api.listTransactions(), api.listAccounts()])
      set({ transactions, accounts, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to update transaction',
      })
    }
  },
  async deleteTransaction(payload) {
    set({ loading: true, error: null })
    try {
      await api.deleteTransaction(payload)
      const [transactions, accounts] = await Promise.all([api.listTransactions(), api.listAccounts()])
      set({ transactions, accounts, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to delete transaction',
      })
    }
  },
}))
