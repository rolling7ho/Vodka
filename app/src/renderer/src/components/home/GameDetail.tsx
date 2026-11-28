import { useState } from 'react'
import type { HomeGameItem } from '../../../../shared/ipc'
import { ArrowLeftIcon } from '../icons/ArrowLeftIcon'
import { GameControllerIcon, SpinnerIcon } from '../icons/OnboardingIcons'
import { HeartIcon, InfoIcon, PcIcon, SettingsGearIcon } from '../icons/SidebarIcons'

interface GameDetailProps {
  game: HomeGameItem
  isLaunching: boolean
  errorMessage: string | null
  onBack: () => void
  onPlay: (game: HomeGameItem) => void
  onOpenPc: (bottlePath: string) => void
}

type DetailTab = 'overview' | 'compatibility' | 'pc'

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

export function GameDetail({
  game,
  isLaunching,
  errorMessage,
  onBack,
  onPlay,
  onOpenPc
}: GameDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [isFavorite, setIsFavorite] = useState(false)

  const recentSharePercent =
    game.totalPlaytimeSeconds > 0
      ? Math.min(100, Math.round((game.lastTwoWeeksSeconds / game.totalPlaytimeSeconds) * 100))
      : 0

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

        <button
          type="button"
          onClick={onBack}
          className="app-no-drag group absolute top-14 left-6 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#161212]/58 px-3.5 py-1.5 text-[12.5px] font-medium text-white/92 ring-1 ring-white/20 backdrop-blur-md transition-colors hover:bg-[#161212]/80"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
          <span>Library</span>
        </button>

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
              className="app-no-drag inline-flex cursor-pointer items-center gap-2.5 rounded-xl bg-[#713131] px-8 py-2.5 text-[14.5px] font-semibold text-white shadow-[0_6px_16px_rgba(113,49,49,0.22)] transition-all duration-150 hover:bg-[#5E2828] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
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

              <div>
                <div className="text-[10.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                  Last 2 Weeks
                </div>
                <div className="mt-0.5 font-semibold text-[#161212] tabular-nums">
                  {formatDetailPlaytime(game.lastTwoWeeksSeconds)}
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
              aria-label="Graphics and compatibility settings"
              title="Graphics and compatibility"
              onClick={() => setActiveTab('compatibility')}
              className="app-no-drag inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-[#161212]/[0.05] text-[#4a4242] transition-colors hover:bg-[#161212]/[0.1] hover:text-[#161212]"
            >
              <SettingsGearIcon className="h-[17px] w-[17px]" />
            </button>

            <button
              type="button"
              aria-label="PC details"
              title="PC details"
              onClick={() => setActiveTab('pc')}
              className="app-no-drag inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-[#161212]/[0.05] text-[#4a4242] transition-colors hover:bg-[#161212]/[0.1] hover:text-[#161212]"
            >
              <InfoIcon className="h-[17px] w-[17px]" />
            </button>

            <button
              type="button"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={isFavorite}
              onClick={() => setIsFavorite((prev) => !prev)}
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
              { id: 'compatibility', label: 'Graphics & Compatibility' },
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

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {activeTab === 'overview' && (
              <>
                <div className="rounded-2xl bg-[#FAF9F8] p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-[14px] font-semibold text-[#161212]">
                        <GameControllerIcon className="h-4 w-4 text-[#713131]" />
                        <span>Ready in {game.bottleName}</span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-[#5e5454]">
                        {game.launchKind === 'steam'
                          ? 'Managed through Steam with automatic Metal and DirectX graphics routing enabled for Apple Silicon.'
                          : 'Configured as a Windows executable with automatic Metal and DirectX graphics routing enabled.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenPc(game.bottlePath)}
                      className="app-no-drag shrink-0 cursor-pointer rounded-xl bg-white px-3.5 py-2 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:text-[#713131]"
                    >
                      Open {game.bottleName}
                    </button>
                  </div>
                </div>

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
                        {game.lastTwoWeeksSeconds > 0
                          ? `Played ${formatDetailPlaytime(game.lastTwoWeeksSeconds)} over the last two weeks`
                          : 'No sessions recorded in the last two weeks'}
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-[#5e5454] tabular-nums">
                        Lifetime playtime across this PC reaches{' '}
                        {formatDetailPlaytime(game.totalPlaytimeSeconds)}.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'compatibility' && (
              <div className="rounded-2xl bg-[#FAF9F8] p-6">
                <h2 className="text-[14px] font-semibold text-[#161212]">
                  Graphics &amp; Compatibility
                </h2>
                <dl className="mt-4 grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="text-[#5e5454]">Graphics Routing</dt>
                    <dd className="mt-1 font-medium text-[#161212]">Automatic</dd>
                  </div>
                  <div>
                    <dt className="text-[#5e5454]">Launcher Runtime</dt>
                    <dd className="mt-1 font-medium text-[#161212]">
                      {game.launchKind === 'steam' ? 'Steam Client' : 'Direct Executable'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#5e5454]">Apple Silicon Translation</dt>
                    <dd className="mt-1 font-medium text-[#161212]">Rosetta 2 + GPTK</dd>
                  </div>
                  <div>
                    <dt className="text-[#5e5454]">Windows Target</dt>
                    <dd className="mt-1 font-medium text-[#161212]">Windows 10 (64-bit)</dd>
                  </div>
                </dl>
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
              <div className="mt-2.5 flex items-baseline justify-between text-[13px]">
                <span className="font-semibold text-[#161212] tabular-nums">
                  {formatDetailPlaytime(game.totalPlaytimeSeconds)} total
                </span>
                <span className="text-[12px] text-[#5e5454] tabular-nums">
                  {recentSharePercent}% recent
                </span>
              </div>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#161212]/[0.08]">
                <div
                  className="h-full rounded-full bg-[#713131] transition-all duration-300"
                  style={{ width: `${Math.max(recentSharePercent, game.lastTwoWeeksSeconds > 0 ? 6 : 0)}%` }}
                />
              </div>
              <div className="mt-2 text-[12px] text-[#5e5454] tabular-nums">
                Last two weeks: {formatDetailPlaytime(game.lastTwoWeeksSeconds)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
