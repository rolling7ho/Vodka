import { useState } from 'react'
import { AppScreen } from '../../shared/ipc'
import { Home } from './components/home/Home'
import { Onboarding } from './components/onboarding/Onboarding'

function resolveInitialScreen(): AppScreen {
  const screenParam = new URLSearchParams(window.location.search).get('screen')
  return screenParam === 'home' ? 'home' : 'onboarding'
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(resolveInitialScreen)

  if (screen === 'home') {
    return <Home onOpenOnboarding={() => setScreen('onboarding')} />
  }

  return <Onboarding onComplete={() => setScreen('home')} />
}
