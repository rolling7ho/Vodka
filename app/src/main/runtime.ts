import { app, BrowserWindow, dialog, Menu, nativeImage, Tray } from 'electron'
import {
  AppSettingsData,
  HomeSummary,
  IPC_CHANNELS,
  UpdateCheckResult
} from '../shared/ipc'
import { GmacBridgeClient } from './bridge'

let tray: Tray | null = null
let activeBridge: GmacBridgeClient | null = null
let resolveOrShowMainWindow: (() => void) | null = null
let cachedIconPath: string | undefined
let cachedAskBeforeQuitting = true
let isConfirmedQuit = false

export function initializeAppRuntime(
  bridge: GmacBridgeClient,
  showMainWindow: () => void,
  iconPath?: string
): void {
  activeBridge = bridge
  resolveOrShowMainWindow = showMainWindow
  cachedIconPath = iconPath

  app.on('before-quit', (event) => {
    if (isConfirmedQuit) {
      bridge.dispose()
      return
    }
    if (!cachedAskBeforeQuitting || !bridge.isAvailable() || process.env.GMAC_FRESH_INSTALL === '1') {
      isConfirmedQuit = true
      bridge.dispose()
      return
    }

    event.preventDefault()
    void confirmQuitWithRunningBottles(bridge)
  })

  if (process.env.GMAC_FRESH_INSTALL === '1' || process.env.GMAC_MOCK_UI === '1' || !bridge.isAvailable()) {
    return
  }

  void runStartupTasks(bridge)
}

async function confirmQuitWithRunningBottles(bridge: GmacBridgeClient): Promise<void> {
  try {
    const summary = await bridge.request<{ runningCount: number; runningBottles: string[] }>(
      'bottles.runningSummary'
    )
    if (summary.runningCount > 0) {
      const focused = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const list = summary.runningBottles.join(', ')
      const options: Electron.MessageBoxOptions = {
        type: 'question',
        title: 'Quit Gmac',
        message: 'Stop running Windows apps and quit Gmac?',
        detail: `${summary.runningCount} running PC(s): ${list}`,
        buttons: ['Stop Running PCs & Quit', 'Cancel'],
        defaultId: 0,
        cancelId: 1
      }
      const response = focused
        ? await dialog.showMessageBox(focused, options)
        : await dialog.showMessageBox(options)
      if (response.response !== 0) {
        return
      }
      await bridge.request('bottles.killAll').catch(() => {})
    }
  } catch {
    // Allow quit if bridge query fails.
  }

  isConfirmedQuit = true
  app.quit()
}

async function runStartupTasks(bridge: GmacBridgeClient): Promise<void> {
  try {
    const settings = await bridge.request<Omit<AppSettingsData, 'openAtLogin'>>('settings.get')
    cachedAskBeforeQuitting = settings.askBeforeQuitting
    updateTrayState(settings.showMenuBarExtra)

    void bridge.request('settings.pruneLogs').catch(() => {})

    if (settings.openSteamAtLaunch) {
      void launchSteamAtStartup(bridge)
    }

    if (settings.autoCheckAppUpdates || settings.autoCheckEngineUpdates) {
      setTimeout(() => {
        void checkUpdatesAndBroadcast()
      }, 2500)
    }
  } catch {
    // Ignore bridge startup failures cleanly.
  }
}

async function launchSteamAtStartup(bridge: GmacBridgeClient): Promise<void> {
  try {
    const summary = await bridge.request<HomeSummary>('home.summary')
    const steam = summary.launchers.find(
      (item) => item.id === 'steam' && item.installed && item.bottlePath && item.executablePath
    )
    if (steam?.bottlePath && steam.executablePath) {
      await bridge.request('home.launch', {
        bottlePath: steam.bottlePath,
        launchKind: 'program',
        programPath: steam.executablePath
      })
    }
  } catch {
    // Ignore auto-launch errors cleanly.
  }
}

export function syncRuntimeSettings(settings: Partial<AppSettingsData>, bridge: GmacBridgeClient): void {
  if (typeof settings.askBeforeQuitting === 'boolean') {
    cachedAskBeforeQuitting = settings.askBeforeQuitting
  }
  if (typeof settings.showMenuBarExtra === 'boolean') {
    updateTrayState(settings.showMenuBarExtra)
  }
  if (typeof settings.logRetentionDays === 'number' && bridge.isAvailable()) {
    void bridge.request('settings.pruneLogs').catch(() => {})
  }
}

function updateTrayState(enabled: boolean): void {
  if (!enabled) {
    if (tray) {
      tray.destroy()
      tray = null
    }
    return
  }

  if (tray) {
    return
  }

  const baseIcon = cachedIconPath ? nativeImage.createFromPath(cachedIconPath) : nativeImage.createEmpty()
  const trayIcon = baseIcon.isEmpty() ? baseIcon : baseIcon.resize({ width: 18, height: 18 })
  tray = new Tray(trayIcon)
  tray.setToolTip('Gmac')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Gmac',
      click: () => resolveOrShowMainWindow?.()
    },
    {
      label: 'Check for Updates...',
      click: () => {
        resolveOrShowMainWindow?.()
        void checkUpdatesAndBroadcast()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Gmac',
      click: () => app.quit()
    }
  ])
  tray.setContextMenu(contextMenu)
  tray.on('click', () => resolveOrShowMainWindow?.())
}

export async function checkUpdatesAndBroadcast(): Promise<UpdateCheckResult> {
  const currentAppVersion = app.getVersion()
  if (!activeBridge || !activeBridge.isAvailable() || process.env.GMAC_FRESH_INSTALL === '1') {
    return {
      appUpdateAvailable: false,
      currentAppVersion,
      latestAppVersion: currentAppVersion,
      appReleaseTitle: null,
      appReleaseUrl: null,
      engineUpdateAvailable: false,
      currentEngineVersion: '4.6.12',
      latestEngineVersion: '4.6.12'
    }
  }

  const status = await activeBridge.request<UpdateCheckResult>('settings.checkUpdates', {
    currentAppVersion
  })

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.UPDATE_STATUS, status)
    }
  }
  return status
}
