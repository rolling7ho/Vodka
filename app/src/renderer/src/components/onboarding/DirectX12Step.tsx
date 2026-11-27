import { useRef } from 'react'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import { CheckIcon, ExternalLinkIcon, SpinnerIcon } from '../icons/OnboardingIcons'

interface DirectX12StepProps {
  installed: boolean
  installing: boolean
  detectedFileName: string | null
  onDownloadFromApple: () => void
  onChooseFile: (fileName: string) => void
  onInstallDetected: () => void
  onContinue: () => void
  onSkip: () => void
}

export function DirectX12Step({
  installed,
  installing,
  detectedFileName,
  onDownloadFromApple,
  onChooseFile,
  onInstallDetected,
  onContinue,
  onSkip
}: DirectX12StepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 pb-16">
      <h2 className="text-center text-[34px] leading-tight font-semibold tracking-[-0.03em] text-[#161212]">
        DirectX 12 support
      </h2>
      <p className="mt-2.5 max-w-lg text-center text-[15px] text-[#5e5454]">
        DirectX 11 and older games work out of the box. DirectX 12 titles use Apple&apos;s free
        Game Porting Toolkit.
      </p>

      <div className="mt-7 w-full max-w-lg rounded-2xl border border-[#161212]/10 bg-white/75 p-5 shadow-xs backdrop-blur-md">
        {installed ? (
          <div className="flex items-center gap-3 text-[15px] font-medium text-emerald-700">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/12">
              <CheckIcon className="h-4 w-4" />
            </span>
            <span>Apple Game Porting Toolkit (D3DMetal) is installed and ready.</span>
          </div>
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-[#5e5454]">
              Sign in with your Apple Account, download the Game Porting Toolkit disk image
              (<span className="font-mono text-[#161212]">.dmg</span>), and Gmac will detect it in
              Downloads or let you select it below.
            </p>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#161212]/[0.035] px-3.5 py-2.5 text-[13px] text-[#5e5454]">
              {installing ? (
                <>
                  <SpinnerIcon className="h-4 w-4 shrink-0 text-[#007AFF]" />
                  <span>Validating and deploying D3DMetal...</span>
                </>
              ) : detectedFileName ? (
                <>
                  <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="truncate">
                    Found <span className="font-mono text-[#161212]">{detectedFileName}</span> in
                    Downloads
                  </span>
                </>
              ) : (
                <span>Watching ~/Downloads for a Game Porting Toolkit disk image</span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {detectedFileName ? (
                <button
                  type="button"
                  disabled={installing}
                  onClick={onInstallDetected}
                  className="app-no-drag inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#161212]/[0.07] px-4 py-2 text-[13px] font-medium text-[#161212] transition-colors hover:bg-[#161212]/12 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>Install {detectedFileName}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={installing}
                  onClick={onDownloadFromApple}
                  className="app-no-drag inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#161212]/[0.07] px-4 py-2 text-[13px] font-medium text-[#161212] transition-colors hover:bg-[#161212]/12 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>Download from Apple</span>
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                type="button"
                disabled={installing}
                onClick={() => fileInputRef.current?.click()}
                className="app-no-drag inline-flex cursor-pointer items-center rounded-full border border-[#161212]/12 bg-white/80 px-4 py-2 text-[13px] font-medium text-[#161212] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Choose File...
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".dmg"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    onChooseFile(file.name)
                  }
                  event.target.value = ''
                }}
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3">
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
          <>
            <button
              type="button"
              disabled={installing}
              onClick={detectedFileName ? onInstallDetected : onDownloadFromApple}
              className="app-no-drag inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {installing ? (
                <>
                  <SpinnerIcon className="h-4 w-4" />
                  <span>Installing...</span>
                </>
              ) : detectedFileName ? (
                <span>Install Toolkit</span>
              ) : (
                <>
                  <span>Download from Apple</span>
                  <ExternalLinkIcon className="h-4 w-4" />
                </>
              )}
            </button>

            <button
              type="button"
              disabled={installing}
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
