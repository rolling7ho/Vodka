import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import { CheckIcon, ExternalLinkIcon, SpinnerIcon } from '../icons/OnboardingIcons'
import { stepParallaxClass, type SlideDirection } from './types'

interface DirectX12StepProps {
  isActive: boolean
  enterDirection: SlideDirection
  installed: boolean
  installing: boolean
  detectedFileName: string | null
  errorMessage?: string | null
  onDownloadFromApple: () => void
  onChooseFile: () => void
  onInstallDetected: () => void
  onContinue: () => void
  onSkip: () => void
}

export function DirectX12Step({
  isActive,
  enterDirection,
  installed,
  installing,
  detectedFileName,
  errorMessage,
  onDownloadFromApple,
  onChooseFile,
  onInstallDetected,
  onContinue,
  onSkip
}: DirectX12StepProps) {
  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 pb-16">
      <div
        className={`flex flex-col items-center ${stepParallaxClass(isActive, enterDirection, 1) ?? ''}`}
      >
        <h2 className="text-center text-[34px] leading-tight font-semibold tracking-[-0.03em] text-[#161212]">
          Modern title support
        </h2>
        <p className="mt-2.5 max-w-lg text-center text-[15px] text-[#5e5454]">
          Some modern titles require Apple&apos;s Game Porting Toolkit to run.
        </p>
      </div>

      <div
        className={`mt-7 w-full max-w-lg rounded-2xl border border-[#161212]/10 bg-white/75 p-5 shadow-xs backdrop-blur-md ${
          stepParallaxClass(isActive, enterDirection, 2) ?? ''
        }`}
      >
        {installed ? (
          <div className="flex items-center gap-3 text-[15px] font-medium text-emerald-700">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/12">
              <CheckIcon key={isActive ? 'dx12-check' : 'dx12-idle'} className="h-4 w-4" />
            </span>
            <span>Apple Game Porting Toolkit is installed and ready.</span>
          </div>
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-[#5e5454]">
              Sign in with your Apple Account, and download the &ldquo;Game Porting Toolkit
              4.0&rdquo;.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {detectedFileName ? (
                <button
                  type="button"
                  disabled={installing}
                  onClick={onInstallDetected}
                  className="app-no-drag inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0066D6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {installing ? (
                    <>
                      <SpinnerIcon className="h-3.5 w-3.5" />
                      <span>Installing...</span>
                    </>
                  ) : (
                    <span>Install Game Porting Toolkit</span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={installing}
                  onClick={onDownloadFromApple}
                  className="app-no-drag inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#007AFF] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0066D6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {installing ? (
                    <>
                      <SpinnerIcon className="h-3.5 w-3.5" />
                      <span>Installing...</span>
                    </>
                  ) : (
                    <>
                      <span>Download from Apple</span>
                      <ExternalLinkIcon className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                disabled={installing}
                onClick={onChooseFile}
                className="app-no-drag inline-flex cursor-pointer items-center rounded-full border border-[#161212]/12 bg-white/80 px-4 py-2 text-[13px] font-medium text-[#161212] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Choose File...
              </button>
            </div>
          </>
        )}
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="mt-4 w-full max-w-lg rounded-xl border border-red-500/20 bg-red-50/90 px-4 py-3 text-[13px] text-red-700"
        >
          {errorMessage}
        </div>
      ) : null}

      <div
        className={`mt-8 flex items-center gap-3 ${stepParallaxClass(isActive, enterDirection, 3) ?? ''}`}
      >
        {installed ? (
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
            disabled={installing}
            onClick={onSkip}
            className="app-no-drag cursor-pointer rounded-full px-5 py-3 text-[14px] font-medium text-[#5e5454] transition-colors hover:bg-[#161212]/[0.05] hover:text-[#161212] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Skip for now
          </button>
        )}
      </div>
    </main>
  )
}
