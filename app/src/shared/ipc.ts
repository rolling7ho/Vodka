export const IPC_CHANNELS = {
  GET_APP_INFO: 'gmac:get-app-info',
  OPEN_EXTERNAL_URL: 'gmac:open-external-url'
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

export interface GmacApi {
  getAppInfo: () => Promise<AppInfo>
  openExternalUrl: (url: string) => Promise<void>
}
