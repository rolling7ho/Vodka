import type { HomeGameItem } from '../../../../shared/ipc'
import { ArrowLeftIcon } from '../icons/ArrowLeftIcon'
import { GameControllerIcon, SpinnerIcon } from '../icons/OnboardingIcons'
import { PcIcon } from '../icons/SidebarIcons'

interface GameDetailProps {
  game: HomeGameItem
  isLaunching: boolean
  errorMessage: string | null
  onBack: () => void
  onPlay: (game: HomeGameItem) => void
  onOpenPc: (bottlePath: string) => void
}

function formatDetailPlaytime(seconds: number): string {
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

function formatLastPlayed(iso: string | null): string {
  if (!iso) {
    return 'Never played'
  }
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) {
    return 'Recently'
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
  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-[1040px] px-9 pt-12 pb-14">
        <button
          type="button"
          onClick={onBack}
          className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#161212]/[0.08] bg-[#FAF9F8] px-3.5 py-1.5 text-[13px] font-medium text-[#4a4242] transition-colors hover:border-[#713131]/25 hover:text-[#713131]"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
          <span>Back to Home</span>
        </button>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/20 bg-red-50/90 px-4 py-2.5 text-[13px] text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <div className="relative mt-5 flex min-h-[268px] flex-col justify-end overflow-hidden rounded-[20px] bg-[#241515] p-7 text-white shadow-[0_14px_36px_rgba(22,18,18,0.12)]">
          {game.artworkDataUrl ? (
            <>
              <img
                src={game.artworkDataUrl}
                alt={game.name}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#120D0D]/90 via-[#161212]/42 to-[#161212]/20" />
            </>
          ) : (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#241515] via-[#5a2828] to-[#713131]" />
          )}

          <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="min-w-0">
              {game.logoDataUrl ? (
                <img
                  src={game.logoDataUrl}
                  alt={game.name}
                  className="max-h-24 max-w-[340px] object-contain object-left drop-shadow-[0_4px_16px_rgba(0,0,0,0.45)]"
                />
              ) : (
                <h1 className="truncate text-[32px] leading-tight font-bold tracking-[-0.035em] text-white">
                  {game.name}
                </h1>
              )}
            </div>

            <button
              type="button"
              disabled={isLaunching}
              onClick={() => onPlay(game)}
              className="app-no-drag inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white/92 px-6 py-2.5 text-[14px] font-semibold text-[#713131] shadow-[0_6px_18px_rgba(0,0,0,0.28)] ring-1 ring-white/40 backdrop-blur-md transition-all duration-150 hover:scale-[1.02] hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLaunching ? (
                <SpinnerIcon className="h-4 w-4" />
              ) : (
                <PlayTriangleIcon className="h-4 w-4" />
              )}
              <span>{isLaunching ? 'Launching...' : 'Play'}</span>
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#161212]/[0.04] bg-[#FAF9F8] px-5 py-4">
            <div className="text-[12px] font-medium text-[#5e5454]">Total Playtime</div>
            <div className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-[#161212] tabular-nums">
              {formatDetailPlaytime(game.totalPlaytimeSeconds)}
            </div>
          </div>

          <div className="rounded-2xl border border-[#161212]/[0.04] bg-[#FAF9F8] px-5 py-4">
            <div className="text-[12px] font-medium text-[#5e5454]">Last Played</div>
            <div className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-[#161212]">
              {formatLastPlayed(game.lastPlayedIso)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenPc(game.bottlePath)}
            className="app-no-drag group cursor-pointer rounded-2xl border border-[#161212]/[0.04] bg-[#FAF9F8] px-5 py-4 text-left transition-colors hover:border-[#713131]/20 hover:bg-white"
          >
            <div className="flex items-center justify-between text-[12px] font-medium text-[#5e5454]">
              <span>PC</span>
              <PcIcon className="h-4 w-4 text-[#713131]/75" />
            </div>
            <div className="mt-2 truncate text-[20px] font-bold tracking-[-0.02em] text-[#161212] group-hover:text-[#713131]">
              {game.bottleName}
            </div>
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-[#161212]/[0.04] bg-[#FAF9F8] p-6">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#161212]">
            <GameControllerIcon className="h-4 w-4 text-[#713131]" />
            <span>Game Details</span>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-3">
            <div>
              <dt className="text-[#5e5454]">Source</dt>
              <dd className="mt-1 font-medium text-[#161212]">
                {game.launchKind === 'steam' ? 'Steam' : 'Windows Executable'}
              </dd>
            </div>
            <div>
              <dt className="text-[#5e5454]">Graphics Routing</dt>
              <dd className="mt-1 font-medium text-[#161212]">Automatic</dd>
            </div>
            <div>
              <dt className="text-[#5e5454]">Last 2 Weeks</dt>
              <dd className="mt-1 font-medium text-[#161212] tabular-nums">
                {formatDetailPlaytime(game.lastTwoWeeksSeconds)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
