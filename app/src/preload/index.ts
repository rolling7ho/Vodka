import { contextBridge, ipcRenderer } from 'electron'
import { GmacApi, IPC_CHANNELS } from '../shared/ipc'

const gmacApi: GmacApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_INFO),
  openExternalUrl: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL_URL, url)
}

contextBridge.exposeInMainWorld('gmac', gmacApi)
