import { GmacWordmark } from '../GmacWordmark'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'

interface WelcomeStepProps {
  onStart?: () => void
}

export function WelcomeStep({ onStart }: WelcomeStepProps) {
  return (
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-10">
      <div className="animate-fade-up">
        <h1
          aria-label="Welcome to Gmac"
          className="flex items-baseline justify-center gap-3 text-[42px] leading-none font-semibold tracking-[-0.03em] text-[#161212]"
        >
          <span>Welcome to</span>
          <GmacWordmark className="h-[46px] w-auto translate-y-[5px]" />
        </h1>
      </div>

      <div className="mt-9 animate-fade-up-delayed">
        <button
          type="button"
          onClick={onStart}
          className="app-no-drag group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#007AFF] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:bg-[#0066D6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-[0.98]"
        >
          <span>Start</span>
          <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>
    </main>
  )
}
