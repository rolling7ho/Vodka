import type { HomeGameItem } from '../../../../shared/ipc'

interface GameHoverCardProps {
  game: HomeGameItem
  anchorRect: DOMRect
  isClosing?: boolean
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}

export interface HoverCardPosition {
  left: number
  top: number
  width: number
  height: number
  opensLeftward: boolean
}

const CARD_WIDTH = 272
const ESTIMATED_CARD_HEIGHT = 296
const VIEWPORT_MARGIN = 16
const HORIZONTAL_GAP = 12

export function computeHoverCardPosition(anchorRect: DOMRect): HoverCardPosition {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800

  let left = anchorRect.right + HORIZONTAL_GAP
  let opensLeftward = false
  if (left + CARD_WIDTH > viewportWidth - VIEWPORT_MARGIN) {
    left = anchorRect.left - CARD_WIDTH - HORIZONTAL_GAP
    opensLeftward = true
  }
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - CARD_WIDTH - VIEWPORT_MARGIN))

  const top = Math.max(
    VIEWPORT_MARGIN,
    Math.min(anchorRect.top, viewportHeight - ESTIMATED_CARD_HEIGHT - VIEWPORT_MARGIN)
  )

  return {
    left,
    top,
    width: CARD_WIDTH,
    height: ESTIMATED_CARD_HEIGHT,
    opensLeftward
  }
}

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

export function GameHoverCard({
  game,
  anchorRect,
  isClosing = false,
  onPointerEnter,
  onPointerLeave
}: GameHoverCardProps) {
  const pos = computeHoverCardPosition(anchorRect)
  const previewImage = game.artworkDataUrl ?? game.portraitArtworkDataUrl

  return (
    <div
      role="tooltip"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        left: pos.left,
        top: pos.top,
        width: pos.width,
        backdropFilter: 'blur(26px) saturate(165%)',
        WebkitBackdropFilter: 'blur(26px) saturate(165%)'
      }}
      className={`app-no-drag fixed z-50 overflow-hidden rounded-2xl bg-[#1A1616]/44 text-white shadow-[0_22px_50px_rgba(22,18,18,0.28)] ring-1 ring-white/25 ${
        isClosing ? 'animate-glass-out pointer-events-none' : 'animate-glass-in pointer-events-auto'
      }`}
    >
      <div className="border-b border-white/12 bg-black/12 px-4 py-3">
        <div className="truncate text-[15.5px] font-bold tracking-[-0.015em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
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
      </div>

      <div className="border-t border-white/12 bg-black/12 px-4 pt-3 pb-4">
        <div className="truncate text-[13.5px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
          Installed on {game.bottleName}
        </div>

        <div className="mt-3 text-[10.5px] font-semibold tracking-[0.06em] text-white/70 uppercase">
          Time Played
        </div>
        <div className="mt-1 text-[12.5px] text-white/90 tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
          Last two weeks: {formatHoverPlaytime(game.lastTwoWeeksSeconds)}
        </div>
        <div className="mt-0.5 text-[12.5px] text-white/90 tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
          Total: {formatHoverPlaytime(game.totalPlaytimeSeconds)}
        </div>
      </div>
    </div>
  )
}
