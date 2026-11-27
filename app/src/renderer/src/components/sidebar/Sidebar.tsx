import type { PointerEvent } from 'react'
import type { BottleSummary } from '../../../../shared/ipc'
import { GmacWordmark } from '../GmacWordmark'
import { HomeIcon, LibraryGridIcon, PcIcon, SettingsGearIcon } from '../icons/SidebarIcons'

export const DEFAULT_SIDEBAR_WIDTH = 232
export const MIN_SIDEBAR_WIDTH = 180
export const MAX_SIDEBAR_WIDTH = 340
export const COLLAPSE_THRESHOLD = 148
export const SIDEBAR_EXPAND_EASING = '380ms cubic-bezier(0.19, 1, 0.22, 1)'
export const SIDEBAR_COLLAPSE_EASING = '320ms cubic-bezier(0.22, 1, 0.36, 1)'

export type SidebarDestination =
  | { kind: 'home' }
  | { kind: 'library' }
  | { kind: 'pc'; path: string }
  | { kind: 'settings' }

interface SidebarProps {
  activeDestination: SidebarDestination
  pcs: BottleSummary[]
  width: number
  isCollapsed: boolean
  isResizing: boolean
  onSelect: (destination: SidebarDestination) => void
  onResizeStart: (event: PointerEvent<HTMLDivElement>) => void
}

const NAV_BUTTON_BASE =
  'app-no-drag flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#007AFF]'

function navButtonClass(isActive: boolean, muted = false): string {
  if (isActive) {
    return `${NAV_BUTTON_BASE} bg-[#713131]/[0.09] font-medium text-[#713131]`
  }
  return `${NAV_BUTTON_BASE} font-normal text-[#4a4242] hover:bg-[#161212]/[0.05] hover:text-[#713131]${
    muted ? ' opacity-55' : ''
  }`
}

export function Sidebar({
  activeDestination,
  pcs,
  width,
  isCollapsed,
  isResizing,
  onSelect,
  onResizeStart
}: SidebarProps) {
  const isHomeActive = activeDestination.kind === 'home'
  const isLibraryActive = activeDestination.kind === 'library'
  const isSettingsActive = activeDestination.kind === 'settings'
  const panelTiming = isCollapsed ? SIDEBAR_COLLAPSE_EASING : SIDEBAR_EXPAND_EASING

  return (
    <div
      className="relative h-full shrink-0"
      style={{
        width: isCollapsed ? 0 : width,
        willChange: isResizing ? 'auto' : 'width',
        transition: isResizing ? 'none' : `width ${panelTiming}`
      }}
    >
      <div className="h-full w-full overflow-hidden">
        <aside
          aria-label="Main navigation"
          aria-hidden={isCollapsed}
          className={`flex h-full flex-col border-r border-[#161212]/[0.08] bg-[#F8F7F7] ${
            isCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
          style={{
            width,
            transform: isCollapsed ? 'translate3d(-28px, 0, 0)' : 'translate3d(0, 0, 0)',
            willChange: isResizing ? 'auto' : 'transform, opacity',
            transition: isResizing
              ? 'none'
              : isCollapsed
                ? `opacity 170ms ease-in, transform ${SIDEBAR_COLLAPSE_EASING}`
                : `opacity 260ms ease-out 55ms, transform ${SIDEBAR_EXPAND_EASING}`
          }}
        >
          <div className="flex items-center px-4 pt-12 pb-4">
            <GmacWordmark className="h-[26px] w-auto shrink-0" />
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
                  const isSelected =
                    activeDestination.kind === 'pc' && activeDestination.path === pc.path
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
      </div>

      {!isCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          aria-valuenow={width}
          onPointerDown={onResizeStart}
          className="app-no-drag group absolute top-0 -right-[3px] bottom-0 z-30 w-[7px] cursor-col-resize"
        >
          <div
            className={`mx-auto h-full w-[2px] transition-colors duration-150 ${
              isResizing ? 'bg-[#713131]' : 'bg-transparent group-hover:bg-[#713131]'
            }`}
          />
        </div>
      )}
    </div>
  )
}
