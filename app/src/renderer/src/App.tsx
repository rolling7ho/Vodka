import { useEffect, useState } from 'react'
import type { AppInfo } from '../../shared/ipc'

export default function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    window.gmac
      .getAppInfo()
      .then((info) => {
        if (!cancelled) {
          setAppInfo(info)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load application info')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-full flex-col bg-[#111113] text-zinc-100 select-none">
      <header className="app-drag h-10 shrink-0 border-b border-zinc-800/80" />

      <main className="flex flex-1 items-center justify-center p-6">
        <section className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Gmac</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Placeholder window for the redesigned Electron application.
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-zinc-800 pt-4 text-xs">
            <dt className="text-zinc-500">Electron</dt>
            <dd className="font-mono text-zinc-200">{appInfo?.versions.electron ?? '...'}</dd>

            <dt className="text-zinc-500">Chrome</dt>
            <dd className="font-mono text-zinc-200">{appInfo?.versions.chrome ?? '...'}</dd>

            <dt className="text-zinc-500">Node</dt>
            <dd className="font-mono text-zinc-200">{appInfo?.versions.node ?? '...'}</dd>

            <dt className="text-zinc-500">Platform</dt>
            <dd className="font-mono text-zinc-200">
              {appInfo ? `${appInfo.platform} (${appInfo.arch})` : '...'}
            </dd>
          </dl>

          {error ? (
            <p className="mt-4 text-xs text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  )
}
