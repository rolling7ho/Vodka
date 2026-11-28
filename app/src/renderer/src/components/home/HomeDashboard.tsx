import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { HomeGameItem, HomeLauncherItem, HomeSummary } from '../../../../shared/ipc'
import {
  BattleNetLogo,
  ClockIcon,
  EAAppLogo,
  EpicLogo,
  GameControllerIcon,
  RockstarLogo,
  SpinnerIcon,
  SteamLogo,
  UbisoftLogo
} from '../icons/OnboardingIcons'
import { PlusIcon } from '../icons/SidebarIcons'

interface HomeDashboardProps {
  summary: HomeSummary | null
  isLoading: boolean
  visitKey: number
  isMockPreview: boolean
  launchingId: string | null
  settingUpLauncherId: string | null
  errorMessage: string | null
  onToggleMockPreview: () => void
  onPlayGame: (game: HomeGameItem) => void
  onOpenLauncher: (launcher: HomeLauncherItem) => void
  onSetupLauncher: (launcher: HomeLauncherItem) => void
  onOpenLibrary: () => void
  onOpenCreatePc: () => void
}

function useCountUp(
  target: number,
  triggerKey: number,
  options?: { durationMs?: number; delayMs?: number }
): number {
  const durationMs = options?.durationMs ?? 780
  const delayMs = options?.delayMs ?? 0
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (target <= 0) {
      setDisplayValue(0)
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setDisplayValue(target)
      return
    }

    setDisplayValue(0)
    let frameId: number | null = null
    let startTimestamp: number | null = null

    const delayTimer = window.setTimeout(() => {
      const tick = (now: number) => {
        if (startTimestamp === null) {
          startTimestamp = now
        }
        const progress = Math.min(1, (now - startTimestamp) / durationMs)
        const eased = 1 - Math.pow(1 - progress, 4)
        setDisplayValue(target * eased)

        if (progress < 1) {
          frameId = window.requestAnimationFrame(tick)
        } else {
          setDisplayValue(target)
        }
      }

      frameId = window.requestAnimationFrame(tick)
    }, delayMs)

    return () => {
      window.clearTimeout(delayTimer)
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [target, triggerKey, durationMs, delayMs])

  return displayValue
}

function splitPlaytime(seconds: number): { value: number; unit: 'hrs' | 'min'; decimals: number } {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return { value: 0, unit: 'hrs', decimals: 0 }
  }
  if (seconds < 3600) {
    return { value: Math.max(1, Math.round(seconds / 60)), unit: 'min', decimals: 0 }
  }
  const hours = seconds / 3600
  return {
    value: hours,
    unit: 'hrs',
    decimals: hours < 1000 ? 1 : 0
  }
}

function formatCardPlaytime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 hrs'
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

function formatRelativeDate(iso: string | null): string {
  if (!iso) {
    return 'Never played'
  }
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) {
    return 'Recently'
  }
  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 5) {
    return 'Just now'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) {
    return 'Yesterday'
  }
  if (diffDays < 30) {
    return `${diffDays}d ago`
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(timestamp)
  )
}

function launcherIcon(id: string, className: string): ReactNode {
  switch (id) {
    case 'steam':
      return <SteamLogo className={className} />
    case 'epicGames':
      return <EpicLogo className={className} />
    case 'battleNet':
      return <BattleNetLogo className={className} />
    case 'eaApp':
      return <EAAppLogo className={className} />
    case 'rockstar':
      return <RockstarLogo className={className} />
    case 'ubisoft':
      return <UbisoftLogo className={className} />
    default:
      return <GameControllerIcon className={className} />
  }
}

function PlayTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M7.5 5.6a1 1 0 0 1 1.52-.85l10 6.4a1 1 0 0 1 0 1.7l-10 6.4A1 1 0 0 1 7.5 18.4V5.6Z" />
    </svg>
  )
}

function RecentActivityIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  )
}

function pcCountLabel(count: number): string {
  if (count <= 0) {
    return 'No PCs yet'
  }
  return count === 1 ? 'Across 1 PC' : `Across ${count} PCs`
}

function staggerStyle(delayMs: number): CSSProperties {
  return { '--stagger-delay': `${delayMs}ms` } as CSSProperties
}

export function HomeDashboard({
  summary,
  isLoading,
  visitKey,
  isMockPreview,
  launchingId,
  settingUpLauncherId,
  errorMessage,
  onToggleMockPreview,
  onPlayGame,
  onOpenLauncher,
  onSetupLauncher,
  onOpenLibrary,
  onOpenCreatePc
}: HomeDashboardProps) {
  const stats = summary?.stats ?? {
    totalPlaytimeSeconds: 0,
    lastTwoWeeksSeconds: 0,
    gamesInstalled: 0,
    pcsCount: 0
  }

  const totalPlaytimeMetric = splitPlaytime(stats.totalPlaytimeSeconds)
  const recentPlaytimeMetric = splitPlaytime(stats.lastTwoWeeksSeconds)

  const animatedTotal = useCountUp(totalPlaytimeMetric.value, visitKey, {
    durationMs: 820,
    delayMs: 40
  })
  const animatedRecent = useCountUp(recentPlaytimeMetric.value, visitKey, {
    durationMs: 780,
    delayMs: 110
  })
  const animatedGames = useCountUp(stats.gamesInstalled, visitKey, {
    durationMs: 700,
    delayMs: 180
  })

  const continuePlaying = summary?.continuePlaying ?? null
  const recentlyPlayed = summary?.recentlyPlayed ?? []
  const launchers = summary?.launchers ?? []
  const steamLauncher = launchers.find((item) => item.id === 'steam' && item.installed) ?? null
  const showSkeletonValue = isLoading && !summary

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div
        key={visitKey}
        className="mx-auto w-full max-w-[1040px] px-9 pt-12 pb-14"
      >
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[28px] font-bold tracking-[-0.035em] text-[#161212]">Home</h1>

          <button
            type="button"
            onClick={onToggleMockPreview}
            aria-pressed={isMockPreview}
            className={`app-no-drag inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
              isMockPreview
                ? 'border-[#713131]/25 bg-[#713131]/[0.09] text-[#713131]'
                : 'border-[#161212]/[0.1] bg-[#FAF9F8] text-[#5e5454] hover:border-[#713131]/20 hover:text-[#713131]'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isMockPreview ? 'bg-[#713131]' : 'bg-[#5e5454]/45'
              }`}
              aria-hidden="true"
            />
            <span>Mock UI</span>
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/20 bg-red-50/90 px-4 py-2.5 text-[13px] text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <section
          aria-label="Playtime statistics"
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <div
            style={staggerStyle(0)}
            className="animate-home-rise rounded-2xl border border-[#161212]/[0.075] bg-[#FAF9F8] px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors duration-200 hover:border-[#713131]/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[#5e5454]">Hours Played</span>
              <ClockIcon className="h-[15px] w-[15px] text-[#713131]/75" />
            </div>
            <div className="mt-3 flex items-baseline gap-1.5 text-[#161212] tabular-nums">
              <span className="text-[34px] leading-none font-bold tracking-[-0.04em]">
                {showSkeletonValue
                  ? '...'
                  : totalPlaytimeMetric.value <= 0
                    ? '0'
                    : animatedTotal.toFixed(totalPlaytimeMetric.decimals)}
              </span>
              {!showSkeletonValue && (
                <span className="text-[15px] font-medium text-[#6d6262]">
                  {totalPlaytimeMetric.unit}
                </span>
              )}
            </div>
            <p className="mt-2.5 text-[12px] text-[#6d6262]">Lifetime playtime</p>
          </div>

          <div
            style={staggerStyle(55)}
            className="animate-home-rise rounded-2xl border border-[#161212]/[0.075] bg-[#FAF9F8] px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors duration-200 hover:border-[#713131]/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[#5e5454]">Last 2 Weeks</span>
              <RecentActivityIcon className="h-[15px] w-[15px] text-[#713131]/75" />
            </div>
            <div className="mt-3 flex items-baseline gap-1.5 text-[#161212] tabular-nums">
              <span className="text-[34px] leading-none font-bold tracking-[-0.04em]">
                {showSkeletonValue
                  ? '...'
                  : recentPlaytimeMetric.value <= 0
                    ? '0'
                    : animatedRecent.toFixed(recentPlaytimeMetric.decimals)}
              </span>
              {!showSkeletonValue && (
                <span className="text-[15px] font-medium text-[#6d6262]">
                  {recentPlaytimeMetric.unit}
                </span>
              )}
            </div>
            <p className="mt-2.5 text-[12px] text-[#6d6262]">Recent activity</p>
          </div>

          <div
            style={staggerStyle(110)}
            className="animate-home-rise rounded-2xl border border-[#161212]/[0.075] bg-[#FAF9F8] px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors duration-200 hover:border-[#713131]/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[#5e5454]">Games Installed</span>
              <GameControllerIcon className="h-[15px] w-[15px] text-[#713131]/75" />
            </div>
            <div className="mt-3 flex items-baseline gap-1.5 text-[#161212] tabular-nums">
              <span className="text-[34px] leading-none font-bold tracking-[-0.04em]">
                {showSkeletonValue ? '...' : `${Math.round(animatedGames)}`}
              </span>
              {!showSkeletonValue && (
                <span className="text-[15px] font-medium text-[#6d6262]">titles</span>
              )}
            </div>
            <p className="mt-2.5 text-[12px] text-[#6d6262]">{pcCountLabel(stats.pcsCount)}</p>
          </div>
        </section>

        <section
          aria-label="Continue playing"
          style={staggerStyle(140)}
          className="animate-home-rise mt-8"
        >
          <h2 className="mb-3 text-[13px] font-semibold tracking-[-0.01em] text-[#5e5454]">
            Continue Playing
          </h2>

          {continuePlaying ? (
            <div className="group relative flex min-h-[248px] flex-col justify-end overflow-hidden rounded-[20px] border border-[#161212]/[0.08] bg-[#241515] p-7 text-white shadow-[0_12px_32px_rgba(22,18,18,0.08)]">
              {continuePlaying.artworkDataUrl ? (
                <>
                  <img
                    src={continuePlaying.artworkDataUrl}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#120D0D]/92 via-[#161212]/48 to-[#161212]/15" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#120D0D]/80 via-[#120D0D]/30 to-transparent" />
                </>
              ) : (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#241515] via-[#5a2828] to-[#713131]" />
              )}

              <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div className="min-w-0">
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/12 px-2.5 py-0.5 text-[11.5px] font-medium text-white backdrop-blur-xs">
                    {continuePlaying.bottleName}
                  </span>
                  <h3 className="mt-2.5 truncate text-[32px] leading-tight font-bold tracking-[-0.035em] text-white">
                    {continuePlaying.name}
                  </h3>
                  <p className="mt-1 text-[13px] text-white/80 tabular-nums">
                    {formatCardPlaytime(continuePlaying.totalPlaytimeSeconds)} played &middot;{' '}
                    {formatRelativeDate(continuePlaying.lastPlayedIso)}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={launchingId !== null}
                  onClick={() => onPlayGame(continuePlaying)}
                  className="app-no-drag inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-6 py-2.5 text-[14px] font-medium text-white shadow-sm transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {launchingId === continuePlaying.id ? (
                    <SpinnerIcon className="h-4 w-4" />
                  ) : (
                    <PlayTriangleIcon className="h-4 w-4" />
                  )}
                  <span>{launchingId === continuePlaying.id ? 'Launching...' : 'Play'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[196px] flex-col justify-between gap-5 rounded-[20px] border border-[#161212]/[0.075] bg-gradient-to-br from-[#FAF9F8] via-[#FAF8F8] to-[#F3EAEA]/55 p-7 sm:flex-row sm:items-center">
              <div className="max-w-lg">
                <h3 className="text-[22px] font-bold tracking-[-0.025em] text-[#161212]">
                  Ready to play your first game
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#5e5454]">
                  {steamLauncher
                    ? 'Open Steam to install a game, or create a dedicated PC for another launcher.'
                    : 'Create a PC or set up a storefront below to start building your Windows game library.'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                {steamLauncher ? (
                  <button
                    type="button"
                    disabled={launchingId !== null}
                    onClick={() => onOpenLauncher(steamLauncher)}
                    className="app-no-drag inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-5 py-2.5 text-[13.5px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {launchingId === `launcher:${steamLauncher.id}` ? (
                      <SpinnerIcon className="h-4 w-4" />
                    ) : (
                      <SteamLogo className="h-4 w-4" />
                    )}
                    <span>
                      {launchingId === `launcher:${steamLauncher.id}` ? 'Opening...' : 'Open Steam'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenCreatePc}
                    className="app-no-drag inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-5 py-2.5 text-[13.5px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] active:scale-[0.98]"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>Create a PC</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section
          aria-label="Recently played"
          style={staggerStyle(200)}
          className="animate-home-rise mt-9"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[#5e5454]">
              Recently Played
            </h2>
            <button
              type="button"
              onClick={onOpenLibrary}
              className="app-no-drag cursor-pointer text-[12.5px] font-medium text-[#713131] transition-colors hover:text-[#522222]"
            >
              View Library
            </button>
          </div>

          {recentlyPlayed.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {recentlyPlayed.map((game) => {
                const isLaunching = launchingId === game.id
                return (
                  <div
                    key={game.id}
                    className="group overflow-hidden rounded-2xl border border-[#161212]/[0.075] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#713131]/25 hover:shadow-[0_10px_24px_rgba(22,18,18,0.06)]"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-[#ECE6E6]">
                      {game.artworkDataUrl ? (
                        <>
                          <img
                            src={game.artworkDataUrl}
                            alt={game.name}
                            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]"
                          />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 to-transparent" />
                        </>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#F4EEEE] to-[#E6DADA] text-[#713131]/55">
                          <GameControllerIcon className="h-8 w-8" />
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={launchingId !== null}
                        aria-label={`Play ${game.name}`}
                        onClick={() => onPlayGame(game)}
                        className="app-no-drag absolute right-2.5 bottom-2.5 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#007AFF] text-white opacity-95 shadow-sm transition-all duration-150 group-hover:scale-105 hover:bg-[#0066D6] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLaunching ? (
                          <SpinnerIcon className="h-4 w-4" />
                        ) : (
                          <PlayTriangleIcon className="h-4 w-4 translate-x-[0.5px]" />
                        )}
                      </button>
                    </div>

                    <div className="px-4 py-3">
                      <div className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[#161212]">
                        {game.name}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-[#6d6262] tabular-nums">
                        <span className="truncate">{formatCardPlaytime(game.totalPlaytimeSeconds)}</span>
                        <span className="shrink-0">{formatRelativeDate(game.lastPlayedIso)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-dashed border-[#161212]/[0.12] bg-[#FAF9F8]/70 px-5 py-4 text-[13px] text-[#5e5454]">
              <span>Games you play across your PCs appear here for quick launching.</span>
            </div>
          )}
        </section>

        <section
          aria-label="Launchers quick access"
          style={staggerStyle(260)}
          className="animate-home-rise mt-9"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[#5e5454]">
              Launchers
            </h2>
            <span className="text-[12px] text-[#6d6262]">Quick access</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {launchers.map((launcher) => {
              const isBusy =
                launchingId === `launcher:${launcher.id}` ||
                settingUpLauncherId === launcher.id
              return (
                <button
                  key={launcher.id}
                  type="button"
                  disabled={launchingId !== null || settingUpLauncherId !== null}
                  onClick={() =>
                    launcher.installed ? onOpenLauncher(launcher) : onSetupLauncher(launcher)
                  }
                  className="app-no-drag group flex cursor-pointer flex-col justify-between rounded-xl border border-[#161212]/[0.075] bg-[#FAF9F8] p-3.5 text-left transition-all duration-150 hover:border-[#713131]/25 hover:bg-white hover:shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                        launcher.installed
                          ? 'bg-[#713131]/[0.1] text-[#713131]'
                          : 'bg-[#161212]/[0.06] text-[#5e5454] group-hover:bg-[#713131]/[0.1] group-hover:text-[#713131]'
                      }`}
                    >
                      {isBusy ? (
                        <SpinnerIcon className="h-4 w-4" />
                      ) : (
                        launcherIcon(launcher.id, 'h-4 w-4')
                      )}
                    </span>

                    {launcher.installed && (
                      <span
                        className="h-2 w-2 rounded-full bg-emerald-500"
                        title="Installed"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="truncate text-[13px] font-semibold text-[#161212] group-hover:text-[#713131]">
                      {launcher.name}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-[#6d6262]">
                      {isBusy
                        ? launcher.installed
                          ? 'Opening...'
                          : 'Setting up...'
                        : launcher.installed
                          ? 'Open'
                          : 'Set up'}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
