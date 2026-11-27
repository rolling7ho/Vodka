import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import { CheckIcon, SpinnerIcon } from '../icons/OnboardingIcons'
import type { ComponentInstallStatus } from './types'

interface EngineSetupStepProps {
  isActive: boolean
  rosettaStatus: ComponentInstallStatus
  engineStatus: ComponentInstallStatus
  downloadProgress: number
  downloadDetail: string
  errorMessage?: string | null
  onInstall: () => void
  onRetry: () => void
  onContinue: () => void
}

function StatusPill({ status, activeLabel }: { status: ComponentInstallStatus; activeLabel?: string }) {
  if (status === 'installed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <CheckIcon className="h-3.5 w-3.5" />
        <span>Installed</span>
      </span>
    )
  }

  if (status === 'installing' || status === 'verifying' || status === 'checking') {
    const label =
      activeLabel ??
      (status === 'verifying' ? 'Verifying' : status === 'checking' ? 'Checking' : 'Installing')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-xs font-medium text-[#007AFF]">
        <SpinnerIcon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-500/12 px-2.5 py-1 text-xs font-medium text-red-700">
        Failed
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-[#161212]/[0.06] px-2.5 py-1 text-xs font-medium text-[#5e5454]">
      Required
    </span>
  )
}

export function EngineSetupStep({
  isActive,
  rosettaStatus,
  engineStatus,
  downloadProgress,
  downloadDetail,
  errorMessage,
  onInstall,
  onRetry,
  onContinue
}: EngineSetupStepProps) {
  const isReady = rosettaStatus === 'installed' && engineStatus === 'installed'
  const isBusy =
    rosettaStatus === 'installing' ||
    rosettaStatus === 'checking' ||
    engineStatus === 'installing' ||
    engineStatus === 'verifying' ||
    engineStatus === 'checking'

  const showProgress =
    (engineStatus === 'installing' || engineStatus === 'verifying') && downloadProgress >= 0

  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 pb-16">
      <div className={`flex flex-col items-center ${isActive ? 'animate-step-1' : 'opacity-0'}`}>
        <h2 className="text-center text-[34px] leading-tight font-semibold tracking-[-0.03em] text-[#161212]">
          Engine setup
        </h2>
        <p className="mt-2.5 max-w-lg text-center text-[15px] text-[#5e5454]">
          Gmac requires Rosetta 2 and the Gmac Windows Engine to run Windows games.
        </p>
      </div>

      <div
        className={`mt-7 w-full max-w-lg divide-y divide-[#161212]/8 rounded-2xl border border-[#161212]/10 bg-white/75 px-5 shadow-xs backdrop-blur-md ${
          isActive ? 'animate-step-2' : 'opacity-0'
        }`}
      >
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-[#161212]">Rosetta 2</p>
            <p className="mt-0.5 text-[13px] text-[#5e5454]">
              Translates x86_64 Windows instructions on Apple Silicon
            </p>
          </div>
          <div className="shrink-0">
            <StatusPill key={isActive ? `r-${rosettaStatus}` : 'r-idle'} status={rosettaStatus} />
          </div>
        </div>

        <div className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-[#161212]">Gmac Windows Engine</p>
              <p className="mt-0.5 text-[13px] text-[#5e5454]">
                {engineStatus === 'installed'
                  ? 'Wine runtime, DXMT, and DXVK'
                  : 'Wine runtime, DXMT, and DXVK (~460 MB download)'}
              </p>
            </div>
            <div className="shrink-0">
              <StatusPill
                key={isActive ? `e-${engineStatus}` : 'e-idle'}
                status={engineStatus}
                activeLabel={
                  engineStatus === 'installing' && downloadProgress < 100
                    ? 'Downloading'
                    : undefined
                }
              />
            </div>
          </div>

          {showProgress ? (
            <div className="mt-3.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#161212]/8">
                <div
                  className="h-full rounded-full bg-[#007AFF] transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(0, downloadProgress))}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-xs text-[#5e5454]">{downloadDetail}</p>
            </div>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="mt-4 flex w-full max-w-lg items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-50/90 px-4 py-3 text-[13px] text-red-700"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={onRetry}
            className="app-no-drag shrink-0 cursor-pointer font-medium text-red-800 underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className={`mt-8 flex items-center gap-3 ${isActive ? 'animate-step-3' : 'opacity-0'}`}>
        {isReady ? (
          <button
            type="button"
            onClick={onContinue}
            className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98]"
          >
            <span>Continue</span>
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={onInstall}
            className="app-no-drag inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? (
              <>
                <SpinnerIcon className="h-4 w-4" />
                <span>Installing...</span>
              </>
            ) : (
              <span>Install</span>
            )}
          </button>
        )}
      </div>
    </main>
  )
}
