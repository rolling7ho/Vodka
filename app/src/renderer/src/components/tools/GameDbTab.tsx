import { useEffect, useState } from 'react'
import type { BottleSummary, GameDbEntryItem } from '../../../../shared/ipc'
import { SearchIcon } from '../icons/SidebarIcons'

interface GameDbTabProps {
  pcs: BottleSummary[]
}

export function GameDbTab({ pcs }: GameDbTabProps) {
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<GameDbEntryItem[]>([])
  const [targetBottlePath, setTargetBottlePath] = useState(pcs[0]?.path ?? '')
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!targetBottlePath && pcs.length > 0) {
      setTargetBottlePath(pcs[0].path)
    }
  }, [pcs, targetBottlePath])

  useEffect(() => {
    if (!window.gmac) {
      return
    }
    const timer = window.setTimeout(() => {
      void window.gmac
        ?.listGameDb(query.trim() ? { query: query.trim() } : undefined)
        .then((res) => setEntries(res.entries))
        .catch(() => {})
    }, 120)
    return () => window.clearTimeout(timer)
  }, [query])

  const handleApplyEntry = async (entry: GameDbEntryItem) => {
    if (!targetBottlePath || !window.gmac) {
      return
    }
    const def = entry.variants.find((variant) => variant.isDefault) ?? entry.variants[0]
    if (!def) {
      return
    }
    const res = await window.gmac.applyGameDb({
      bottlePath: targetBottlePath,
      entryId: entry.id,
      variantId: def.id
    })
    setAppliedMessage(
      `Applied "${entry.title}" (${def.label}) — ${res.appliedCount} settings updated.`
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FAF9F8] p-4">
        <label className="relative flex min-w-[220px] flex-1 items-center">
          <SearchIcon className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[#5e5454]/75" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search verified GameDB compatibility presets..."
            aria-label="Search GameDB"
            className="app-no-drag w-full rounded-xl bg-white py-2 pr-3 pl-8 text-[12.5px] text-[#161212] placeholder-[#5e5454]/55 ring-1 ring-[#161212]/[0.08] focus:outline-none"
          />
        </label>

        {pcs.length > 0 && (
          <select
            aria-label="Target PC for GameDB presets"
            value={targetBottlePath}
            onChange={(event) => setTargetBottlePath(event.target.value)}
            className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08]"
          >
            {pcs.map((pc) => (
              <option key={pc.path} value={pc.path}>
                Apply to: {pc.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {appliedMessage && (
        <div className="rounded-xl bg-emerald-500/10 px-4 py-2.5 text-[12.5px] font-medium text-emerald-700">
          {appliedMessage}
        </div>
      )}

      <div className="divide-y divide-[#161212]/[0.06] rounded-2xl bg-[#FAF9F8] px-5">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-wrap items-start justify-between gap-3 py-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold text-[#161212]">{entry.title}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#5e5454] ring-1 ring-[#161212]/[0.06]">
                  {entry.ratingLabel}
                </span>
                {entry.steamAppId != null && (
                  <span className="font-mono text-[11px] text-[#5e5454]">
                    App {entry.steamAppId}
                  </span>
                )}
              </div>
              {entry.notes[0] && (
                <p className="mt-1 text-[12px] text-[#5e5454]">{entry.notes[0]}</p>
              )}
            </div>

            {entry.variants.length > 0 && (
              <button
                type="button"
                disabled={!targetBottlePath}
                onClick={() => void handleApplyEntry(entry)}
                className="app-no-drag shrink-0 cursor-pointer rounded-xl bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF] disabled:opacity-50"
              >
                Apply Default
              </button>
            )}
          </div>
        ))}
        {entries.length === 0 && (
          <div className="py-8 text-center text-[13px] text-[#5e5454]">
            No GameDB entries matched your filter.
          </div>
        )}
      </div>
    </div>
  )
}
