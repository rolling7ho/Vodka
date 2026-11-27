import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import {
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  GameControllerIcon,
  ShieldAlertIcon
} from '../icons/OnboardingIcons'
import { getGraphicsChoiceTitle } from './GraphicsStep'
import type { GraphicsChoiceId } from './types'

interface ReadyStepProps {
  steamInstalled: boolean
  graphicsChoice: GraphicsChoiceId
  onOpenSteam: () => void
  onFinish: () => void
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

export function ReadyStep({
  steamInstalled,
  graphicsChoice,
  onOpenSteam,
  onFinish
}: ReadyStepProps) {
  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-8 pb-16">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600">
        <CheckIcon className="h-6 w-6" />
      </span>

      <h2 className="mt-4 text-center text-[34px] leading-tight font-semibold tracking-[-0.03em] text-[#161212]">
        You are ready to play
      </h2>
      <p className="mt-2 max-w-lg text-center text-[15px] text-[#5e5454]">
        Graphics routing is set to{' '}
        <span className="font-medium text-[#161212]">{getGraphicsChoiceTitle(graphicsChoice)}</span>.
      </p>

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
        {steamInstalled ? (
          <>
            <button
              type="button"
              onClick={onOpenSteam}
              className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98]"
            >
              <span>Open Steam</span>
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={onFinish}
              className="app-no-drag cursor-pointer rounded-full border border-[#161212]/12 bg-white/80 px-5 py-3 text-[14px] font-medium text-[#161212] transition-colors hover:bg-white"
            >
              Go to Library
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onFinish}
            className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98]"
          >
            <span>Go to Library</span>
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </main>
  )
}
