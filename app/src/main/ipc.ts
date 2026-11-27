import { app, ipcMain, shell } from 'electron'
import { AppInfo, IPC_CHANNELS } from '../shared/ipc'

export function registerIpcHandlers(): void {
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
}
