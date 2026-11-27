import { WelcomeStep } from './WelcomeStep'

interface OnboardingProps {
  onComplete?: () => void
}

export function Onboarding({ onComplete }: OnboardingProps) {
  return (
    <div className="flex h-full flex-col bg-white text-[#161212] select-none">
      <header className="app-drag h-10 shrink-0" />
      <WelcomeStep onStart={onComplete} />
    </div>
  )
}
