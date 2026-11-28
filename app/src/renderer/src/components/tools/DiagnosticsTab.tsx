import { useEffect, useState } from 'react'
import type { BottleSummary, DiagnosticsAnalyzeResult, LogFileItem } from '../../../../shared/ipc'

interface DiagnosticsTabProps {
  pcs: BottleSummary[]
  initialLogPath: string | null
}

export function DiagnosticsTab({ pcs, initialLogPath }: DiagnosticsTabProps) {
  const [logFiles, setLogFiles] = useState<LogFileItem[]>([])
  const [selectedLogPath, setSelectedLogPath] = useState(initialLogPath ?? '')
  const [pastedLog, setPastedLog] = useState('')
  const [selectedBottlePath, setSelectedBottlePath] = useState(pcs[0]?.path ?? '')
  const [analysis, setAnalysis] = useState<DiagnosticsAnalyzeResult | null>(null)
  const [exportedPath, setExportedPath] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (initialLogPath) {
      setSelectedLogPath(initialLogPath)
    }
  }, [initialLogPath])

  useEffect(() => {
    if (!window.gmac) {
      return
    }
    void window.gmac
      .listLogs()
      .then((res) => {
        setLogFiles(res.files)
        if (!initialLogPath && !selectedLogPath && res.files.length > 0) {
          setSelectedLogPath(res.files[0].path)
        }
      })
      .catch(() => {})
  }, [initialLogPath, selectedLogPath])

  const handleAnalyze = async () => {
    if (!window.gmac) {
      return
    }
    setErrorMessage(null)
    try {
      const payload = pastedLog.trim()
        ? { logText: pastedLog.trim() }
        : selectedLogPath
          ? { logPath: selectedLogPath }
          : null
      if (!payload) {
        setErrorMessage('Select a log file or paste Wine output to analyze.')
        return
      }
      const res = await window.gmac.analyzeDiagnostics(payload)
      setAnalysis(res)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Diagnostics analysis failed.')
    }
  }

  const handleExport = async () => {
    if (!window.gmac) {
      return
    }
    setErrorMessage(null)
    try {
      const res = await window.gmac.exportDiagnosticsReport(selectedBottlePath || undefined)
      setExportedPath(res.path)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to export report.')
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-2xl bg-[#FAF9F8] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#161212]">Crash &amp; Log Diagnostics</h2>
            <p className="mt-0.5 text-[12.5px] text-[#5e5454]">
              Classify Wine errors against known crash patterns and generate stability reports.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pcs.length > 0 && (
              <select
                aria-label="Target PC for export"
                value={selectedBottlePath}
                onChange={(event) => setSelectedBottlePath(event.target.value)}
                className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08]"
              >
                {pcs.map((pc) => (
                  <option key={pc.path} value={pc.path}>
                    {pc.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => void handleExport()}
              className="app-no-drag cursor-pointer rounded-xl bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF]"
            >
              Export Stability Report
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Select Wine log file"
              value={selectedLogPath}
              onChange={(event) => setSelectedLogPath(event.target.value)}
              className="app-no-drag min-w-[220px] flex-1 cursor-pointer rounded-xl bg-white px-3 py-2 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08]"
            >
              <option value="">Choose a recorded log file...</option>
              {logFiles.map((file) => (
                <option key={file.path} value={file.path}>
                  {file.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleAnalyze()}
              className="app-no-drag cursor-pointer rounded-xl bg-[#713131] px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-[#5E2828]"
            >
              Run Analysis
            </button>
          </div>

          <textarea
            rows={5}
            value={pastedLog}
            onChange={(event) => setPastedLog(event.target.value)}
            placeholder="Or paste raw crash/Wine stderr output here..."
            aria-label="Paste Wine crash log"
            className="app-no-drag w-full rounded-xl bg-white p-3 font-mono text-[12px] text-[#161212] placeholder-[#5e5454]/55 ring-1 ring-[#161212]/[0.08] focus:ring-2 focus:ring-[#713131]/35 focus:outline-none"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-500/[0.08] px-4 py-2.5 text-[12.5px] font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {exportedPath && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-500/10 px-4 py-3 text-[12.5px] text-emerald-700">
          <span className="truncate font-mono">Saved report to {exportedPath}</span>
          <button
            type="button"
            onClick={() => void window.gmac?.showInFinder(exportedPath)}
            className="app-no-drag shrink-0 cursor-pointer font-semibold underline"
          >
            Reveal in Finder
          </button>
        </div>
      )}

      {analysis && (
        <div className="space-y-4 rounded-2xl bg-[#FAF9F8] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                Classification Summary
              </div>
              <div className="mt-1 text-[15px] font-semibold text-[#161212]">
                {analysis.headline ?? 'No known crash patterns matched this log.'}
              </div>
            </div>
            {analysis.primaryCategory && (
              <span className="rounded-full bg-[#713131]/10 px-3 py-1 text-[12px] font-semibold text-[#713131]">
                {analysis.primaryCategory}
              </span>
            )}
          </div>

          {analysis.remediations.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                Recommended Fixes
              </div>
              {analysis.remediations.map((rem) => (
                <div key={rem.id} className="rounded-xl bg-white p-3.5 ring-1 ring-[#161212]/[0.06]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-[#161212]">{rem.title}</span>
                    <span className="rounded-full bg-[#FAF9F8] px-2 py-0.5 text-[11px] font-medium text-[#5e5454]">
                      Risk: {rem.risk}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-[#5e5454]">{rem.description}</p>
                  <p className="mt-1 text-[11.5px] text-[#713131]">{rem.whatWillChange}</p>
                </div>
              ))}
            </div>
          )}

          {analysis.matches.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                Matched Lines ({analysis.matches.length})
              </div>
              <div className="max-h-56 divide-y divide-[#161212]/[0.06] overflow-y-auto rounded-xl bg-white px-3.5 ring-1 ring-[#161212]/[0.06]">
                {analysis.matches.map((match) => (
                  <div key={`${match.id}-${match.lineIndex}`} className="py-2 font-mono text-[11.5px]">
                    <div className="text-[#5e5454]">
                      Line {match.lineIndex + 1} &middot; {match.category}
                    </div>
                    <div className="mt-0.5 break-all text-[#161212]">{match.lineText}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
