import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent
} from 'react'
import type { BottleSummary } from '../../../../shared/ipc'
import { GmacWordmark } from '../GmacWordmark'
import { PcGlyph, type PcIconId } from '../icons/PcIcons'
import { HomeIcon, LibraryGridIcon, PlusIcon, SettingsGearIcon } from '../icons/SidebarIcons'
import { PcContextMenu } from './PcModals'

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
  onOpenCreatePc: () => void
  onRenamePc: (path: string, newName: string) => Promise<void>
  onRequestDeletePc: (pc: BottleSummary) => void
  onRequestChangeIcon: (pc: BottleSummary) => void
  onSelectPcIcon: (pc: BottleSummary, icon: PcIconId) => Promise<void>
  onReorderPcs: (orderedPaths: string[]) => Promise<void>
}

interface ContextMenuState {
  id: number
  pc: BottleSummary
  x: number
  y: number
}

interface DropTargetState {
  path: string
  position: 'before' | 'after'
}

const NAV_BUTTON_BASE =
  'app-no-drag flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#713131]/60'

function navButtonClass(isActive: boolean, muted = false): string {
  if (isActive) {
    return `${NAV_BUTTON_BASE} bg-[#713131]/[0.09] font-medium text-[#713131]`
  }
  return `${NAV_BUTTON_BASE} font-normal text-[#4a4242] hover:bg-[#161212]/[0.05] hover:text-[#713131]${
    muted ? ' opacity-55' : ''
  }`
}

function computeReorderedPaths(
  pcs: BottleSummary[],
  draggedPath: string,
  targetPath: string,
  position: 'before' | 'after'
): string[] | null {
  const paths = pcs.map((pc) => pc.path)
  const fromIndex = paths.indexOf(draggedPath)
  const targetIndex = paths.indexOf(targetPath)
  if (fromIndex === -1 || targetIndex === -1 || draggedPath === targetPath) {
    return null
  }

  const next = paths.filter((entry) => entry !== draggedPath)
  const adjustedTarget = next.indexOf(targetPath)
  const insertAt = position === 'before' ? adjustedTarget : adjustedTarget + 1
  next.splice(insertAt, 0, draggedPath)

  const unchanged = next.every((entry, idx) => entry === paths[idx])
  return unchanged ? null : next
}

export function Sidebar({
  activeDestination,
  pcs,
  width,
  isCollapsed,
  isResizing,
  onSelect,
  onResizeStart,
  onOpenCreatePc,
  onRenamePc,
  onRequestDeletePc,
  onRequestChangeIcon,
  onSelectPcIcon,
  onReorderPcs
}: SidebarProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [draggedPath, setDraggedPath] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTargetState | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const contextMenuSeqRef = useRef(0)

  useEffect(() => {
    if (!renamingPath) {
      return
    }
    requestAnimationFrame(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    })
  }, [renamingPath])

  const isHomeActive = activeDestination.kind === 'home'
  const isLibraryActive = activeDestination.kind === 'library'
  const isSettingsActive = activeDestination.kind === 'settings'
  const panelTiming = isCollapsed ? SIDEBAR_COLLAPSE_EASING : SIDEBAR_EXPAND_EASING

  const startInlineRename = (pc: BottleSummary) => {
    setRenamingPath(pc.path)
    setRenameDraft(pc.name)
  }

  const commitInlineRename = async (pc: BottleSummary) => {
    const trimmed = renameDraft.trim()
    setRenamingPath(null)
    if (!trimmed || trimmed === pc.name) {
      return
    }
    await onRenamePc(pc.path, trimmed)
  }

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>, pc: BottleSummary) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      void commitInlineRename(pc)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setRenamingPath(null)
    }
  }

  const handlePcContextMenu = (event: MouseEvent<HTMLButtonElement>, pc: BottleSummary) => {
    event.preventDefault()
    event.stopPropagation()
    contextMenuSeqRef.current += 1
    setContextMenu({
      id: contextMenuSeqRef.current,
      pc,
      x: event.clientX,
      y: event.clientY
    })
  }

  const handleDragStart = (event: DragEvent<HTMLDivElement>, path: string) => {
    if (renamingPath === path) {
      event.preventDefault()
      return
    }
    setDraggedPath(path)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', path)
  }

  const handleDragOverRow = (event: DragEvent<HTMLDivElement>, targetPath: string) => {
    if (!draggedPath || draggedPath === targetPath) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const rect = event.currentTarget.getBoundingClientRect()
    const position: 'before' | 'after' =
      event.clientY - rect.top < rect.height / 2 ? 'before' : 'after'

    setDropTarget((current) =>
      current?.path === targetPath && current.position === position
        ? current
        : { path: targetPath, position }
    )
  }

  const handleDropOnRow = (event: DragEvent<HTMLDivElement>, targetPath: string) => {
    event.preventDefault()
    const sourcePath = draggedPath ?? event.dataTransfer.getData('text/plain')
    const position =
      dropTarget?.path === targetPath
        ? dropTarget.position
        : event.clientY - event.currentTarget.getBoundingClientRect().top <
            event.currentTarget.getBoundingClientRect().height / 2
          ? 'before'
          : 'after'

    setDraggedPath(null)
    setDropTarget(null)

    if (!sourcePath) {
      return
    }
    const nextOrder = computeReorderedPaths(pcs, sourcePath, targetPath, position)
    if (nextOrder) {
      void onReorderPcs(nextOrder)
    }
  }

  const clearDragState = () => {
    setDraggedPath(null)
    setDropTarget(null)
  }

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
            <div className="flex items-center justify-between px-2.5 pb-1.5">
              <span className="text-[11.5px] font-semibold text-[#5e5454]">PCs</span>
              <button
                type="button"
                onClick={onOpenCreatePc}
                aria-label="Create PC"
                title="Create PC"
                className="app-no-drag inline-flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-md text-[#5e5454] transition-colors hover:bg-[#161212]/[0.06] hover:text-[#713131] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#713131]/60"
              >
                <PlusIcon className="h-[14px] w-[14px]" />
              </button>
            </div>

            {pcs.length > 0 ? (
              <div className="space-y-0.5">
                {pcs.map((pc) => {
                  const isSelected =
                    activeDestination.kind === 'pc' && activeDestination.path === pc.path
                  const isRenaming = renamingPath === pc.path
                  const isDragging = draggedPath === pc.path
                  const showBeforeIndicator =
                    dropTarget?.path === pc.path && dropTarget.position === 'before'
                  const showAfterIndicator =
                    dropTarget?.path === pc.path && dropTarget.position === 'after'

                  return (
                    <div
                      key={pc.path}
                      draggable={!isRenaming}
                      onDragStart={(event) => handleDragStart(event, pc.path)}
                      onDragOver={(event) => handleDragOverRow(event, pc.path)}
                      onDrop={(event) => handleDropOnRow(event, pc.path)}
                      onDragEnd={clearDragState}
                      className={`relative ${isDragging ? 'opacity-45' : ''}`}
                    >
                      {showBeforeIndicator && (
                        <div className="pointer-events-none absolute -top-[1px] right-2 left-2 z-10 flex items-center">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#713131]" />
                          <span className="h-[2px] flex-1 rounded-full bg-[#713131]" />
                        </div>
                      )}

                      {isRenaming ? (
                        <div
                          className={`${NAV_BUTTON_BASE} bg-[#713131]/[0.07] text-[#713131]`}
                        >
                          <PcGlyph icon={pc.icon} className="h-[16px] w-[16px] shrink-0" />
                          <input
                            ref={renameInputRef}
                            type="text"
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value)}
                            onBlur={() => void commitInlineRename(pc)}
                            onKeyDown={(event) => handleRenameKeyDown(event, pc)}
                            aria-label={`Rename ${pc.name}`}
                            className="w-full min-w-0 rounded border border-[#713131]/30 bg-white px-1.5 py-0.5 text-[13px] font-medium text-[#161212] focus:border-[#713131] focus:outline-none"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          data-pc-context-trigger="true"
                          aria-current={isSelected ? 'page' : undefined}
                          onClick={() => onSelect({ kind: 'pc', path: pc.path })}
                          onContextMenu={(event) => handlePcContextMenu(event, pc)}
                          className={navButtonClass(isSelected, !pc.isAvailable)}
                        >
                          <PcGlyph icon={pc.icon} className="h-[16px] w-[16px] shrink-0" />
                          <span className="truncate">{pc.name}</span>
                        </button>
                      )}

                      {showAfterIndicator && (
                        <div className="pointer-events-none absolute right-2 -bottom-[1px] left-2 z-10 flex items-center">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#713131]" />
                          <span className="h-[2px] flex-1 rounded-full bg-[#713131]" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenCreatePc}
                className="app-no-drag cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[#5e5454]/85 transition-colors hover:bg-[#161212]/[0.05] hover:text-[#713131]"
              >
                Create your first PC
              </button>
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

      {contextMenu && (
        <PcContextMenu
          key={contextMenu.id}
          pc={contextMenu.pc}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() =>
            setContextMenu((current) => (current?.id === contextMenu.id ? null : current))
          }
          onRename={startInlineRename}
          onChangeIcon={onRequestChangeIcon}
          onSelectIcon={(targetPc, icon) => void onSelectPcIcon(targetPc, icon)}
          onDelete={onRequestDeletePc}
        />
      )}
    </div>
  )
}
