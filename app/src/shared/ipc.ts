export type AppScreen = 'onboarding' | 'home'

export const IPC_CHANNELS = {
  GET_APP_INFO: 'gmac:get-app-info',
  OPEN_EXTERNAL_URL: 'gmac:open-external-url',
  GET_SYSTEM_STATUS: 'gmac:get-system-status',
  LIST_BOTTLES: 'gmac:list-bottles',
  CREATE_BOTTLE: 'gmac:create-bottle',
  RENAME_BOTTLE: 'gmac:rename-bottle',
  DELETE_BOTTLE: 'gmac:delete-bottle',
  SET_BOTTLE_ICON: 'gmac:set-bottle-icon',
  REORDER_BOTTLES: 'gmac:reorder-bottles',
  GET_HOME_SUMMARY: 'gmac:get-home-summary',
  LAUNCH_HOME_ITEM: 'gmac:launch-home-item',
  INSTALL_ENGINE: 'gmac:install-engine',
  PICK_TOOLKIT_FILE: 'gmac:pick-toolkit-file',
  PICK_EXECUTABLE_FILE: 'gmac:pick-executable-file',
  PICK_FOLDER: 'gmac:pick-folder',
  SHOW_IN_FINDER: 'gmac:show-in-finder',
  INSTALL_TOOLKIT: 'gmac:install-toolkit',
  SET_DEFAULT_GRAPHICS: 'gmac:set-default-graphics',
  IMPORT_LEGACY_BOTTLES: 'gmac:import-legacy-bottles',
  SETUP_LAUNCHER: 'gmac:setup-launcher',
  BRIDGE_PROGRESS: 'gmac:bridge-progress'
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

export interface BottleSummary {
  name: string
  path: string
  windowsVersion: string
  graphicsBackend: string
  isAvailable: boolean
  icon?: string | null
}

export interface SystemStatus {
  rosettaInstalled: boolean
  engineInstalled: boolean
  toolkitInstalled: boolean
  detectedToolkitFile: string | null
  detectedToolkitPath: string | null
  legacyWhiskyBottles: DiscoveredBottle[]
  steamInstalled: boolean
}

export interface BridgeProgressEvent {
  requestMethod: string
  data: Record<string, unknown>
}

export interface ToolkitInstallResult {
  installed: boolean
  version: string
}

export interface ImportBottlesResult {
  importedCount: number
}

export interface LauncherSetupResult {
  bottlePath: string
  launcher: string
}

export interface StatPoint {
  date: string
  value: number
}

export interface HomeStats {
  totalPlaytimeSeconds: number
  lastTwoWeeksSeconds: number
  gamesInstalled: number
  pcsCount: number
  hoursHistory: StatPoint[]
  recentHoursHistory: StatPoint[]
  gamesHistory: StatPoint[]
}

export interface HomeGameItem {
  id: string
  name: string
  bottleName: string
  bottlePath: string
  launchKind: 'steam' | 'program'
  steamAppId?: number | null
  programPath?: string | null
  totalPlaytimeSeconds: number
  lastTwoWeeksSeconds: number
  lastPlayedIso: string | null
  artworkDataUrl: string | null
  portraitArtworkDataUrl: string | null
  logoDataUrl: string | null
}

export interface HomeLauncherItem {
  id: string
  name: string
  installed: boolean
  bottleName: string | null
  bottlePath: string | null
  executablePath: string | null
}

export interface HomeSummary {
  stats: HomeStats
  continuePlaying: HomeGameItem | null
  recentlyPlayed: HomeGameItem[]
  allGames: HomeGameItem[]
  launchers: HomeLauncherItem[]
}

export interface LaunchHomeItemRequest {
  bottlePath: string
  launchKind: 'steam' | 'program'
  steamAppId?: number | null
  programPath?: string | null
}

export interface GmacApi {
  getAppInfo: () => Promise<AppInfo>
  openExternalUrl: (url: string) => Promise<void>
  getSystemStatus: () => Promise<SystemStatus>
  listBottles: () => Promise<BottleSummary[]>
  createBottle: (name: string, icon?: string | null) => Promise<BottleSummary>
  renameBottle: (path: string, name: string) => Promise<BottleSummary>
  deleteBottle: (path: string) => Promise<{ deleted: boolean }>
  setBottleIcon: (path: string, icon: string) => Promise<{ path: string; icon: string }>
  reorderBottles: (paths: string[]) => Promise<{ paths: string[] }>
  getHomeSummary: () => Promise<HomeSummary>
  launchHomeItem: (request: LaunchHomeItemRequest) => Promise<{ launched: boolean }>
  installEngine: () => Promise<{ installed: boolean }>
  pickToolkitFile: () => Promise<string | null>
  pickExecutableFile: (defaultPath?: string) => Promise<string | null>
  pickFolder: (defaultPath?: string) => Promise<string | null>
  showInFinder: (targetPath: string) => Promise<{ opened: boolean }>
  installToolkit: (path: string) => Promise<ToolkitInstallResult>
  setDefaultGraphics: (choice: string) => Promise<{ choice: string }>
  importLegacyBottles: (paths: string[]) => Promise<ImportBottlesResult>
  setupLauncher: (launcher: string, graphicsChoice: string) => Promise<LauncherSetupResult>
  onBridgeProgress: (listener: (event: BridgeProgressEvent) => void) => () => void
}
