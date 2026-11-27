import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { BottleSummary } from '../../../../shared/ipc'
import { SidebarToggleIcon } from '../icons/SidebarIcons'
import {
  COLLAPSE_THRESHOLD,
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  Sidebar,
  type SidebarDestination
} from '../sidebar/Sidebar'

interface HomeProps {
  onOpenOnboarding?: () => void
}

function destinationTitle(destination: SidebarDestination, pcs: BottleSummary[]): string {
  switch (destination.kind) {
    case 'home':
      return 'Home'
    case 'library':
      return 'Library'
    case 'settings':
      return 'Settings'
    case 'pc':
      return pcs.find((pc) => pc.path === destination.path)?.name ?? 'PC'
  }
}

export function Home({ onOpenOnboarding }: HomeProps) {
  const [pcs, setPcs] = useState<BottleSummary[]>([])
  const [activeDestination, setActiveDestination] = useState<SidebarDestination>({ kind: 'home' })
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragStartWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH)

  useEffect(() => {
    let cancelled = false
    window.gmac
      ?.listBottles()
      .then((loadedPcs) => {
        if (!cancelled) {
          setPcs(loadedPcs)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isResizing) {
      return
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.clientX < COLLAPSE_THRESHOLD) {
        setIsSidebarCollapsed(true)
        setSidebarWidth(Math.max(MIN_SIDEBAR_WIDTH, dragStartWidthRef.current))
        setIsResizing(false)
        return
      }
      const nextWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, Math.round(event.clientX))
      )
      setSidebarWidth(nextWidth)
    }

    const handlePointerStop = () => {
      setIsResizing(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerStop)
    window.addEventListener('pointercancel', handlePointerStop)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerStop)
      window.removeEventListener('pointercancel', handlePointerStop)
    }
  }, [isResizing])

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragStartWidthRef.current = sidebarWidth
    setIsResizing(true)
  }

  const sectionTitle = destinationTitle(activeDestination, pcs)

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-white text-[#161212] select-none">
      <div className="app-drag fixed inset-x-0 top-0 z-20 h-12">
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          aria-label={isSidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          aria-expanded={!isSidebarCollapsed}
          title={isSidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
          style={{
            left: isSidebarCollapsed ? 78 : sidebarWidth - 39,
            transition: isResizing
              ? 'none'
              : 'left 280ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms, color 150ms'
          }}
          className="app-no-drag absolute top-[10px] inline-flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-md text-[#5e5454] transition-colors hover:bg-[#161212]/[0.06] hover:text-[#713131] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#007AFF]"
        >
          <SidebarToggleIcon className="h-[19px] w-[19px]" />
        </button>
      </div>

      <Sidebar
        activeDestination={activeDestination}
        pcs={pcs}
        width={sidebarWidth}
        isCollapsed={isSidebarCollapsed}
        isResizing={isResizing}
        onSelect={setActiveDestination}
        onResizeStart={handleResizeStart}
      />

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="h-11 w-full shrink-0" />
        <main className="flex flex-1 flex-col items-center justify-center px-8 pb-12 text-center">
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#161212]">
            {sectionTitle}
          </h1>
          <p className="mt-2 text-[14px] text-[#5e5454]">Section placeholder.</p>
          {onOpenOnboarding && (
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="app-no-drag mt-6 cursor-pointer rounded-full border border-[#161212]/15 bg-white px-4 py-2 text-[13px] font-medium text-[#161212] transition hover:bg-[#161212]/5"
            >
              Open Onboarding
            </button>
          )}
        </main>
      </div>
    </div>
  )
}
