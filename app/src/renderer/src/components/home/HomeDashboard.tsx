import { useEffect, useId, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { HomeGameItem, HomeLauncherItem, HomeSummary, StatPoint } from '../../../../shared/ipc'
import { LauncherBrandImage } from '../icons/LauncherLogos'
import { ClockIcon, GameControllerIcon, SpinnerIcon } from '../icons/OnboardingIcons'
import { PlusIcon } from '../icons/SidebarIcons'

interface HomeDashboardProps {
  summary: HomeSummary | null
  isLoading: boolean
  visitKey: number
  launchingId: string | null
  settingUpLauncherId: string | null
  errorMessage: string | null
  onPlayGame: (game: HomeGameItem) => void
  onOpenGameDetail: (game: HomeGameItem) => void
  onOpenLauncher: (launcher: HomeLauncherItem) => void
  onSetupLauncher: (launcher: HomeLauncherItem) => void
  onOpenLibrary: () => void
  onOpenCreatePc: () => void
}

function useCountUp(
  target: number,
  triggerKey: number,
  options?: { durationMs?: number; delayMs?: number; power?: number }
): number {
  const durationMs = options?.durationMs ?? 2400
  const delayMs = options?.delayMs ?? 0
  const power = options?.power ?? 6.5
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
        const eased = 1 - Math.pow(1 - progress, power)
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
  }, [target, triggerKey, durationMs, delayMs, power])

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

function formatRecentPlaytime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0 hrs played'
  }
  if (seconds < 60) {
    return '< 1 min played'
  }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min played`
  }
  const hours = seconds / 3600
  if (hours < 100) {
    return `${hours.toFixed(1)} hrs played`
  }
  return `${Math.round(hours)} hrs played`
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

function StatSparkline({ points }: { points: StatPoint[] }) {
  const gradientId = useId().replace(/:/g, '')
  const width = 220
  const height = 42
  const padX = 2
  const padTop = 6
  const padBottom = 5

  const hasNonZero = points.some((point) => point.value > 0)
  if (points.length < 2 || !hasNonZero) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="mt-3 h-[38px] w-full overflow-visible"
      >
        <path
          d={`M ${padX} ${height - padBottom} L ${width - padX} ${height - padBottom}`}
          fill="none"
          stroke="#713131"
          strokeOpacity="0.22"
          strokeWidth={1.6}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    )
  }

  const minVal = Math.min(...points.map((point) => point.value))
  const maxVal = Math.max(...points.map((point) => point.value))
  const range = maxVal - minVal || 1
  const usableWidth = width - padX * 2
  const usableHeight = height - padTop - padBottom

  const coords = points.map((point, index) => {
    const x = padX + (index / (points.length - 1)) * usableWidth
    const normalized = (point.value - minVal) / range
    const y = padTop + (1 - normalized) * usableHeight
    return { x, y }
  })

  let linePath = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)]
    const p1 = coords[i]
    const p2 = coords[i + 1]
    const p3 = coords[Math.min(coords.length - 1, i + 2)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  const last = coords[coords.length - 1]
  const areaPath = `${linePath} L ${last.x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="mt-3 h-[38px] w-full overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#713131" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#713131" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke="#713131"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        vectorEffect="non-scaling-stroke"
        className="animate-sparkline-draw"
      />
    </svg>
  )
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

function staggerStyle(delayMs: number): CSSProperties {
  return { '--stagger-delay': `${delayMs}ms` } as CSSProperties
}

function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, onOpen: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onOpen()
  }
}

export function HomeDashboard({
  summary,
  isLoading,
  visitKey,
  launchingId,
  settingUpLauncherId,
  errorMessage,
  onPlayGame,
  onOpenGameDetail,
  onOpenLauncher,
  onSetupLauncher,
  onOpenLibrary,
  onOpenCreatePc
}: HomeDashboardProps) {
  const stats = summary?.stats ?? {
    totalPlaytimeSeconds: 0,
    lastTwoWeeksSeconds: 0,
    gamesInstalled: 0,
    pcsCount: 0,
    hoursHistory: [],
    recentHoursHistory: [],
    gamesHistory: []
  }

  const totalPlaytimeMetric = splitPlaytime(stats.totalPlaytimeSeconds)
  const recentPlaytimeMetric = splitPlaytime(stats.lastTwoWeeksSeconds)

  const animatedTotal = useCountUp(totalPlaytimeMetric.value, visitKey, {
    durationMs: 2500,
    delayMs: 40,
    power: 6.5
  })
  const animatedRecent = useCountUp(recentPlaytimeMetric.value, visitKey, {
    durationMs: 2350,
    delayMs: 110,
    power: 6.5
  })
  const animatedGames = useCountUp(stats.gamesInstalled, visitKey, {
    durationMs: 2100,
    delayMs: 180,
    power: 3.6
  })

  const continuePlaying = summary?.continuePlaying ?? null
  const recentlyPlayed = summary?.recentlyPlayed ?? []
  const launchers = summary?.launchers ?? []
  const steamLauncher = launchers.find((item) => item.id === 'steam' && item.installed) ?? null
  const showSkeletonValue = isLoading && !summary

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div key={visitKey} className="mx-auto w-full max-w-[1040px] px-9 pt-12 pb-14">
        <h1 className="text-[28px] font-bold tracking-[-0.035em] text-[#161212]">Home</h1>

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
            className="animate-home-rise rounded-2xl border border-[#161212]/[0.075] bg-[#FAF9F8] px-6 pt-5 pb-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors duration-200 hover:border-[#713131]/20"
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
            <StatSparkline points={stats.hoursHistory} />
          </div>

          <div
            style={staggerStyle(55)}
            className="animate-home-rise rounded-2xl border border-[#161212]/[0.075] bg-[#FAF9F8] px-6 pt-5 pb-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors duration-200 hover:border-[#713131]/20"
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
            <StatSparkline points={stats.recentHoursHistory} />
          </div>

          <div
            style={staggerStyle(110)}
            className="animate-home-rise rounded-2xl border border-[#161212]/[0.075] bg-[#FAF9F8] px-6 pt-5 pb-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors duration-200 hover:border-[#713131]/20"
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
            <StatSparkline points={stats.gamesHistory} />
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
            <div
              role="button"
              tabIndex={0}
              aria-label={`View details for ${continuePlaying.name}`}
              onClick={() => onOpenGameDetail(continuePlaying)}
              onKeyDown={(event) =>
                handleCardKeyDown(event, () => onOpenGameDetail(continuePlaying))
              }
              className="app-no-drag group relative min-h-[248px] cursor-pointer overflow-hidden rounded-[20px] border border-[#161212]/[0.08] bg-[#241515] shadow-[0_12px_32px_rgba(22,18,18,0.08)] transition-all duration-200 hover:shadow-[0_16px_38px_rgba(22,18,18,0.14)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF]"
            >
              {continuePlaying.artworkDataUrl ? (
                <>
                  <img
                    src={continuePlaying.artworkDataUrl}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#120D0D]/72 via-[#161212]/22 to-[#120D0D]/55" />
                </>
              ) : (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#241515] via-[#5a2828] to-[#713131]" />
              )}

              <div className="pointer-events-none absolute top-6 right-7 z-10 flex justify-end">
                {continuePlaying.logoDataUrl ? (
                  <img
                    src={continuePlaying.logoDataUrl}
                    alt={continuePlaying.name}
                    className="max-h-[82px] max-w-[300px] object-contain object-right drop-shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
                  />
                ) : (
                  <span className="max-w-[280px] truncate text-right text-[28px] leading-tight font-extrabold tracking-[-0.03em] text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.5)]">
                    {continuePlaying.name}
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={launchingId !== null}
                aria-label={`Play ${continuePlaying.name}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onPlayGame(continuePlaying)
                }}
                className="app-no-drag absolute bottom-6 left-7 z-10 inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-[#007AFF] text-white shadow-[0_6px_18px_rgba(0,122,255,0.42)] transition-all duration-150 hover:scale-105 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {launchingId === continuePlaying.id ? (
                  <SpinnerIcon className="h-5 w-5" />
                ) : (
                  <PlayTriangleIcon className="h-5 w-5 translate-x-[1px]" />
                )}
              </button>

              <div className="pointer-events-none absolute right-7 bottom-6 z-10 text-right text-[12.5px] font-medium text-white/75 tabular-nums">
                {formatRecentPlaytime(continuePlaying.totalPlaytimeSeconds)} &middot;{' '}
                {formatRelativeDate(continuePlaying.lastPlayedIso)}
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
                      <LauncherBrandImage id="steam" className="h-4 w-4 object-contain" />
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
                    role="button"
                    tabIndex={0}
                    aria-label={`View details for ${game.name}`}
                    onClick={() => onOpenGameDetail(game)}
                    onKeyDown={(event) => handleCardKeyDown(event, () => onOpenGameDetail(game))}
                    className="app-no-drag group relative aspect-video cursor-pointer overflow-hidden rounded-2xl border border-[#161212]/[0.08] bg-[#1C1414] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#713131]/30 hover:shadow-[0_12px_28px_rgba(22,18,18,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF]"
                  >
                    {game.artworkDataUrl ? (
                      <img
                        src={game.artworkDataUrl}
                        alt=""
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2B1B1B] to-[#4A2525] text-white/30">
                        <GameControllerIcon className="h-9 w-9" />
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/52 via-transparent to-black/72" />

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
                      {formatRecentPlaytime(game.totalPlaytimeSeconds)} &middot;{' '}
                      {formatRelativeDate(game.lastPlayedIso)}
                    </div>

                    <button
                      type="button"
                      disabled={launchingId !== null}
                      aria-label={`Play ${game.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onPlayGame(game)
                      }}
                      className="app-no-drag absolute right-3 bottom-3 z-10 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#007AFF] text-white shadow-sm transition-all duration-150 hover:scale-105 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLaunching ? (
                        <SpinnerIcon className="h-4 w-4" />
                      ) : (
                        <PlayTriangleIcon className="h-4 w-4 translate-x-[0.5px]" />
                      )}
                    </button>
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
          aria-label="Launchers"
          style={staggerStyle(260)}
          className="animate-home-rise mt-9"
        >
          <div className="mb-3 flex items-center">
            <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[#5e5454]">
              Launchers
            </h2>
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
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#161212]/[0.07] bg-white shadow-[0_1px_2px_rgba(22,18,18,0.04)]">
                      {isBusy ? (
                        <SpinnerIcon className="h-4 w-4 text-[#713131]" />
                      ) : (
                        <LauncherBrandImage id={launcher.id} className="h-5 w-5 object-contain" />
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
