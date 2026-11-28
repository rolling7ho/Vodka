import { useCallback, useEffect, useState } from 'react'
import type { LogFileItem } from '../../../../shared/ipc'
import { FolderOpenIcon } from '../icons/SidebarIcons'

interface ConsoleLogsTabProps {
  onSendToDiagnostics: (logPath: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ConsoleLogsTab({ onSendToDiagnostics }: ConsoleLogsTabProps) {
  const [folder, setFolder] = useState('')
  const [files, setFiles] = useState<LogFileItem[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const refreshLogs = useCallback(async () => {
    if (!window.gmac) {
      setIsLoading(false)
      return
    }
    try {
      const res = await window.gmac.listLogs()
      setFolder(res.folder)
      setFiles(res.files)
      if (!selectedPath && res.files.length > 0) {
        setSelectedPath(res.files[0].path)
      }
    } finally {
      setIsLoading(false)
    }
  }, [selectedPath])

  useEffect(() => {
    void refreshLogs()
  }, [refreshLogs])

  useEffect(() => {
    if (!selectedPath || !window.gmac) {
      return
    }
    void window.gmac
      .readLogFile(selectedPath)
      .then((res) => {
        setContent(res.content)
        setTruncated(res.truncated)
      })
      .catch(() => {
        setContent('Unable to read log file.')
      })
  }, [selectedPath])

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FAF9F8] px-5 py-4">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[#161212]">Console &amp; Wine Logs</div>
          <div className="mt-0.5 truncate font-mono text-[11.5px] text-[#5e5454]">
            {folder || '~/Library/Logs/com.rolling7ho.Gmac'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshLogs()}
            className="app-no-drag cursor-pointer rounded-xl bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF]"
          >
            Refresh
          </button>
          {folder && (
            <button
              type="button"
              onClick={() => void window.gmac?.showInFinder(folder)}
              className="app-no-drag inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF]"
            >
              <FolderOpenIcon className="h-3.5 w-3.5" />
              <span>Open Folder</span>
            </button>
          )}
        </div>
      </div>

      {files.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="max-h-[460px] divide-y divide-[#161212]/[0.06] overflow-y-auto rounded-2xl bg-[#FAF9F8] p-2">
            {files.map((file) => {
              const active = file.path === selectedPath
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={`app-no-drag flex w-full cursor-pointer flex-col rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active ? 'bg-white ring-1 ring-[#713131]/30' : 'hover:bg-white/60'
                  }`}
                >
                  <span className="truncate font-mono text-[12px] font-semibold text-[#161212]">
                    {file.name}
                  </span>
                  <span className="mt-0.5 text-[11px] text-[#5e5454] tabular-nums">
                    {formatBytes(file.sizeBytes)} &middot;{' '}
                    {new Date(file.modifiedAt).toLocaleString()}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col rounded-2xl bg-[#FAF9F8] p-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <span className="text-[12px] font-medium text-[#5e5454]">
                {truncated ? 'Showing last 500 lines' : 'Full log output'}
              </span>
              {selectedPath && (
                <button
                  type="button"
                  onClick={() => onSendToDiagnostics(selectedPath)}
                  className="app-no-drag cursor-pointer rounded-xl bg-[#713131] px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#5E2828]"
                >
                  Analyze in Diagnostics
                </button>
              )}
            </div>
            <pre className="h-[410px] overflow-auto rounded-xl bg-white p-3.5 font-mono text-[11.5px] leading-relaxed text-[#161212] ring-1 ring-[#161212]/[0.06]">
              {content || 'Log file is empty.'}
            </pre>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#FAF9F8] px-6 py-10 text-center text-[13px] text-[#5e5454]">
          {isLoading
            ? 'Loading Wine logs...'
            : 'No log files found yet. Launch a game or PC to record runtime output.'}
        </div>
      )}
    </div>
  )
}
