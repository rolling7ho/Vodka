import type { HomeGameItem } from '../../../../shared/ipc'

interface GameHoverCardProps {
  game: HomeGameItem
  anchorRect: DOMRect
}

const CARD_WIDTH = 272
const ESTIMATED_CARD_HEIGHT = 296
const VIEWPORT_MARGIN = 16
const HORIZONTAL_GAP = 12

export function formatHoverPlaytime(seconds: number): string {
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

export function GameHoverCard({ game, anchorRect }: GameHoverCardProps) {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800

  let left = anchorRect.right + HORIZONTAL_GAP
  if (left + CARD_WIDTH > viewportWidth - VIEWPORT_MARGIN) {
    left = anchorRect.left - CARD_WIDTH - HORIZONTAL_GAP
  }
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - CARD_WIDTH - VIEWPORT_MARGIN))

  const top = Math.max(
    VIEWPORT_MARGIN,
    Math.min(anchorRect.top, viewportHeight - ESTIMATED_CARD_HEIGHT - VIEWPORT_MARGIN)
  )

  const previewImage = game.artworkDataUrl ?? game.portraitArtworkDataUrl

  return (
    <div
      role="tooltip"
      style={{ left, top, width: CARD_WIDTH }}
      className="animate-context-in pointer-events-none fixed z-50 overflow-hidden rounded-2xl bg-[#1A1616] text-white shadow-[0_22px_50px_rgba(22,18,18,0.34)] ring-1 ring-white/12"
    >
      <div className="bg-[#251F1F] px-4 py-3">
        <div className="truncate text-[15.5px] font-bold tracking-[-0.015em] text-white">
          {game.name}
        </div>
      </div>

      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#141010]">
        {previewImage ? (
          <img
            src={previewImage}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#2B1B1B] to-[#522828]" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#191515] to-transparent" />
      </div>

      <div className="relative overflow-hidden bg-[#191515] px-4 pt-2.5 pb-4">
        {previewImage && (
          <img
            src={previewImage}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-xl"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-[#191515]/82 backdrop-blur-md" />

        <div className="relative z-10">
          <div className="truncate text-[14.5px] font-semibold text-white">
            {game.bottleName}
          </div>

          <div className="mt-3 text-[10.5px] font-semibold tracking-[0.06em] text-white/55 uppercase">
            Time Played
          </div>
          <div className="mt-1 text-[12.5px] text-white/82 tabular-nums">
            Last two weeks: {formatHoverPlaytime(game.lastTwoWeeksSeconds)}
          </div>
          <div className="mt-0.5 text-[12.5px] text-white/82 tabular-nums">
            Total: {formatHoverPlaytime(game.totalPlaytimeSeconds)}
          </div>
        </div>
      </div>
    </div>
  )
}
