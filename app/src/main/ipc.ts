import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import {
  AppInfo,
  BottleSummary,
  BridgeProgressEvent,
  HomeSummary,
  ImportBottlesResult,
  IPC_CHANNELS,
  LaunchHomeItemRequest,
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

function defaultHomeSummary(pcsCount: number): HomeSummary {
  return {
    stats: {
      totalPlaytimeSeconds: 0,
      lastTwoWeeksSeconds: 0,
      gamesInstalled: 0,
      pcsCount
    },
    continuePlaying: null,
    recentlyPlayed: [],
    launchers: [
      {
        id: 'steam',
        name: 'Steam',
        installed: false,
        bottleName: null,
        bottlePath: null,
        executablePath: null
      },
      {
        id: 'epicGames',
        name: 'Epic Games Store',
        installed: false,
        bottleName: null,
        bottlePath: null,
        executablePath: null
      },
      {
        id: 'battleNet',
        name: 'Battle.net',
        installed: false,
        bottleName: null,
        bottlePath: null,
        executablePath: null
      },
      {
        id: 'eaApp',
        name: 'EA App',
        installed: false,
        bottleName: null,
        bottlePath: null,
        executablePath: null
      },
      {
        id: 'rockstar',
        name: 'Rockstar Games',
        installed: false,
        bottleName: null,
        bottlePath: null,
        executablePath: null
      },
      {
        id: 'ubisoft',
        name: 'Ubisoft Connect',
        installed: false,
        bottleName: null,
        bottlePath: null,
        executablePath: null
      }
    ]
  }
}

export function registerIpcHandlers(bridge: GmacBridgeClient): void {
  let freshBottles: BottleSummary[] = []

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
    if (process.env.GMAC_FRESH_INSTALL === '1') {
      return [...freshBottles]
    }
    if (!bridge.isAvailable()) {
      return []
    }
    try {
      return await bridge.request<BottleSummary[]>('library.list')
    } catch {
      return []
    }
  })

  ipcMain.handle(IPC_CHANNELS.GET_HOME_SUMMARY, async (): Promise<HomeSummary> => {
    if (process.env.GMAC_FRESH_INSTALL === '1' || !bridge.isAvailable()) {
      return defaultHomeSummary(freshBottles.length)
    }
    try {
      return await bridge.request<HomeSummary>('home.summary')
    } catch {
      return defaultHomeSummary(0)
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.LAUNCH_HOME_ITEM,
    async (_event, request: LaunchHomeItemRequest): Promise<{ launched: boolean }> => {
      if (process.env.GMAC_FRESH_INSTALL === '1') {
        return { launched: true }
      }
      return await bridge.request<{ launched: boolean }>('home.launch', {
        bottlePath: request.bottlePath,
        launchKind: request.launchKind,
        ...(request.steamAppId != null ? { steamAppId: request.steamAppId } : {}),
        ...(request.programPath ? { programPath: request.programPath } : {})
      })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CREATE_BOTTLE,
    async (_event, name: string, icon?: string | null): Promise<BottleSummary> => {
      if (process.env.GMAC_FRESH_INSTALL === '1') {
        const trimmed = name.trim()
        if (!trimmed) {
          throw new Error('PC name is required.')
        }
        const created: BottleSummary = {
          name: trimmed,
          path: `/tmp/gmac-fresh-pc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          windowsVersion: 'Windows 10',
          graphicsBackend: 'Recommended',
          isAvailable: true,
          icon: icon ?? 'pc'
        }
        freshBottles = [...freshBottles, created]
        return created
      }
      return await bridge.request<BottleSummary>('bottles.create', {
        name,
        ...(icon ? { icon } : {})
      })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.RENAME_BOTTLE,
    async (_event, path: string, name: string): Promise<BottleSummary> => {
      if (process.env.GMAC_FRESH_INSTALL === '1') {
        const trimmed = name.trim()
        if (!trimmed) {
          throw new Error('PC name is required.')
        }
        const index = freshBottles.findIndex((bottle) => bottle.path === path)
        if (index === -1) {
          throw new Error('PC not found.')
        }
        const updated = { ...freshBottles[index], name: trimmed }
        freshBottles = freshBottles.map((bottle, idx) => (idx === index ? updated : bottle))
        return updated
      }
      return await bridge.request<BottleSummary>('bottles.rename', { path, name })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DELETE_BOTTLE,
    async (_event, path: string): Promise<{ deleted: boolean }> => {
      if (process.env.GMAC_FRESH_INSTALL === '1') {
        freshBottles = freshBottles.filter((bottle) => bottle.path !== path)
        return { deleted: true }
      }
      return await bridge.request<{ deleted: boolean }>('bottles.delete', { path })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SET_BOTTLE_ICON,
    async (_event, path: string, icon: string): Promise<{ path: string; icon: string }> => {
      if (process.env.GMAC_FRESH_INSTALL === '1') {
        freshBottles = freshBottles.map((bottle) =>
          bottle.path === path ? { ...bottle, icon } : bottle
        )
        return { path, icon }
      }
      return await bridge.request<{ path: string; icon: string }>('bottles.setIcon', {
        path,
        icon
      })
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.REORDER_BOTTLES,
    async (_event, paths: string[]): Promise<{ paths: string[] }> => {
      if (process.env.GMAC_FRESH_INSTALL === '1') {
        const byPath = new Map(freshBottles.map((bottle) => [bottle.path, bottle]))
        const reordered: BottleSummary[] = []
        for (const entryPath of paths) {
          const item = byPath.get(entryPath)
          if (item) {
            reordered.push(item)
            byPath.delete(entryPath)
          }
        }
        for (const remaining of byPath.values()) {
          reordered.push(remaining)
        }
        freshBottles = reordered
        return { paths: freshBottles.map((bottle) => bottle.path) }
      }
      return await bridge.request<{ paths: string[] }>('bottles.reorder', { paths })
    }
  )

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
