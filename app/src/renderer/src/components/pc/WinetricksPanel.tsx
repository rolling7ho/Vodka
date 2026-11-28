import { useEffect, useMemo, useState } from 'react'
import type { WinetricksCategoryGroup } from '../../../../shared/ipc'
import { SpinnerIcon } from '../icons/OnboardingIcons'
import { SearchIcon } from '../icons/SidebarIcons'

interface WinetricksPanelProps {
  bottlePath: string
  isManagedPc: boolean
}

export function WinetricksPanel({ bottlePath, isManagedPc }: WinetricksPanelProps) {
  const [categories, setCategories] = useState<WinetricksCategoryGroup[]>([])
  const [available, setAvailable] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [runningVerb, setRunningVerb] = useState<string | null>(null)
  const [lastOutput, setLastOutput] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadVerbs = async () => {
    if (!window.gmac) {
      setIsLoading(false)
      return
    }
    try {
      const res = await window.gmac.listWinetricksVerbs(isManagedPc ? bottlePath : undefined)
      setAvailable(res.available)
      setCategories(res.categories)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load Winetricks verbs.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadVerbs()
  }, [bottlePath, isManagedPc])

  const filteredVerbs = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    const items: Array<{ category: string; name: string; description: string; installed: boolean }> = []
    for (const group of categories) {
      if (selectedCategory !== 'all' && group.category !== selectedCategory) {
        continue
      }
      for (const verb of group.verbs) {
        if (
          trimmed &&
          !verb.name.toLowerCase().includes(trimmed) &&
          !verb.description.toLowerCase().includes(trimmed)
        ) {
          continue
        }
        items.push({ category: group.category, ...verb })
      }
    }
    return items.slice(0, 120)
  }, [categories, selectedCategory, query])

  const handleInstallVerb = async (verbName: string) => {
    if (!isManagedPc || !window.gmac) {
      return
    }
    setRunningVerb(verbName)
    setErrorMessage(null)
    setLastOutput(null)
    try {
      const result = await window.gmac.runWinetricksVerb(bottlePath, verbName)
      setLastOutput(result.output || `winetricks ${verbName} exited with code ${result.exitCode}.`)
      if (!result.ok) {
        setErrorMessage(`winetricks ${verbName} failed with exit code ${result.exitCode}.`)
      }
      await loadVerbs()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Winetricks command failed.')
    } finally {
      setRunningVerb(null)
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FAF9F8] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter winetricks category"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map((group) => (
              <option key={group.category} value={group.category}>
                {group.category} ({group.verbs.length})
              </option>
            ))}
          </select>

          <label className="relative flex items-center">
            <SearchIcon className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#5e5454]/75" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search components (e.g. vcrun2022)..."
              aria-label="Search winetricks verbs"
              className="app-no-drag w-64 rounded-xl bg-white py-2 pr-3 pl-8 text-[12.5px] text-[#161212] placeholder-[#5e5454]/55 ring-1 ring-[#161212]/[0.08] focus:outline-none"
            />
          </label>
        </div>

        <span className="text-[12px] text-[#5e5454] tabular-nums">
          {filteredVerbs.length} shown
        </span>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-500/[0.08] px-4 py-2.5 text-[12.5px] font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {lastOutput && (
        <div className="rounded-2xl bg-[#FAF9F8] p-4">
          <div className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
            Winetricks Output
          </div>
          <pre className="mt-2 max-h-44 overflow-auto rounded-xl bg-white p-3 font-mono text-[11.5px] text-[#161212] ring-1 ring-[#161212]/[0.06]">
            {lastOutput}
          </pre>
        </div>
      )}

      {!available && !isLoading ? (
        <div className="rounded-2xl bg-[#FAF9F8] px-6 py-8 text-center text-[13px] text-[#5e5454]">
          Bundled winetricks catalog (verbs.txt) was not found in app resources.
        </div>
      ) : filteredVerbs.length > 0 ? (
        <div className="divide-y divide-[#161212]/[0.06] rounded-2xl bg-[#FAF9F8] px-5">
          {filteredVerbs.map((verb) => (
            <div
              key={`${verb.category}-${verb.name}`}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-semibold text-[#161212]">
                    {verb.name}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#5e5454] ring-1 ring-[#161212]/[0.06]">
                    {verb.category}
                  </span>
                  {verb.installed && (
                    <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      Installed
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] text-[#5e5454]">{verb.description}</p>
              </div>

              <button
                type="button"
                disabled={!isManagedPc || runningVerb !== null}
                onClick={() => void handleInstallVerb(verb.name)}
                className="app-no-drag inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {runningVerb === verb.name && <SpinnerIcon className="h-3.5 w-3.5" />}
                <span>{runningVerb === verb.name ? 'Installing...' : 'Install'}</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-[#FAF9F8] px-6 py-8 text-center text-[13px] text-[#5e5454]">
          {isLoading ? 'Loading winetricks verbs...' : 'No matching winetricks verbs found.'}
        </div>
      )}
    </div>
  )
}
