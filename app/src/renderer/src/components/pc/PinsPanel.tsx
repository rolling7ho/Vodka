import { useCallback, useEffect, useState } from 'react'
import type { BottlePinItem, BottleSummary } from '../../../../shared/ipc'
import { FolderOpenIcon, PlayTriangleIcon } from '../icons/SidebarIcons'

interface PinsPanelProps {
  pc: BottleSummary
  isManagedPc: boolean
  onRunExecutable: (pc: BottleSummary, programPath: string) => Promise<void>
}

export function PinsPanel({ pc, isManagedPc, onRunExecutable }: PinsPanelProps) {
  const [pins, setPins] = useState<BottlePinItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const refreshPins = useCallback(async () => {
    if (!isManagedPc || !window.gmac) {
      setIsLoading(false)
      return
    }
    try {
      const res = await window.gmac.listBottlePins(pc.path)
      setPins(res.pins)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load pins.')
    } finally {
      setIsLoading(false)
    }
  }, [pc.path, isManagedPc])

  useEffect(() => {
    void refreshPins()
  }, [refreshPins])

  const handleAddPin = async () => {
    if (!isManagedPc || !window.gmac) {
      return
    }
    try {
      setErrorMessage(null)
      const exePath = await window.gmac.pickExecutableFile(pc.path)
      if (!exePath) {
        return
      }
      const res = await window.gmac.addBottlePin(pc.path, exePath)
      setPins(res.pins)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to pin executable.')
    }
  }

  const handleRemovePin = async (programPath: string) => {
    if (!isManagedPc || !window.gmac) {
      return
    }
    try {
      setErrorMessage(null)
      const res = await window.gmac.removeBottlePin(pc.path, programPath)
      setPins(res.pins)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to remove pin.')
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FAF9F8] px-5 py-4">
        <div>
          <div className="text-[14px] font-semibold text-[#161212]">Pinned Programs</div>
          <p className="mt-0.5 text-[12px] text-[#5e5454]">
            Pin non-Steam executables inside {pc.name} so they appear across Gmac Home and Library.
          </p>
        </div>
        <button
          type="button"
          disabled={!isManagedPc}
          onClick={() => void handleAddPin()}
          className="app-no-drag inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#713131] px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-[#5E2828] disabled:cursor-not-allowed disabled:opacity-55"
        >
          <FolderOpenIcon className="h-3.5 w-3.5" />
          <span>Pin Executable...</span>
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-500/[0.08] px-4 py-2.5 text-[12.5px] font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      {pins.length > 0 ? (
        <div className="divide-y divide-[#161212]/[0.06] rounded-2xl bg-[#FAF9F8] px-5">
          {pins.map((pin) => (
            <div
              key={pin.path}
              className="flex flex-wrap items-center justify-between gap-3 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-[#161212]">{pin.name}</div>
                <div className="mt-0.5 truncate font-mono text-[11.5px] text-[#5e5454]">
                  {pin.path}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onRunExecutable(pc, pin.path)}
                  className="app-no-drag inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#007AFF] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#0066D6]"
                >
                  <PlayTriangleIcon className="h-3 w-3" />
                  <span>Launch</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemovePin(pin.path)}
                  className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-1.5 text-[12px] font-medium text-red-600 ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-red-500/[0.08]"
                >
                  Unpin
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-[#FAF9F8] px-6 py-8 text-center text-[13px] text-[#5e5454]">
          {isLoading ? 'Loading pinned programs...' : 'No executables pinned in this PC yet.'}
        </div>
      )}
    </div>
  )
}
