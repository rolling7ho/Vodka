import { useCallback, useEffect, useState } from 'react'
import type { BottleProcessItem } from '../../../../shared/ipc'
import { SpinnerIcon } from '../icons/OnboardingIcons'

interface ProcessesPanelProps {
  bottlePath: string
  bottleName: string
  isManagedPc: boolean
}

export function ProcessesPanel({ bottlePath, bottleName, isManagedPc }: ProcessesPanelProps) {
  const [running, setRunning] = useState(false)
  const [processes, setProcesses] = useState<BottleProcessItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyPid, setBusyPid] = useState<number | null>(null)
  const [isKillingBottle, setIsKillingBottle] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const refreshProcesses = useCallback(async () => {
    if (!isManagedPc || !window.gmac) {
      setIsLoading(false)
      return
    }
    try {
      setErrorMessage(null)
      const res = await window.gmac.listBottleProcesses(bottlePath)
      setRunning(res.running)
      setProcesses(res.processes)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to query running processes.')
    } finally {
      setIsLoading(false)
    }
  }, [bottlePath, isManagedPc])

  useEffect(() => {
    void refreshProcesses()
  }, [refreshProcesses])

  const handleKillProcess = async (pid: number, force: boolean) => {
    if (!window.gmac) {
      return
    }
    setBusyPid(pid)
    try {
      await window.gmac.killBottleProcess(bottlePath, pid, force)
      await refreshProcesses()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to terminate process.')
    } finally {
      setBusyPid(null)
    }
  }

  const handleKillAll = async () => {
    if (!window.gmac) {
      return
    }
    setIsKillingBottle(true)
    try {
      await window.gmac.killBottle(bottlePath)
      await refreshProcesses()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to stop PC processes.')
    } finally {
      setIsKillingBottle(false)
    }
  }

  if (!isManagedPc) {
    return (
      <div className="mt-6 rounded-2xl bg-[#FAF9F8] px-6 py-8 text-center text-[13px] text-[#5e5454]">
        Live process inspection is unavailable for preview PCs.
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FAF9F8] px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#161212]">
            <span>{running ? 'Wineserver Active' : 'PC Idle'}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                running ? 'bg-emerald-500/12 text-emerald-700' : 'bg-[#161212]/[0.06] text-[#5e5454]'
              }`}
            >
              {processes.length} {processes.length === 1 ? 'process' : 'processes'}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[#5e5454]">
            Monitor and terminate Windows processes running inside {bottleName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void refreshProcesses()}
            className="app-no-drag inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF]"
          >
            {isLoading && <SpinnerIcon className="h-3.5 w-3.5" />}
            <span>Refresh</span>
          </button>

          {running && (
            <button
              type="button"
              disabled={isKillingBottle}
              onClick={() => void handleKillAll()}
              className="app-no-drag inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-55"
            >
              {isKillingBottle ? 'Stopping...' : 'Stop All Processes'}
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-500/[0.08] px-4 py-2.5 text-[12.5px] font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {processes.length > 0 ? (
        <div className="divide-y divide-[#161212]/[0.06] rounded-2xl bg-[#FAF9F8] px-5">
          {processes.map((proc) => (
            <div
              key={`${proc.winePID}-${proc.imageName}`}
              className="flex flex-wrap items-center justify-between gap-3 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-[13px] font-medium text-[#161212]">
                    {proc.imageName}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#5e5454] ring-1 ring-[#161212]/[0.06]">
                    {proc.kind}
                  </span>
                </div>
                <div className="mt-0.5 text-[12px] text-[#5e5454] tabular-nums">
                  Wine PID {proc.winePID} &middot; {proc.memoryUsage}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={busyPid === proc.winePID}
                  onClick={() => void handleKillProcess(proc.winePID, false)}
                  className="app-no-drag cursor-pointer rounded-lg bg-white px-2.5 py-1 text-[12px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF]"
                >
                  Quit
                </button>
                <button
                  type="button"
                  disabled={busyPid === proc.winePID}
                  onClick={() => void handleKillProcess(proc.winePID, true)}
                  className="app-no-drag cursor-pointer rounded-lg bg-red-500/[0.08] px-2.5 py-1 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-500/[0.15]"
                >
                  Force Kill
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-[#FAF9F8] px-6 py-8 text-center text-[13px] text-[#5e5454]">
          {isLoading ? 'Checking Wine processes...' : `No Windows processes are running in ${bottleName}.`}
        </div>
      )}
    </div>
  )
}
