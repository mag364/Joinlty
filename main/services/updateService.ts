import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateCheckResult, UpdateInfo } from 'electron-updater'
import type { UpdateStatus } from '../../shared/preload'

const githubOwner = 'mag364'
const githubRepo = 'Joinlty'
const githubRepoUrl = `https://github.com/${githubOwner}/${githubRepo}`
const githubLatestReleaseApiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/releases/latest`

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

const normalizeVersion = (version: string) => version.trim().replace(/^v/i, '')

const compareVersions = (left: string, right: string) => {
  const leftParts = normalizeVersion(left).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0)
  const rightParts = normalizeVersion(right).split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0)
  const maxLength = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < maxLength; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (diff !== 0) return diff
  }

  return 0
}

const getReleaseNotes = (value: unknown) => {
  if (typeof value !== 'string') return null
  return value.trim().length > 0 ? value : null
}

const checkGithubLatestRelease = async (): Promise<UpdateStatus> => {
  setStatus({ checking: true, error: null, message: `Checking ${githubRepoUrl} for updates...` })

  try {
    const response = await fetch(githubLatestReleaseApiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `Jointly/${app.getVersion()}`,
      },
    })

    if (response.status === 404) {
      setStatus({
        checking: false,
        updateAvailable: false,
        updateDownloaded: false,
        updateInfo: null,
        error: 'No published GitHub release was found for this repository.',
        message: `No releases found at ${githubRepoUrl}. Publish a release with an installer asset before update checks can find it.`,
      })
      return status
    }

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status} ${response.statusText}`)
    }

    const release = await response.json() as {
      tag_name?: string
      name?: string | null
      body?: string | null
      published_at?: string | null
      html_url?: string | null
      draft?: boolean
      prerelease?: boolean
    }

    const latestVersion = normalizeVersion(release.tag_name ?? '')
    if (!latestVersion) {
      throw new Error('Latest GitHub release did not include a tag name.')
    }

    const updateAvailable = compareVersions(latestVersion, app.getVersion()) > 0
    setStatus({
      checking: false,
      updateAvailable,
      updateDownloaded: false,
      downloadProgress: null,
      updateInfo: {
        version: latestVersion,
        releaseDate: release.published_at ?? null,
        releaseName: release.name ?? release.tag_name ?? null,
        releaseNotes: getReleaseNotes(release.body),
      },
      error: null,
      message: updateAvailable
        ? `Update ${latestVersion} is available from ${githubRepoUrl}.`
        : `You are running the latest version available on ${githubRepoUrl}.`,
    })

    return status
  } catch (error) {
    setStatus({
      checking: false,
      updateAvailable: false,
      updateDownloaded: false,
      error: error instanceof Error ? error.message : String(error),
      message: `Update check failed while contacting ${githubRepoUrl}.`,
    })
    return status
  }
}

export const updateService = {
  init() {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.setFeedURL({ provider: 'github', owner: githubOwner, repo: githubRepo })

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
      return checkGithubLatestRelease()
    }

    setStatus({ checking: true, error: null, message: 'Checking for updates...' })
    try {
      const result: UpdateCheckResult | null = await autoUpdater.checkForUpdates()
      if (!result?.updateInfo) {
        setStatus({ checking: false, message: `No update information was returned from ${githubRepoUrl}.` })
      }
    } catch (error) {
      setStatus({
        checking: false,
        error: error instanceof Error ? error.message : String(error),
        message: `Update check failed while contacting ${githubRepoUrl}.`,
      })
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