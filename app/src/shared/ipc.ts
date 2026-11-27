export const IPC_CHANNELS = {
  GET_APP_INFO: 'gmac:get-app-info',
  OPEN_EXTERNAL_URL: 'gmac:open-external-url',
  GET_SYSTEM_STATUS: 'gmac:get-system-status'
} as const

export interface AppInfo {
  name: string
  version: string
  platform: string
  arch: string
  versions: {
    electron: string
    chrome: string
    node: string
  }
}

export interface DiscoveredBottle {
  id: string
  name: string
  path: string
}

export interface SystemStatus {
  rosettaInstalled: boolean
  engineInstalled: boolean
  toolkitInstalled: boolean
  detectedToolkitFile: string | null
  legacyWhiskyBottles: DiscoveredBottle[]
  steamInstalled: boolean
}

export interface GmacApi {
  getAppInfo: () => Promise<AppInfo>
  openExternalUrl: (url: string) => Promise<void>
  getSystemStatus: () => Promise<SystemStatus>
}
