import { useEffect, useState } from 'react'
import type {
  BottleSummary,
  TroubleshootCategoryItem,
  TroubleshootFixResult,
  TroubleshootRunResult
} from '../../../../shared/ipc'
import { SpinnerIcon } from '../icons/OnboardingIcons'

interface TroubleshooterTabProps {
  pcs: BottleSummary[]
}

export function TroubleshooterTab({ pcs }: TroubleshooterTabProps) {
  const [selectedBottlePath, setSelectedBottlePath] = useState(pcs[0]?.path ?? '')
  const [categories, setCategories] = useState<TroubleshootCategoryItem[]>([])
  const [runResult, setRunResult] = useState<TroubleshootRunResult | null>(null)
  const [appliedFix, setAppliedFix] = useState<TroubleshootFixResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedBottlePath && pcs.length > 0) {
      setSelectedBottlePath(pcs[0].path)
    }
  }, [pcs, selectedBottlePath])

  useEffect(() => {
    if (!window.gmac) {
      return
    }
    void window.gmac
      .listTroubleshootCategories()
      .then((res) => setCategories(res.categories.filter((cat) => cat.hasFlow)))
      .catch(() => {})
  }, [])

  const startFlow = async (categoryId: string, nodeId?: string) => {
    if (!selectedBottlePath || !window.gmac) {
      return
    }
    setIsRunning(true)
    setErrorMessage(null)
    if (!nodeId) {
      setAppliedFix(null)
    }
    try {
      const res = await window.gmac.runTroubleshootFlow({
        bottlePath: selectedBottlePath,
        category: categoryId,
        ...(nodeId ? { nodeId } : {})
      })
      setRunResult(res)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Guided check failed.')
    } finally {
      setIsRunning(false)
    }
  }

  const handleApplyFix = async () => {
    if (!runResult?.node?.fixId || !selectedBottlePath || !window.gmac) {
      return
    }
    setIsRunning(true)
    try {
      const fixRes = await window.gmac.applyTroubleshootFix({
        bottlePath: selectedBottlePath,
        fixId: runResult.node.fixId,
        params: runResult.node.params
      })
      setAppliedFix(fixRes)
      const nextId = runResult.node.on.applied ?? runResult.node.on.default
      if (nextId) {
        await startFlow(runResult.category, nextId)
      }
    } finally {
      setIsRunning(false)
    }
  }

  const handleUndo = async () => {
    if (!appliedFix || !selectedBottlePath || !window.gmac) {
      return
    }
    await window.gmac.undoTroubleshootFix({
      bottlePath: selectedBottlePath,
      fixId: appliedFix.fixId,
      beforeValue: appliedFix.beforeValue,
      afterValue: appliedFix.afterValue
    })
    setAppliedFix(null)
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FAF9F8] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#161212]">Guided Troubleshooter</h2>
          <p className="mt-0.5 text-[12.5px] text-[#5e5454]">
            Pick a symptom to run automated Wine environment checks and apply reversible fixes.
          </p>
        </div>

        <select
          aria-label="PC to troubleshoot"
          value={selectedBottlePath}
          onChange={(event) => {
            setSelectedBottlePath(event.target.value)
            setRunResult(null)
            setAppliedFix(null)
          }}
          className="app-no-drag cursor-pointer rounded-xl bg-white px-3 py-2 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08]"
        >
          {pcs.length === 0 ? (
            <option value="">No PCs created</option>
          ) : (
            pcs.map((pc) => (
              <option key={pc.path} value={pc.path}>
                {pc.name}
              </option>
            ))
          )}
        </select>
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-red-500/[0.08] px-4 py-2.5 text-[12.5px] font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            disabled={!selectedBottlePath || isRunning}
            onClick={() => void startFlow(cat.id)}
            className="app-no-drag flex cursor-pointer items-center justify-between rounded-2xl bg-[#FAF9F8] px-4 py-3.5 text-left transition-colors hover:bg-[#F3EFEF] disabled:opacity-55"
          >
            <span className="text-[13px] font-medium text-[#161212]">{cat.title}</span>
            <span className="text-[12px] font-semibold text-[#713131]">Run</span>
          </button>
        ))}
      </div>

      {isRunning && (
        <div className="flex items-center gap-2 rounded-2xl bg-[#FAF9F8] px-5 py-4 text-[13px] text-[#5e5454]">
          <SpinnerIcon className="h-4 w-4" />
          <span>Running guided checks...</span>
        </div>
      )}

      {runResult && !isRunning && (
        <div className="space-y-4 rounded-2xl bg-[#FAF9F8] p-5">
          {runResult.executedChecks.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5e5454] uppercase">
                Automated Check Results
              </div>
              {runResult.executedChecks.map((check) => (
                <div
                  key={`${check.nodeId}-${check.checkId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-[#161212]/[0.06]"
                >
                  <div>
                    <div className="text-[13px] font-medium text-[#161212]">{check.title}</div>
                    <div className="text-[12px] text-[#5e5454]">{check.summary}</div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${
                      check.outcome === 'pass' || check.outcome === 'already_configured'
                        ? 'bg-emerald-500/12 text-emerald-700'
                        : check.outcome === 'fail'
                          ? 'bg-amber-500/15 text-amber-700'
                          : 'bg-[#161212]/[0.07] text-[#5e5454]'
                    }`}
                  >
                    {check.outcome.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {runResult.node && (
            <div className="rounded-xl bg-white p-4 ring-1 ring-[#161212]/[0.08]">
              <div className="text-[14px] font-semibold text-[#161212]">
                {runResult.node.title ?? 'Next Step'}
              </div>
              {runResult.node.description && (
                <p className="mt-1 text-[12.5px] text-[#5e5454]">{runResult.node.description}</p>
              )}

              {runResult.node.fixPreview && (
                <div className="mt-3 rounded-lg bg-[#FAF9F8] px-3 py-2 text-[12px]">
                  <span className="font-medium text-[#161212]">
                    {runResult.node.fixPreview.settingName}:
                  </span>{' '}
                  <span className="font-mono text-[#5e5454]">
                    {runResult.node.fixPreview.currentValue} &rarr;{' '}
                    <strong className="text-[#713131]">
                      {runResult.node.fixPreview.newValue}
                    </strong>
                  </span>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {runResult.node.type === 'fix' && runResult.node.fixId && (
                  <button
                    type="button"
                    onClick={() => void handleApplyFix()}
                    className="app-no-drag cursor-pointer rounded-xl bg-[#713131] px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-[#5E2828]"
                  >
                    Apply Recommended Fix
                  </button>
                )}

                {runResult.node.type === 'verify' &&
                  Object.entries(runResult.node.on).map(([label, targetNodeId]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => void startFlow(runResult.category, targetNodeId)}
                      className="app-no-drag cursor-pointer rounded-xl bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#161212] ring-1 ring-[#161212]/[0.08] transition-colors hover:bg-[#F3EFEF]"
                    >
                      {label === 'fixed'
                        ? 'Issue Resolved'
                        : label === 'not_fixed'
                          ? 'Still Broken'
                          : `Continue (${label})`}
                    </button>
                  ))}

                {appliedFix && (
                  <button
                    type="button"
                    onClick={() => void handleUndo()}
                    className="app-no-drag cursor-pointer rounded-xl px-3 py-1.5 text-[12px] font-medium text-[#5e5454] hover:text-[#161212]"
                  >
                    Undo Fix
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
