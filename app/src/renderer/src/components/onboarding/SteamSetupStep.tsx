import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import { CheckIcon, FolderIcon, SpinnerIcon } from '../icons/OnboardingIcons'
import type { SteamSetupStage } from './types'

interface SteamSetupStepProps {
  storagePath: string
  stage: SteamSetupStage
  onStartSetup: () => void
  onContinue: () => void
  onSkip: () => void
}

const STAGE_ORDER: SteamSetupStage[] = ['idle', 'creating', 'downloading', 'installing', 'done']

function stageIndex(stage: SteamSetupStage): number {
  return STAGE_ORDER.indexOf(stage)
}

function StepBadge({
  currentStage,
  targetStage
}: {
  currentStage: SteamSetupStage
  targetStage: SteamSetupStage
}) {
  const current = stageIndex(currentStage)
  const target = stageIndex(targetStage)

  if (current > target || currentStage === 'done') {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-700">
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
    )
  }

  if (current === target) {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#007AFF]/12 text-[#007AFF]">
        <SpinnerIcon className="h-3.5 w-3.5" />
      </span>
    )
  }

  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#161212]/15" />
}

export function SteamSetupStep({
  storagePath,
  stage,
  onStartSetup,
  onContinue,
  onSkip
}: SteamSetupStepProps) {
  const isBusy = stage === 'creating' || stage === 'downloading' || stage === 'installing'

  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 pb-16">
      <h2 className="text-center text-[34px] leading-tight font-semibold tracking-[-0.03em] text-[#161212]">
        Set up Steam
      </h2>
      <p className="mt-2.5 max-w-lg text-center text-[15px] text-[#5e5454]">
        Create a dedicated Steam PC and install the official Steam client with recommended defaults.
      </p>

      <div className="mt-7 w-full max-w-lg rounded-2xl border border-[#161212]/10 bg-white/75 p-5 shadow-xs backdrop-blur-md">
        <div className="flex items-center gap-3 rounded-xl bg-[#161212]/[0.035] px-3.5 py-2.5">
          <FolderIcon className="h-4 w-4 shrink-0 text-[#5e5454]" />
          <div className="min-w-0 flex-1">
            <span className="block text-[12px] font-medium text-[#5e5454]">PC storage folder</span>
            <span className="block truncate font-mono text-[12.5px] text-[#161212]">
              {storagePath}
            </span>
          </div>
        </div>

        <div className="mt-4 divide-y divide-[#161212]/8">
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-[14px] font-medium text-[#161212]">Create Steam PC</p>
              <p className="text-[12.5px] text-[#5e5454]">Windows 10, macOS Game Mode enabled</p>
            </div>
            <StepBadge currentStage={stage} targetStage="creating" />
          </div>

          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-[14px] font-medium text-[#161212]">Download Steam installer</p>
              <p className="text-[12.5px] text-[#5e5454]">Official installer from Valve</p>
            </div>
            <StepBadge currentStage={stage} targetStage="downloading" />
          </div>

          <div className="flex items-center justify-between gap-4 pt-3">
            <div>
              <p className="text-[14px] font-medium text-[#161212]">Install Steam</p>
              <p className="text-[12.5px] text-[#5e5454]">
                Configured automatically inside your Steam PC
              </p>
            </div>
            <StepBadge currentStage={stage} targetStage="installing" />
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3">
        {stage === 'done' ? (
          <button
            type="button"
            onClick={onContinue}
            className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98]"
          >
            <span>Continue</span>
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={isBusy}
              onClick={onStartSetup}
              className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? (
                <>
                  <SpinnerIcon className="h-4 w-4" />
                  <span>Setting Up Steam...</span>
                </>
              ) : (
                <>
                  <span>Set Up Steam</span>
                  <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={onSkip}
              className="app-no-drag cursor-pointer rounded-full px-5 py-3 text-[14px] font-medium text-[#5e5454] transition-colors hover:bg-[#161212]/[0.05] hover:text-[#161212] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Skip for now
            </button>
          </>
        )}
      </div>
    </main>
  )
}
