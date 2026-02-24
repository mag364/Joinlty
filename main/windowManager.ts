import { BrowserWindow } from 'electron'
import type { Rectangle } from 'electron'

type WindowManagerInit = {
  preloadPath: string
  devServerUrl?: string
  distHtmlPath: string
  iconPath?: string
}

let managerConfig: WindowManagerInit | null = null
let mainWindow: BrowserWindow | null = null
let developerModeEnabled = true

const logDeveloperMode = (message: string, enabled: boolean) => {
  console.info(`[windowManager] ${message} (developerMode=${enabled ? 'on' : 'off'})`)
}

export const initWindowManager = (config: WindowManagerInit) => {
  managerConfig = config
}

export const getDeveloperModeEnabled = () => developerModeEnabled
export const getMainWindow = () => mainWindow

export const setDeveloperModeEnabled = (enabled: boolean) => {
  developerModeEnabled = enabled
  logDeveloperMode('state updated', enabled)
}

const applyMenuBarBehavior = (win: BrowserWindow, enabled: boolean) => {
  // On macOS, app menus behave differently, but these calls are still safe.
  win.setAutoHideMenuBar(!enabled)
  win.setMenuBarVisibility(enabled)
}

const createWindow = (enabled: boolean, bounds?: Rectangle) => {
  if (!managerConfig) {
    throw new Error('Window manager not initialized')
  }

  const win = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 820,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 980,
    minHeight: 640,
    title: 'Jointly',
    icon: managerConfig.iconPath,
    show: false,
    frame: true,
    autoHideMenuBar: !enabled,
    webPreferences: {
      preload: managerConfig.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  applyMenuBarBehavior(win, enabled)
  logDeveloperMode('created main window with mode applied', enabled)

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show()
    }
  })

  if (managerConfig.devServerUrl) {
    void win.loadURL(managerConfig.devServerUrl)
  } else {
    void win.loadFile(managerConfig.distHtmlPath)
  }

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
    }
  })

  mainWindow = win
  return win
}

export const createMainWindow = () => createWindow(developerModeEnabled)

export const applyDeveloperMode = (win: BrowserWindow, enabled: boolean) => {
  if (win.isDestroyed()) return null

  setDeveloperModeEnabled(enabled)
  applyMenuBarBehavior(win, enabled)
  logDeveloperMode('applied menu behavior in-place (frame remains enabled)', enabled)
  return win
}

export const recreateMainWindowForDeveloperMode = (enabled: boolean) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    applyDeveloperMode(mainWindow, enabled)
    return
  }

  setDeveloperModeEnabled(enabled)
  createWindow(enabled)
}
