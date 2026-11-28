import { useState } from 'react'
import type { DiscoveredBottle } from '../../../../shared/ipc'

interface WhiskyMigrationModalProps {
  bottles: DiscoveredBottle[]
  onClose: () => void
  onImported: (count: number) => void
}

export function WhiskyMigrationModal({
  bottles,
  onClose,
  onImported
}: WhiskyMigrationModalProps) {
  const [selected, setSelected] = useState<string[]>(bottles.map((item) => item.path))
  const [isImporting, setIsImporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const togglePath = (path: string) => {
    setSelected((prev) =>
      prev.includes(path) ? prev.filter((item) => item !== path) : [...prev, path]
    )
  }

  const handleImport = async () => {
    if (!window.gmac || selected.length === 0) {
      return
    }
    setIsImporting(true)
    setErrorMessage(null)
    try {
      const res = await window.gmac.importLegacyBottles(selected)
      onImported(res.importedCount)
      onClose()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to import Whisky bottles.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whisky-migration-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#161212]/40 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="app-no-drag w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-[#161212]/[0.08]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="whisky-migration-title" className="text-[17px] font-bold text-[#161212]">
          Migrate from Original Whisky
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[#5e5454]">
          Import existing Whisky bottles into Gmac in place without duplicating game files.
        </p>

        {bottles.length > 0 ? (
          <div className="mt-4 max-h-60 divide-y divide-[#161212]/[0.06] overflow-y-auto rounded-xl bg-[#FAF9F8] px-3.5">
            {bottles.map((bottle) => {
              const checked = selected.includes(bottle.path)
              return (
                <label
                  key={bottle.id}
                  className="flex cursor-pointer items-start gap-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePath(bottle.path)}
                    className="mt-1 h-4 w-4 accent-[#713131]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[#161212]">{bottle.name}</div>
                    <div className="truncate font-mono text-[11px] text-[#5e5454]">
                      {bottle.path}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-[#FAF9F8] px-4 py-6 text-center text-[12.5px] text-[#5e5454]">
            No unimported Whisky bottles were detected on this Mac.
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 rounded-lg bg-red-500/[0.08] px-3 py-2 text-[12px] text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="app-no-drag cursor-pointer rounded-xl px-4 py-2 text-[13px] font-medium text-[#5e5454] transition-colors hover:bg-[#161212]/[0.06]"
          >
            Cancel
          </button>
          {bottles.length > 0 && (
            <button
              type="button"
              disabled={isImporting || selected.length === 0}
              onClick={() => void handleImport()}
              className="app-no-drag cursor-pointer rounded-xl bg-[#713131] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#5E2828] disabled:opacity-55"
            >
              {isImporting ? 'Importing...' : `Import (${selected.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
