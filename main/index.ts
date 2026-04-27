import { app, BrowserWindow } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDb } from './dbService'
import { registerIpcHandlers } from './ipc/index'
import { settingsService } from './services/settingsService'
import { generationService } from './services/generationService'
import { updateService } from './services/updateService'
import { createMainWindow, initWindowManager, setDeveloperModeEnabled } from './windowManager'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

app.whenReady().then(() => {
  const runAutoCommitDue = () => {
    try {
      generationService.autoCommitDueForCurrentMonth()
    } catch (error) {
      console.error('[generation:auto-commit] failed', error)
    }
  }

  getDb()
  initWindowManager({
    preloadPath: join(__dirname, 'index.mjs'),
    devServerUrl: process.env.VITE_DEV_SERVER_URL,
    distHtmlPath: join(__dirname, '../dist/index.html'),
    iconPath: join(__dirname, '../build/icon.ico'),
  })

  updateService.init()

  const loadedSettings = settingsService.getAll()
  const developerModeEnabled = loadedSettings.developer_mode !== '0'
  console.info(`[main] applying persisted developer mode at startup: ${developerModeEnabled ? 'on' : 'off'}`)
  setDeveloperModeEnabled(developerModeEnabled)

  registerIpcHandlers()
  runAutoCommitDue()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
