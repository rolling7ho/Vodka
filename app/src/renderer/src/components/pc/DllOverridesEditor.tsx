import { useState } from 'react'
import type { DllOverrideEntry, DllOverrideMode } from '../../../../shared/ipc'

interface DllOverridesEditorProps {
  entries: DllOverrideEntry[]
  onChange: (entries: DllOverrideEntry[]) => void
}

const MODE_LABELS: { value: DllOverrideMode; label: string }[] = [
  { value: 'n,b', label: 'Native then Builtin (n,b)' },
  { value: 'b,n', label: 'Builtin then Native (b,n)' },
  { value: 'n', label: 'Native only (n)' },
  { value: 'b', label: 'Builtin only (b)' },
  { value: '', label: 'Disabled' }
]

export function DllOverridesEditor({ entries, onChange }: DllOverridesEditorProps) {
  const [dllName, setDllName] = useState('')
  const [mode, setMode] = useState<DllOverrideMode>('n,b')

  const handleAdd = () => {
    const cleaned = dllName
      .trim()
      .replace(/\.dll$/i, '')
      .toLowerCase()
    if (!cleaned) {
      return
    }
    const filtered = entries.filter((item) => item.dllName.toLowerCase() !== cleaned)
    onChange([...filtered, { dllName: cleaned, mode }])
    setDllName('')
  }

  const handleModeChange = (targetName: string, nextMode: DllOverrideMode) => {
    onChange(
      entries.map((item) =>
        item.dllName === targetName ? { ...item, mode: nextMode } : item
      )
    )
  }

  const handleRemove = (targetName: string) => {
    onChange(entries.filter((item) => item.dllName !== targetName))
  }

  return (
    <div className="rounded-2xl bg-[#FAF9F8] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
            DLL Overrides
          </h3>
          <p className="mt-1 text-[12px] text-[#5e5454]">
            Control whether Wine uses native Windows DLLs or builtin Wine implementations.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={dllName}
          onChange={(event) => setDllName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleAdd()
            }
          }}
          placeholder="e.g. d3dcompiler_47"
          aria-label="DLL name without .dll suffix"
          className="app-no-drag min-w-[160px] flex-1 rounded-xl bg-white px-3 py-2 text-[12.5px] text-[#161212] placeholder-[#5e5454]/55 ring-1 ring-[#161212]/[0.08] focus:ring-2 focus:ring-[#713131]/35 focus:outline-none"
        />
        <select
          aria-label="DLL override mode"
          value={mode}
          onChange={(event) => setMode(event.target.value as DllOverrideMode)}
          className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] focus:outline-none"
        >
          {MODE_LABELS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!dllName.trim()}
          className="app-no-drag cursor-pointer rounded-xl bg-[#713131] px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-[#5E2828] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add Override
        </button>
      </div>

      {entries.length > 0 ? (
        <div className="mt-3 divide-y divide-[#161212]/[0.06] rounded-xl bg-white px-3.5 ring-1 ring-[#161212]/[0.06]">
          {entries.map((entry) => (
            <div
              key={entry.dllName}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <span className="font-mono text-[12.5px] font-medium text-[#161212]">
                {entry.dllName}.dll
              </span>
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Override mode for ${entry.dllName}`}
                  value={entry.mode}
                  onChange={(event) =>
                    handleModeChange(entry.dllName, event.target.value as DllOverrideMode)
                  }
                  className="app-no-drag cursor-pointer rounded-lg bg-[#FAF9F8] px-2.5 py-1 text-[12px] font-medium text-[#161212] focus:outline-none"
                >
                  {MODE_LABELS.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleRemove(entry.dllName)}
                  className="app-no-drag cursor-pointer rounded-lg px-2 py-1 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-500/[0.08]"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-white px-3.5 py-3 text-[12px] text-[#5e5454] ring-1 ring-[#161212]/[0.06]">
          No custom DLL overrides configured for this PC.
        </div>
      )}
    </div>
  )
}
