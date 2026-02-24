import { app, BrowserWindow, dialog } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc'
import { getAppDataPaths } from '../dbService'
import { settingsService } from '../services/settingsService'
import { applyDeveloperMode } from '../windowManager'
import { handleOnce } from './guard'

export const registerAppWindowIpc = () => {
  handleOnce(IPC_CHANNELS.appGetInfo, () => {
    const { dbPath, storageDir } = getAppDataPaths()
    return { appVersion: app.getVersion(), dbPath, storageDir }
  })

  handleOnce(IPC_CHANNELS.appPickFile, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, {
          properties: ['openFile'],
          title: 'Select attachment file',
        })
      : await dialog.showOpenDialog({
          properties: ['openFile'],
          title: 'Select attachment file',
        })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  handleOnce(IPC_CHANNELS.windowMinimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  handleOnce(IPC_CHANNELS.windowMaximize, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  })

  handleOnce(IPC_CHANNELS.windowClose, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  handleOnce(IPC_CHANNELS.developerModeGet, () => settingsService.getAll().developer_mode !== '0')
  handleOnce(IPC_CHANNELS.developerModeSet, (event, enabledRaw) => {
    const enabled = Boolean(enabledRaw)
    settingsService.set('developer_mode', enabled ? '1' : '0')

    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      applyDeveloperMode(win, enabled)
    }

    return { enabled }
  })
}
