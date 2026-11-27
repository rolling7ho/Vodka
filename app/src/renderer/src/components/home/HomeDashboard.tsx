import type { ReactNode } from 'react'
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
  launchingId: string | null
  settingUpLauncherId: string | null
  errorMessage: string | null
  onPlayGame: (game: HomeGameItem) => void
  onOpenLauncher: (launcher: HomeLauncherItem) => void
  onSetupLauncher: (launcher: HomeLauncherItem) => void
  onOpenLibrary: () => void
  onOpenCreatePc: () => void
}

function formatPlaytime(seconds: number): string {
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

export function HomeDashboard({
  summary,
  isLoading,
  launchingId,
  settingUpLauncherId,
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
    pcsCount: 0
  }
  const continuePlaying = summary?.continuePlaying ?? null
  const recentlyPlayed = summary?.recentlyPlayed ?? []
  const launchers = summary?.launchers ?? []
  const steamLauncher = launchers.find((item) => item.id === 'steam' && item.installed) ?? null

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-[1040px] px-8 pt-12 pb-12">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[26px] font-bold tracking-[-0.025em] text-[#161212]">Home</h1>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/20 bg-red-50/90 px-4 py-2.5 text-[13px] text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <section aria-label="Playtime statistics" className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#161212]/[0.08] bg-[#FAF9F9] px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[#5e5454]">Hours Played</span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#713131]/[0.1] text-[#713131]">
                <ClockIcon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 text-[28px] leading-none font-bold tracking-[-0.02em] text-[#161212] tabular-nums">
              {isLoading && !summary ? '...' : formatPlaytime(stats.totalPlaytimeSeconds)}
            </div>
            <p className="mt-2 text-[12px] text-[#5e5454]">Lifetime playtime</p>
          </div>

          <div className="rounded-2xl border border-[#161212]/[0.08] bg-[#FAF9F9] px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[#5e5454]">Last 2 Weeks</span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#713131]/[0.1] text-[#713131]">
                <RecentActivityIcon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 text-[28px] leading-none font-bold tracking-[-0.02em] text-[#161212] tabular-nums">
              {isLoading && !summary ? '...' : formatPlaytime(stats.lastTwoWeeksSeconds)}
            </div>
            <p className="mt-2 text-[12px] text-[#5e5454]">Recent playtime</p>
          </div>

          <div className="rounded-2xl border border-[#161212]/[0.08] bg-[#FAF9F9] px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[#5e5454]">Games Installed</span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#713131]/[0.1] text-[#713131]">
                <GameControllerIcon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 text-[28px] leading-none font-bold tracking-[-0.02em] text-[#161212] tabular-nums">
              {isLoading && !summary ? '...' : `${stats.gamesInstalled}`}
            </div>
            <p className="mt-2 text-[12px] text-[#5e5454]">{pcCountLabel(stats.pcsCount)}</p>
          </div>
        </section>

        <section aria-label="Continue playing" className="mt-7">
          <h2 className="mb-3 text-[13.5px] font-semibold text-[#5e5454]">Continue Playing</h2>

          {continuePlaying ? (
            <div className="relative flex min-h-[216px] flex-col justify-end overflow-hidden rounded-2xl border border-[#161212]/[0.08] bg-[#241515] p-6 text-white shadow-xs">
              {continuePlaying.artworkDataUrl ? (
                <>
                  <img
                    src={continuePlaying.artworkDataUrl}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#161212]/90 via-[#161212]/65 to-[#161212]/25" />
                </>
              ) : (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#241515] via-[#5a2828] to-[#713131]" />
              )}

              <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div className="min-w-0">
                  <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-[11.5px] font-medium text-white backdrop-blur-xs">
                    {continuePlaying.bottleName}
                  </span>
                  <h3 className="mt-2.5 truncate text-[28px] leading-tight font-bold tracking-[-0.02em] text-white">
                    {continuePlaying.name}
                  </h3>
                  <p className="mt-1 text-[13px] text-white/80">
                    {formatPlaytime(continuePlaying.totalPlaytimeSeconds)} played &middot;{' '}
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
            <div className="flex min-h-[192px] flex-col justify-between gap-5 rounded-2xl border border-[#161212]/[0.08] bg-gradient-to-br from-[#FAF7F7] via-[#FBF9F9] to-[#F3EAEA]/60 p-6 sm:flex-row sm:items-center">
              <div className="max-w-lg">
                <h3 className="text-[22px] font-bold tracking-[-0.02em] text-[#161212]">
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

        <section aria-label="Recently played" className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13.5px] font-semibold text-[#5e5454]">Recently Played</h2>
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
                    className="group overflow-hidden rounded-2xl border border-[#161212]/[0.08] bg-[#FAF9F9] transition-colors hover:border-[#713131]/25"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-[#ECE6E6]">
                      {game.artworkDataUrl ? (
                        <img
                          src={game.artworkDataUrl}
                          alt={game.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
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
                        className="app-no-drag absolute right-2.5 bottom-2.5 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#007AFF] text-white opacity-95 shadow-sm transition-all duration-150 group-hover:scale-105 hover:bg-[#0066D6] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLaunching ? (
                          <SpinnerIcon className="h-4 w-4" />
                        ) : (
                          <PlayTriangleIcon className="h-4 w-4 translate-x-[0.5px]" />
                        )}
                      </button>
                    </div>

                    <div className="px-3.5 py-3">
                      <div className="truncate text-[13.5px] font-semibold text-[#161212]">
                        {game.name}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-[12px] text-[#5e5454]">
                        <span className="truncate">{formatPlaytime(game.totalPlaytimeSeconds)}</span>
                        <span className="shrink-0">{formatRelativeDate(game.lastPlayedIso)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-dashed border-[#161212]/[0.12] bg-[#FAF9F9]/70 px-5 py-4 text-[13px] text-[#5e5454]">
              <span>Games you play across your PCs appear here for quick launching.</span>
            </div>
          )}
        </section>

        <section aria-label="Launchers quick access" className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13.5px] font-semibold text-[#5e5454]">Launchers</h2>
            <span className="text-[12px] text-[#5e5454]/80">Quick access</span>
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
                  className="app-no-drag group flex cursor-pointer flex-col justify-between rounded-xl border border-[#161212]/[0.08] bg-[#FAF9F9] p-3.5 text-left transition-colors hover:border-[#713131]/25 hover:bg-[#161212]/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
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
                    <div className="mt-0.5 text-[11.5px] text-[#5e5454]">
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
