import { join } from 'path'
import { app, BrowserWindow, session } from 'electron'
import { registerIpcHandlers } from './ipc'

app.setName('Gmac')

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

function createMainWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const rendererUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
  const allowedDevOrigin = rendererUrl ? new URL(rendererUrl).origin : null

  const mainWindow = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 800,
    minHeight: 560,
    show: false,
    title: 'Gmac',
    backgroundColor: '#ffffff',
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

  mainWindow.webContents.setWindowOpenHandler(() => {
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

  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

void app.whenReady().then(() => {
  configureContentSecurityPolicy()
  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
