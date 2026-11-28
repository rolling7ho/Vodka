import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type {
  BottleConfig,
  BottleSummary,
  HomeGameItem,
  HomeLauncherItem
} from '../../../../shared/ipc'
import { LauncherBrandImage } from '../icons/LauncherLogos'
import { GameControllerIcon, SpinnerIcon } from '../icons/OnboardingIcons'
import { PcGlyph } from '../icons/PcIcons'
import {
  ChevronDownIcon,
  FolderOpenIcon,
  PencilIcon,
  PlayTriangleIcon,
  SearchIcon,
  TrashIcon
} from '../icons/SidebarIcons'
import { AudioConfigCard } from './AudioConfigCard'
import { DllOverridesEditor } from './DllOverridesEditor'
import { PinsPanel } from './PinsPanel'
import { ProcessesPanel } from './ProcessesPanel'
import { WinetricksPanel } from './WinetricksPanel'

interface PcPageProps {
  pc: BottleSummary
  games: HomeGameItem[]
  launchers: HomeLauncherItem[]
  launchingId: string | null
  errorMessage: string | null
  isManagedPc: boolean
  onPlayGame: (game: HomeGameItem) => void
  onOpenGame: (gameId: string) => void
  onOpenLauncher: (launcher: HomeLauncherItem) => void
  onRunExecutable: (pc: BottleSummary, programPath: string) => Promise<void>
  onRequestChangeIcon: (pc: BottleSummary) => void
  onRenamePc: (path: string, newName: string) => Promise<void>
  onRequestDeletePc: (pc: BottleSummary) => void
}

type PcTab = 'overview' | 'configuration' | 'processes' | 'winetricks' | 'pins' | 'games'

type PcConfigState = BottleConfig

function buildDefaultPcConfig(pc: BottleSummary): PcConfigState {
  const validBackends = ['recommended', 'd3dMetal', 'dxmt', 'dxvk', 'wined3d'] as const
  const backend = validBackends.includes(pc.graphicsBackend as PcConfigState['graphicsBackend'])
    ? (pc.graphicsBackend as PcConfigState['graphicsBackend'])
    : 'recommended'

  const validVersions = ['Windows 11', 'Windows 10', 'Windows 8.1', 'Windows 7'] as const
  const winVersion = validVersions.includes(pc.windowsVersion as PcConfigState['windowsVersion'])
    ? (pc.windowsVersion as PcConfigState['windowsVersion'])
    : 'Windows 10'

  return {
    windowsVersion: winVersion,
    enhancedSync: 'msync',
    avxEnabled: true,
    graphicsBackend: backend,
    metalHud: false,
    dxrEnabled: true,
    shaderCacheEnabled: true,
    retinaMode: false,
    virtualDesktop: false,
    virtualDesktopResolution: '1920x1080',
    controllerCompatMode: false,
    dxvk: false,
    dxvkAsync: true,
    dxvkHud: 'off',
    dpi: 96,
    dllOverrides: [],
    audioDriver: 'auto',
    audioLatencyPreset: 'defaultPreset',
    outputDeviceMode: 'followSystem',
    pinnedDeviceName: null
  }
}

function loadPcConfig(pc: BottleSummary): PcConfigState {
  const defaults = buildDefaultPcConfig(pc)
  try {
    const raw = window.localStorage.getItem(`gmac.pcConfig.${pc.path}`)
    if (!raw) {
      return defaults
    }
    return { ...defaults, ...(JSON.parse(raw) as Partial<PcConfigState>) }
  } catch {
    return defaults
  }
}

function formatTotalPlaytime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 hrs'
  }
  if (seconds < 3600) {
    return `${Math.max(1, Math.round(seconds / 60))} min`
  }
  const hours = seconds / 3600
  return hours < 100 ? `${hours.toFixed(1)} hrs` : `${Math.round(hours)} hrs`
}

function formatBackendLabel(backend: string): string {
  switch (backend) {
    case 'd3dMetal':
      return 'D3DMetal'
    case 'dxmt':
      return 'DXMT'
    case 'dxvk':
      return 'DXVK'
    case 'wined3d':
      return 'WineD3D'
    case 'recommended':
    default:
      return 'Recommended'
  }
}

interface ConfigSwitchRowProps {
  label: string
  description: string
  checked: boolean
  onToggle: () => void
}

function ConfigSwitchRow({ label, description, checked, onToggle }: ConfigSwitchRowProps) {
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

export function PcPage({
  pc,
  games,
  launchers,
  launchingId,
  errorMessage,
  isManagedPc,
  onPlayGame,
  onOpenGame,
  onOpenLauncher,
  onRunExecutable,
  onRequestChangeIcon,
  onRenamePc,
  onRequestDeletePc
}: PcPageProps) {
  const [activeTab, setActiveTab] = useState<PcTab>('overview')
  const [config, setConfig] = useState<PcConfigState>(() => loadPcConfig(pc))
  const [searchQuery, setSearchQuery] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState(pc.name)
  const [copiedPath, setCopiedPath] = useState(false)
  const [savedNoticeVisible, setSavedNoticeVisible] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  const renameInputRef = useRef<HTMLInputElement>(null)
  const savedTimerRef = useRef<number | null>(null)
  const copyTimerRef = useRef<number | null>(null)
  const noticeTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setConfig(loadPcConfig(pc))
    setRenameDraft(pc.name)
    setIsRenaming(false)
    setSearchQuery('')
    setActionNotice(null)

    if (!isManagedPc || !window.gmac) {
      return
    }
    let cancelled = false
    void window.gmac
      .getBottleConfig(pc.path)
      .then((loaded) => {
        if (!cancelled) {
          setConfig(loaded)
        }
      })
      .catch(() => {
        // Fall back to cached local config.
      })

    return () => {
      cancelled = true
    }
  }, [pc, isManagedPc])

  useEffect(() => {
    if (!isRenaming) {
      return
    }
    requestAnimationFrame(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    })
  }, [isRenaming])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current)
      }
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
      }
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current)
      }
    }
  }, [])

  const pcGames = useMemo(
    () =>
      games.filter(
        (game) => game.bottlePath === pc.path || game.bottleName === pc.name
      ),
    [games, pc.path, pc.name]
  )

  const pcLaunchers = useMemo(
    () =>
      launchers.filter(
        (launcher) =>
          launcher.installed &&
          (launcher.bottlePath === pc.path || launcher.bottleName === pc.name)
      ),
    [launchers, pc.path, pc.name]
  )

  const filteredPcGames = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const base = [...pcGames].sort((a, b) => a.name.localeCompare(b.name))
    if (!query) {
      return base
    }
    return base.filter((game) => game.name.toLowerCase().includes(query))
  }, [pcGames, searchQuery])

  const totalPlaytimeSeconds = useMemo(
    () => pcGames.reduce((sum, game) => sum + game.totalPlaytimeSeconds, 0),
    [pcGames]
  )

  const updateConfig = (patch: Partial<PcConfigState>) => {
    setConfig((previous) => {
      const next = { ...previous, ...patch }
      try {
        window.localStorage.setItem(`gmac.pcConfig.${pc.path}`, JSON.stringify(next))
      } catch {
        // Ignore storage errors.
      }
      return next
    })
    if (isManagedPc && window.gmac) {
      void window.gmac.updateBottleConfig(pc.path, patch).catch(() => {
        // Ignore bridge persistence error in offline/fresh mode.
      })
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

  const handleRenameSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = renameDraft.trim()
    setIsRenaming(false)
    if (!trimmed || trimmed === pc.name) {
      setRenameDraft(pc.name)
      return
    }
    await onRenamePc(pc.path, trimmed)
  }

  const showTransientNotice = (message: string) => {
    setActionNotice(message)
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current)
    }
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null
      setActionNotice(null)
    }, 2400)
  }

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(pc.path)
      setCopiedPath(true)
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
      }
      copyTimerRef.current = window.setTimeout(() => {
        copyTimerRef.current = null
        setCopiedPath(false)
      }, 1400)
    } catch {
      // Clipboard unavailable.
    }
  }

  const handleRunProgramClick = async () => {
    if (!pc.isAvailable || launchingId !== null) {
      return
    }
    const picked = await window.gmac?.pickExecutableFile(`${pc.path}/drive_c`)
    if (picked) {
      await onRunExecutable(pc, picked)
    }
  }

  const handleShowInFinder = async (targetPath: string) => {
    const result = await window.gmac?.showInFinder(targetPath)
    if (!result?.opened) {
      showTransientNotice(`Folder not available on disk: ${targetPath}`)
    }
  }

  const handleResetPcConfig = () => {
    const fresh = buildDefaultPcConfig(pc)
    setConfig(fresh)
    try {
      window.localStorage.removeItem(`gmac.pcConfig.${pc.path}`)
    } catch {
      // Ignore storage errors.
    }
    if (isManagedPc && window.gmac) {
      void window.gmac.updateBottleConfig(pc.path, fresh).catch(() => {
        // Ignore bridge persistence error.
      })
    }
    showTransientNotice('PC configuration restored to defaults.')
  }

  const renderGameCard = (game: HomeGameItem) => {
    const isLaunching = launchingId === game.id
    return (
      <div
        key={game.id}
        role="button"
        tabIndex={0}
        aria-label={`Open ${game.name} in Library`}
        onClick={() => onOpenGame(game.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpenGame(game.id)
          }
        }}
        className="app-no-drag group relative aspect-video cursor-pointer overflow-hidden rounded-2xl bg-[#1C1414] shadow-[0_6px_18px_rgba(22,18,18,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(22,18,18,0.15)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#713131]/60"
      >
        {game.artworkDataUrl ? (
          <img
            src={game.artworkDataUrl}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2B1B1B] to-[#4A2525] text-white/30">
            <GameControllerIcon className="h-9 w-9" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/72" />

        <div className="pointer-events-none absolute top-3.5 left-3.5 z-10 max-w-[180px]">
          {game.logoDataUrl ? (
            <img
              src={game.logoDataUrl}
              alt={game.name}
              className="max-h-10 max-w-full object-contain object-left drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
            />
          ) : (
            <span className="block truncate text-[15px] leading-tight font-bold tracking-[-0.02em] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
              {game.name}
            </span>
          )}
        </div>

        <div className="pointer-events-none absolute right-14 bottom-3.5 left-3.5 z-10 truncate text-[11.5px] font-medium text-white/75 tabular-nums">
          {formatTotalPlaytime(game.totalPlaytimeSeconds)} played
        </div>

        <button
          type="button"
          disabled={launchingId !== null}
          aria-label={`Play ${game.name}`}
          onClick={(event) => {
            event.stopPropagation()
            onPlayGame(game)
          }}
          className="app-no-drag absolute right-3 bottom-3 z-10 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#007AFF] text-white shadow-[0_6px_18px_rgba(0,122,255,0.42)] transition-all duration-150 hover:scale-105 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLaunching ? (
            <SpinnerIcon className="h-4 w-4" />
          ) : (
            <PlayTriangleIcon className="h-4 w-4" />
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-[1040px] px-9 pt-12 pb-16">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              disabled={!isManagedPc}
              onClick={() => onRequestChangeIcon(pc)}
              aria-label={`Change icon for ${pc.name}`}
              title={isManagedPc ? 'Change icon' : pc.name}
              className={`app-no-drag flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FAF9F8] text-[#713131] ring-1 ring-[#161212]/[0.06] ${
                isManagedPc ? 'cursor-pointer transition-colors hover:bg-[#F4EEEE]' : ''
              }`}
            >
              <PcGlyph icon={pc.icon} className="h-6 w-6" />
            </button>

            <div className="min-w-0">
              {isRenaming ? (
                <form onSubmit={(event) => void handleRenameSubmit(event)}>
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameDraft}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onBlur={() => void handleRenameSubmit({ preventDefault() {} } as FormEvent)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        setIsRenaming(false)
                        setRenameDraft(pc.name)
                      }
                    }}
                    aria-label="Rename PC"
                    className="app-no-drag rounded-xl bg-[#FAF9F8] px-3 py-1 text-[24px] font-bold tracking-[-0.03em] text-[#161212] ring-2 ring-[#713131]/35 focus:outline-none"
                  />
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-[28px] font-bold tracking-[-0.035em] text-[#161212]">
                    {pc.name}
                  </h1>
                  {isManagedPc && (
                    <button
                      type="button"
                      aria-label={`Rename ${pc.name}`}
                      onClick={() => setIsRenaming(true)}
                      className="app-no-drag inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#5e5454] transition-colors hover:bg-[#161212]/[0.06] hover:text-[#713131]"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-[#5e5454]">
                <span className="rounded-full bg-[#FAF9F8] px-2.5 py-0.5 font-medium text-[#4a4242]">
                  {config.windowsVersion}
                </span>
                <span className="rounded-full bg-[#FAF9F8] px-2.5 py-0.5 font-medium text-[#4a4242]">
                  {formatBackendLabel(config.graphicsBackend)}
                </span>
                <span className="tabular-nums">
                  {pcGames.length} {pcGames.length === 1 ? 'game' : 'games'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!pc.isAvailable || launchingId !== null}
              onClick={() => void handleRunProgramClick()}
              className="app-no-drag inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#007AFF] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(0,122,255,0.28)] transition-all duration-150 hover:bg-[#0066D6] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {launchingId === `run:${pc.path}` ? (
                <SpinnerIcon className="h-3.5 w-3.5" />
              ) : (
                <PlayTriangleIcon className="h-3.5 w-3.5" />
              )}
              <span>{launchingId === `run:${pc.path}` ? 'Running...' : 'Run...'}</span>
            </button>

            {isManagedPc && (
              <>
                <button
                  type="button"
                  onClick={() => onRequestChangeIcon(pc)}
                  className="app-no-drag cursor-pointer rounded-xl bg-[#FAF9F8] px-3.5 py-2 text-[12.5px] font-medium text-[#161212] transition-colors hover:bg-[#F3EFEF]"
                >
                  Change Icon
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${pc.name}`}
                  onClick={() => onRequestDeletePc(pc)}
                  className="app-no-drag inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-red-500/[0.08] px-3.5 py-2 text-[12.5px] font-medium text-red-600 transition-colors hover:bg-red-500/[0.14]"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>

        {!pc.isAvailable && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-amber-500/25 bg-amber-50/90 px-4 py-2.5 text-[13px] text-amber-800"
          >
            This PC is currently unavailable on disk. Reconnect its drive or remove it from the sidebar.
          </div>
        )}

        {actionNotice && (
          <div
            role="status"
            className="mt-4 rounded-xl bg-[#FAF9F8] px-4 py-2.5 text-[13px] text-[#4a4242] ring-1 ring-[#161212]/[0.06]"
          >
            {actionNotice}
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/20 bg-red-50/90 px-4 py-2.5 text-[13px] text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <nav
          aria-label="PC sections"
          className="mt-6 flex flex-wrap items-center gap-6 border-b border-[#161212]/[0.07]"
        >
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'configuration', label: 'Configuration' },
              { id: 'processes', label: 'Processes' },
              { id: 'winetricks', label: 'Winetricks' },
              { id: 'pins', label: 'Pins' },
              { id: 'games', label: `Games (${pcGames.length})` }
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

        {activeTab === 'overview' && (
          <div className="mt-6 space-y-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="min-w-0 rounded-2xl bg-[#FAF9F8] px-5 py-4">
                <div className="text-[12px] font-medium text-[#5e5454]">Games Installed</div>
                <div className="mt-2 truncate text-[24px] font-bold tracking-[-0.03em] text-[#161212] tabular-nums">
                  {pcGames.length}
                </div>
              </div>

              <div className="min-w-0 rounded-2xl bg-[#FAF9F8] px-5 py-4">
                <div className="text-[12px] font-medium text-[#5e5454]">Total Playtime</div>
                <div className="mt-2 truncate text-[24px] font-bold tracking-[-0.03em] text-[#161212] tabular-nums">
                  {formatTotalPlaytime(totalPlaytimeSeconds)}
                </div>
              </div>

              <div className="min-w-0 rounded-2xl bg-[#FAF9F8] px-5 py-4">
                <div className="text-[12px] font-medium text-[#5e5454]">Graphics Backend</div>
                <div className="mt-2 truncate text-[17px] font-bold tracking-[-0.02em] text-[#161212] xl:text-[19px]">
                  {formatBackendLabel(config.graphicsBackend)}
                </div>
              </div>
            </div>

            <section aria-label="Installed games on this PC">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13.5px] font-semibold text-[#161212]">Installed Games</h2>
                {pcGames.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('games')}
                    className="app-no-drag cursor-pointer text-[12.5px] font-medium text-[#713131] hover:underline"
                  >
                    See all
                  </button>
                )}
              </div>

              {pcGames.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pcGames.map(renderGameCard)}
                </div>
              ) : (
                <div className="rounded-2xl bg-[#FAF9F8] px-6 py-7 text-center text-[13px] text-[#5e5454]">
                  No games detected inside {pc.name} yet. Open a storefront launcher to install titles.
                </div>
              )}
            </section>

            {pcLaunchers.length > 0 && (
              <section aria-label="Installed launchers on this PC">
                <h2 className="mb-3 text-[13.5px] font-semibold text-[#161212]">Launchers</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pcLaunchers.map((launcher) => {
                    const isBusy = launchingId === `launcher:${launcher.id}`
                    return (
                      <button
                        key={launcher.id}
                        type="button"
                        disabled={launchingId !== null}
                        onClick={() => onOpenLauncher(launcher)}
                        className="app-no-drag group flex cursor-pointer items-center gap-3 rounded-xl bg-[#FAF9F8] p-3.5 text-left transition-colors hover:bg-[#F3EFEF] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isBusy ? (
                          <SpinnerIcon className="h-6 w-6 shrink-0 text-[#713131]" />
                        ) : (
                          <LauncherBrandImage
                            id={launcher.id}
                            className="h-7 w-7 shrink-0 object-contain"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-[#161212] group-hover:text-[#713131]">
                            {launcher.name}
                          </div>
                          <div className="text-[11.5px] text-[#5e5454]">
                            {isBusy ? 'Opening...' : 'Open'}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            <section aria-label="Advanced Windows tools" className="rounded-2xl bg-[#FAF9F8] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[13.5px] font-semibold text-[#161212]">Advanced Tools</h2>
                  <p className="mt-0.5 text-[12px] text-[#5e5454]">
                    Inspect the Windows C: drive, container folder, and runtime overrides.
                  </p>
                </div>
                <button
                  type="button"
                  aria-expanded={showAdvanced}
                  onClick={() => setShowAdvanced((open) => !open)}
                  className="app-no-drag inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:text-[#713131]"
                >
                  <span>{showAdvanced ? 'Hide' : 'Show'}</span>
                  <ChevronDownIcon
                    className={`h-3.5 w-3.5 transition-transform duration-150 ${
                      showAdvanced ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </button>
              </div>

              {showAdvanced && (
                <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-[#161212]/[0.06] pt-4">
                  <button
                    type="button"
                    onClick={() => void handleShowInFinder(`${pc.path}/drive_c`)}
                    className="app-no-drag inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF]"
                  >
                    <FolderOpenIcon className="h-3.5 w-3.5" />
                    <span>Open C: Drive</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyPath()}
                    className="app-no-drag cursor-pointer rounded-xl bg-white px-3.5 py-2 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF]"
                  >
                    {copiedPath ? 'Path Copied' : 'Copy Container Path'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPcConfig}
                    className="app-no-drag cursor-pointer rounded-xl bg-white px-3.5 py-2 text-[12.5px] font-medium text-[#5e5454] ring-1 ring-[#161212]/[0.08] transition-colors hover:text-[#161212]"
                  >
                    Reset PC Configuration
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'configuration' && (
          <div className="mt-6 max-w-[760px] space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-[#161212]">PC Configuration</h2>
                <p className="mt-0.5 text-[12.5px] text-[#5e5454]">
                  Runtime defaults applied to programs launched from {pc.name}.
                </p>
              </div>
              {savedNoticeVisible && (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11.5px] font-medium text-emerald-700">
                  Saved
                </span>
              )}
            </div>

            <div className="rounded-2xl bg-[#FAF9F8] p-5">
              <h3 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                Windows &amp; Sync
              </h3>
              <div className="mt-4 space-y-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <label
                      htmlFor="pc-windows-version"
                      className="text-[13.5px] font-medium text-[#161212]"
                    >
                      Windows Version
                    </label>
                    <div className="mt-0.5 text-[12px] text-[#5e5454]">
                      Target Windows compatibility profile reported to installers.
                    </div>
                  </div>
                  <select
                    id="pc-windows-version"
                    value={config.windowsVersion}
                    onChange={(event) =>
                      updateConfig({
                        windowsVersion: event.target.value as PcConfigState['windowsVersion']
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

                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <div className="text-[13.5px] font-medium text-[#161212]">Enhanced Sync</div>
                    <div className="mt-0.5 text-[12px] text-[#5e5454]">
                      Synchronization backend for multi-threaded games.
                    </div>
                  </div>
                  <div className="inline-flex rounded-xl bg-white p-1 ring-1 ring-[#161212]/[0.08]">
                    {(
                      [
                        { id: 'msync', label: 'MSync' },
                        { id: 'esync', label: 'ESync' },
                        { id: 'off', label: 'Off' }
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => updateConfig({ enhancedSync: mode.id })}
                        className={`app-no-drag cursor-pointer rounded-lg px-3 py-1 text-[12px] font-medium transition-colors ${
                          config.enhancedSync === mode.id
                            ? 'bg-[#713131] text-white'
                            : 'text-[#5e5454] hover:text-[#161212]'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#161212]/[0.06] pt-3">
                  <ConfigSwitchRow
                    label="AVX Instruction Support"
                    description="Expose AVX extensions through Rosetta 2 for newer titles."
                    checked={config.avxEnabled}
                    onToggle={() => updateConfig({ avxEnabled: !config.avxEnabled })}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#FAF9F8] p-5">
              <h3 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                Graphics &amp; Metal
              </h3>
              <div className="mt-4 space-y-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <label
                      htmlFor="pc-graphics-backend"
                      className="text-[13.5px] font-medium text-[#161212]"
                    >
                      Default Graphics Backend
                    </label>
                    <div className="mt-0.5 text-[12px] text-[#5e5454]">
                      Translation layer applied unless overridden per game.
                    </div>
                  </div>
                  <select
                    id="pc-graphics-backend"
                    value={config.graphicsBackend}
                    onChange={(event) =>
                      updateConfig({
                        graphicsBackend: event.target.value as PcConfigState['graphicsBackend']
                      })
                    }
                    className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[13px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:ring-2 focus:ring-[#713131]/35 focus:outline-none"
                  >
                    <option value="recommended">Recommended</option>
                    <option value="d3dMetal">D3DMetal</option>
                    <option value="dxmt">DXMT</option>
                    <option value="dxvk">DXVK</option>
                    <option value="wined3d">WineD3D</option>
                  </select>
                </div>

                <div className="divide-y divide-[#161212]/[0.06] border-t border-[#161212]/[0.06] pt-3">
                  <ConfigSwitchRow
                    label="Metal Performance HUD"
                    description="Show live GPU frame-time metrics across apps in this PC."
                    checked={config.metalHud}
                    onToggle={() => updateConfig({ metalHud: !config.metalHud })}
                  />
                  <ConfigSwitchRow
                    label="DXR Ray Tracing"
                    description="Enable hardware ray tracing translation on Apple Silicon GPUs."
                    checked={config.dxrEnabled}
                    onToggle={() => updateConfig({ dxrEnabled: !config.dxrEnabled })}
                  />
                  <ConfigSwitchRow
                    label="Shader Cache"
                    description="Store compiled shaders inside this container to shorten load times."
                    checked={config.shaderCacheEnabled}
                    onToggle={() => updateConfig({ shaderCacheEnabled: !config.shaderCacheEnabled })}
                  />
                  <ConfigSwitchRow
                    label="Enable DXVK Translation"
                    description="Route Direct3D 10/11 calls through DXVK + MoltenVK instead of DXMT."
                    checked={config.dxvk}
                    onToggle={() => updateConfig({ dxvk: !config.dxvk })}
                  />
                  {config.dxvk && (
                    <div className="space-y-3 py-3">
                      <ConfigSwitchRow
                        label="DXVK Async Shaders"
                        description="Compile shaders asynchronously to minimize in-game stutter."
                        checked={config.dxvkAsync}
                        onToggle={() => updateConfig({ dxvkAsync: !config.dxvkAsync })}
                      />
                      <div className="flex items-center justify-between gap-4 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-[#161212]/[0.06]">
                        <span className="text-[12.5px] font-medium text-[#4a4242]">DXVK HUD</span>
                        <select
                          aria-label="DXVK HUD overlay"
                          value={config.dxvkHud}
                          onChange={(event) =>
                            updateConfig({
                              dxvkHud: event.target.value as PcConfigState['dxvkHud']
                            })
                          }
                          className="app-no-drag cursor-pointer rounded-lg bg-[#FAF9F8] px-2.5 py-1 text-[12.5px] font-medium text-[#161212] focus:outline-none"
                        >
                          <option value="off">Off</option>
                          <option value="fps">FPS Only</option>
                          <option value="partial">Partial</option>
                          <option value="full">Full Diagnostics</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#FAF9F8] p-5">
              <h3 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                Display &amp; Input
              </h3>
              <div className="mt-3 divide-y divide-[#161212]/[0.06]">
                <ConfigSwitchRow
                  label="Retina Mode"
                  description="Render Windows apps at native high-DPI macOS scaling."
                  checked={config.retinaMode}
                  onToggle={() => updateConfig({ retinaMode: !config.retinaMode })}
                />

                <div className="flex flex-wrap items-center justify-between gap-4 py-3">
                  <div>
                    <label htmlFor="pc-dpi-input" className="text-[13.5px] font-medium text-[#161212]">
                      Windows DPI Scaling
                    </label>
                    <div className="mt-0.5 text-[12px] text-[#5e5454]">
                      Adjust LogPixels scaling for small fonts or ultra-high-res screens (96 standard).
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={72}
                      max={384}
                      step={24}
                      aria-label="Windows DPI slider"
                      value={config.dpi}
                      onChange={(event) => updateConfig({ dpi: Number(event.target.value) })}
                      className="app-no-drag w-28 accent-[#713131]"
                    />
                    <input
                      id="pc-dpi-input"
                      type="number"
                      min={72}
                      max={480}
                      value={config.dpi}
                      onChange={(event) => {
                        const val = Number(event.target.value)
                        if (Number.isFinite(val) && val >= 72 && val <= 480) {
                          updateConfig({ dpi: val })
                        }
                      }}
                      className="app-no-drag w-16 rounded-lg bg-white px-2.5 py-1 text-center text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] tabular-nums focus:outline-none"
                    />
                  </div>
                </div>

                <div className="py-3">
                  <ConfigSwitchRow
                    label="Virtual Desktop"
                    description="Contain fullscreen games inside a resizable macOS window."
                    checked={config.virtualDesktop}
                    onToggle={() => updateConfig({ virtualDesktop: !config.virtualDesktop })}
                  />
                  {config.virtualDesktop && (
                    <div className="mt-2.5 flex items-center justify-between gap-4 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-[#161212]/[0.06]">
                      <span className="text-[12.5px] font-medium text-[#4a4242]">
                        Desktop Resolution
                      </span>
                      <select
                        aria-label="Virtual desktop resolution"
                        value={config.virtualDesktopResolution}
                        onChange={(event) =>
                          updateConfig({
                            virtualDesktopResolution: event.target
                              .value as PcConfigState['virtualDesktopResolution']
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

                <ConfigSwitchRow
                  label="Controller Compatibility Mode"
                  description="Prefer fallback XInput mapping for older PC ports."
                  checked={config.controllerCompatMode}
                  onToggle={() =>
                    updateConfig({ controllerCompatMode: !config.controllerCompatMode })
                  }
                />
              </div>
            </div>

            <AudioConfigCard
              bottlePath={pc.path}
              isManagedPc={isManagedPc}
              config={config}
              onUpdate={updateConfig}
              onExternalConfigUpdate={(next) => {
                setConfig(next)
                try {
                  window.localStorage.setItem(`gmac.pcConfig.${pc.path}`, JSON.stringify(next))
                } catch {
                  // Ignore storage errors cleanly.
                }
              }}
            />

            <DllOverridesEditor
              entries={config.dllOverrides}
              onChange={(dllOverrides) => updateConfig({ dllOverrides })}
            />

            <div className="rounded-2xl bg-[#FAF9F8] p-5">
              <h3 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                Container Location
              </h3>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-[#161212]/[0.06]">
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#4a4242]">
                  {pc.path}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleShowInFinder(pc.path)}
                    className="app-no-drag inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#FAF9F8] px-2.5 py-1 text-[12px] font-medium text-[#161212] transition-colors hover:bg-[#EFEBEB]"
                  >
                    <FolderOpenIcon className="h-3.5 w-3.5" />
                    <span>Show in Finder</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyPath()}
                    className="app-no-drag cursor-pointer rounded-lg bg-[#FAF9F8] px-2.5 py-1 text-[12px] font-medium text-[#161212] transition-colors hover:bg-[#EFEBEB]"
                  >
                    {copiedPath ? 'Copied' : 'Copy Path'}
                  </button>
                </div>
              </div>

              {isManagedPc && (
                <div className="mt-4 flex items-center justify-between gap-4 border-t border-[#161212]/[0.06] pt-4">
                  <div>
                    <div className="text-[13.5px] font-medium text-[#161212]">Delete PC</div>
                    <div className="mt-0.5 text-[12px] text-[#5e5454]">
                      Permanently remove this container and its installed files from disk.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRequestDeletePc(pc)}
                    className="app-no-drag shrink-0 cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-red-700"
                  >
                    Delete PC
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'processes' && (
          <ProcessesPanel bottlePath={pc.path} bottleName={pc.name} isManagedPc={isManagedPc} />
        )}

        {activeTab === 'winetricks' && (
          <WinetricksPanel bottlePath={pc.path} isManagedPc={isManagedPc} />
        )}

        {activeTab === 'pins' && (
          <PinsPanel pc={pc} isManagedPc={isManagedPc} onRunExecutable={onRunExecutable} />
        )}

        {activeTab === 'games' && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[14px] font-semibold text-[#161212]">
                {filteredPcGames.length} {filteredPcGames.length === 1 ? 'Game' : 'Games'} on{' '}
                {pc.name}
              </div>

              <label className="relative flex items-center">
                <SearchIcon className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#5e5454]/75" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search this PC..."
                  aria-label="Search games in this PC"
                  className="app-no-drag w-52 rounded-lg bg-[#FAF9F8] py-1.5 pr-3 pl-8 text-[12.5px] text-[#161212] placeholder:text-[#5e5454]/65 focus:bg-[#F6F3F3] focus:outline-2 focus:outline-[#713131]/40"
                />
              </label>
            </div>

            {filteredPcGames.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPcGames.map(renderGameCard)}
              </div>
            ) : (
              <div className="rounded-2xl bg-[#FAF9F8] px-6 py-8 text-center text-[13px] text-[#5e5454]">
                {pcGames.length === 0
                  ? `No games installed on ${pc.name}.`
                  : 'No matching games on this PC.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
