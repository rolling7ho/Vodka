import { useEffect, useState } from 'react'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import {
  ClockIcon,
  DownloadIcon,
  GameControllerIcon,
  ShieldAlertIcon
} from '../icons/OnboardingIcons'

interface ReadyStepProps {
  isActive: boolean
  selectedLauncherName: string | null
  launcherReady: boolean
  onPrimaryAction: () => void
}

const TIPS = [
  {
    title: 'Steam updates on first launch',
    detail:
      'The Steam window can stay blank or show "Updating Steam" for 2 to 5 minutes the first time it opens.',
    icon: (className: string) => <DownloadIcon className={className} />
  },
  {
    title: 'First game launch builds shaders',
    detail:
      'A game starts slower the first time while graphics shaders compile; later launches are faster.',
    icon: (className: string) => <ClockIcon className={className} />
  },
  {
    title: 'macOS Game Mode',
    detail: 'Play full screen to enable macOS Game Mode automatically.',
    icon: (className: string) => <GameControllerIcon className={className} />
  },
  {
    title: 'Kernel anti-cheat',
    detail: 'Online games with kernel-level anti-cheat cannot run through Wine on macOS.',
    icon: (className: string) => <ShieldAlertIcon className={className} />
  }
]

type RevealPhase = 'idle' | 'draw' | 'reveal'

export function ReadyStep({
  isActive,
  selectedLauncherName,
  launcherReady,
  onPrimaryAction
}: ReadyStepProps) {
  const [phase, setPhase] = useState<RevealPhase>('idle')

  useEffect(() => {
    if (!isActive) {
      setPhase('idle')
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setPhase('reveal')
      return
    }

    const startDrawTimer = window.setTimeout(() => {
      setPhase('draw')
    }, 480)

    const revealTimer = window.setTimeout(() => {
      setPhase('reveal')
    }, 1280)

    return () => {
      window.clearTimeout(startDrawTimer)
      window.clearTimeout(revealTimer)
    }
  }, [isActive])

  const checkPositionClass =
    phase === 'reveal'
      ? 'translate-y-0 scale-100 opacity-100'
      : phase === 'draw'
        ? 'translate-y-[185px] scale-[1.55] opacity-100'
        : 'translate-y-[185px] scale-90 opacity-0'

  const revealContentClass =
    phase === 'reveal'
      ? 'translate-y-0 opacity-100'
      : 'pointer-events-none translate-y-4 opacity-0'

  const primaryLabel =
    launcherReady && selectedLauncherName ? `Open ${selectedLauncherName}` : 'Done'

  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 pb-16">
      <span
        className={`inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${checkPositionClass}`}
      >
        {phase !== 'idle' ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-6 w-6"
          >
            <path d="M5 13l4 4L19 7" pathLength={1} className="animate-check-write-hero" />
          </svg>
        ) : null}
      </span>

      <div
        className={`flex w-full flex-col items-center transition-all duration-600 delay-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${revealContentClass}`}
      >
        <h2 className="mt-4 text-center text-[34px] leading-tight font-semibold tracking-[-0.03em] text-[#161212]">
          You are ready to play
        </h2>

        <div className="mt-6 w-full max-w-lg rounded-2xl border border-[#161212]/10 bg-white/75 p-5 shadow-xs backdrop-blur-md">
          <p className="text-[12px] font-semibold tracking-wide text-[#5e5454] uppercase">
            Good to know
          </p>

          <div className="mt-3 divide-y divide-[#161212]/8">
            {TIPS.map((tip) => (
              <div key={tip.title} className="flex items-start gap-3 py-2.5 first:pt-1 last:pb-0">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#713131]/[0.08] text-[#713131]">
                  {tip.icon('h-3.5 w-3.5')}
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-[#161212]">{tip.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-[#5e5454]">{tip.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-7 flex items-center gap-3">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98]"
          >
            <span>{primaryLabel}</span>
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </main>
  )
}
