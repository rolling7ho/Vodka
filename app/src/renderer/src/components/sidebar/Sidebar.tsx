import type { BottleSummary } from '../../../../shared/ipc'
import { GmacLogo } from '../GmacLogo'
import { HomeIcon, LibraryGridIcon, PcIcon, SettingsGearIcon } from '../icons/SidebarIcons'

export type SidebarDestination =
  | { kind: 'home' }
  | { kind: 'library' }
  | { kind: 'pc'; path: string }
  | { kind: 'settings' }

interface SidebarProps {
  activeDestination: SidebarDestination
  pcs: BottleSummary[]
  onSelect: (destination: SidebarDestination) => void
}

const NAV_BUTTON_BASE =
  'app-no-drag flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#007AFF]'

function navButtonClass(isActive: boolean, muted = false): string {
  if (isActive) {
    return `${NAV_BUTTON_BASE} bg-[#713131]/[0.09] font-medium text-[#713131]`
  }
  return `${NAV_BUTTON_BASE} font-normal text-[#4a4242] hover:bg-[#161212]/[0.045] hover:text-[#161212]${
    muted ? ' opacity-55' : ''
  }`
}

export function Sidebar({ activeDestination, pcs, onSelect }: SidebarProps) {
  const isHomeActive = activeDestination.kind === 'home'
  const isLibraryActive = activeDestination.kind === 'library'
  const isSettingsActive = activeDestination.kind === 'settings'

  return (
    <aside
      aria-label="Main navigation"
      className="flex h-full w-[232px] shrink-0 flex-col border-r border-[#161212]/[0.08] bg-[#F8F7F7]"
    >
      <div className="app-drag flex items-center px-4 pt-12 pb-4">
        <GmacLogo className="h-7 w-7" />
      </div>

      <nav className="space-y-0.5 px-2.5">
        <button
          type="button"
          aria-current={isHomeActive ? 'page' : undefined}
          onClick={() => onSelect({ kind: 'home' })}
          className={navButtonClass(isHomeActive)}
        >
          <HomeIcon className="h-[17px] w-[17px] shrink-0" />
          <span>Home</span>
        </button>

        <button
          type="button"
          aria-current={isLibraryActive ? 'page' : undefined}
          onClick={() => onSelect({ kind: 'library' })}
          className={navButtonClass(isLibraryActive)}
        >
          <LibraryGridIcon className="h-[17px] w-[17px] shrink-0" />
          <span>Library</span>
        </button>
      </nav>

      <div className="mx-3 my-3 h-px bg-[#161212]/[0.08]" role="separator" />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5">
        <div className="px-2.5 pb-1.5 text-[11.5px] font-semibold text-[#5e5454]">PCs</div>

        {pcs.length > 0 ? (
          <div className="space-y-0.5">
            {pcs.map((pc) => {
              const isSelected = activeDestination.kind === 'pc' && activeDestination.path === pc.path
              return (
                <button
                  key={pc.path}
                  type="button"
                  aria-current={isSelected ? 'page' : undefined}
                  onClick={() => onSelect({ kind: 'pc', path: pc.path })}
                  className={navButtonClass(isSelected, !pc.isAvailable)}
                >
                  <PcIcon className="h-[16px] w-[16px] shrink-0" />
                  <span className="truncate">{pc.name}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="px-2.5 py-1.5 text-[13px] text-[#5e5454]/80">Create your first PC</p>
        )}
      </div>

      <div className="mx-3 my-2 h-px bg-[#161212]/[0.08]" role="separator" />

      <div className="px-2.5 pt-1 pb-3">
        <button
          type="button"
          aria-current={isSettingsActive ? 'page' : undefined}
          onClick={() => onSelect({ kind: 'settings' })}
          className={navButtonClass(isSettingsActive)}
        >
          <SettingsGearIcon className="h-[17px] w-[17px] shrink-0" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
