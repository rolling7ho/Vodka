import { WelcomeStep } from './WelcomeStep'

interface OnboardingProps {
  onComplete?: () => void
}

export function Onboarding({ onComplete }: OnboardingProps) {
  return (
    <div className="onboarding-radiance flex h-full flex-col text-[#161212] select-none">
      <header className="app-drag relative z-10 h-10 shrink-0" />
      <WelcomeStep onStart={onComplete} />
    </div>
  )
}
