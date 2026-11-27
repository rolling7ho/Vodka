import { contextBridge, ipcRenderer } from 'electron'
import { BridgeProgressEvent, GmacApi, IPC_CHANNELS } from '../shared/ipc'

const gmacApi: GmacApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_INFO),
  openExternalUrl: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL_URL, url),
  getSystemStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SYSTEM_STATUS),
  listBottles: () => ipcRenderer.invoke(IPC_CHANNELS.LIST_BOTTLES),
  createBottle: (name: string, icon?: string | null) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREATE_BOTTLE, name, icon),
  renameBottle: (path: string, name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.RENAME_BOTTLE, path, name),
  deleteBottle: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_BOTTLE, path),
  setBottleIcon: (path: string, icon: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_BOTTLE_ICON, path, icon),
  reorderBottles: (paths: string[]) => ipcRenderer.invoke(IPC_CHANNELS.REORDER_BOTTLES, paths),
  installEngine: () => ipcRenderer.invoke(IPC_CHANNELS.INSTALL_ENGINE),
  pickToolkitFile: () => ipcRenderer.invoke(IPC_CHANNELS.PICK_TOOLKIT_FILE),
  installToolkit: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.INSTALL_TOOLKIT, path),
  setDefaultGraphics: (choice: string) => ipcRenderer.invoke(IPC_CHANNELS.SET_DEFAULT_GRAPHICS, choice),
  importLegacyBottles: (paths: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.IMPORT_LEGACY_BOTTLES, paths),
  setupLauncher: (launcher: string, graphicsChoice: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETUP_LAUNCHER, launcher, graphicsChoice),
  onBridgeProgress: (listener: (event: BridgeProgressEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: BridgeProgressEvent) => {
      listener(payload)
    }
    ipcRenderer.on(IPC_CHANNELS.BRIDGE_PROGRESS, wrapped)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.BRIDGE_PROGRESS, wrapped)
    }
  }
}

contextBridge.exposeInMainWorld('gmac', gmacApi)
