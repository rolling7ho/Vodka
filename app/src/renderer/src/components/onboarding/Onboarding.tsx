import { useEffect, useState } from 'react'
import { ArrowLeftIcon } from '../icons/ArrowLeftIcon'
import { PlaceholderStep } from './PlaceholderStep'
import { WelcomeStep } from './WelcomeStep'

interface OnboardingProps {
  onComplete?: () => void
}

type Direction = 'forward' | 'backward'

interface NavigationState {
  stepIndex: number
  direction: Direction | null
  transitionId: number
  exiting: {
    stepIndex: number
    direction: Direction
    key: number
  } | null
}

const EXIT_CLEANUP_MS = 520

export function Onboarding({ onComplete }: OnboardingProps) {
  const [nav, setNav] = useState<NavigationState>({
    stepIndex: 0,
    direction: null,
    transitionId: 0,
    exiting: null
  })

  useEffect(() => {
    if (!nav.exiting) {
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const delay = prefersReducedMotion ? 0 : EXIT_CLEANUP_MS

    const timer = window.setTimeout(() => {
      setNav((prev) => ({ ...prev, exiting: null }))
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [nav.exiting])

  function navigateTo(nextStepIndex: number, direction: Direction): void {
    setNav((prev) => {
      const nextId = prev.transitionId + 1
      return {
        stepIndex: nextStepIndex,
        direction,
        transitionId: nextId,
        exiting: {
          stepIndex: prev.stepIndex,
          direction,
          key: nextId
        }
      }
    })
  }

  function renderStep(stepIndex: number, interactive: boolean, animateEntrance: boolean) {
    if (stepIndex === 0) {
      return (
        <WelcomeStep
          animateEntrance={animateEntrance}
          onStart={interactive ? () => navigateTo(1, 'forward') : undefined}
        />
      )
    }

    if (stepIndex === 1) {
      return (
        <PlaceholderStep
          title="Step 2 placeholder"
          description="Placeholder view for the second onboarding step."
          nextLabel="Continue"
          onNext={interactive ? () => navigateTo(2, 'forward') : undefined}
        />
      )
    }

    return (
      <PlaceholderStep
        title="Step 3 placeholder"
        description="Placeholder view for the third onboarding step."
        nextLabel={onComplete ? 'Finish' : undefined}
        onNext={interactive ? onComplete : undefined}
      />
    )
  }

  const enterClass =
    nav.direction === 'forward'
      ? 'animate-slide-in-right'
      : nav.direction === 'backward'
        ? 'animate-slide-in-left'
        : ''

  const canGoBack = nav.stepIndex > 0

  return (
    <div className="onboarding-radiance relative flex h-full flex-col text-[#161212] select-none">
      <header className="app-drag relative z-10 h-10 shrink-0" />

      <div className="relative z-10 flex-1 overflow-hidden">
        {nav.exiting ? (
          <div
            key={`exit-${nav.exiting.key}`}
            className={`pointer-events-none absolute inset-0 flex ${
              nav.exiting.direction === 'forward'
                ? 'animate-slide-out-left'
                : 'animate-slide-out-right'
            }`}
          >
            {renderStep(nav.exiting.stepIndex, false, false)}
          </div>
        ) : null}

        <div
          key={`step-${nav.stepIndex}-${nav.transitionId}`}
          className={`absolute inset-0 flex ${enterClass}`}
        >
          {renderStep(nav.stepIndex, true, nav.direction === null)}
        </div>
      </div>

      <button
        type="button"
        aria-label="Back"
        aria-hidden={!canGoBack}
        tabIndex={canGoBack ? 0 : -1}
        disabled={!canGoBack}
        onClick={() => navigateTo(Math.max(0, nav.stepIndex - 1), 'backward')}
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
