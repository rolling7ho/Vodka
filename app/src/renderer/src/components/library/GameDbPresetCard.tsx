import { useEffect, useState } from 'react'
import type {
  GameDbChangeItem,
  GameDbEntryItem,
  HomeGameItem
} from '../../../../shared/ipc'

interface GameDbPresetCardProps {
  game: HomeGameItem
}

function ratingBadgeClass(rating: GameDbEntryItem['rating']): string {
  switch (rating) {
    case 'works':
      return 'bg-emerald-500/12 text-emerald-700'
    case 'playable':
      return 'bg-amber-500/15 text-amber-700'
    case 'broken':
    case 'notSupported':
      return 'bg-red-500/12 text-red-700'
    default:
      return 'bg-[#161212]/[0.07] text-[#5e5454]'
  }
}

export function GameDbPresetCard({ game }: GameDbPresetCardProps) {
  const [entry, setEntry] = useState<GameDbEntryItem | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [changes, setChanges] = useState<GameDbChangeItem[] | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!window.gmac) {
      return
    }
    let cancelled = false
    setEntry(null)
    setChanges(null)
    setStatusMessage(null)

    const lookup =
      game.launchKind === 'steam' && game.steamAppId != null
        ? { steamAppId: game.steamAppId }
        : { query: game.name }

    void window.gmac
      .listGameDb(lookup)
      .then((res) => {
        if (cancelled) {
          return
        }
        const matched =
          res.entries.find((item) => item.steamAppId === game.steamAppId) ??
          res.entries[0] ??
          null
        setEntry(matched)
        if (matched && matched.variants.length > 0) {
          const def = matched.variants.find((variant) => variant.isDefault) ?? matched.variants[0]
          setSelectedVariantId(def.id)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [game.id, game.launchKind, game.steamAppId, game.name])

  if (!entry) {
    return null
  }

  const activeVariant =
    entry.variants.find((variant) => variant.id === selectedVariantId) ?? entry.variants[0]

  const isMockGame = game.bottlePath.startsWith('/mock/')

  const handlePreview = async () => {
    if (!window.gmac || !activeVariant || isMockGame) {
      return
    }
    setStatusMessage(null)
    const res = await window.gmac.previewGameDb({
      bottlePath: game.bottlePath,
      entryId: entry.id,
      variantId: activeVariant.id
    })
    setChanges(res.changes)
    if (res.changes.length === 0) {
      setStatusMessage('PC already matches every setting in this preset.')
    }
  }

  const handleApply = async () => {
    if (!window.gmac || !activeVariant || isMockGame) {
      return
    }
    setIsApplying(true)
    setStatusMessage(null)
    try {
      const res = await window.gmac.applyGameDb({
        bottlePath: game.bottlePath,
        entryId: entry.id,
        variantId: activeVariant.id
      })
      setChanges(null)
      setStatusMessage(
        res.appliedCount > 0
          ? `Applied "${activeVariant.label}" (${res.appliedCount} settings updated on ${game.bottleName}).`
          : `Applied "${activeVariant.label}".`
      )
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl bg-[#FAF9F8] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
            GameDB Recommended Config
          </h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ratingBadgeClass(
              entry.rating
            )}`}
          >
            {entry.ratingLabel}
          </span>
        </div>
        {entry.antiCheat && (
          <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-red-700">
            Anti-cheat: {entry.antiCheat}
          </span>
        )}
      </div>

      {entry.notes.length > 0 && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#5e5454]">{entry.notes[0]}</p>
      )}

      {entry.variants.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <select
            aria-label="GameDB configuration variant"
            value={activeVariant?.id ?? ''}
            onChange={(event) => {
              setSelectedVariantId(event.target.value)
              setChanges(null)
              setStatusMessage(null)
            }}
            className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:outline-none"
          >
            {entry.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isMockGame}
              onClick={() => void handlePreview()}
              className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-1.5 text-[12px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF] disabled:opacity-50"
            >
              Preview Changes
            </button>
            <button
              type="button"
              disabled={isMockGame || isApplying}
              onClick={() => void handleApply()}
              className="app-no-drag cursor-pointer rounded-xl bg-[#713131] px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#5E2828] disabled:opacity-50"
            >
              {isApplying ? 'Applying...' : 'Apply Preset'}
            </button>
          </div>
        </div>
      )}

      {changes && changes.length > 0 && (
        <div className="mt-3 divide-y divide-[#161212]/[0.06] rounded-xl bg-white px-3.5 ring-1 ring-[#161212]/[0.06]">
          {changes.map((change) => (
            <div
              key={`${change.category}-${change.settingName}`}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12px]"
            >
              <span className="font-medium text-[#161212]">
                {change.category}: {change.settingName}
              </span>
              <span className="font-mono text-[#5e5454]">
                {change.currentValue} &rarr;{' '}
                <strong className="text-[#713131]">{change.newValue}</strong>
              </span>
            </div>
          ))}
        </div>
      )}

      {statusMessage && (
        <div className="mt-2.5 text-[12px] font-medium text-[#713131]">{statusMessage}</div>
      )}
    </div>
  )
}
