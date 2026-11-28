import { useState } from 'react'
import type { BottleSummary } from '../../../../shared/ipc'
import { ConsoleLogsTab } from './ConsoleLogsTab'
import { DiagnosticsTab } from './DiagnosticsTab'
import { GameDbTab } from './GameDbTab'
import { TroubleshooterTab } from './TroubleshooterTab'

interface ToolsPageProps {
  pcs: BottleSummary[]
}

type ToolsTab = 'logs' | 'diagnostics' | 'troubleshooter' | 'gamedb'

export function ToolsPage({ pcs }: ToolsPageProps) {
  const [activeTab, setActiveTab] = useState<ToolsTab>('logs')
  const [diagnosticLogPath, setDiagnosticLogPath] = useState<string | null>(null)

  const handleAnalyzeLog = (path: string) => {
    setDiagnosticLogPath(path)
    setActiveTab('diagnostics')
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-white">
      <div className="h-[46px] shrink-0" />

      <div className="mx-auto w-full max-w-[920px] px-8 pb-14">
        <header>
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-[#161212]">
            Tools &amp; Support
          </h1>
          <p className="mt-1 text-[13.5px] text-[#5e5454]">
            Inspect Wine runtime logs, classify crashes, run guided troubleshooting, and apply verified GameDB configs.
          </p>
        </header>

        <nav
          aria-label="Tools sections"
          className="mt-6 flex flex-wrap items-center gap-6 border-b border-[#161212]/[0.07]"
        >
          {(
            [
              { id: 'logs', label: 'Console Logs' },
              { id: 'diagnostics', label: 'Diagnostics' },
              { id: 'troubleshooter', label: 'Troubleshooter' },
              { id: 'gamedb', label: 'Game Database' }
            ] as const
          ).map((tab) => {
            const selected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`app-no-drag relative cursor-pointer pb-3 text-[13px] transition-colors ${
                  selected
                    ? 'font-semibold text-[#713131]'
                    : 'font-medium text-[#5e5454] hover:text-[#161212]'
                }`}
              >
                {tab.label}
                {selected && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#713131]" />
                )}
              </button>
            )
          })}
        </nav>

        {activeTab === 'logs' && <ConsoleLogsTab onSendToDiagnostics={handleAnalyzeLog} />}
        {activeTab === 'diagnostics' && (
          <DiagnosticsTab pcs={pcs} initialLogPath={diagnosticLogPath} />
        )}
        {activeTab === 'troubleshooter' && <TroubleshooterTab pcs={pcs} />}
        {activeTab === 'gamedb' && <GameDbTab pcs={pcs} />}
      </div>
    </div>
  )
}
