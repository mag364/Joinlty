import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateCheckResult, UpdateInfo } from 'electron-updater'
import type { UpdateStatus } from '../../shared/preload'

let status: UpdateStatus = {
  checking: false,
  updateAvailable: false,
  updateDownloaded: false,
  currentVersion: app.getVersion(),
  message: app.isPackaged ? 'Update status has not been checked yet.' : 'Update checks are available in packaged builds.',
}

const toSerializableUpdateInfo = (info: UpdateInfo | null | undefined): UpdateStatus['updateInfo'] => {
  if (!info) return null
  return {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseName: info.releaseName,
    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
  }
}

const setStatus = (next: Partial<UpdateStatus>) => {
  status = {
    ...status,
    ...next,
    currentVersion: app.getVersion(),
  }
}

export const updateService = {
  init() {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => {
      setStatus({ checking: true, error: null, message: 'Checking for updates...' })
    })

    autoUpdater.on('update-available', (info) => {
      setStatus({
        checking: false,
        updateAvailable: true,
        updateDownloaded: false,
        updateInfo: toSerializableUpdateInfo(info),
        error: null,
        message: `Update ${info.version} is available.`,
      })
    })

    autoUpdater.on('update-not-available', (info) => {
      setStatus({
        checking: false,
        updateAvailable: false,
        updateDownloaded: false,
        updateInfo: toSerializableUpdateInfo(info),
        error: null,
        message: 'You are running the latest version.',
      })
    })

    autoUpdater.on('download-progress', (progress) => {
      setStatus({
        downloadProgress: Math.round(progress.percent),
        message: `Downloading update... ${Math.round(progress.percent)}%`,
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      setStatus({
        checking: false,
        updateAvailable: true,
        updateDownloaded: true,
        downloadProgress: 100,
        updateInfo: toSerializableUpdateInfo(info),
        error: null,
        message: 'Update downloaded. Restart to install.',
      })
    })

    autoUpdater.on('error', (error) => {
      setStatus({
        checking: false,
        error: error instanceof Error ? error.message : String(error),
        message: 'Update check failed.',
      })
    })
  },

  getStatus(): UpdateStatus {
    return status
  },

  async checkForUpdates(): Promise<UpdateStatus> {
    if (!app.isPackaged) {
      setStatus({
        checking: false,
        updateAvailable: false,
        updateDownloaded: false,
        error: null,
        message: 'Update checks are available after installing a packaged release.',
      })
      return status
    }

    setStatus({ checking: true, error: null, message: 'Checking for updates...' })
    const result: UpdateCheckResult | null = await autoUpdater.checkForUpdates()
    if (!result?.updateInfo) {
      setStatus({ checking: false, message: 'No update information was returned.' })
    }
    return status
  },

  async downloadUpdate(): Promise<UpdateStatus> {
    if (!status.updateAvailable) {
      setStatus({ message: 'No update is currently available to download.' })
      return status
    }

    setStatus({ downloadProgress: 0, error: null, message: 'Starting update download...' })
    await autoUpdater.downloadUpdate()
    return status
  },

  quitAndInstall(): UpdateStatus {
    if (!status.updateDownloaded) {
      setStatus({ message: 'No downloaded update is ready to install.' })
      return status
    }

    setStatus({ message: 'Restarting to install update...' })
    autoUpdater.quitAndInstall(false, true)
    return status
  },
}