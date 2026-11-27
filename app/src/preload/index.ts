import { contextBridge, ipcRenderer } from 'electron'
import { GmacApi, IPC_CHANNELS } from '../shared/ipc'

const gmacApi: GmacApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_INFO)
}

contextBridge.exposeInMainWorld('gmac', gmacApi)
