import { existsSync } from 'fs'
import { join } from 'path'
import { app, BrowserWindow, Menu, nativeImage, nativeTheme, session, shell } from 'electron'
import { AppScreen, BottleSummary, SystemStatus } from '../shared/ipc'
import { GmacBridgeClient } from './bridge'
import { registerIpcHandlers } from './ipc'

async function resolveInitialScreen(bridge: GmacBridgeClient): Promise<AppScreen> {
  const requested = process.env.GMAC_SCREEN?.trim().toLowerCase()
  if (requested === 'home' || requested === 'onboarding') {
    return requested
  }
  if (process.env.GMAC_FRESH_INSTALL === '1' || !bridge.isAvailable()) {
    return 'onboarding'
  }
  try {
    const [status, bottles] = await Promise.all([
      bridge.request<SystemStatus>('system.status'),
      bridge.request<BottleSummary[]>('library.list')
    ])
    if (status.engineInstalled || bottles.length > 0) {
      return 'home'
    }
  } catch {
    // Fall back to onboarding when system status cannot be probed.
  }
  return 'onboarding'
}

function resolveAppIconPath(): string | undefined {
  const candidates = [
    join(__dirname, '../../resources/icon.png'),
    join(process.resourcesPath, 'icon.png')
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

function configureApplicationMenu(): void {
  if (process.platform !== 'darwin') {
    return
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Gmac',
      submenu: [
        { role: 'about', label: 'About Gmac' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: 'Hide Gmac' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit Gmac' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.setName('Gmac')
const bridgeClient = new GmacBridgeClient()

function buildContentSecurityPolicy(rendererUrl: string | undefined): string {
  if (rendererUrl) {
    const devOrigin = new URL(rendererUrl).origin
    const wsOrigin = devOrigin.replace(/^http/, 'ws')
    return [
      `default-src 'self' ${devOrigin}`,
      `script-src 'self' 'unsafe-inline' ${devOrigin}`,
      `style-src 'self' 'unsafe-inline' ${devOrigin}`,
      `connect-src 'self' ${devOrigin} ${wsOrigin}`,
      `img-src 'self' data: ${devOrigin}`,
      `font-src 'self' data: ${devOrigin}`
    ].join('; ')
  }

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:"
  ].join('; ')
}

function configureContentSecurityPolicy(): void {
  const rendererUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
  const cspHeader = buildContentSecurityPolicy(rendererUrl)

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspHeader]
      }
    })
  })
}

async function createMainWindow(iconPath?: string): Promise<BrowserWindow> {
  const isMac = process.platform === 'darwin'
  const rendererUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
  const allowedDevOrigin = rendererUrl ? new URL(rendererUrl).origin : null
  const initialScreen = await resolveInitialScreen(bridgeClient)

  const mainWindow = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 800,
    minHeight: 560,
    show: false,
    title: 'Gmac',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121010' : '#ffffff',
    ...(iconPath ? { icon: iconPath } : {}),
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 16, y: 16 }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:') {
        void shell.openExternal(parsed.toString())
      }
    } catch {
      // Ignore malformed popup URLs.
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    try {
      const parsed = new URL(targetUrl)
      if (allowedDevOrigin) {
        if (parsed.origin !== allowedDevOrigin) {
          event.preventDefault()
        }
      } else if (parsed.protocol !== 'file:') {
        event.preventDefault()
      }
    } catch {
      event.preventDefault()
    }
  })

  const mockUi = process.env.GMAC_MOCK_UI === '1'

  if (rendererUrl) {
    const targetUrl = new URL(rendererUrl)
    targetUrl.searchParams.set('screen', initialScreen)
    if (mockUi) {
      targetUrl.searchParams.set('mock', '1')
    }
    void mainWindow.loadURL(targetUrl.toString())
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { screen: initialScreen, ...(mockUi ? { mock: '1' } : {}) }
    })
  }

  return mainWindow
}

void app.whenReady().then(() => {
  const iconPath = resolveAppIconPath()
  if (process.platform === 'darwin' && iconPath) {
    const dockIcon = nativeImage.createFromPath(iconPath)
    if (!dockIcon.isEmpty()) {
      app.dock?.setIcon(dockIcon)
    }
  }
  app.setAboutPanelOptions({
    applicationName: 'Gmac',
    applicationVersion: app.getVersion(),
    ...(iconPath ? { iconPath } : {})
  })
  configureApplicationMenu()
  configureContentSecurityPolicy()
  registerIpcHandlers(bridgeClient)
  void createMainWindow(iconPath)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow(iconPath)
    }
  })
})

app.on('before-quit', () => {
  bridgeClient.dispose()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
