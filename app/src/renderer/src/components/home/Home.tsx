import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { BottleSummary, HomeGameItem, HomeLauncherItem, HomeSummary } from '../../../../shared/ipc'
import type { PcIconId } from '../icons/PcIcons'
import { SidebarToggleIcon } from '../icons/SidebarIcons'
import { ChangePcIconModal, CreatePcModal, DeletePcModal } from '../sidebar/PcModals'
import {
  COLLAPSE_THRESHOLD,
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  SIDEBAR_COLLAPSE_EASING,
  SIDEBAR_EXPAND_EASING,
  Sidebar,
  type SidebarDestination
} from '../sidebar/Sidebar'
import { LibraryGamePage } from '../library/LibraryGamePage'
import { LibraryView } from '../library/LibraryView'
import { HomeDashboard } from './HomeDashboard'
import { MOCK_HOME_SUMMARY } from './mockHomeData'

interface HomeProps {
  enteredFromOnboarding?: boolean
  onOpenOnboarding?: () => void
}

const COLLAPSED_TOGGLE_X = 90

function resolveInitialMockMode(): boolean {
  return new URLSearchParams(window.location.search).get('mock') === '1'
}

function launcherToPcIcon(id: string): PcIconId {
  switch (id) {
    case 'steam':
      return 'steam'
    case 'epicGames':
      return 'epic'
    case 'battleNet':
      return 'battleNet'
    case 'eaApp':
      return 'ea'
    case 'rockstar':
      return 'rockstar'
    case 'ubisoft':
      return 'ubisoft'
    default:
      return 'pc'
  }
}

function destinationTitle(
  destination: SidebarDestination,
  pcs: BottleSummary[],
  games: HomeGameItem[]
): string {
  switch (destination.kind) {
    case 'home':
      return 'Home'
    case 'library':
      return 'Library'
    case 'game':
      return games.find((game) => game.id === destination.gameId)?.name ?? 'Game'
    case 'settings':
      return 'Settings'
    case 'pc':
      return pcs.find((pc) => pc.path === destination.path)?.name ?? 'PC'
  }
}

export function Home({ enteredFromOnboarding = false, onOpenOnboarding }: HomeProps) {
  const [pcs, setPcs] = useState<BottleSummary[]>([])
  const [homeSummary, setHomeSummary] = useState<HomeSummary | null>(null)
  const [isHomeLoading, setIsHomeLoading] = useState(true)
  const [isMockMode] = useState(resolveInitialMockMode)
  const [homeVisitKey, setHomeVisitKey] = useState(() => (enteredFromOnboarding ? 2 : 1))
  const [launchingId, setLaunchingId] = useState<string | null>(null)
  const [homeError, setHomeError] = useState<string | null>(null)
  const [activeDestination, setActiveDestination] = useState<SidebarDestination>({ kind: 'home' })
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createModalDefaults, setCreateModalDefaults] = useState<{
    name: string
    icon: PcIconId
  }>({ name: '', icon: 'pc' })
  const [iconModalPc, setIconModalPc] = useState<BottleSummary | null>(null)
  const [deleteModalPc, setDeleteModalPc] = useState<BottleSummary | null>(null)
  const dragStartWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH)
  const mockActionTimerRef = useRef<number | null>(null)

  const refreshHomeSummary = async () => {
    if (!window.gmac) {
      setIsHomeLoading(false)
      return
    }
    try {
      const summary = await window.gmac.getHomeSummary()
      setHomeSummary(summary)
    } catch {
      // Keep last known summary.
    } finally {
      setIsHomeLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    Promise.all([
      window.gmac?.listBottles().catch(() => [] as BottleSummary[]) ?? Promise.resolve([]),
      window.gmac?.getHomeSummary().catch(() => null) ?? Promise.resolve(null)
    ]).then(([loadedPcs, summary]) => {
      if (cancelled) {
        return
      }
      setPcs(loadedPcs)
      setHomeSummary(summary)
      setIsHomeLoading(false)
    })

    return () => {
      cancelled = true
      if (mockActionTimerRef.current !== null) {
        window.clearTimeout(mockActionTimerRef.current)
      }
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

  const handleSelectDestination = (next: SidebarDestination) => {
    setActiveDestination((current) => {
      if (next.kind === 'home' && current.kind !== 'home') {
        setHomeVisitKey((key) => key + 1)
      }
      return next
    })
  }

  const openCreatePcModal = (defaults?: { name: string; icon: PcIconId }) => {
    setCreateModalDefaults(defaults ?? { name: '', icon: 'pc' })
    setIsCreateModalOpen(true)
  }

  const runMockTransientFeedback = (id: string) => {
    if (mockActionTimerRef.current !== null) {
      window.clearTimeout(mockActionTimerRef.current)
    }
    setLaunchingId(id)
    mockActionTimerRef.current = window.setTimeout(() => {
      setLaunchingId(null)
      mockActionTimerRef.current = null
    }, 700)
  }

  const handleCreatePc = async (name: string, icon: PcIconId) => {
    if (!window.gmac) {
      throw new Error('Gmac IPC bridge is unavailable.')
    }
    const created = await window.gmac.createBottle(name, icon)
    setPcs((prev) => [...prev, created])
    setActiveDestination({ kind: 'pc', path: created.path })
    void refreshHomeSummary()
  }

  const handleRenamePc = async (path: string, newName: string) => {
    const previousPcs = pcs
    setPcs((prev) => prev.map((pc) => (pc.path === path ? { ...pc, name: newName } : pc)))
    try {
      const updated = await window.gmac?.renameBottle(path, newName)
      if (updated) {
        setPcs((prev) => prev.map((pc) => (pc.path === path ? updated : pc)))
      }
      void refreshHomeSummary()
    } catch {
      setPcs(previousPcs)
    }
  }

  const handleChangePcIcon = async (pc: BottleSummary, icon: PcIconId) => {
    const previousPcs = pcs
    setPcs((prev) => prev.map((entry) => (entry.path === pc.path ? { ...entry, icon } : entry)))
    try {
      await window.gmac?.setBottleIcon(pc.path, icon)
    } catch {
      setPcs(previousPcs)
    }
  }

  const handleDeletePc = async (pc: BottleSummary) => {
    if (!window.gmac) {
      throw new Error('Gmac IPC bridge is unavailable.')
    }
    await window.gmac.deleteBottle(pc.path)
    setPcs((prev) => prev.filter((entry) => entry.path !== pc.path))
    setActiveDestination((current) =>
      current.kind === 'pc' && current.path === pc.path ? { kind: 'home' } : current
    )
    void refreshHomeSummary()
  }

  const handleReorderPcs = async (orderedPaths: string[]) => {
    const previousPcs = pcs
    const byPath = new Map(pcs.map((pc) => [pc.path, pc]))
    const reordered = orderedPaths
      .map((entryPath) => byPath.get(entryPath))
      .filter((entry): entry is BottleSummary => entry !== undefined)
    if (reordered.length === pcs.length) {
      setPcs(reordered)
    }
    try {
      await window.gmac?.reorderBottles(orderedPaths)
    } catch {
      setPcs(previousPcs)
    }
  }

  const handlePlayGame = async (game: HomeGameItem) => {
    setHomeError(null)
    if (isMockMode) {
      runMockTransientFeedback(game.id)
      return
    }
    if (!window.gmac) {
      return
    }
    setLaunchingId(game.id)
    try {
      await window.gmac.launchHomeItem({
        bottlePath: game.bottlePath,
        launchKind: game.launchKind,
        steamAppId: game.steamAppId ?? null,
        programPath: game.programPath ?? null
      })
    } catch (err) {
      setHomeError(err instanceof Error ? err.message : `Unable to launch ${game.name}.`)
    } finally {
      setLaunchingId(null)
    }
  }

  const handleOpenLauncher = async (launcher: HomeLauncherItem) => {
    setHomeError(null)
    if (isMockMode) {
      runMockTransientFeedback(`launcher:${launcher.id}`)
      return
    }
    if (!window.gmac || !launcher.bottlePath || !launcher.executablePath) {
      return
    }
    setLaunchingId(`launcher:${launcher.id}`)
    try {
      await window.gmac.launchHomeItem({
        bottlePath: launcher.bottlePath,
        launchKind: 'program',
        programPath: launcher.executablePath
      })
    } catch (err) {
      setHomeError(err instanceof Error ? err.message : `Unable to open ${launcher.name}.`)
    } finally {
      setLaunchingId(null)
    }
  }

  const handleSetupLauncher = (launcher: HomeLauncherItem) => {
    openCreatePcModal({
      name: launcher.name,
      icon: launcherToPcIcon(launcher.id)
    })
  }

  const displayedSummary = isMockMode ? MOCK_HOME_SUMMARY : homeSummary
  const allGames =
    displayedSummary?.allGames && displayedSummary.allGames.length > 0
      ? displayedSummary.allGames
      : [
          ...(displayedSummary?.continuePlaying ? [displayedSummary.continuePlaying] : []),
          ...(displayedSummary?.recentlyPlayed ?? [])
        ]
  const activeGame =
    activeDestination.kind === 'game'
      ? allGames.find((game) => game.id === activeDestination.gameId) ?? null
      : null
  const sectionTitle = destinationTitle(activeDestination, pcs, allGames)
  const toggleX = isSidebarCollapsed ? COLLAPSED_TOGGLE_X : sidebarWidth - 39
  const toggleTiming = isSidebarCollapsed ? SIDEBAR_COLLAPSE_EASING : SIDEBAR_EXPAND_EASING

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
            transform: `translate3d(${toggleX}px, 0, 0)`,
            willChange: isResizing ? 'auto' : 'transform',
            transition: isResizing
              ? 'none'
              : `transform ${toggleTiming}, background-color 150ms, color 150ms`
          }}
          className="app-no-drag group absolute top-[10px] left-0 inline-flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-md text-[#5e5454] transition-colors hover:bg-[#161212]/[0.06] hover:text-[#713131] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#713131]/60"
        >
          <SidebarToggleIcon className="h-[19px] w-[19px] transition-transform duration-150 group-active:scale-90" />
        </button>
      </div>

      <Sidebar
        activeDestination={activeDestination}
        pcs={pcs}
        games={allGames}
        width={sidebarWidth}
        isCollapsed={isSidebarCollapsed}
        isResizing={isResizing}
        onSelect={handleSelectDestination}
        onResizeStart={handleResizeStart}
        onOpenCreatePc={() => openCreatePcModal()}
        onRenamePc={handleRenamePc}
        onRequestDeletePc={setDeleteModalPc}
        onRequestChangeIcon={setIconModalPc}
        onSelectPcIcon={handleChangePcIcon}
        onReorderPcs={handleReorderPcs}
      />

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        {activeDestination.kind === 'home' ? (
          <HomeDashboard
            summary={displayedSummary}
            isLoading={isHomeLoading}
            visitKey={homeVisitKey}
            launchingId={launchingId}
            errorMessage={homeError}
            onPlayGame={handlePlayGame}
            onOpenLauncher={handleOpenLauncher}
            onSetupLauncher={handleSetupLauncher}
            onOpenLibrary={() => handleSelectDestination({ kind: 'library' })}
            onOpenCreatePc={() => openCreatePcModal()}
          />
        ) : activeDestination.kind === 'library' ? (
          <LibraryView
            games={allGames}
            launchingId={launchingId}
            errorMessage={homeError}
            onSelectGame={(gameId) => handleSelectDestination({ kind: 'game', gameId })}
            onPlayGame={handlePlayGame}
            onOpenCreatePc={() => openCreatePcModal()}
          />
        ) : activeDestination.kind === 'game' ? (
          activeGame ? (
            <LibraryGamePage
              key={activeGame.id}
              game={activeGame}
              isLaunching={launchingId === activeGame.id}
              errorMessage={homeError}
              onPlay={handlePlayGame}
              onOpenPc={(bottlePath) => handleSelectDestination({ kind: 'pc', path: bottlePath })}
            />
          ) : (
            <LibraryView
              games={allGames}
              launchingId={launchingId}
              errorMessage={homeError}
              onSelectGame={(gameId) => handleSelectDestination({ kind: 'game', gameId })}
              onPlayGame={handlePlayGame}
              onOpenCreatePc={() => openCreatePcModal()}
            />
          )
        ) : (
          <>
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
          </>
        )}
      </div>

      <CreatePcModal
        isOpen={isCreateModalOpen}
        initialName={createModalDefaults.name}
        initialIcon={createModalDefaults.icon}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreatePc}
      />

      <ChangePcIconModal
        pc={iconModalPc}
        onClose={() => setIconModalPc(null)}
        onSelectIcon={handleChangePcIcon}
      />

      <DeletePcModal
        pc={deleteModalPc}
        onClose={() => setDeleteModalPc(null)}
        onConfirmDelete={handleDeletePc}
      />
    </div>
  )
}
