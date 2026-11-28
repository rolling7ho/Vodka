import { useEffect, useState, type CSSProperties } from 'react'
import type { HomeGameItem, HomeLauncherItem, HomeSummary } from '../../../../shared/ipc'
import { LauncherBrandImage } from '../icons/LauncherLogos'
import { GameControllerIcon, SpinnerIcon } from '../icons/OnboardingIcons'
import { PlayTriangleIcon, PlusIcon } from '../icons/SidebarIcons'
import { StatSparkline } from '../shared/StatSparkline'

interface HomeDashboardProps {
  summary: HomeSummary | null
  isLoading: boolean
  visitKey: number
  launchingId: string | null
  errorMessage: string | null
  onPlayGame: (game: HomeGameItem) => void
  onOpenLauncher: (launcher: HomeLauncherItem) => void
  onSetupLauncher: (launcher: HomeLauncherItem) => void
  onOpenLibrary: () => void
  onOpenCreatePc: () => void
}

function useCountUp(
  target: number,
  triggerKey: number,
  options?: { durationMs?: number; delayMs?: number; decay?: number }
): number {
  const durationMs = options?.durationMs ?? 1450
  const delayMs = options?.delayMs ?? 0
  const decay = options?.decay ?? 9
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
    const denom = 1 - Math.pow(2, -decay)

    const delayTimer = window.setTimeout(() => {
      const tick = (now: number) => {
        if (startTimestamp === null) {
          startTimestamp = now
        }
        const progress = Math.min(1, (now - startTimestamp) / durationMs)
        const eased = progress >= 1 ? 1 : (1 - Math.pow(2, -decay * progress)) / denom
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
  }, [target, triggerKey, durationMs, delayMs, decay])

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

function staggerStyle(delayMs: number): CSSProperties {
  return { '--stagger-delay': `${delayMs}ms` } as CSSProperties
}

export function HomeDashboard({
  summary,
  isLoading,
  visitKey,
  launchingId,
  errorMessage,
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
    pcsCount: 0,
    hoursHistory: [],
    recentHoursHistory: [],
    gamesHistory: []
  }

  const totalPlaytimeMetric = splitPlaytime(stats.totalPlaytimeSeconds)
  const recentPlaytimeMetric = splitPlaytime(stats.lastTwoWeeksSeconds)

  const animatedTotal = useCountUp(totalPlaytimeMetric.value, visitKey, {
    durationMs: 1450,
    delayMs: 30,
    decay: 9
  })
  const animatedRecent = useCountUp(recentPlaytimeMetric.value, visitKey, {
    durationMs: 1350,
    delayMs: 90,
    decay: 8.5
  })
  const animatedGames = useCountUp(stats.gamesInstalled, visitKey, {
    durationMs: 1150,
    delayMs: 150,
    decay: 6
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
            className="animate-home-rise rounded-2xl border border-[#161212]/[0.04] bg-[#FAF9F8] px-6 pt-5 pb-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors duration-200 hover:border-[#713131]/15"
          >
            <div className="text-[12.5px] font-medium text-[#5e5454]">Hours Played</div>
            <div className="mt-2.5 flex items-baseline gap-1.5 text-[#161212] tabular-nums">
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
            className="animate-home-rise rounded-2xl border border-[#161212]/[0.04] bg-[#FAF9F8] px-6 pt-5 pb-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors duration-200 hover:border-[#713131]/15"
          >
            <div className="text-[12.5px] font-medium text-[#5e5454]">Last 2 Weeks</div>
            <div className="mt-2.5 flex items-baseline gap-1.5 text-[#161212] tabular-nums">
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
            className="animate-home-rise rounded-2xl border border-[#161212]/[0.04] bg-[#FAF9F8] px-6 pt-5 pb-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors duration-200 hover:border-[#713131]/15"
          >
            <div className="text-[12.5px] font-medium text-[#5e5454]">Games Installed</div>
            <div className="mt-2.5 flex items-baseline gap-1.5 text-[#161212] tabular-nums">
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
            <div className="app-no-drag group relative min-h-[256px] overflow-hidden rounded-[20px] bg-[#241515] shadow-[0_14px_34px_rgba(22,18,18,0.1)] transition-all duration-200 hover:shadow-[0_18px_40px_rgba(22,18,18,0.15)]">
              {continuePlaying.artworkDataUrl ? (
                <>
                  <img
                    src={continuePlaying.artworkDataUrl}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#120D0D]/72 via-[#161212]/18 to-[#120D0D]/50" />
                </>
              ) : (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#241515] via-[#5a2828] to-[#713131]" />
              )}

              <div className="pointer-events-none absolute top-1 right-6 z-10 flex justify-end">
                {continuePlaying.logoDataUrl ? (
                  <img
                    src={continuePlaying.logoDataUrl}
                    alt={continuePlaying.name}
                    className="max-h-[126px] max-w-[380px] object-contain object-right drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
                  />
                ) : (
                  <span className="max-w-[320px] truncate text-right text-[32px] leading-tight font-extrabold tracking-[-0.03em] text-white drop-shadow-[0_3px_12px_rgba(0,0,0,0.5)]">
                    {continuePlaying.name}
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={launchingId !== null}
                aria-label={`Play ${continuePlaying.name}`}
                onClick={() => onPlayGame(continuePlaying)}
                className="app-no-drag absolute bottom-6 left-7 z-10 inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-[#1D4E89] text-white shadow-[0_8px_22px_rgba(16,42,76,0.38)] ring-1 ring-white/18 backdrop-blur-md transition-all duration-150 hover:scale-105 hover:bg-[#163D6B] hover:ring-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {launchingId === continuePlaying.id ? (
                  <SpinnerIcon className="h-5 w-5" />
                ) : (
                  <PlayTriangleIcon className="h-5 w-5" />
                )}
              </button>

              <div className="pointer-events-none absolute right-7 bottom-6 z-10 text-right text-[12.5px] font-medium text-white/75 tabular-nums">
                {formatRecentPlaytime(continuePlaying.totalPlaytimeSeconds)} &middot;{' '}
                {formatRelativeDate(continuePlaying.lastPlayedIso)}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[196px] flex-col justify-between gap-5 rounded-[20px] border border-[#161212]/[0.04] bg-gradient-to-br from-[#FAF9F8] via-[#FAF8F8] to-[#F3EAEA]/55 p-7 sm:flex-row sm:items-center">
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
                    className="app-no-drag inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#713131] px-5 py-2.5 text-[13.5px] font-medium text-white transition-all duration-150 hover:bg-[#5E2828] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="app-no-drag inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#713131] px-5 py-2.5 text-[13.5px] font-medium text-white transition-all duration-150 hover:bg-[#5E2828] active:scale-[0.98]"
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
                    className="app-no-drag group relative aspect-video overflow-hidden rounded-2xl bg-[#1C1414] shadow-[0_6px_18px_rgba(22,18,18,0.08)] transition-shadow duration-200 hover:shadow-[0_12px_26px_rgba(22,18,18,0.14)]"
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
                      onClick={() => onPlayGame(game)}
                      className="app-no-drag absolute right-3 bottom-3 z-10 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#1D4E89] text-white shadow-[0_6px_16px_rgba(16,42,76,0.36)] ring-1 ring-white/18 backdrop-blur-md transition-all duration-150 hover:scale-105 hover:bg-[#163D6B] hover:ring-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLaunching ? (
                        <SpinnerIcon className="h-4 w-4" />
                      ) : (
                        <PlayTriangleIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-dashed border-[#161212]/[0.1] bg-[#FAF9F8]/70 px-5 py-4 text-[13px] text-[#5e5454]">
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
              const isBusy = launchingId === `launcher:${launcher.id}`
              return (
                <button
                  key={launcher.id}
                  type="button"
                  disabled={launchingId !== null}
                  onClick={() =>
                    launcher.installed ? onOpenLauncher(launcher) : onSetupLauncher(launcher)
                  }
                  className="app-no-drag group flex cursor-pointer flex-col justify-between rounded-xl border border-[#161212]/[0.04] bg-[#FAF9F8] p-3.5 text-left transition-all duration-150 hover:border-[#713131]/20 hover:bg-white hover:shadow-xs disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-center">
                    {isBusy ? (
                      <SpinnerIcon className="h-6 w-6 text-[#713131]" />
                    ) : (
                      <LauncherBrandImage
                        id={launcher.id}
                        className="h-7 w-7 shrink-0 object-contain"
                      />
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="truncate text-[13px] font-semibold text-[#161212] group-hover:text-[#713131]">
                      {launcher.name}
                    </div>
                    <div
                      className={`mt-0.5 text-[11.5px] ${
                        launcher.installed
                          ? 'text-[#6d6262]'
                          : 'font-medium text-[#8C2D2D]'
                      }`}
                    >
                      {isBusy ? 'Opening...' : launcher.installed ? 'Open' : 'Set up'}
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
