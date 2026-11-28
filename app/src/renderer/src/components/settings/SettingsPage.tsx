import { useEffect, useRef, useState } from 'react'
import type { AppInfo, SystemStatus } from '../../../../shared/ipc'
import { SpinnerIcon } from '../icons/OnboardingIcons'
import { ExternalLinkIcon, FolderOpenIcon, SettingsGearIcon } from '../icons/SidebarIcons'

interface SettingsPageProps {
  onOpenOnboarding?: () => void
  onResetFavorites?: () => void
}

type SettingsTab = 'general' | 'gaming' | 'graphics' | 'storage' | 'updates'

interface AppSettingsState {
  openAtLogin: boolean
  askBeforeQuitting: boolean
  showMenuBarExtra: boolean
  preferredTerminal: 'terminal' | 'iterm' | 'ghostty' | 'warp'
  defaultWinVersion: 'Windows 11' | 'Windows 10' | 'Windows 8.1' | 'Windows 7'
  defaultPcsLocation: string
  openSteamAtLaunch: boolean
  gameModeEnabled: boolean
  fitBelowNotch: boolean
  defaultGraphicsBackend: 'recommended' | 'd3dMetal' | 'dxmt' | 'dxvk' | 'wined3d'
  logRetentionDays: 1 | 7 | 30 | 0
  autoCheckAppUpdates: boolean
  autoCheckEngineUpdates: boolean
}

const APP_SETTINGS_KEY = 'gmac.appSettings'
const DEFAULT_PCS_LOCATION = '~/Library/Containers/com.gmac.app/Bottles'
const DEFAULT_LOGS_LOCATION = '~/Library/Logs/Gmac'

const DEFAULT_APP_SETTINGS: AppSettingsState = {
  openAtLogin: false,
  askBeforeQuitting: true,
  showMenuBarExtra: false,
  preferredTerminal: 'terminal',
  defaultWinVersion: 'Windows 10',
  defaultPcsLocation: DEFAULT_PCS_LOCATION,
  openSteamAtLaunch: false,
  gameModeEnabled: true,
  fitBelowNotch: false,
  defaultGraphicsBackend: 'recommended',
  logRetentionDays: 7,
  autoCheckAppUpdates: true,
  autoCheckEngineUpdates: true
}

function loadAppSettings(): AppSettingsState {
  try {
    const raw = window.localStorage.getItem(APP_SETTINGS_KEY)
    if (!raw) {
      return { ...DEFAULT_APP_SETTINGS }
    }
    return { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettingsState>) }
  } catch {
    return { ...DEFAULT_APP_SETTINGS }
  }
}

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onToggle: () => void
}

function ToggleRow({ label, description, checked, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-[#161212]">{label}</div>
        <div className="mt-0.5 text-[12px] text-[#5e5454]">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`app-no-drag relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#713131]/60 ${
          checked ? 'bg-[#713131]' : 'bg-[#161212]/16'
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white shadow-xs transition-transform duration-150 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function StatusBadge({ installed }: { installed: boolean }) {
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${
        installed
          ? 'bg-emerald-500/10 text-emerald-700'
          : 'bg-[#161212]/[0.06] text-[#5e5454]'
      }`}
    >
      {installed ? 'Installed' : 'Not installed'}
    </span>
  )
}

export function SettingsPage({ onOpenOnboarding, onResetFavorites }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [settings, setSettings] = useState<AppSettingsState>(loadAppSettings)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [isInstallingEngine, setIsInstallingEngine] = useState(false)
  const [isInstallingToolkit, setIsInstallingToolkit] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusNotice, setStatusNotice] = useState<string | null>(null)
  const [confirmClearShaders, setConfirmClearShaders] = useState(false)
  const [confirmResetPrefs, setConfirmResetPrefs] = useState(false)
  const [savedNoticeVisible, setSavedNoticeVisible] = useState(false)

  const savedTimerRef = useRef<number | null>(null)
  const noticeTimerRef = useRef<number | null>(null)

  const refreshSystemStatus = async () => {
    try {
      const nextStatus = await window.gmac?.getSystemStatus()
      if (nextStatus) {
        setSystemStatus(nextStatus)
      }
    } catch {
      // Keep last known status.
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([
      window.gmac?.getSystemStatus().catch(() => null) ?? Promise.resolve(null),
      window.gmac?.getAppInfo().catch(() => null) ?? Promise.resolve(null)
    ]).then(([status, info]) => {
      if (cancelled) {
        return
      }
      if (status) {
        setSystemStatus(status)
      }
      if (info) {
        setAppInfo(info)
      }
    })

    return () => {
      cancelled = true
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current)
      }
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current)
      }
    }
  }, [])

  const showSavedBadge = () => {
    setSavedNoticeVisible(true)
    if (savedTimerRef.current !== null) {
      window.clearTimeout(savedTimerRef.current)
    }
    savedTimerRef.current = window.setTimeout(() => {
      savedTimerRef.current = null
      setSavedNoticeVisible(false)
    }, 1500)
  }

  const showTransientNotice = (message: string) => {
    setStatusNotice(message)
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current)
    }
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null
      setStatusNotice(null)
    }, 2600)
  }

  const updateSettings = (patch: Partial<AppSettingsState>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch }
      try {
        window.localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage errors.
      }
      return next
    })
    showSavedBadge()
  }

  const handleChoosePcsFolder = async () => {
    setStatusError(null)
    try {
      const picked = await window.gmac?.pickFolder(
        settings.defaultPcsLocation.startsWith('/') ? settings.defaultPcsLocation : undefined
      )
      if (picked) {
        updateSettings({ defaultPcsLocation: picked })
      }
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Unable to select folder.')
    }
  }

  const handleShowInFinder = async (targetPath: string) => {
    setStatusError(null)
    try {
      const result = await window.gmac?.showInFinder(targetPath)
      if (!result?.opened) {
        showTransientNotice(`Location unavailable on disk in this mode: ${targetPath}`)
      }
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Unable to open location in Finder.')
    }
  }

  const handleGraphicsBackendChange = async (
    value: AppSettingsState['defaultGraphicsBackend']
  ) => {
    updateSettings({ defaultGraphicsBackend: value })
    try {
      await window.gmac?.setDefaultGraphics(value)
    } catch {
      // Local setting stays updated even if bridge declines in offline mode.
    }
  }

  const handleInstallEngine = async () => {
    if (!window.gmac || isInstallingEngine) {
      return
    }
    setStatusError(null)
    setIsInstallingEngine(true)
    try {
      await window.gmac.installEngine()
      await refreshSystemStatus()
      showTransientNotice('Gmac Windows Engine is ready.')
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Unable to install Windows Engine.')
    } finally {
      setIsInstallingEngine(false)
    }
  }

  const handleImportToolkit = async () => {
    if (!window.gmac || isInstallingToolkit) {
      return
    }
    setStatusError(null)
    try {
      const toolkitPath = await window.gmac.pickToolkitFile()
      if (!toolkitPath) {
        return
      }
      setIsInstallingToolkit(true)
      const result = await window.gmac.installToolkit(toolkitPath)
      await refreshSystemStatus()
      showTransientNotice(
        result.version
          ? `Game Porting Toolkit ${result.version} imported.`
          : 'Game Porting Toolkit imported.'
      )
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : 'Unable to import Game Porting Toolkit.'
      )
    } finally {
      setIsInstallingToolkit(false)
    }
  }

  const handleConfirmClearShaders = () => {
    setConfirmClearShaders(false)
    showTransientNotice('Shader cache clear requested for installed PCs.')
  }

  const handleConfirmResetPrefs = () => {
    setConfirmResetPrefs(false)
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (
          key &&
          (key === APP_SETTINGS_KEY ||
            key.startsWith('gmac.gameSettings.') ||
            key.startsWith('gmac.pcConfig.'))
        ) {
          keysToRemove.push(key)
        }
      }
      for (const key of keysToRemove) {
        window.localStorage.removeItem(key)
      }
    } catch {
      // Ignore storage errors.
    }
    setSettings({ ...DEFAULT_APP_SETTINGS })
    onResetFavorites?.()
    showTransientNotice('Local UI preferences and favorites cleared.')
  }

  const handleOpenGitHub = async () => {
    try {
      await window.gmac?.openExternalUrl('https://github.com/rolling7ho/gmac')
    } catch {
      // Ignore external link errors.
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-[960px] px-9 pt-12 pb-16">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-bold tracking-[-0.035em] text-[#161212]">Settings</h1>
          </div>

          {savedNoticeVisible && (
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[12px] font-medium text-emerald-700">
              Saved
            </span>
          )}
        </div>

        {statusError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/20 bg-red-50/90 px-4 py-2.5 text-[13px] text-red-700"
          >
            {statusError}
          </div>
        )}

        {statusNotice && !statusError && (
          <div
            role="status"
            className="mt-4 rounded-xl bg-[#FAF9F8] px-4 py-2.5 text-[13px] text-[#4a4242] ring-1 ring-[#161212]/[0.06]"
          >
            {statusNotice}
          </div>
        )}

        <nav
          aria-label="Settings sections"
          className="mt-6 flex flex-wrap items-center gap-6 border-b border-[#161212]/[0.07]"
        >
          {(
            [
              { id: 'general', label: 'General' },
              { id: 'gaming', label: 'Gaming' },
              { id: 'graphics', label: 'Graphics & Engine' },
              { id: 'storage', label: 'Storage' },
              { id: 'updates', label: 'Updates & About' }
            ] as const
          ).map((tab) => {
            const selected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`app-no-drag relative cursor-pointer pb-3 text-[13px] transition-colors ${
                  selected
                    ? 'font-semibold text-[#713131]'
                    : 'font-medium text-[#5e5454] hover:text-[#161212]'
                }`}
              >
                {tab.label}
                {selected && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#713131]" />
                )}
              </button>
            )
          })}
        </nav>

        <div className="mt-6 max-w-[760px] space-y-5">
          {activeTab === 'general' && (
            <>
              <div className="rounded-2xl bg-[#FAF9F8] p-5">
                <h2 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                  Startup &amp; Shell
                </h2>
                <div className="mt-3 divide-y divide-[#161212]/[0.06]">
                  <ToggleRow
                    label="Open Gmac at login"
                    description="Launch Gmac automatically when you sign in to macOS."
                    checked={settings.openAtLogin}
                    onToggle={() => updateSettings({ openAtLogin: !settings.openAtLogin })}
                  />
                  <ToggleRow
                    label="Ask before quitting while games are running"
                    description="Quitting Gmac stops active Windows processes inside your PCs."
                    checked={settings.askBeforeQuitting}
                    onToggle={() =>
                      updateSettings({ askBeforeQuitting: !settings.askBeforeQuitting })
                    }
                  />
                  <ToggleRow
                    label="Show Gmac in menu bar"
                    description="Keep quick-launch shortcuts available from the macOS menu bar."
                    checked={settings.showMenuBarExtra}
                    onToggle={() =>
                      updateSettings({ showMenuBarExtra: !settings.showMenuBarExtra })
                    }
                  />

                  <div className="flex flex-col justify-between gap-2 pt-3 sm:flex-row sm:items-center">
                    <div>
                      <label
                        htmlFor="settings-preferred-terminal"
                        className="text-[13.5px] font-medium text-[#161212]"
                      >
                        Preferred Terminal
                      </label>
                      <div className="mt-0.5 text-[12px] text-[#5e5454]">
                        Application opened when launching a Wine shell for a PC.
                      </div>
                    </div>
                    <select
                      id="settings-preferred-terminal"
                      value={settings.preferredTerminal}
                      onChange={(event) =>
                        updateSettings({
                          preferredTerminal: event.target
                            .value as AppSettingsState['preferredTerminal']
                        })
                      }
                      className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[13px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:ring-2 focus:ring-[#713131]/35 focus:outline-none"
                    >
                      <option value="terminal">Terminal</option>
                      <option value="iterm">iTerm2</option>
                      <option value="ghostty">Ghostty</option>
                      <option value="warp">Warp</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#FAF9F8] p-5">
                <h2 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                  New PCs
                </h2>
                <div className="mt-4 space-y-4">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                      <label
                        htmlFor="settings-default-win"
                        className="text-[13.5px] font-medium text-[#161212]"
                      >
                        Default Windows Version
                      </label>
                      <div className="mt-0.5 text-[12px] text-[#5e5454]">
                        Initial compatibility target assigned when creating a new PC.
                      </div>
                    </div>
                    <select
                      id="settings-default-win"
                      value={settings.defaultWinVersion}
                      onChange={(event) =>
                        updateSettings({
                          defaultWinVersion: event.target
                            .value as AppSettingsState['defaultWinVersion']
                        })
                      }
                      className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[13px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:ring-2 focus:ring-[#713131]/35 focus:outline-none"
                    >
                      <option value="Windows 11">Windows 11</option>
                      <option value="Windows 10">Windows 10</option>
                      <option value="Windows 8.1">Windows 8.1</option>
                      <option value="Windows 7">Windows 7</option>
                    </select>
                  </div>

                  <div className="border-t border-[#161212]/[0.06] pt-3">
                    <div className="text-[13.5px] font-medium text-[#161212]">
                      Default PCs Location
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-[#161212]/[0.06]">
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#4a4242]">
                        {settings.defaultPcsLocation}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleChoosePcsFolder()}
                          className="app-no-drag cursor-pointer rounded-lg bg-[#FAF9F8] px-2.5 py-1 text-[12px] font-medium text-[#161212] transition-colors hover:bg-[#EFEBEB]"
                        >
                          Choose...
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleShowInFinder(settings.defaultPcsLocation)}
                          className="app-no-drag inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#FAF9F8] px-2.5 py-1 text-[12px] font-medium text-[#161212] transition-colors hover:bg-[#EFEBEB]"
                        >
                          <FolderOpenIcon className="h-3.5 w-3.5" />
                          <span>Finder</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'gaming' && (
            <>
              <div className="rounded-2xl bg-[#FAF9F8] p-5">
                <h2 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                  macOS Gaming
                </h2>
                <div className="mt-3 divide-y divide-[#161212]/[0.06]">
                  <ToggleRow
                    label="Open Steam when Gmac opens"
                    description="Start Steam in its assigned PC automatically on launch if installed."
                    checked={settings.openSteamAtLaunch}
                    onToggle={() =>
                      updateSettings({ openSteamAtLaunch: !settings.openSteamAtLaunch })
                    }
                  />
                  <ToggleRow
                    label="Game Mode for Windows games"
                    description="Mark Wine processes as games so macOS enables Game Mode in full screen."
                    checked={settings.gameModeEnabled}
                    onToggle={() =>
                      updateSettings({ gameModeEnabled: !settings.gameModeEnabled })
                    }
                  />
                  <ToggleRow
                    label="Fit full-screen games below the notch"
                    description="Expose the display area below the camera notch so UI stays unobstructed."
                    checked={settings.fitBelowNotch}
                    onToggle={() => updateSettings({ fitBelowNotch: !settings.fitBelowNotch })}
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-[#FAF9F8] p-5">
                <h2 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                  Default Graphics
                </h2>
                <div className="mt-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <label
                      htmlFor="settings-default-graphics"
                      className="text-[13.5px] font-medium text-[#161212]"
                    >
                      Default Graphics Backend
                    </label>
                    <div className="mt-0.5 text-[12px] text-[#5e5454]">
                      Global DirectX translation layer used for newly created PCs.
                    </div>
                  </div>
                  <select
                    id="settings-default-graphics"
                    value={settings.defaultGraphicsBackend}
                    onChange={(event) =>
                      void handleGraphicsBackendChange(
                        event.target.value as AppSettingsState['defaultGraphicsBackend']
                      )
                    }
                    className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[13px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:ring-2 focus:ring-[#713131]/35 focus:outline-none"
                  >
                    <option value="recommended">Automatic (Recommended)</option>
                    <option value="d3dMetal">D3DMetal</option>
                    <option value="dxmt">DXMT</option>
                    <option value="dxvk">DXVK</option>
                    <option value="wined3d">WineD3D</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {activeTab === 'graphics' && (
            <>
              <div className="rounded-2xl bg-[#FAF9F8] p-5">
                <h2 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                  Runtime Components
                </h2>
                <div className="mt-3 divide-y divide-[#161212]/[0.06]">
                  <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium text-[#161212]">Rosetta 2</div>
                      <div className="mt-0.5 text-[12px] text-[#5e5454]">
                        macOS x86_64 instruction translation required by Windows titles.
                      </div>
                    </div>
                    <StatusBadge installed={systemStatus?.rosettaInstalled ?? false} />
                  </div>

                  <div className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium text-[#161212]">
                        Gmac Windows Engine
                      </div>
                      <div className="mt-0.5 text-[12px] text-[#5e5454]">
                        Core compatibility runtime powering every Windows PC.
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <StatusBadge installed={systemStatus?.engineInstalled ?? false} />
                      {!systemStatus?.engineInstalled && (
                        <button
                          type="button"
                          disabled={isInstallingEngine}
                          onClick={() => void handleInstallEngine()}
                          className="app-no-drag inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#713131] px-3.5 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#5E2828] disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {isInstallingEngine && <SpinnerIcon className="h-3.5 w-3.5" />}
                          <span>{isInstallingEngine ? 'Installing...' : 'Install Engine'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium text-[#161212]">
                        Apple Game Porting Toolkit (DirectX 12)
                      </div>
                      <div className="mt-0.5 text-[12px] text-[#5e5454]">
                        {systemStatus?.detectedToolkitFile
                          ? `Detected disk image: ${systemStatus.detectedToolkitFile}`
                          : 'Required for DirectX 12 titles via Apple D3DMetal.'}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <StatusBadge installed={systemStatus?.toolkitInstalled ?? false} />
                      <button
                        type="button"
                        disabled={isInstallingToolkit}
                        onClick={() => void handleImportToolkit()}
                        className="app-no-drag inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {isInstallingToolkit && <SpinnerIcon className="h-3.5 w-3.5" />}
                        <span>
                          {isInstallingToolkit
                            ? 'Importing...'
                            : systemStatus?.toolkitInstalled
                              ? 'Re-import (.dmg)'
                              : 'Import Toolkit (.dmg)'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {onOpenOnboarding && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#FAF9F8] p-5">
                  <div>
                    <div className="text-[13.5px] font-semibold text-[#161212]">Setup Wizard</div>
                    <div className="mt-0.5 text-[12.5px] text-[#5e5454]">
                      Re-run first-time setup to inspect engine downloads, GPTK import, or PC migration.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenOnboarding}
                    className="app-no-drag inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:text-[#713131]"
                  >
                    <SettingsGearIcon className="h-4 w-4" />
                    <span>Open Setup Wizard</span>
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'storage' && (
            <>
              <div className="rounded-2xl bg-[#FAF9F8] p-5">
                <h2 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                  Logs &amp; Folders
                </h2>
                <div className="mt-4 space-y-4">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                      <label
                        htmlFor="settings-log-retention"
                        className="text-[13.5px] font-medium text-[#161212]"
                      >
                        Keep Wine Logs For
                      </label>
                      <div className="mt-0.5 text-[12px] text-[#5e5454]">
                        Older launch diagnostic logs are cleaned up automatically.
                      </div>
                    </div>
                    <select
                      id="settings-log-retention"
                      value={settings.logRetentionDays}
                      onChange={(event) =>
                        updateSettings({
                          logRetentionDays: Number(
                            event.target.value
                          ) as AppSettingsState['logRetentionDays']
                        })
                      }
                      className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[13px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:ring-2 focus:ring-[#713131]/35 focus:outline-none"
                    >
                      <option value={1}>1 day</option>
                      <option value={7}>1 week</option>
                      <option value={30}>1 month</option>
                      <option value={0}>Forever</option>
                    </select>
                  </div>

                  <div className="divide-y divide-[#161212]/[0.06] border-t border-[#161212]/[0.06] pt-3">
                    <div className="flex items-center justify-between gap-4 py-2.5">
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium text-[#161212]">PCs Folder</div>
                        <div className="mt-0.5 truncate font-mono text-[12px] text-[#5e5454]">
                          {settings.defaultPcsLocation}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleShowInFinder(settings.defaultPcsLocation)}
                        className="app-no-drag inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF]"
                      >
                        <FolderOpenIcon className="h-3.5 w-3.5" />
                        <span>Show in Finder</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-2.5">
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium text-[#161212]">Logs Folder</div>
                        <div className="mt-0.5 truncate font-mono text-[12px] text-[#5e5454]">
                          {DEFAULT_LOGS_LOCATION}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleShowInFinder(DEFAULT_LOGS_LOCATION)}
                        className="app-no-drag inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF]"
                      >
                        <FolderOpenIcon className="h-3.5 w-3.5" />
                        <span>Show in Finder</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-[#FAF9F8] p-5">
                <h2 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                  Maintenance
                </h2>
                <div className="mt-3 divide-y divide-[#161212]/[0.06]">
                  <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
                    <div>
                      <div className="text-[13.5px] font-medium text-[#161212]">Shader Caches</div>
                      <div className="mt-0.5 text-[12px] text-[#5e5454]">
                        Games rebuild shaders as they run, so the first minutes after clearing may stutter.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmClearShaders(true)}
                      className="app-no-drag shrink-0 cursor-pointer rounded-xl bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF]"
                    >
                      Clear...
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-3">
                    <div>
                      <div className="text-[13.5px] font-medium text-[#161212]">
                        Reset Local UI Preferences
                      </div>
                      <div className="mt-0.5 text-[12px] text-[#5e5454]">
                        Restore Gmac settings, per-game overrides, PC configurations, and favorites.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmResetPrefs(true)}
                      className="app-no-drag shrink-0 cursor-pointer rounded-xl bg-red-500/[0.08] px-3.5 py-1.5 text-[12.5px] font-medium text-red-600 transition-colors hover:bg-red-500/[0.14]"
                    >
                      Reset...
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'updates' && (
            <>
              <div className="rounded-2xl bg-[#FAF9F8] p-5">
                <h2 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                  Automatic Updates
                </h2>
                <div className="mt-3 divide-y divide-[#161212]/[0.06]">
                  <ToggleRow
                    label="Check for Gmac updates automatically"
                    description="Download and prompt when new desktop releases are published."
                    checked={settings.autoCheckAppUpdates}
                    onToggle={() =>
                      updateSettings({ autoCheckAppUpdates: !settings.autoCheckAppUpdates })
                    }
                  />
                  <ToggleRow
                    label="Check for Gmac Windows Engine updates automatically"
                    description="Keep Wine compatibility and graphics translation payloads up to date."
                    checked={settings.autoCheckEngineUpdates}
                    onToggle={() =>
                      updateSettings({ autoCheckEngineUpdates: !settings.autoCheckEngineUpdates })
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-[#FAF9F8] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[15px] font-semibold text-[#161212]">
                      {appInfo?.name ?? 'Gmac'}
                    </h2>
                    <div className="mt-0.5 text-[12.5px] text-[#5e5454] tabular-nums">
                      Version {appInfo?.version ?? '0.1.0'} &middot; macOS ({appInfo?.arch ?? 'arm64'})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleOpenGitHub()}
                    className="app-no-drag inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:text-[#713131]"
                  >
                    <span>View on GitHub</span>
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                {appInfo && (
                  <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-[#161212]/[0.06] pt-4 text-[12.5px]">
                    <div>
                      <dt className="text-[#5e5454]">Electron</dt>
                      <dd className="mt-0.5 font-medium text-[#161212] tabular-nums">
                        {appInfo.versions.electron}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5e5454]">Chromium</dt>
                      <dd className="mt-0.5 font-medium text-[#161212] tabular-nums">
                        {appInfo.versions.chrome}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#5e5454]">Node.js</dt>
                      <dd className="mt-0.5 font-medium text-[#161212] tabular-nums">
                        {appInfo.versions.node}
                      </dd>
                    </div>
                  </dl>
                )}

                <p className="mt-4 border-t border-[#161212]/[0.06] pt-3 text-[12px] text-[#5e5454]">
                  Released under the GNU General Public License v3.0. Fork of Whisky.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {confirmClearShaders && (
        <div
          className="app-no-drag fixed inset-0 z-50 flex items-center justify-center bg-[#161212]/28 px-4 backdrop-blur-[4px]"
          onClick={() => setConfirmClearShaders(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-shaders-title"
            className="animate-context-in w-full max-w-sm rounded-[22px] bg-white p-6 shadow-[0_24px_64px_rgba(22,18,18,0.22)] ring-1 ring-[#161212]/[0.06]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="clear-shaders-title" className="text-[18px] font-bold text-[#161212]">
              Clear shader caches?
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#5e5454]">
              Running PCs will be stopped before clearing compiled graphics caches.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearShaders(false)}
                className="cursor-pointer rounded-xl px-4 py-2 text-[13px] font-medium text-[#5e5454] transition-colors hover:bg-[#161212]/[0.05] hover:text-[#161212]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearShaders}
                className="cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-red-700"
              >
                Stop PCs and Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmResetPrefs && (
        <div
          className="app-no-drag fixed inset-0 z-50 flex items-center justify-center bg-[#161212]/28 px-4 backdrop-blur-[4px]"
          onClick={() => setConfirmResetPrefs(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-prefs-title"
            className="animate-context-in w-full max-w-sm rounded-[22px] bg-white p-6 shadow-[0_24px_64px_rgba(22,18,18,0.22)] ring-1 ring-[#161212]/[0.06]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="reset-prefs-title" className="text-[18px] font-bold text-[#161212]">
              Reset local UI preferences?
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#5e5454]">
              This restores default app settings, per-game overrides, PC configurations, and clears Home favorites.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmResetPrefs(false)}
                className="cursor-pointer rounded-xl px-4 py-2 text-[13px] font-medium text-[#5e5454] transition-colors hover:bg-[#161212]/[0.05] hover:text-[#161212]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetPrefs}
                className="cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-red-700"
              >
                Reset Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
