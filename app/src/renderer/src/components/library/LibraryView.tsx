import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import type { HomeGameItem } from '../../../../shared/ipc'
import { GameControllerIcon, SpinnerIcon } from '../icons/OnboardingIcons'
import { ChevronDownIcon, PlusIcon, SearchIcon } from '../icons/SidebarIcons'
import { formatHoverPlaytime, GameHoverCard } from './GameHoverCard'

interface LibraryViewProps {
  games: HomeGameItem[]
  launchingId: string | null
  errorMessage: string | null
  onSelectGame: (gameId: string) => void
  onPlayGame: (game: HomeGameItem) => void
  onOpenCreatePc: () => void
}

type LibrarySortMode = 'alphabetical' | 'recent' | 'hours'

interface HoveredCardState {
  game: HomeGameItem
  rect: DOMRect
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

function compareByRecent(lhs: HomeGameItem, rhs: HomeGameItem): number {
  const leftMs = lhs.lastPlayedIso ? Date.parse(lhs.lastPlayedIso) : Number.NaN
  const rightMs = rhs.lastPlayedIso ? Date.parse(rhs.lastPlayedIso) : Number.NaN
  const leftValid = !Number.isNaN(leftMs)
  const rightValid = !Number.isNaN(rightMs)

  if (leftValid && rightValid && leftMs !== rightMs) {
    return rightMs - leftMs
  }
  if (leftValid !== rightValid) {
    return leftValid ? -1 : 1
  }
  if (lhs.totalPlaytimeSeconds !== rhs.totalPlaytimeSeconds) {
    return rhs.totalPlaytimeSeconds - lhs.totalPlaytimeSeconds
  }
  return lhs.name.localeCompare(rhs.name)
}

function formatRecentDateGroup(iso: string | null): string {
  if (!iso) {
    return 'Unplayed'
  }
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) {
    return 'Earlier'
  }
  const now = new Date()
  const playedDate = new Date(timestamp)
  const diffDays = (now.getTime() - playedDate.getTime()) / 86_400_000

  if (diffDays <= 7) {
    return 'This week'
  }
  if (
    playedDate.getFullYear() === now.getFullYear() &&
    playedDate.getMonth() === now.getMonth()
  ) {
    return 'Earlier this month'
  }
  if (playedDate.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(undefined, { month: 'long' }).format(playedDate)
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(playedDate)
}

export function LibraryView({
  games,
  launchingId,
  errorMessage,
  onSelectGame,
  onPlayGame,
  onOpenCreatePc
}: LibraryViewProps) {
  const [sortMode, setSortMode] = useState<LibrarySortMode>('alphabetical')
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredCard, setHoveredCard] = useState<HoveredCardState | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const shelfRef = useRef<HTMLDivElement>(null)

  const clearHover = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setHoveredCard(null)
  }

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current)
      }
    }
  }, [])

  const scheduleHover = (game: HomeGameItem, element: HTMLElement) => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current)
    }
    const rect = element.getBoundingClientRect()
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null
      setHoveredCard({ game, rect })
    }, 220)
  }

  const recentGames = useMemo(() => [...games].sort(compareByRecent), [games])

  const filteredAndSortedGames = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = query
      ? games.filter(
          (game) =>
            game.name.toLowerCase().includes(query) ||
            game.bottleName.toLowerCase().includes(query)
        )
      : [...games]

    return filtered.sort((lhs, rhs) => {
      switch (sortMode) {
        case 'recent':
          return compareByRecent(lhs, rhs)
        case 'hours':
          if (lhs.totalPlaytimeSeconds !== rhs.totalPlaytimeSeconds) {
            return rhs.totalPlaytimeSeconds - lhs.totalPlaytimeSeconds
          }
          return lhs.name.localeCompare(rhs.name)
        case 'alphabetical':
        default:
          return lhs.name.localeCompare(rhs.name)
      }
    })
  }, [games, searchQuery, sortMode])

  const scrollShelf = (direction: -1 | 1) => {
    clearHover()
    shelfRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' })
  }

  const featuredRecent = recentGames[0] ?? null
  const secondaryRecent = recentGames.slice(1)

  const openGame = (gameId: string) => {
    clearHover()
    onSelectGame(gameId)
  }

  const handleFeaturedPlayClick = (event: MouseEvent<HTMLButtonElement>, game: HomeGameItem) => {
    event.stopPropagation()
    clearHover()
    onPlayGame(game)
  }

  return (
    <div
      onScroll={clearHover}
      className="flex-1 overflow-y-auto bg-white"
    >
      <div className="mx-auto w-full max-w-[1120px] px-9 pt-12 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[28px] font-bold tracking-[-0.035em] text-[#161212]">Library</h1>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/20 bg-red-50/90 px-4 py-2.5 text-[13px] text-red-700"
          >
            {errorMessage}
          </div>
        )}

        {games.length === 0 ? (
          <div className="mt-7 flex flex-col items-start justify-between gap-5 rounded-2xl bg-[#FAF9F8] p-7 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#161212]">
                Your game library is empty
              </h2>
              <p className="mt-1 text-[13.5px] text-[#5e5454]">
                Create a PC and install a launcher or Windows executable to see your games here.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCreatePc}
              className="app-no-drag inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[#713131] px-5 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-[#5E2828]"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Create a PC</span>
            </button>
          </div>
        ) : (
          <>
            <section aria-label="Recent games" className="mt-7">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-[#161212]">
                  Recent Games
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Scroll recent games left"
                    onClick={() => scrollShelf(-1)}
                    className="app-no-drag inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#5e5454] transition-colors hover:bg-[#161212]/[0.06] hover:text-[#161212]"
                  >
                    <ChevronDownIcon className="h-4 w-4 rotate-90" />
                  </button>
                  <button
                    type="button"
                    aria-label="Scroll recent games right"
                    onClick={() => scrollShelf(1)}
                    className="app-no-drag inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#5e5454] transition-colors hover:bg-[#161212]/[0.06] hover:text-[#161212]"
                  >
                    <ChevronDownIcon className="h-4 w-4 -rotate-90" />
                  </button>
                </div>
              </div>

              <div
                ref={shelfRef}
                onScroll={clearHover}
                className="flex gap-4 overflow-x-auto pt-1 pb-3"
              >
                {featuredRecent && (
                  <div className="shrink-0">
                    <div className="mb-1.5 h-5 text-[12px] font-medium text-[#5e5454]">
                      {formatRecentDateGroup(featuredRecent.lastPlayedIso)}
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openGame(featuredRecent.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openGame(featuredRecent.id)
                        }
                      }}
                      onMouseEnter={(event) => scheduleHover(featuredRecent, event.currentTarget)}
                      onMouseLeave={clearHover}
                      className="app-no-drag group relative flex h-[216px] w-[304px] cursor-pointer flex-col overflow-hidden rounded-2xl bg-[#1A1414] shadow-[0_10px_24px_rgba(22,18,18,0.12)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(22,18,18,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#713131]/60"
                    >
                      <div className="relative h-[144px] w-full overflow-hidden">
                        {featuredRecent.artworkDataUrl ? (
                          <img
                            src={featuredRecent.artworkDataUrl}
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2B1B1B] to-[#522828] text-white/30">
                            <GameControllerIcon className="h-10 w-10" />
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/65" />
                        {featuredRecent.logoDataUrl ? (
                          <img
                            src={featuredRecent.logoDataUrl}
                            alt={featuredRecent.name}
                            className="pointer-events-none absolute bottom-2.5 left-3.5 max-h-10 max-w-[180px] object-contain object-left drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"
                          />
                        ) : (
                          <span className="pointer-events-none absolute right-3.5 bottom-2.5 left-3.5 truncate text-[16px] font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
                            {featuredRecent.name}
                          </span>
                        )}
                      </div>

                      <div className="relative flex flex-1 items-center gap-3.5 overflow-hidden bg-[#221D1D] px-3.5">
                        {featuredRecent.artworkDataUrl && (
                          <img
                            src={featuredRecent.artworkDataUrl}
                            alt=""
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-xl"
                          />
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-[#1B1717]/78 backdrop-blur-md" />

                        <button
                          type="button"
                          disabled={launchingId !== null}
                          aria-label={`Play ${featuredRecent.name}`}
                          onClick={(event) => handleFeaturedPlayClick(event, featuredRecent)}
                          className="app-no-drag relative z-10 inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#713131] text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)] transition-all duration-150 hover:bg-[#5E2828] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {launchingId === featuredRecent.id ? (
                            <SpinnerIcon className="h-4 w-4" />
                          ) : (
                            <PlayTriangleIcon className="h-4 w-4 translate-x-[0.5px]" />
                          )}
                        </button>

                        <div className="relative z-10 min-w-0 text-white">
                          <div className="text-[10px] font-semibold tracking-[0.06em] text-white/55 uppercase">
                            Time Played
                          </div>
                          <div className="truncate text-[11.5px] text-white/85 tabular-nums">
                            Last two weeks: {formatHoverPlaytime(featuredRecent.lastTwoWeeksSeconds)}
                          </div>
                          <div className="truncate text-[11.5px] text-white/75 tabular-nums">
                            Total: {formatHoverPlaytime(featuredRecent.totalPlaytimeSeconds)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {secondaryRecent.map((game, index) => {
                  const prevGroup = formatRecentDateGroup(
                    index === 0
                      ? featuredRecent?.lastPlayedIso ?? null
                      : secondaryRecent[index - 1].lastPlayedIso
                  )
                  const groupLabel = formatRecentDateGroup(game.lastPlayedIso)
                  const showGroupLabel = groupLabel !== prevGroup
                  const coverSrc = game.portraitArtworkDataUrl ?? game.artworkDataUrl

                  return (
                    <div key={game.id} className="shrink-0">
                      <div className="mb-1.5 h-5 text-[12px] font-medium text-[#5e5454]">
                        {showGroupLabel ? groupLabel : ''}
                      </div>
                      <button
                        type="button"
                        onClick={() => openGame(game.id)}
                        onMouseEnter={(event) => scheduleHover(game, event.currentTarget)}
                        onMouseLeave={clearHover}
                        aria-label={game.name}
                        className="app-no-drag group relative block h-[216px] w-[144px] cursor-pointer overflow-hidden rounded-2xl bg-[#1C1515] text-left shadow-[0_8px_20px_rgba(22,18,18,0.1)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(22,18,18,0.17)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#713131]/60"
                      >
                        {coverSrc ? (
                          <img
                            src={coverSrc}
                            alt={game.name}
                            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#2B1B1B] to-[#522828] p-3 text-center text-white">
                            <GameControllerIcon className="h-8 w-8 text-white/40" />
                            <span className="line-clamp-2 text-[13px] font-semibold">
                              {game.name}
                            </span>
                          </div>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>

            <section aria-label="All games" className="mt-9">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-baseline gap-1.5">
                    <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-[#161212]">
                      All Games
                    </h2>
                    <span className="text-[13px] font-medium text-[#5e5454] tabular-nums">
                      ({filteredAndSortedGames.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold tracking-[0.05em] text-[#5e5454]/80 uppercase">
                      Sort By
                    </span>
                    <div className="relative">
                      <select
                        aria-label="Sort games"
                        value={sortMode}
                        onChange={(event) => setSortMode(event.target.value as LibrarySortMode)}
                        className="app-no-drag cursor-pointer appearance-none rounded-lg bg-[#FAF9F8] py-1.5 pr-7 pl-3 text-[12.5px] font-medium text-[#161212] transition-colors hover:bg-[#F3EFEF] focus:outline-2 focus:outline-[#713131]/50"
                      >
                        <option value="alphabetical">Alphabetical</option>
                        <option value="recent">Recently Played</option>
                        <option value="hours">Hours Played</option>
                      </select>
                      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-[#5e5454]" />
                    </div>
                  </div>
                </div>

                <label className="relative flex items-center">
                  <SearchIcon className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#5e5454]/75" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search games..."
                    aria-label="Search games"
                    className="app-no-drag w-48 rounded-lg bg-[#FAF9F8] py-1.5 pr-3 pl-8 text-[12.5px] text-[#161212] placeholder:text-[#5e5454]/65 focus:bg-[#F6F3F3] focus:outline-2 focus:outline-[#713131]/40"
                  />
                </label>
              </div>

              {filteredAndSortedGames.length > 0 ? (
                <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {filteredAndSortedGames.map((game) => {
                    const coverSrc = game.portraitArtworkDataUrl ?? game.artworkDataUrl
                    return (
                      <button
                        key={game.id}
                        type="button"
                        onClick={() => openGame(game.id)}
                        onMouseEnter={(event) => scheduleHover(game, event.currentTarget)}
                        onMouseLeave={clearHover}
                        aria-label={game.name}
                        className="app-no-drag group relative aspect-[2/3] w-full cursor-pointer overflow-hidden rounded-2xl bg-[#1C1515] text-left shadow-[0_8px_20px_rgba(22,18,18,0.09)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(22,18,18,0.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#713131]/60"
                      >
                        {coverSrc ? (
                          <img
                            src={coverSrc}
                            alt={game.name}
                            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#2B1B1B] to-[#522828] p-3 text-center text-white">
                            <GameControllerIcon className="h-8 w-8 text-white/40" />
                            <span className="line-clamp-2 text-[13px] font-semibold">
                              {game.name}
                            </span>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-2xl bg-[#FAF9F8] px-5 py-8 text-center text-[13px] text-[#5e5454]">
                  No games match your search.
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {hoveredCard && (
        <GameHoverCard game={hoveredCard.game} anchorRect={hoveredCard.rect} />
      )}
    </div>
  )
}
