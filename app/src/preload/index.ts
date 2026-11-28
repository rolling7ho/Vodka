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
  getBottleConfig: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_BOTTLE_CONFIG, path),
  updateBottleConfig: (path, patch) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_BOTTLE_CONFIG, path, patch),
  getGameSettings: (target) => ipcRenderer.invoke(IPC_CHANNELS.GET_GAME_SETTINGS, target),
  updateGameSettings: (target, patch) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_GAME_SETTINGS, target, patch),
  getAppSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_SETTINGS),
  updateAppSettings: (patch) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_APP_SETTINGS, patch),
  clearShaderCaches: () => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_SHADER_CACHES),
  setThemePreference: (theme) => ipcRenderer.invoke(IPC_CHANNELS.SET_THEME_PREFERENCE, theme),
  getHomeSummary: () => ipcRenderer.invoke(IPC_CHANNELS.GET_HOME_SUMMARY),
  launchHomeItem: (request) => ipcRenderer.invoke(IPC_CHANNELS.LAUNCH_HOME_ITEM, request),
  installEngine: () => ipcRenderer.invoke(IPC_CHANNELS.INSTALL_ENGINE),
  pickToolkitFile: () => ipcRenderer.invoke(IPC_CHANNELS.PICK_TOOLKIT_FILE),
  pickExecutableFile: (defaultPath?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PICK_EXECUTABLE_FILE, defaultPath),
  pickFolder: (defaultPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.PICK_FOLDER, defaultPath),
  showInFinder: (targetPath: string) => ipcRenderer.invoke(IPC_CHANNELS.SHOW_IN_FINDER, targetPath),
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
