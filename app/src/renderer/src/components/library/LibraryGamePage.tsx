import { useEffect, useMemo, useRef, useState } from 'react'
import type { HomeGameItem, StatPoint } from '../../../../shared/ipc'
import { SpinnerIcon } from '../icons/OnboardingIcons'
import { HeartIcon, PcIcon, PlayTriangleIcon, SettingsGearIcon } from '../icons/SidebarIcons'
import { StatSparkline } from '../shared/StatSparkline'

interface LibraryGamePageProps {
  game: HomeGameItem
  isFavorite: boolean
  isLaunching: boolean
  errorMessage: string | null
  onToggleFavorite: () => void
  onPlay: (game: HomeGameItem) => void
  onOpenPc: (bottlePath: string) => void
}

type DetailTab = 'overview' | 'settings' | 'pc'

type GameGraphicsBackend = 'inherit' | 'recommended' | 'd3dMetal' | 'dxmt' | 'dxvk' | 'wined3d'
type EnhancedSyncMode = 'inherit' | 'msync' | 'esync' | 'off'

interface GameSettingsState {
  graphicsBackend: GameGraphicsBackend
  metal4Enabled: boolean
  shaderCacheEnabled: boolean
  metalHud: boolean
  launchArguments: string
  locale: string
  enhancedSync: EnhancedSyncMode
  virtualDesktop: boolean
  virtualDesktopResolution: '1920x1080' | '2560x1440' | '3840x2160'
  controllerCompatMode: boolean
}

const DEFAULT_GAME_SETTINGS: GameSettingsState = {
  graphicsBackend: 'inherit',
  metal4Enabled: true,
  shaderCacheEnabled: true,
  metalHud: false,
  launchArguments: '',
  locale: 'auto',
  enhancedSync: 'inherit',
  virtualDesktop: false,
  virtualDesktopResolution: '1920x1080',
  controllerCompatMode: false
}

const LOCALE_OPTIONS = [
  { value: 'auto', label: 'System Default' },
  { value: 'en_US', label: 'English' },
  { value: 'ja_JP', label: 'Japanese' },
  { value: 'ko_KR', label: 'Korean' },
  { value: 'zh_CN', label: 'Simplified Chinese' },
  { value: 'zh_TW', label: 'Traditional Chinese' },
  { value: 'de_DE', label: 'German' },
  { value: 'fr_FR', label: 'French' },
  { value: 'es_ES', label: 'Spanish' }
] as const

function loadGameSettings(gameId: string): GameSettingsState {
  try {
    const raw = window.localStorage.getItem(`gmac.gameSettings.${gameId}`)
    if (!raw) {
      return { ...DEFAULT_GAME_SETTINGS }
    }
    const parsed = JSON.parse(raw) as Partial<GameSettingsState>
    return { ...DEFAULT_GAME_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_GAME_SETTINGS }
  }
}

function formatDetailPlaytime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 min'
  }
  if (seconds < 60) {
    return '< 1 min'
  }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = seconds / 3600
  if (hours < 100) {
    return `${hours.toFixed(1)} hrs`
  }
  return `${Math.round(hours)} hrs`
}

function formatLastPlayed(iso: string | null): string {
  if (!iso) {
    return 'Never'
  }
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) {
    return 'Recently'
  }
  const diffHours = (Date.now() - timestamp) / 3_600_000
  if (diffHours < 24) {
    return 'Today'
  }
  if (diffHours < 48) {
    return 'Yesterday'
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(timestamp))
}

function buildGamePlaytimeHistory(game: HomeGameItem): StatPoint[] {
  const totalHours = Math.max(0, game.totalPlaytimeSeconds / 3600)
  const dayOffsets = [-30, -24, -18, -12, -7, -3, 0]
  const now = Date.now()

  if (totalHours <= 0) {
    return dayOffsets.map((offset) => ({
      date: new Date(now + offset * 86_400_000).toISOString(),
      value: 0
    }))
  }

  const recentHours = Math.min(totalHours, Math.max(0, game.lastTwoWeeksSeconds / 3600))
  const preRecentHours = Math.max(totalHours * 0.35, totalHours - recentHours)
  const fractions = [
    preRecentHours * 0.45,
    preRecentHours * 0.62,
    preRecentHours * 0.82,
    preRecentHours,
    preRecentHours + recentHours * 0.32,
    preRecentHours + recentHours * 0.68,
    totalHours
  ]

  return dayOffsets.map((offset, index) => ({
    date: new Date(now + offset * 86_400_000).toISOString(),
    value: Number(fractions[index].toFixed(2))
  }))
}

interface SettingToggleRowProps {
  label: string
  description: string
  checked: boolean
  onToggle: () => void
}

function SettingToggleRow({ label, description, checked, onToggle }: SettingToggleRowProps) {
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

export function LibraryGamePage({
  game,
  isFavorite,
  isLaunching,
  errorMessage,
  onToggleFavorite,
  onPlay,
  onOpenPc
}: LibraryGamePageProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [settings, setSettings] = useState<GameSettingsState>(() => loadGameSettings(game.id))
  const [savedNoticeVisible, setSavedNoticeVisible] = useState(false)
  const savedTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setSettings(loadGameSettings(game.id))
    setSavedNoticeVisible(false)
  }, [game.id])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current)
      }
    }
  }, [])

  const updateSettings = (patch: Partial<GameSettingsState>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch }
      try {
        window.localStorage.setItem(`gmac.gameSettings.${game.id}`, JSON.stringify(next))
      } catch {
        // Ignore storage quota errors in restricted modes.
      }
      return next
    })
    setSavedNoticeVisible(true)
    if (savedTimerRef.current !== null) {
      window.clearTimeout(savedTimerRef.current)
    }
    savedTimerRef.current = window.setTimeout(() => {
      savedTimerRef.current = null
      setSavedNoticeVisible(false)
    }, 1500)
  }

  const resetSettings = () => {
    const fresh = { ...DEFAULT_GAME_SETTINGS }
    setSettings(fresh)
    try {
      window.localStorage.removeItem(`gmac.gameSettings.${game.id}`)
    } catch {
      // Ignore storage errors.
    }
    setSavedNoticeVisible(true)
    if (savedTimerRef.current !== null) {
      window.clearTimeout(savedTimerRef.current)
    }
    savedTimerRef.current = window.setTimeout(() => {
      savedTimerRef.current = null
      setSavedNoticeVisible(false)
    }, 1500)
  }

  const playtimeHistory = useMemo(() => buildGamePlaytimeHistory(game), [game])

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="relative flex min-h-[296px] w-full flex-col items-center justify-center overflow-hidden bg-[#1D1414]">
        {game.artworkDataUrl ? (
          <>
            <img
              src={game.artworkDataUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#161212]/78" />
          </>
        ) : (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#241515] via-[#5a2828] to-[#713131]" />
        )}

        <div className="relative z-10 flex w-full max-w-[780px] items-center justify-center px-9 pt-12 pb-6">
          {game.logoDataUrl ? (
            <img
              src={game.logoDataUrl}
              alt={game.name}
              className="max-h-[138px] max-w-[440px] object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.58)]"
            />
          ) : (
            <h1 className="text-center text-[38px] leading-tight font-extrabold tracking-[-0.035em] text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]">
              {game.name}
            </h1>
          )}
        </div>
      </div>

      <div className="border-b border-[#161212]/[0.06] bg-[#FAF9F8] px-9 py-4">
        <div className="mx-auto flex w-full max-w-[1040px] flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              disabled={isLaunching}
              onClick={() => onPlay(game)}
              className="app-no-drag inline-flex cursor-pointer items-center gap-2.5 rounded-xl bg-[#007AFF] px-8 py-2.5 text-[14.5px] font-semibold text-white shadow-[0_6px_16px_rgba(0,122,255,0.3)] transition-all duration-150 hover:bg-[#0066D6] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLaunching ? (
                <SpinnerIcon className="h-4 w-4" />
              ) : (
                <PlayTriangleIcon className="h-4 w-4" />
              )}
              <span>{isLaunching ? 'Launching...' : 'Play'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-6 text-[12.5px]">
              <div>
                <div className="text-[10.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                  Last Played
                </div>
                <div className="mt-0.5 font-semibold text-[#161212]">
                  {formatLastPlayed(game.lastPlayedIso)}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                  Play Time
                </div>
                <div className="mt-0.5 font-semibold text-[#161212] tabular-nums">
                  {formatDetailPlaytime(game.totalPlaytimeSeconds)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenPc(game.bottlePath)}
                className="app-no-drag group cursor-pointer text-left"
              >
                <div className="text-[10.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                  PC
                </div>
                <div className="mt-0.5 font-semibold text-[#713131] group-hover:underline">
                  {game.bottleName}
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Game settings"
              title="Game settings"
              aria-pressed={activeTab === 'settings'}
              onClick={() => setActiveTab((tab) => (tab === 'settings' ? 'overview' : 'settings'))}
              className={`app-no-drag inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                activeTab === 'settings'
                  ? 'bg-[#713131]/[0.12] text-[#713131]'
                  : 'bg-[#161212]/[0.05] text-[#4a4242] hover:bg-[#161212]/[0.1] hover:text-[#161212]'
              }`}
            >
              <SettingsGearIcon className="h-[17px] w-[17px]" />
            </button>

            <button
              type="button"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={isFavorite}
              onClick={onToggleFavorite}
              className={`app-no-drag inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                isFavorite
                  ? 'bg-[#713131]/[0.12] text-[#713131]'
                  : 'bg-[#161212]/[0.05] text-[#4a4242] hover:bg-[#161212]/[0.1] hover:text-[#713131]'
              }`}
            >
              <HeartIcon className="h-[17px] w-[17px]" filled={isFavorite} />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1040px] px-9 pt-4 pb-16">
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-500/20 bg-red-50/90 px-4 py-2.5 text-[13px] text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <div className="text-[12.5px] font-medium text-[#5e5454]">
          Installed on <span className="font-semibold text-[#161212]">{game.bottleName}</span>
        </div>

        <nav
          aria-label="Game sections"
          className="mt-4 flex items-center gap-6 border-b border-[#161212]/[0.07]"
        >
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'settings', label: 'Settings' },
              { id: 'pc', label: 'PC Details' }
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

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                  Activity
                </h2>
                <div className="mt-2.5 space-y-3">
                  <div className="rounded-2xl bg-[#FAF9F8] px-5 py-4">
                    <div className="text-[11.5px] font-semibold text-[#713131] uppercase">
                      {formatLastPlayed(game.lastPlayedIso)}
                    </div>
                    <div className="mt-1 text-[13.5px] font-semibold text-[#161212]">
                      {game.totalPlaytimeSeconds > 0
                        ? `Played ${formatDetailPlaytime(game.totalPlaytimeSeconds)} total on ${game.bottleName}`
                        : `Installed on ${game.bottleName} with no recorded sessions yet`}
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-[#5e5454]">
                      {game.launchKind === 'steam'
                        ? 'Launched through Steam inside this PC.'
                        : 'Launched directly as a Windows executable.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-semibold text-[#161212]">Game Settings</h2>
                    <p className="mt-0.5 text-[12.5px] text-[#5e5454]">
                      Override PC defaults when launching {game.name}.
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {savedNoticeVisible && (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11.5px] font-medium text-emerald-700">
                        Saved
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={resetSettings}
                      className="app-no-drag cursor-pointer rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-[#5e5454] transition-colors hover:bg-[#161212]/[0.06] hover:text-[#161212]"
                    >
                      Reset to PC Defaults
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#FAF9F8] p-5">
                  <h3 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                    Graphics &amp; Rendering
                  </h3>
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div>
                        <label
                          htmlFor="game-graphics-backend"
                          className="text-[13.5px] font-medium text-[#161212]"
                        >
                          Graphics Backend
                        </label>
                        <div className="mt-0.5 text-[12px] text-[#5e5454]">
                          Choose which DirectX translation layer this title uses.
                        </div>
                      </div>
                      <select
                        id="game-graphics-backend"
                        value={settings.graphicsBackend}
                        onChange={(event) =>
                          updateSettings({
                            graphicsBackend: event.target.value as GameGraphicsBackend
                          })
                        }
                        className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[13px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:ring-2 focus:ring-[#713131]/35 focus:outline-none"
                      >
                        <option value="inherit">Inherit from PC</option>
                        <option value="recommended">Automatic</option>
                        <option value="d3dMetal">D3DMetal</option>
                        <option value="dxmt">DXMT</option>
                        <option value="dxvk">DXVK</option>
                        <option value="wined3d">WineD3D</option>
                      </select>
                    </div>

                    <div className="divide-y divide-[#161212]/[0.06] border-t border-[#161212]/[0.06] pt-3">
                      <SettingToggleRow
                        label="Metal 4 (DirectX 12)"
                        description="Use Metal 4 command encoding for D3D12 titles when supported."
                        checked={settings.metal4Enabled}
                        onToggle={() =>
                          updateSettings({ metal4Enabled: !settings.metal4Enabled })
                        }
                      />
                      <SettingToggleRow
                        label="Shader Cache"
                        description="Keep compiled shaders on disk to reduce in-game stutter."
                        checked={settings.shaderCacheEnabled}
                        onToggle={() =>
                          updateSettings({ shaderCacheEnabled: !settings.shaderCacheEnabled })
                        }
                      />
                      <SettingToggleRow
                        label="Metal Performance HUD"
                        description="Show live FPS and GPU timing overlay while playing."
                        checked={settings.metalHud}
                        onToggle={() => updateSettings({ metalHud: !settings.metalHud })}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#FAF9F8] p-5">
                  <h3 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                    Launch Options &amp; Environment
                  </h3>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label
                        htmlFor="game-launch-args"
                        className="block text-[13.5px] font-medium text-[#161212]"
                      >
                        Launch Arguments
                      </label>
                      <input
                        id="game-launch-args"
                        type="text"
                        value={settings.launchArguments}
                        onChange={(event) =>
                          updateSettings({ launchArguments: event.target.value })
                        }
                        placeholder="e.g. -windowed -skipintro"
                        className="app-no-drag mt-1.5 w-full rounded-xl bg-white px-3.5 py-2 text-[13px] text-[#161212] placeholder-[#5e5454]/45 ring-1 ring-[#161212]/[0.08] focus:ring-2 focus:ring-[#713131]/35 focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div>
                        <label
                          htmlFor="game-locale"
                          className="text-[13.5px] font-medium text-[#161212]"
                        >
                          Windows Locale
                        </label>
                        <div className="mt-0.5 text-[12px] text-[#5e5454]">
                          Locale reported to the game for text and save encoding.
                        </div>
                      </div>
                      <select
                        id="game-locale"
                        value={settings.locale}
                        onChange={(event) => updateSettings({ locale: event.target.value })}
                        className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[13px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:ring-2 focus:ring-[#713131]/35 focus:outline-none"
                      >
                        {LOCALE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div>
                        <div className="text-[13.5px] font-medium text-[#161212]">Enhanced Sync</div>
                        <div className="mt-0.5 text-[12px] text-[#5e5454]">
                          Thread synchronization method used by the compatibility runtime.
                        </div>
                      </div>
                      <div className="inline-flex rounded-xl bg-white p-1 ring-1 ring-[#161212]/[0.08]">
                        {(
                          [
                            { id: 'inherit', label: 'Inherit' },
                            { id: 'msync', label: 'MSync' },
                            { id: 'esync', label: 'ESync' },
                            { id: 'off', label: 'Off' }
                          ] as const
                        ).map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => updateSettings({ enhancedSync: mode.id })}
                            className={`app-no-drag cursor-pointer rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors ${
                              settings.enhancedSync === mode.id
                                ? 'bg-[#713131] text-white'
                                : 'text-[#5e5454] hover:text-[#161212]'
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#FAF9F8] p-5">
                  <h3 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                    Display &amp; Controller
                  </h3>
                  <div className="mt-3 divide-y divide-[#161212]/[0.06]">
                    <div className="pb-3">
                      <SettingToggleRow
                        label="Virtual Desktop"
                        description="Run this game inside a fixed-size Windows desktop window."
                        checked={settings.virtualDesktop}
                        onToggle={() =>
                          updateSettings({ virtualDesktop: !settings.virtualDesktop })
                        }
                      />
                      {settings.virtualDesktop && (
                        <div className="mt-2.5 flex items-center justify-between gap-4 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-[#161212]/[0.06]">
                          <span className="text-[12.5px] font-medium text-[#4a4242]">
                            Desktop Resolution
                          </span>
                          <select
                            aria-label="Desktop resolution"
                            value={settings.virtualDesktopResolution}
                            onChange={(event) =>
                              updateSettings({
                                virtualDesktopResolution: event.target
                                  .value as GameSettingsState['virtualDesktopResolution']
                              })
                            }
                            className="app-no-drag cursor-pointer rounded-lg bg-[#FAF9F8] px-2.5 py-1 text-[12.5px] font-medium text-[#161212] focus:outline-none"
                          >
                            <option value="1920x1080">1920 x 1080</option>
                            <option value="2560x1440">2560 x 1440</option>
                            <option value="3840x2160">3840 x 2160</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="pt-3">
                      <SettingToggleRow
                        label="Controller Compatibility Mode"
                        description="Force legacy XInput mapping if native controller buttons behave unexpectedly."
                        checked={settings.controllerCompatMode}
                        onToggle={() =>
                          updateSettings({
                            controllerCompatMode: !settings.controllerCompatMode
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pc' && (
              <div className="rounded-2xl bg-[#FAF9F8] p-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-[14px] font-semibold text-[#161212]">PC Environment</h2>
                  <button
                    type="button"
                    onClick={() => onOpenPc(game.bottlePath)}
                    className="app-no-drag cursor-pointer text-[12.5px] font-medium text-[#713131] hover:underline"
                  >
                    Open PC
                  </button>
                </div>
                <dl className="mt-4 space-y-3 text-[13px]">
                  <div>
                    <dt className="text-[#5e5454]">PC Name</dt>
                    <dd className="mt-0.5 font-medium text-[#161212]">{game.bottleName}</dd>
                  </div>
                  <div>
                    <dt className="text-[#5e5454]">Container Path</dt>
                    <dd className="mt-0.5 break-all font-mono text-[12px] text-[#4a4242]">
                      {game.bottlePath}
                    </dd>
                  </div>
                  {game.steamAppId != null && (
                    <div>
                      <dt className="text-[#5e5454]">Steam App ID</dt>
                      <dd className="mt-0.5 font-medium text-[#161212] tabular-nums">
                        {game.steamAppId}
                      </dd>
                    </div>
                  )}
                  {game.programPath && (
                    <div>
                      <dt className="text-[#5e5454]">Executable</dt>
                      <dd className="mt-0.5 break-all font-mono text-[12px] text-[#4a4242]">
                        {game.programPath}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-[#FAF9F8] p-5">
              <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                <span>PC</span>
                <PcIcon className="h-4 w-4 text-[#713131]" />
              </div>
              <div className="mt-2.5 text-[16px] font-bold tracking-[-0.02em] text-[#161212]">
                {game.bottleName}
              </div>
              <div className="mt-1 text-[12.5px] text-[#5e5454]">
                {game.launchKind === 'steam' ? 'Steam library' : 'Windows executable'}
              </div>
              <button
                type="button"
                onClick={() => onOpenPc(game.bottlePath)}
                className="app-no-drag mt-3.5 inline-flex cursor-pointer items-center text-[12.5px] font-medium text-[#713131] hover:underline"
              >
                Open PC settings &rarr;
              </button>
            </div>

            <div className="rounded-2xl bg-[#FAF9F8] p-5">
              <div className="text-[11px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                Playtime
              </div>
              <div className="mt-2.5 text-[16px] font-bold tracking-[-0.02em] text-[#161212] tabular-nums">
                {formatDetailPlaytime(game.totalPlaytimeSeconds)} total
              </div>
              <StatSparkline points={playtimeHistory} className="mt-3 h-[54px] w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
