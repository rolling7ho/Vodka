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
  GET_BOTTLE_CONFIG: 'gmac:get-bottle-config',
  UPDATE_BOTTLE_CONFIG: 'gmac:update-bottle-config',
  GET_GAME_SETTINGS: 'gmac:get-game-settings',
  UPDATE_GAME_SETTINGS: 'gmac:update-game-settings',
  GET_APP_SETTINGS: 'gmac:get-app-settings',
  UPDATE_APP_SETTINGS: 'gmac:update-app-settings',
  CLEAR_SHADER_CACHES: 'gmac:clear-shader-caches',
  SET_THEME_PREFERENCE: 'gmac:set-theme-preference',
  INSTALL_ENGINE: 'gmac:install-engine',
  PICK_TOOLKIT_FILE: 'gmac:pick-toolkit-file',
  PICK_EXECUTABLE_FILE: 'gmac:pick-executable-file',
  PICK_FOLDER: 'gmac:pick-folder',
  SHOW_IN_FINDER: 'gmac:show-in-finder',
  INSTALL_TOOLKIT: 'gmac:install-toolkit',
  SET_DEFAULT_GRAPHICS: 'gmac:set-default-graphics',
  IMPORT_LEGACY_BOTTLES: 'gmac:import-legacy-bottles',
  SETUP_LAUNCHER: 'gmac:setup-launcher',
  BRIDGE_PROGRESS: 'gmac:bridge-progress',
  CHECK_UPDATES: 'gmac:check-updates',
  UPDATE_STATUS: 'gmac:update-status',
  LIST_BOTTLE_PROCESSES: 'gmac:list-bottle-processes',
  KILL_BOTTLE_PROCESS: 'gmac:kill-bottle-process',
  KILL_BOTTLE: 'gmac:kill-bottle',
  LIST_BOTTLE_PINS: 'gmac:list-bottle-pins',
  ADD_BOTTLE_PIN: 'gmac:add-bottle-pin',
  REMOVE_BOTTLE_PIN: 'gmac:remove-bottle-pin',
  LIST_WINETRICKS_VERBS: 'gmac:list-winetricks-verbs',
  RUN_WINETRICKS_VERB: 'gmac:run-winetricks-verb',
  GET_AUDIO_STATUS: 'gmac:get-audio-status',
  RUN_AUDIO_TEST: 'gmac:run-audio-test',
  TROUBLESHOOT_AUDIO: 'gmac:troubleshoot-audio',
  APPLY_AUDIO_FIX: 'gmac:apply-audio-fix',
  LIST_LOGS: 'gmac:list-logs',
  READ_LOG_FILE: 'gmac:read-log-file',
  ANALYZE_DIAGNOSTICS: 'gmac:analyze-diagnostics',
  EXPORT_DIAGNOSTICS_REPORT: 'gmac:export-diagnostics-report',
  LIST_TROUBLESHOOT_CATEGORIES: 'gmac:list-troubleshoot-categories',
  RUN_TROUBLESHOOT_FLOW: 'gmac:run-troubleshoot-flow',
  APPLY_TROUBLESHOOT_FIX: 'gmac:apply-troubleshoot-fix',
  UNDO_TROUBLESHOOT_FIX: 'gmac:undo-troubleshoot-fix',
  LIST_GAMEDB: 'gmac:list-gamedb',
  PREVIEW_GAMEDB: 'gmac:preview-gamedb',
  APPLY_GAMEDB: 'gmac:apply-gamedb'
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

export type ThemePreference = 'system' | 'light' | 'dark'

export type DllOverrideMode = 'b' | 'n' | 'n,b' | 'b,n' | ''

export interface DllOverrideEntry {
  dllName: string
  mode: DllOverrideMode
}

export interface BottleConfig {
  windowsVersion: 'Windows 11' | 'Windows 10' | 'Windows 8.1' | 'Windows 7'
  enhancedSync: 'msync' | 'esync' | 'off'
  avxEnabled: boolean
  graphicsBackend: 'recommended' | 'd3dMetal' | 'dxmt' | 'dxvk' | 'wined3d'
  metalHud: boolean
  dxrEnabled: boolean
  shaderCacheEnabled: boolean
  retinaMode: boolean
  virtualDesktop: boolean
  virtualDesktopResolution: '1920x1080' | '2560x1440' | '3840x2160'
  controllerCompatMode: boolean
  dxvk: boolean
  dxvkAsync: boolean
  dxvkHud: 'off' | 'fps' | 'partial' | 'full'
  dpi: number
  dllOverrides: DllOverrideEntry[]
  audioDriver: 'auto' | 'coreaudio' | 'disabled'
  audioLatencyPreset: 'defaultPreset' | 'lowLatency' | 'stable'
  outputDeviceMode: 'followSystem' | 'pinned'
  pinnedDeviceName: string | null
}

export interface GameSettingsData {
  graphicsBackend: 'inherit' | 'recommended' | 'd3dMetal' | 'dxmt' | 'dxvk' | 'wined3d'
  metal4Enabled: boolean
  shaderCacheEnabled: boolean
  metalHud: boolean
  launchArguments: string
  locale: string
  enhancedSync: 'inherit' | 'msync' | 'esync' | 'off'
  virtualDesktop: boolean
  virtualDesktopResolution: '1920x1080' | '2560x1440' | '3840x2160'
  controllerCompatMode: boolean
}

export interface GameSettingsTarget {
  bottlePath: string
  launchKind: 'steam' | 'program'
  steamAppId?: number | null
  programPath?: string | null
}

export interface AppSettingsData {
  openAtLogin: boolean
  askBeforeQuitting: boolean
  showMenuBarExtra: boolean
  preferredTerminal: 'terminal' | 'iterm' | 'ghostty' | 'warp'
  defaultWinVersion: 'Windows 11' | 'Windows 10' | 'Windows 8.1' | 'Windows 7'
  defaultPcsLocation: string
  logsFolder: string
  openSteamAtLaunch: boolean
  gameModeEnabled: boolean
  fitBelowNotch: boolean
  defaultGraphicsBackend: 'recommended' | 'd3dMetal' | 'dxmt' | 'dxvk' | 'wined3d'
  logRetentionDays: 1 | 7 | 30 | 0
  autoCheckAppUpdates: boolean
  autoCheckEngineUpdates: boolean
}

export interface UpdateCheckResult {
  appUpdateAvailable: boolean
  currentAppVersion: string
  latestAppVersion: string | null
  appReleaseTitle: string | null
  appReleaseUrl: string | null
  engineUpdateAvailable: boolean
  currentEngineVersion: string | null
  latestEngineVersion: string
}

export interface BottleProcessItem {
  imageName: string
  winePID: number
  memoryUsage: string
  kind: string
}

export interface BottleProcessesResult {
  running: boolean
  processes: BottleProcessItem[]
}

export interface BottlePinItem {
  name: string
  path: string
  removable: boolean
}

export interface WinetricksVerbItem {
  name: string
  description: string
  installed: boolean
}

export interface WinetricksCategoryGroup {
  category: string
  verbs: WinetricksVerbItem[]
}

export interface WinetricksListResult {
  available: boolean
  categories: WinetricksCategoryGroup[]
}

export interface WinetricksRunResult {
  ok: boolean
  exitCode: number
  output: string
}

export interface AudioDeviceItem {
  id: string
  name: string
  transportType: string
  sampleRate: number
  outputChannelCount: number
  isDefault: boolean
}

export interface AudioFindingItem {
  id: string
  description: string
  confidence: string
  evidence: string
  suggestedAction: string | null
}

export interface AudioStatusResult {
  defaultDevice: AudioDeviceItem | null
  devices: AudioDeviceItem[]
  findings: AudioFindingItem[]
}

export interface AudioTestResult {
  ok: boolean
  status: string
  summary: string
  evidence: string[]
  findings: AudioFindingItem[]
}

export interface AudioTroubleshootFix {
  id: string
  title: string
  description: string
}

export interface AudioTroubleshootResult {
  symptom: string
  symptomTitle: string
  symptomDescription: string
  findings: AudioFindingItem[]
  suggestedFixes: AudioTroubleshootFix[]
}

export interface LogFileItem {
  name: string
  path: string
  sizeBytes: number
  modifiedAt: string
}

export interface LogsListResult {
  folder: string
  files: LogFileItem[]
}

export interface LogReadResult {
  path: string
  content: string
  lineCount: number
  truncated: boolean
}

export interface DiagnosisMatchItem {
  id: string
  category: string
  severity: string
  confidence: number
  lineIndex: number
  lineText: string
}

export interface RemediationActionItem {
  id: string
  title: string
  description: string
  risk: string
  actionType: string
  settingKeyPath: string | null
  settingValue: string | null
  winetricksVerb: string | null
  whatWillChange: string
  undoPath: string
}

export interface DiagnosticsAnalyzeResult {
  primaryCategory: string | null
  primaryConfidence: string | null
  headline: string | null
  matches: DiagnosisMatchItem[]
  remediations: RemediationActionItem[]
}

export interface DiagnosticsExportResult {
  path: string
  report: string
}

export interface TroubleshootCategoryItem {
  id: string
  title: string
  hasFlow: boolean
}

export interface TroubleshootCheckItem {
  nodeId: string
  checkId: string
  title: string
  outcome: string
  summary: string
  confidence: string | null
}

export interface TroubleshootFlowNode {
  id: string
  type: 'check' | 'fix' | 'info' | 'verify' | 'branch'
  phase: string
  title: string | null
  description: string | null
  fixId: string | null
  params: Record<string, string>
  on: Record<string, string>
  fixPreview: {
    settingName: string
    currentValue: string
    newValue: string
    scope: string
    isReversible: boolean
  } | null
}

export interface TroubleshootRunResult {
  category: string
  executedChecks: TroubleshootCheckItem[]
  node: TroubleshootFlowNode | null
}

export interface TroubleshootFixResult {
  ok: boolean
  fixId: string
  result: string
  beforeValue: string | null
  afterValue: string | null
}

export interface GameDbVariantItem {
  id: string
  label: string
  isDefault: boolean
  whenToUse: string | null
  rationale: string[]
  winetricksVerbs: string[]
}

export interface GameDbEntryItem {
  id: string
  title: string
  subtitle: string | null
  steamAppId: number | null
  rating: 'works' | 'playable' | 'unverified' | 'broken' | 'notSupported'
  ratingLabel: string
  antiCheat: string | null
  notes: string[]
  variants: GameDbVariantItem[]
}

export interface GameDbChangeItem {
  category: string
  settingName: string
  currentValue: string
  newValue: string
  isHighImpact: boolean
}

export interface GameDbPreviewResult {
  entryId: string
  variantId: string
  changes: GameDbChangeItem[]
}

export interface GameDbApplyResult {
  ok: boolean
  entryId: string
  variantId: string
  appliedCount: number
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
  getBottleConfig: (path: string) => Promise<BottleConfig>
  updateBottleConfig: (path: string, patch: Partial<BottleConfig>) => Promise<BottleConfig>
  getGameSettings: (target: GameSettingsTarget) => Promise<GameSettingsData>
  updateGameSettings: (
    target: GameSettingsTarget,
    patch: Partial<GameSettingsData> & { reset?: boolean }
  ) => Promise<GameSettingsData>
  getAppSettings: () => Promise<AppSettingsData>
  updateAppSettings: (patch: Partial<AppSettingsData>) => Promise<AppSettingsData>
  clearShaderCaches: () => Promise<{ cleared: boolean }>
  setThemePreference: (theme: ThemePreference) => Promise<{ theme: ThemePreference }>
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
  checkUpdates: () => Promise<UpdateCheckResult>
  onUpdateStatus: (listener: (status: UpdateCheckResult) => void) => () => void
  listBottleProcesses: (path: string) => Promise<BottleProcessesResult>
  killBottleProcess: (path: string, pid: number, force?: boolean) => Promise<{ killed: boolean }>
  killBottle: (path: string) => Promise<{ killed: boolean }>
  listBottlePins: (path: string) => Promise<{ pins: BottlePinItem[] }>
  addBottlePin: (
    path: string,
    programPath: string,
    name?: string
  ) => Promise<{ pins: BottlePinItem[] }>
  removeBottlePin: (path: string, programPath: string) => Promise<{ pins: BottlePinItem[] }>
  listWinetricksVerbs: (path?: string) => Promise<WinetricksListResult>
  runWinetricksVerb: (path: string, verb: string) => Promise<WinetricksRunResult>
  getAudioStatus: (bottlePath?: string) => Promise<AudioStatusResult>
  runAudioTest: (bottlePath: string) => Promise<AudioTestResult>
  troubleshootAudio: (bottlePath: string, symptom: string) => Promise<AudioTroubleshootResult>
  applyAudioFix: (
    bottlePath: string,
    fixId: string
  ) => Promise<{ ok: boolean; fixId: string; config: BottleConfig }>
  listLogs: () => Promise<LogsListResult>
  readLogFile: (path: string) => Promise<LogReadResult>
  analyzeDiagnostics: (input: {
    logText?: string
    logPath?: string
    exitCode?: number
  }) => Promise<DiagnosticsAnalyzeResult>
  exportDiagnosticsReport: (bottlePath?: string) => Promise<DiagnosticsExportResult>
  listTroubleshootCategories: () => Promise<{ categories: TroubleshootCategoryItem[] }>
  runTroubleshootFlow: (input: {
    bottlePath: string
    category: string
    nodeId?: string
  }) => Promise<TroubleshootRunResult>
  applyTroubleshootFix: (input: {
    bottlePath: string
    fixId: string
    params?: Record<string, string>
  }) => Promise<TroubleshootFixResult>
  undoTroubleshootFix: (input: {
    bottlePath: string
    fixId: string
    beforeValue?: string | null
    afterValue?: string | null
    params?: Record<string, string>
  }) => Promise<{ restored: boolean }>
  listGameDb: (input?: {
    query?: string
    steamAppId?: number
  }) => Promise<{ entries: GameDbEntryItem[] }>
  previewGameDb: (input: {
    bottlePath: string
    entryId: string
    variantId?: string
  }) => Promise<GameDbPreviewResult>
  applyGameDb: (input: {
    bottlePath: string
    entryId: string
    variantId?: string
  }) => Promise<GameDbApplyResult>
}
