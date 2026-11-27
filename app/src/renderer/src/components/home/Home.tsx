import { useEffect, useState } from 'react'
import type { BottleSummary } from '../../../../shared/ipc'
import { Sidebar, type SidebarDestination } from '../sidebar/Sidebar'

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

  const sectionTitle = destinationTitle(activeDestination, pcs)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-[#161212] select-none">
      <Sidebar activeDestination={activeDestination} pcs={pcs} onSelect={setActiveDestination} />

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="app-drag h-11 w-full shrink-0" />
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
