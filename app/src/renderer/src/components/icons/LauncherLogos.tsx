import battlenetLogo from '../../assets/launchers/battlenet.png'
import eaLogo from '../../assets/launchers/ea.png'
import epicLogo from '../../assets/launchers/epic.png'
import rockstarLogo from '../../assets/launchers/rockstar.png'
import steamLogo from '../../assets/launchers/steam.png'
import ubisoftLogo from '../../assets/launchers/ubisoft.png'
import { GameControllerIcon } from './OnboardingIcons'

const LAUNCHER_LOGOS: Record<string, { src: string; alt: string; darkInvert?: boolean }> = {
  steam: { src: steamLogo, alt: 'Steam' },
  epicGames: { src: epicLogo, alt: 'Epic Games Store' },
  battleNet: { src: battlenetLogo, alt: 'Battle.net' },
  eaApp: { src: eaLogo, alt: 'EA App' },
  rockstar: { src: rockstarLogo, alt: 'Rockstar Games' },
  ubisoft: { src: ubisoftLogo, alt: 'Ubisoft Connect', darkInvert: true }
}

interface LauncherBrandImageProps {
  id: string
  className?: string
}

export function LauncherBrandImage({ id, className }: LauncherBrandImageProps) {
  const entry = LAUNCHER_LOGOS[id]
  if (!entry) {
    return <GameControllerIcon className={className} />
  }

  const imageClasses = [
    className ?? 'h-5 w-5 object-contain',
    entry.darkInvert ? 'dark-invert-logo' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <img
      src={entry.src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={imageClasses}
    />
  )
}
