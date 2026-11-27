import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import { CheckIcon, FolderIcon } from '../icons/OnboardingIcons'
import type { DiscoveredBottle } from './types'

interface ImportPCsStepProps {
  bottles: DiscoveredBottle[]
  selectedIds: string[]
  onToggleBottle: (id: string) => void
  onToggleAll: () => void
  onImportSelected: () => void
  onSkip: () => void
}

export function ImportPCsStep({
  bottles,
  selectedIds,
  onToggleBottle,
  onToggleAll,
  onImportSelected,
  onSkip
}: ImportPCsStepProps) {
  const allSelected = bottles.length > 0 && selectedIds.length === bottles.length

  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 pb-16">
      <h2 className="text-center text-[34px] leading-tight font-semibold tracking-[-0.03em] text-[#161212]">
        Import existing PCs
      </h2>
      <p className="mt-2.5 max-w-lg text-center text-[15px] text-[#5e5454]">
        Bottles from the original Whisky app are referenced in place without copying or moving game
        files.
      </p>

      <div className="mt-7 w-full max-w-lg rounded-2xl border border-[#161212]/10 bg-white/75 p-5 shadow-xs backdrop-blur-md">
        {bottles.length === 0 ? (
          <div className="flex flex-col items-center py-5 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#161212]/[0.05] text-[#5e5454]">
              <FolderIcon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[15px] font-medium text-[#161212]">
              No bottles from the original Whisky app were found.
            </p>
            <p className="mt-1 max-w-sm text-[13px] text-[#5e5454]">
              You can import an existing PC folder at any time from File &gt; Import PC.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between pb-3">
              <span className="text-[13px] font-medium text-[#5e5454]">
                {bottles.length} discovered {bottles.length === 1 ? 'PC' : 'PCs'}
              </span>
              <button
                type="button"
                onClick={onToggleAll}
                className="app-no-drag cursor-pointer text-[13px] font-medium text-[#007AFF] hover:underline"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-56 divide-y divide-[#161212]/8 overflow-y-auto border-t border-[#161212]/8">
              {bottles.map((bottle) => {
                const isChecked = selectedIds.includes(bottle.id)
                return (
                  <button
                    key={bottle.id}
                    type="button"
                    aria-pressed={isChecked}
                    onClick={() => onToggleBottle(bottle.id)}
                    className="app-no-drag flex w-full cursor-pointer items-center gap-3 py-3 text-left transition-colors hover:bg-[#161212]/[0.02]"
                  >
                    <span
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${
                        isChecked
                          ? 'bg-[#007AFF] text-white'
                          : 'border border-[#161212]/20 bg-white text-transparent'
                      }`}
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-[#161212]">
                        {bottle.name}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[12px] text-[#5e5454]">
                        {bottle.path}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3">
        {bottles.length > 0 ? (
          <>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={onImportSelected}
              className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>Import Selected</span>
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={onSkip}
              className="app-no-drag cursor-pointer rounded-full px-5 py-3 text-[14px] font-medium text-[#5e5454] transition-colors hover:bg-[#161212]/[0.05] hover:text-[#161212]"
            >
              Skip
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onSkip}
            className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98]"
          >
            <span>Continue</span>
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </main>
  )
}
