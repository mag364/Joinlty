import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Download, RefreshCw, ShieldAlert, Upload } from 'lucide-react'
import { useAppStore } from '@renderer/store/useAppStore'
import { api } from '@renderer/lib/api'
import type { Category } from '@shared/types'
import type {
  AIConnectionResult,
  AIModelOption,
  DebugDbIntegrityCheckResult,
  DebugEnumInventory,
  FullDataBackupPayload,
  UpdateStatus,
} from '@shared/preload'
import { getAvailableTimeZones, getLocalTodayDate } from '@renderer/lib/dates'
import { mapCsvRowToTransaction, normalizeHeader, parseCsvRows } from '@renderer/lib/csv'
import { Card, SectionHeader } from '@renderer/components/ui'

export const SettingsManager = () => {
  const appInfo = useAppStore((state) => state.appInfo)
  const members = useAppStore((state) => state.members)
  const accounts = useAppStore((state) => state.accounts)
  const transactions = useAppStore((state) => state.transactions)
  const refreshCoreData = useAppStore((state) => state.refreshCoreData)

  const [settings, setSettings] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [categoryKind, setCategoryKind] = useState<'income' | 'expense' | ''>('')
  const [categoryActive, setCategoryActive] = useState(true)
  const [selectedCategorySource, setSelectedCategorySource] = useState<'managed' | 'transaction' | null>(null)
  const [pendingCategoryDeleteId, setPendingCategoryDeleteId] = useState('')
  const [provider, setProvider] = useState<'none' | 'ollama' | 'lmstudio'>('none')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [timeZone, setTimeZone] = useState('')
  const [savingTimeZone, setSavingTimeZone] = useState(false)
  const [availableModels, setAvailableModels] = useState<AIModelOption[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [aiResult, setAiResult] = useState<AIConnectionResult | null>(null)
  const [testingAi, setTestingAi] = useState(false)
  const [importStatus, setImportStatus] = useState<string>('')
  const [importingCsv, setImportingCsv] = useState(false)
  const [importingFullBackup, setImportingFullBackup] = useState(false)
  const [fullTransferStatus, setFullTransferStatus] = useState('')
  const [exportMemberId, setExportMemberId] = useState('')
  const [exportAccountSelection, setExportAccountSelection] = useState<Record<string, boolean>>({})
  const [importTargetMemberId, setImportTargetMemberId] = useState('')
  const [importTargetAccountId, setImportTargetAccountId] = useState('')
  const [developerModeEnabled, setDeveloperModeEnabled] = useState(true)
  const [updatingDeveloperMode, setUpdatingDeveloperMode] = useState(false)
  const [enumInventoryResult, setEnumInventoryResult] = useState<DebugEnumInventory | null>(null)
  const [runningEnumInventory, setRunningEnumInventory] = useState(false)
  const [enumInventoryError, setEnumInventoryError] = useState('')
  const [dbIntegrityResult, setDbIntegrityResult] = useState<DebugDbIntegrityCheckResult | null>(null)
  const [runningDbIntegrity, setRunningDbIntegrity] = useState(false)
  const [dbIntegrityError, setDbIntegrityError] = useState('')
  const [clearingAllData, setClearingAllData] = useState(false)
  const [clearAllDataStatus, setClearAllDataStatus] = useState('')
  const [copiedField, setCopiedField] = useState<'storage' | 'db' | null>(null)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [updateAction, setUpdateAction] = useState<'checking' | 'downloading' | 'installing' | null>(null)
  const aiModelRequestIdRef = useRef(0)

  const availableTimeZones = useMemo(() => {
    const zones = getAvailableTimeZones()
    const currentSystemZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (currentSystemZone && !zones.includes(currentSystemZone)) {
      return [currentSystemZone, ...zones]
    }
    return zones
  }, [])

  const loadSettings = async () => {
    const loaded = await api.getSettings()
    setSettings(loaded)
    setProvider((loaded.ai_provider as 'none' | 'ollama' | 'lmstudio') ?? 'none')
    setBaseUrl(loaded.ai_base_url ?? '')
    setModel(loaded.ai_model ?? '')
    setTimeZone(loaded.app_timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC')
    const enabled = await api.getDeveloperMode()
    setDeveloperModeEnabled(enabled)
  }

  const saveTimeZone = async () => {
    if (!timeZone.trim()) return
    setSavingTimeZone(true)
    try {
      await api.setSetting({ key: 'app_timezone', value: timeZone.trim() })
      await loadSettings()
    } finally {
      setSavingTimeZone(false)
    }
  }

  const loadCategories = async () => {
    const result = await api.listCategories()
    setCategories(result)
  }

  const refreshUpdateStatus = async () => {
    const result = await api.getUpdateStatus()
    setUpdateStatus(result)
  }

  useEffect(() => {
    void loadSettings()
    void loadCategories()
    void refreshUpdateStatus()
  }, [])

  useEffect(() => {
    if (!updateStatus?.checking && !updateStatus?.downloadProgress) return

    const interval = window.setInterval(() => {
      void refreshUpdateStatus()
    }, 1000)

    return () => window.clearInterval(interval)
  }, [updateStatus?.checking, updateStatus?.downloadProgress])

  const exportMemberAccounts = useMemo(
    () =>
      exportMemberId
        ? accounts.filter((account) => account.owner_type === 'member' && account.owner_id === exportMemberId)
        : [],
    [accounts, exportMemberId],
  )

  const importTargetAccounts = useMemo(
    () =>
      importTargetMemberId
        ? accounts.filter((account) => account.owner_type === 'member' && account.owner_id === importTargetMemberId)
        : accounts,
    [accounts, importTargetMemberId],
  )

  useEffect(() => {
    const selectedManaged = categories.find((category) => category.id === selectedCategoryId)
    if (selectedManaged) {
      setSelectedCategorySource('managed')
      setCategoryName(selectedManaged.name)
      setCategoryKind(selectedManaged.kind ?? '')
      setCategoryActive(selectedManaged.active)
      return
    }

    if (selectedCategoryId.startsWith('tx:')) {
      setSelectedCategorySource('transaction')
      setCategoryName(selectedCategoryId.slice(3))
      setCategoryKind('')
      setCategoryActive(true)
      return
    }

    setSelectedCategorySource(null)
    if (!selectedCategoryId) {
      setCategoryName('')
      setCategoryKind('')
      setCategoryActive(true)
    }
  }, [selectedCategoryId, categories])

  const categoryOptions = useMemo(() => {
    const managedNames = new Set(categories.map((category) => category.name.trim().toLowerCase()))
    const transactionOnlyNames = Array.from(
      new Set(
        transactions
          .map((transaction) => transaction.category?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    )
      .filter((name) => !managedNames.has(name.toLowerCase()))
      .sort((a, b) => a.localeCompare(b))

    const managed = categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        source: 'managed' as const,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const transactionOnly = transactionOnlyNames.map((name) => ({
      id: `tx:${name}`,
      name,
      source: 'transaction' as const,
    }))

    return [...managed, ...transactionOnly]
  }, [categories, transactions])

  const saveAISettings = async () => {
    await api.setSetting({ key: 'ai_provider', value: provider })
    await api.setSetting({ key: 'ai_base_url', value: baseUrl })
    await api.setSetting({ key: 'ai_model', value: model })
    await loadSettings()
  }

  const testAI = async () => {
    if (provider === 'none') {
      setAiResult({ ok: false, message: 'Select an AI provider before running a test.' })
      return
    }

    setTestingAi(true)
    setAiResult(null)
    try {
      const result = await api.testAIConnection({ provider, baseUrl, model })
      setAiResult(result)
    } catch (error) {
      setAiResult({
        ok: false,
        message: `AI connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setTestingAi(false)
    }
  }

  const loadAIModels = async (providerValue = provider, baseUrlValue = baseUrl) => {
    const requestId = ++aiModelRequestIdRef.current

    if (providerValue === 'none') {
      setAvailableModels([])
      setModel('')
      return
    }

    setLoadingModels(true)
    setAvailableModels([])
    try {
      const models = await api.listAIModels({ provider: providerValue, baseUrl: baseUrlValue })
      if (requestId !== aiModelRequestIdRef.current) return

      setAvailableModels(models)

      if (models.length === 0) {
        setModel('')
        return
      }

      if (!models.some((item) => item.id === model)) {
        setModel(models[0].id)
      }
    } finally {
      if (requestId === aiModelRequestIdRef.current) {
        setLoadingModels(false)
      }
    }
  }

  useEffect(() => {
    void loadAIModels(provider, baseUrl)
  }, [provider, baseUrl])

  const activeProviderLabel = provider === 'none' ? 'Disabled' : provider === 'ollama' ? 'Ollama' : 'LM Studio'
  const activeModelLabel = model.trim() ? model : 'Not selected'
  const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const selectedTimeZoneNow = (() => {
    if (!timeZone) return '—'
    try {
      return new Date().toLocaleString('en-US', {
        timeZone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return 'Invalid timezone selected'
    }
  })()

  const hasMemberScopedExport = exportMemberId.trim().length > 0
  const selectedExportAccountIds = exportMemberAccounts
    .filter((account) => exportAccountSelection[account.id] ?? true)
    .map((account) => account.id)

  const previewExportMembers = hasMemberScopedExport ? members.filter((member) => member.id === exportMemberId) : members
  const previewExportAccounts = (() => {
    if (!hasMemberScopedExport) return accounts
    if (selectedExportAccountIds.length === 0) return exportMemberAccounts
    return exportMemberAccounts.filter((account) => selectedExportAccountIds.includes(account.id))
  })()

  const previewExportAccountIdSet = new Set(previewExportAccounts.map((account) => account.id))
  const previewExportTransactions = transactions.filter((transaction) => {
    if (!hasMemberScopedExport) return true

    if (previewExportAccountIdSet.size === 0) {
      return transaction.owner_type === 'member' && transaction.owner_id === exportMemberId
    }

    return (
      (transaction.account_id != null && previewExportAccountIdSet.has(transaction.account_id)) ||
      (transaction.from_account_id != null && previewExportAccountIdSet.has(transaction.from_account_id)) ||
      (transaction.to_account_id != null && previewExportAccountIdSet.has(transaction.to_account_id))
    )
  })

  const previewExportMemberName = exportMemberId
    ? members.find((member) => member.id === exportMemberId)?.name ?? exportMemberId
    : 'All members'

  const previewImportMemberName = importTargetMemberId
    ? members.find((member) => member.id === importTargetMemberId)?.name ?? importTargetMemberId
    : 'From CSV'

  const previewImportAccountName = importTargetAccountId
    ? accounts.find((account) => account.id === importTargetAccountId)?.name ?? importTargetAccountId
    : 'From CSV'

  const exportSnapshot = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      export_scope: {
        member_id: hasMemberScopedExport ? exportMemberId : null,
        account_ids: previewExportAccounts.map((account) => account.id),
      },
      settings,
      members: previewExportMembers,
      accounts: previewExportAccounts,
      transactions: previewExportTransactions,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `couplebudget-export-${getLocalTodayDate()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportAllDataBackup = async () => {
    try {
      setFullTransferStatus('')
      const payload = await api.exportAllData()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `jointly-full-backup-${getLocalTodayDate()}.json`
      link.click()
      URL.revokeObjectURL(url)
      setFullTransferStatus('Full data backup exported successfully.')
    } catch (error) {
      setFullTransferStatus(`Full backup export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const importAllDataBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportingFullBackup(true)
    setFullTransferStatus('')
    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as FullDataBackupPayload

      if (parsed?.format !== 'jointly-full-backup-v1') {
        throw new Error('Invalid backup format. Expected jointly-full-backup-v1.')
      }

      await api.importAllData(parsed)
      await refreshCoreData()
      await loadSettings()
      await loadCategories()
      setExportMemberId('')
      setExportAccountSelection({})
      setImportTargetMemberId('')
      setImportTargetAccountId('')
      setFullTransferStatus('Full backup imported successfully.')
    } catch (error) {
      setFullTransferStatus(`Full backup import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setImportingFullBackup(false)
      event.target.value = ''
    }
  }

  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportStatus('')
    setImportingCsv(true)

    try {
      const text = await file.text()
      const csvRows = parseCsvRows(text)
      if (csvRows.length < 2) {
        setImportStatus('CSV import failed: no data rows found.')
        return
      }

      const headers = csvRows[0].map(normalizeHeader)
      const dataRows = csvRows.slice(1)

      let importedCount = 0
      let skippedCount = 0
      let missingAccountCount = 0
      const skipReasons: string[] = []

      for (const rawRow of dataRows) {
        const rowRecord: Record<string, string> = {}
        headers.forEach((header, idx) => {
          rowRecord[header] = rawRow[idx] ?? ''
        })

        const mapped = mapCsvRowToTransaction(rowRecord, members, accounts)
        if (!mapped.payload) {
          skippedCount += 1
          if (mapped.error && skipReasons.length < 5) skipReasons.push(mapped.error)
          continue
        }

        const payload = { ...mapped.payload }

        if (importTargetMemberId.trim()) {
          payload.owner_type = 'member'
          payload.owner_id = importTargetMemberId.trim()
        }

        if (importTargetAccountId.trim() && payload.type !== 'transfer') {
          payload.account_id = importTargetAccountId.trim()
        }

        if (payload.type !== 'transfer' && !payload.account_id) {
          skippedCount += 1
          missingAccountCount += 1
          if (skipReasons.length < 5) skipReasons.push('Income/expense row missing account (select an import target account or provide account/account_id column).')
          continue
        }

        await api.createTransaction(payload)
        importedCount += 1
      }

      const reasonSuffix = skipReasons.length > 0 ? ` Top issues: ${Array.from(new Set(skipReasons)).join(' | ')}` : ''
      const missingAccountSuffix = missingAccountCount > 0 ? ` (${missingAccountCount} skipped for missing account)` : ''
      setImportStatus(`CSV import complete: ${importedCount} imported, ${skippedCount} skipped${missingAccountSuffix}.${reasonSuffix}`)
      const refreshed = await api.listTransactions()
      useAppStore.setState({ transactions: refreshed })
    } catch (error) {
      setImportStatus(`CSV import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setImportingCsv(false)
      event.target.value = ''
    }
  }

  const saveCategory = async () => {
    if (!selectedCategoryId || !categoryName.trim()) return
    if (selectedCategorySource === 'transaction') {
      await api.createCategory({
        name: categoryName.trim(),
        kind: categoryKind || null,
      })
      await loadCategories()
      return
    }

    await api.updateCategory({
      id: selectedCategoryId,
      name: categoryName.trim(),
      kind: categoryKind || null,
      active: categoryActive,
    })
    setPendingCategoryDeleteId('')
    await loadCategories()
  }

  const removeCategory = async () => {
    if (!selectedCategoryId || selectedCategorySource !== 'managed') return

    if (pendingCategoryDeleteId !== selectedCategoryId) {
      setPendingCategoryDeleteId(selectedCategoryId)
      return
    }

    await api.deleteCategory({ id: selectedCategoryId })
    setPendingCategoryDeleteId('')
    setSelectedCategoryId('')
    await loadCategories()
  }

  const toggleDeveloperMode = async (enabled: boolean) => {
    setUpdatingDeveloperMode(true)
    try {
      setDeveloperModeEnabled(enabled)
      await api.setDeveloperMode(enabled)
      if (!enabled) {
        setEnumInventoryResult(null)
        setEnumInventoryError('')
        setDbIntegrityResult(null)
        setDbIntegrityError('')
      }
    } finally {
      setUpdatingDeveloperMode(false)
    }
  }

  const checkForUpdates = async () => {
    setUpdateAction('checking')
    try {
      const result = await api.checkForUpdates()
      setUpdateStatus(result)
    } finally {
      setUpdateAction(null)
    }
  }

  const downloadUpdate = async () => {
    setUpdateAction('downloading')
    try {
      const result = await api.downloadUpdate()
      setUpdateStatus(result)
    } finally {
      setUpdateAction(null)
    }
  }

  const installUpdate = async () => {
    setUpdateAction('installing')
    try {
      const result = await api.installUpdate()
      setUpdateStatus(result)
    } finally {
      setUpdateAction(null)
    }
  }

  const runEnumInventory = async () => {
    setRunningEnumInventory(true)
    setEnumInventoryError('')
    try {
      const result = await api.debugEnumInventory()
      setEnumInventoryResult(result)
    } catch (error) {
      setEnumInventoryError(error instanceof Error ? error.message : 'Failed to run enum inventory')
    } finally {
      setRunningEnumInventory(false)
    }
  }

  const runDbIntegrityCheck = async () => {
    setRunningDbIntegrity(true)
    setDbIntegrityError('')
    try {
      const result = await api.debugDbIntegrityCheck()
      setDbIntegrityResult(result)
    } catch (error) {
      setDbIntegrityError(error instanceof Error ? error.message : 'Failed to run DB integrity check')
    } finally {
      setRunningDbIntegrity(false)
    }
  }

  const clearAllData = async () => {
    setClearingAllData(true)
    setClearAllDataStatus('')
    try {
      await api.clearAllData()
      await refreshCoreData()
      await loadSettings()
      await loadCategories()
      setExportMemberId('')
      setExportAccountSelection({})
      setImportTargetMemberId('')
      setImportTargetAccountId('')
      setClearAllDataStatus('All data cleared. App has been reset to defaults.')
    } catch (error) {
      setClearAllDataStatus(`Failed to clear data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setClearingAllData(false)
    }
  }

  const copyToClipboard = async (value: string, field: 'storage' | 'db') => {
    if (!value.trim()) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = value
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopiedField(field)
      window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1800)
    } catch {
      setCopiedField(null)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Data directory details, import/export, and AI provider settings.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <SectionHeader title="App & Storage" subtitle="Application metadata and local storage paths." />
            <div className="space-y-4 p-5 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">App Version</p>
                <p className="mt-1 font-medium text-slate-800">{appInfo?.appVersion ?? 'Loading...'}</p>
                <p className="mt-1 text-xs text-slate-600">Jointly helps you manage household members, accounts, transactions, and budgets in one place.</p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Data Directory</p>
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(appInfo?.storageDir ?? '', 'storage')}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-slate-700" title={appInfo?.storageDir ?? ''}>
                  {appInfo?.storageDir ?? 'Loading...'}
                </p>
                {copiedField === 'storage' && <p className="mt-1 text-xs text-emerald-700">Copied</p>}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Database Path</p>
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(appInfo?.dbPath ?? '', 'db')}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-slate-700" title={appInfo?.dbPath ?? ''}>
                  {appInfo?.dbPath ?? 'Loading...'}
                </p>
                {copiedField === 'db' && <p className="mt-1 text-xs text-emerald-700">Copied</p>}
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Timezone" subtitle="Set the app timezone used for date-sensitive workflows." />
            <div className="grid gap-3 p-5 md:grid-cols-4">
              <label className="text-xs text-slate-600 md:col-span-3">
                Timezone
                <select value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  {availableTimeZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              </label>
              <div className="md:self-end">
                <button onClick={() => void saveTimeZone()} disabled={savingTimeZone} className="w-full rounded border border-slate-300 px-3 py-2 text-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
                  {savingTimeZone ? 'Saving...' : 'Save Timezone'}
                </button>
              </div>
            </div>
            <div className="space-y-1 px-5 pb-5 text-xs text-slate-600">
              <p>System timezone: <span className="font-semibold">{systemTimeZone || 'Unknown'}</span></p>
              <p>Selected timezone preview: <span className="font-semibold">{selectedTimeZoneNow}</span></p>
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Application Updates"
              subtitle="Check for, download, and install packaged app updates."
              actions={<RefreshCw className="h-4 w-4 text-slate-500" />}
            />
            <div className="space-y-4 p-5 text-sm">
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p>Current version: <span className="font-semibold">{updateStatus?.currentVersion ?? appInfo?.appVersion ?? 'Loading...'}</span></p>
                {updateStatus?.updateInfo?.version && (
                  <p className="mt-1">Available version: <span className="font-semibold">{updateStatus.updateInfo.version}</span></p>
                )}
              </div>

              <p className={`rounded px-3 py-2 text-sm ${updateStatus?.error ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-slate-200 bg-white text-slate-700'}`}>
                {updateStatus?.message ?? 'Loading update status...'}
              </p>

              {typeof updateStatus?.downloadProgress === 'number' && (
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${Math.max(0, Math.min(100, updateStatus.downloadProgress))}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Download progress: {updateStatus.downloadProgress}%</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void checkForUpdates()}
                  disabled={updateAction !== null || updateStatus?.checking}
                  className="rounded border border-slate-300 px-3 py-2 text-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateAction === 'checking' || updateStatus?.checking ? 'Checking...' : 'Check for Updates'}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadUpdate()}
                  disabled={updateAction !== null || !updateStatus?.updateAvailable || updateStatus.updateDownloaded}
                  className="rounded border border-slate-300 px-3 py-2 text-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateAction === 'downloading' ? 'Downloading...' : 'Download Update'}
                </button>
                <button
                  type="button"
                  onClick={() => void installUpdate()}
                  disabled={updateAction !== null || !updateStatus?.updateDownloaded}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateAction === 'installing' ? 'Restarting...' : 'Restart & Install'}
                </button>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Categories" subtitle="Manage normalized categories used across transactions and reports." />
            <div className="grid gap-3 p-5 md:grid-cols-4">
              <label className="text-xs text-slate-600">
                Category
                <select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select category</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}{category.source === 'transaction' ? ' (from transactions)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Category name
                <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" disabled={!selectedCategoryId} />
              </label>
              <label className="text-xs text-slate-600">
                Type
                <select value={categoryKind} onChange={(event) => setCategoryKind(event.target.value as 'income' | 'expense' | '')} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" disabled={!selectedCategoryId}>
                  <option value="">Unspecified</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </label>
              <label className="text-xs text-slate-600">
                Status
                <span className="mt-1 flex h-[42px] items-center rounded border border-slate-300 px-3 text-sm">
                  <input type="checkbox" checked={categoryActive} onChange={(event) => setCategoryActive(event.target.checked)} disabled={!selectedCategoryId || selectedCategorySource !== 'managed'} className="mr-2" />
                  Active
                </span>
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 px-5 pb-5">
              <button onClick={() => void saveCategory()} className="rounded bg-slate-900 px-3 py-2 text-sm text-white transition hover:opacity-95" disabled={!selectedCategoryId}>
                {selectedCategorySource === 'transaction' ? 'Add to Managed Categories' : 'Save'}
              </button>
              <button
                onClick={() => void removeCategory()}
                className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 transition hover:bg-red-50"
                title={selectedCategorySource === 'managed' && pendingCategoryDeleteId === selectedCategoryId ? 'Click again to confirm remove' : undefined}
                disabled={!selectedCategoryId || selectedCategorySource !== 'managed'}
              >
                {selectedCategorySource === 'managed' && pendingCategoryDeleteId === selectedCategoryId ? 'Confirm remove' : 'Remove'}
              </button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionHeader title="Import / Export" subtitle="Move data in and out of Jointly safely." />
            <div className="space-y-5 p-5 text-sm">
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Download className="h-4 w-4" /> Export
                </div>
                <label className="text-xs text-slate-600">
                  Export member scope
                  <select
                    value={exportMemberId}
                    onChange={(event) => {
                      const nextMemberId = event.target.value
                      setExportMemberId(nextMemberId)
                      const nextSelection: Record<string, boolean> = {}
                      if (nextMemberId) {
                        for (const account of accounts.filter((item) => item.owner_type === 'member' && item.owner_id === nextMemberId)) {
                          nextSelection[account.id] = true
                        }
                      }
                      setExportAccountSelection(nextSelection)
                    }}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">All members</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                {exportMemberId && (
                  <div className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="text-xs text-slate-600">Export accounts for selected member</p>
                    <div className="mt-1 grid gap-1">
                      {exportMemberAccounts.map((account) => (
                        <label key={account.id} className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={exportAccountSelection[account.id] ?? true}
                            onChange={(event) =>
                              setExportAccountSelection((prev) => ({
                                ...prev,
                                [account.id]: event.target.checked,
                              }))
                            }
                          />
                          {account.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={exportSnapshot} className="rounded border border-slate-300 px-3 py-2 text-sm transition hover:bg-slate-100">
                    Export Snapshot (.json)
                  </button>
                  <button onClick={() => void exportAllDataBackup()} className="rounded border border-slate-300 px-3 py-2 text-sm transition hover:bg-slate-100">
                    Export Full Backup (.json)
                  </button>
                </div>
              </section>

              <section className="space-y-2 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Upload className="h-4 w-4" /> Import
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="text-xs text-slate-600">
                    Import target member (optional)
                    <select
                      value={importTargetMemberId}
                      onChange={(event) => {
                        setImportTargetMemberId(event.target.value)
                        setImportTargetAccountId('')
                      }}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Use CSV owners</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-600">
                    Import target account (optional)
                    <select
                      value={importTargetAccountId}
                      onChange={(event) => setImportTargetAccountId(event.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Use CSV account refs</option>
                      {importTargetAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer rounded border border-slate-300 px-3 py-2 text-sm transition hover:bg-slate-100">
                    {importingCsv ? 'Importing CSV...' : 'Import CSV'}
                    <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void importCsv(event)} disabled={importingCsv} />
                  </label>
                  <label className="cursor-pointer rounded border border-slate-300 px-3 py-2 text-sm transition hover:bg-slate-100">
                    {importingFullBackup ? 'Importing Full Backup...' : 'Import Full Backup'}
                    <input type="file" accept=".json,application/json" className="hidden" onChange={(event) => void importAllDataBackup(event)} disabled={importingFullBackup} />
                  </label>
                </div>
              </section>

              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p>
                  <span className="font-semibold">Export preview:</span> {previewExportMemberName} • {previewExportAccounts.length} account(s) • {previewExportTransactions.length} transaction(s)
                </p>
                <p className="mt-1">
                  <span className="font-semibold">Import mapping:</span> Member: {previewImportMemberName} • Account: {previewImportAccountName}
                </p>
              </div>

              {importStatus && <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{importStatus}</p>}
              {fullTransferStatus && <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{fullTransferStatus}</p>}
            </div>
          </Card>

          <Card>
            <SectionHeader title="AI Provider" subtitle="Configure your local AI endpoint and model." />
            <div className="space-y-3 p-5 text-sm">
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Select an AI Provider to enable AI-assisted suggestions and checks. Recommended model: <span className="font-semibold">qwen2.5-7b</span>.
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-xs text-slate-600">
                  Provider
                  <select value={provider} onChange={(event) => setProvider(event.target.value as 'none' | 'ollama' | 'lmstudio')} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm">
                    <option value="none">None</option>
                    <option value="ollama">Ollama</option>
                    <option value="lmstudio">LM Studio</option>
                  </select>
                </label>
                <label className="text-xs text-slate-600 md:col-span-2">
                  Endpoint URL
                  <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="Base URL" className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>

              <label className="text-xs text-slate-600">
                Model
                <select value={model} onChange={(event) => setModel(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" disabled={provider === 'none' || loadingModels}>
                  {loadingModels && <option value="">Loading models...</option>}
                  {!loadingModels && availableModels.length === 0 && <option value="">No models found</option>}
                  {!loadingModels && availableModels.length > 0 && availableModels.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>

              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="https://ollama.com/download/"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                >
                  Download Ollama
                </a>
                <a
                  href="https://lmstudio.ai/download"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                >
                  Download LM Studio
                </a>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => void saveAISettings()} className="rounded bg-slate-900 px-3 py-2 text-sm text-white transition hover:opacity-95">Save</button>
                <button
                  onClick={() => void testAI()}
                  disabled={testingAi}
                  className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {testingAi ? 'Testing...' : 'Test'}
                </button>
              </div>

              <p className="text-xs text-slate-600">Active AI config: <span className="font-semibold">{activeProviderLabel}</span> / <span className="font-semibold">{activeModelLabel}</span></p>
              {aiResult && <p className={`rounded px-3 py-2 text-sm ${aiResult.ok ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-amber-200 bg-amber-50 text-amber-700'}`}>{aiResult.message}</p>}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <SectionHeader title="Danger Zone" subtitle="Clear all budget data and start fresh." />
        <div className="space-y-3 p-5">
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            This will remove members, accounts, transactions, recurring rules, budgets, and settings.
          </div>
          <button
            type="button"
            onClick={() => {
              setClearConfirmText('')
              setClearConfirmOpen(true)
            }}
            disabled={clearingAllData}
            className="inline-flex items-center gap-2 rounded border border-red-300 bg-white px-3 py-2 text-sm text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShieldAlert className="h-4 w-4" />
            {clearingAllData ? 'Clearing...' : 'Clear All Data'}
          </button>
          {clearAllDataStatus && <p className="text-xs text-red-700">{clearAllDataStatus}</p>}
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Developer"
          subtitle="Toggle Chrome menu bar/framed mode and run diagnostics."
          actions={
            <label className="flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-xs">
              <input type="checkbox" checked={developerModeEnabled} onChange={(event) => void toggleDeveloperMode(event.target.checked)} disabled={updatingDeveloperMode} />
              Developer Mode
            </label>
          }
        />
        <div className="space-y-3 p-5">
          <p className="text-xs text-slate-600">
            {developerModeEnabled
              ? 'Menu bar visible; standard window frame enabled.'
              : 'Menu auto-hides; standard window frame remains enabled.'}
          </p>
          {!developerModeEnabled ? (
            <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Enable Developer Mode to run enum inventory and DB integrity checks.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void runEnumInventory()} disabled={runningEnumInventory} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm transition hover:bg-slate-100 disabled:opacity-60">{runningEnumInventory ? 'Running...' : 'Run Enum Inventory'}</button>
                <button onClick={() => void runDbIntegrityCheck()} disabled={runningDbIntegrity} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm transition hover:bg-slate-100 disabled:opacity-60">{runningDbIntegrity ? 'Running...' : 'Run DB Integrity Check'}</button>
              </div>
              {enumInventoryError && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{enumInventoryError}</p>}
              {dbIntegrityError && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{dbIntegrityError}</p>}
              {enumInventoryResult && (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Enum Inventory Output</summary>
                  <pre className="mt-2 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(enumInventoryResult, null, 2)}</pre>
                </details>
              )}
              {dbIntegrityResult && (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">DB Integrity Check Output</summary>
                  <pre className="mt-2 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(dbIntegrityResult, null, 2)}</pre>
                </details>
              )}
            </>
          )}
        </div>
      </Card>

      {clearConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <SectionHeader title="Clear all data?" subtitle="Type CLEAR to confirm this irreversible action." />
            <div className="space-y-3 p-5 text-sm">
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">This cannot be undone.</p>
              <input
                value={clearConfirmText}
                onChange={(event) => setClearConfirmText(event.target.value)}
                placeholder="Type CLEAR"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setClearConfirmOpen(false)
                    setClearConfirmText('')
                  }}
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={clearConfirmText.trim() !== 'CLEAR' || clearingAllData}
                  onClick={() => {
                    void clearAllData()
                    setClearConfirmOpen(false)
                    setClearConfirmText('')
                  }}
                  className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Confirm Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
