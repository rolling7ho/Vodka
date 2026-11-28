import { useEffect, useRef, useState } from 'react'
import { AppScreen } from '../../shared/ipc'
import { Home } from './components/home/Home'
import { Onboarding } from './components/onboarding/Onboarding'

function resolveInitialScreen(): AppScreen {
  const screenParam = new URLSearchParams(window.location.search).get('screen')
  return screenParam === 'home' ? 'home' : 'onboarding'
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(resolveInitialScreen)
  const [isTransitioningToHome, setIsTransitioningToHome] = useState(false)
  const transitionTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current)
      }
    }
  }, [])

  const handleOnboardingComplete = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setScreen('home')

    if (prefersReducedMotion) {
      setIsTransitioningToHome(false)
      return
    }

    setIsTransitioningToHome(true)
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current)
    }
    transitionTimerRef.current = window.setTimeout(() => {
      setIsTransitioningToHome(false)
      transitionTimerRef.current = null
    }, 660)
  }

  const handleOpenOnboarding = () => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }
    setIsTransitioningToHome(false)
    setScreen('onboarding')
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-white">
      {screen === 'home' && (
        <div className={isTransitioningToHome ? 'animate-home-enter h-full w-full' : 'h-full w-full'}>
          <Home
            enteredFromOnboarding={isTransitioningToHome}
            onOpenOnboarding={handleOpenOnboarding}
          />
        </div>
      )}

      {(screen === 'onboarding' || isTransitioningToHome) && (
        <div
          className={
            isTransitioningToHome
              ? 'animate-onboarding-exit pointer-events-none absolute inset-0 z-40'
              : 'h-full w-full'
          }
          aria-hidden={isTransitioningToHome}
        >
          <Onboarding onComplete={handleOnboardingComplete} />
        </div>
      )}
    </div>
  )
}
