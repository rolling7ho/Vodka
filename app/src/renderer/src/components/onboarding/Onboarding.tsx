import { useState } from 'react'
import { ArrowLeftIcon } from '../icons/ArrowLeftIcon'
import { PlaceholderStep } from './PlaceholderStep'
import { WelcomeStep } from './WelcomeStep'

interface OnboardingProps {
  onComplete?: () => void
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0)

  const canGoBack = stepIndex > 0

  return (
    <div className="onboarding-radiance relative flex h-full flex-col text-[#161212] select-none">
      <header className="app-drag relative z-10 h-10 shrink-0" />

      <div className="relative z-10 flex-1 overflow-hidden">
        <div
          className="onboarding-track flex h-full w-full"
          style={{ transform: `translate3d(-${stepIndex * 100}%, 0, 0)` }}
        >
          <div
            className="flex h-full w-full shrink-0"
            aria-hidden={stepIndex !== 0}
            inert={stepIndex !== 0}
          >
            <WelcomeStep onStart={() => setStepIndex(1)} />
          </div>

          <div
            className="flex h-full w-full shrink-0"
            aria-hidden={stepIndex !== 1}
            inert={stepIndex !== 1}
          >
            <PlaceholderStep
              title="Step 2 placeholder"
              description="Placeholder view for the second onboarding step."
              nextLabel="Continue"
              onNext={() => setStepIndex(2)}
            />
          </div>

          <div
            className="flex h-full w-full shrink-0"
            aria-hidden={stepIndex !== 2}
            inert={stepIndex !== 2}
          >
            <PlaceholderStep
              title="Step 3 placeholder"
              description="Placeholder view for the third onboarding step."
              nextLabel={onComplete ? 'Finish' : undefined}
              onNext={onComplete}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label="Back"
        aria-hidden={!canGoBack}
        tabIndex={canGoBack ? 0 : -1}
        disabled={!canGoBack}
        onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
        className={`app-no-drag group absolute right-6 bottom-6 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#161212]/10 bg-white/80 text-[#161212] shadow-xs backdrop-blur-md transition-all duration-200 hover:border-[#161212]/20 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] active:scale-95 ${
          canGoBack
            ? 'cursor-pointer scale-100 opacity-100'
            : 'pointer-events-none scale-90 opacity-0'
        }`}
      >
        <ArrowLeftIcon className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
      </button>
    </div>
  )
}
