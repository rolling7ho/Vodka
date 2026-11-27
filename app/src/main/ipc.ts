import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import {
  AppInfo,
  BottleSummary,
  BridgeProgressEvent,
  ImportBottlesResult,
  IPC_CHANNELS,
  LauncherSetupResult,
  SystemStatus,
  ToolkitInstallResult
} from '../shared/ipc'
import { GmacBridgeClient } from './bridge'
import { getSystemStatus } from './systemStatus'

function emitProgress(event: BridgeProgressEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.BRIDGE_PROGRESS, event)
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function registerIpcHandlers(bridge: GmacBridgeClient): void {
  bridge.onProgress((event) => {
    emitProgress(event)
  })

  ipcMain.handle(IPC_CHANNELS.GET_APP_INFO, (): AppInfo => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL_URL, async (_event, targetUrl: string): Promise<void> => {
    const parsed = new URL(targetUrl)
    if (parsed.protocol !== 'https:') {
      throw new Error('Only HTTPS URLs may be opened externally')
    }
    await shell.openExternal(parsed.toString())
  })

  ipcMain.handle(IPC_CHANNELS.GET_SYSTEM_STATUS, async (): Promise<SystemStatus> => {
    if (process.env.GMAC_FRESH_INSTALL === '1' || !bridge.isAvailable()) {
      return getSystemStatus()
    }
    try {
      return await bridge.request<SystemStatus>('system.status')
    } catch {
      return getSystemStatus()
    }
  })

  ipcMain.handle(IPC_CHANNELS.LIST_BOTTLES, async (): Promise<BottleSummary[]> => {
    if (process.env.GMAC_FRESH_INSTALL === '1' || !bridge.isAvailable()) {
      return []
    }
    try {
      return await bridge.request<BottleSummary[]>('library.list')
    } catch {
      return []
    }
  })

  ipcMain.handle(IPC_CHANNELS.PICK_TOOLKIT_FILE, async (): Promise<string | null> => {
    const focused = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const options: Electron.OpenDialogOptions = {
      title: 'Select Apple Game Porting Toolkit',
      properties: ['openFile', 'openDirectory'],
      filters: [{ name: 'Disk Image', extensions: ['dmg'] }]
    }
    const result = focused
      ? await dialog.showOpenDialog(focused, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.INSTALL_ENGINE, async (): Promise<{ installed: boolean }> => {
    if (process.env.GMAC_FRESH_INSTALL === '1') {
      emitProgress({
        requestMethod: 'engine.install',
        data: { component: 'rosetta', status: 'installing' }
      })
      emitProgress({
        requestMethod: 'engine.install',
        data: { component: 'engine', status: 'installing', progress: 0 }
      })
      await wait(550)
      emitProgress({
        requestMethod: 'engine.install',
        data: { component: 'rosetta', status: 'installed' }
      })
      emitProgress({
        requestMethod: 'engine.install',
        data: { component: 'engine', status: 'installing', progress: 35 }
      })
      await wait(500)
      emitProgress({
        requestMethod: 'engine.install',
        data: { component: 'engine', status: 'installing', progress: 72 }
      })
      await wait(500)
      emitProgress({
        requestMethod: 'engine.install',
        data: { component: 'engine', status: 'installing', progress: 96 }
      })
      await wait(450)
      emitProgress({
        requestMethod: 'engine.install',
        data: { component: 'engine', status: 'installed', progress: 100 }
      })
      return { installed: true }
    }

    return await bridge.request<{ installed: boolean }>('engine.install')
  })

  ipcMain.handle(
    IPC_CHANNELS.INSTALL_TOOLKIT,
    async (_event, toolkitPath: string): Promise<ToolkitInstallResult> => {
      if (process.env.GMAC_FRESH_INSTALL === '1') {
        await wait(900)
        return { installed: true, version: '4.0b3' }
      }
      return await bridge.request<ToolkitInstallResult>('gptk.install', { path: toolkitPath })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SET_DEFAULT_GRAPHICS,
    async (_event, choice: string): Promise<{ choice: string }> => {
      if (process.env.GMAC_FRESH_INSTALL === '1') {
        return { choice }
      }
      return await bridge.request<{ choice: string }>('graphics.setDefault', { choice })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.IMPORT_LEGACY_BOTTLES,
    async (_event, paths: string[]): Promise<ImportBottlesResult> => {
      if (process.env.GMAC_FRESH_INSTALL === '1') {
        return { importedCount: paths.length }
      }
      return await bridge.request<ImportBottlesResult>('bottles.importLegacy', { paths })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SETUP_LAUNCHER,
    async (_event, launcher: string, graphicsChoice: string): Promise<LauncherSetupResult> => {
      if (process.env.GMAC_FRESH_INSTALL === '1') {
        emitProgress({
          requestMethod: 'launcher.setup',
          data: { component: 'launcher', stage: 'creating' }
        })
        await wait(700)
        emitProgress({
          requestMethod: 'launcher.setup',
          data: { component: 'launcher', stage: 'downloading' }
        })
        await wait(750)
        emitProgress({
          requestMethod: 'launcher.setup',
          data: { component: 'launcher', stage: 'installing' }
        })
        await wait(750)
        emitProgress({
          requestMethod: 'launcher.setup',
          data: { component: 'launcher', stage: 'done' }
        })
        return { bottlePath: '', launcher }
      }

      return await bridge.request<LauncherSetupResult>('launcher.setup', {
        launcher,
        graphicsChoice
      })
    }
  )
}
