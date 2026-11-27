export type { DiscoveredBottle } from '../../../../shared/ipc'

export type SlideDirection = 'forward' | 'backward'

export function stepParallaxClass(
  isActive: boolean,
  direction: SlideDirection,
  slot: 1 | 2 | 3
): string | undefined {
  if (!isActive) {
    return undefined
  }
  return direction === 'forward' ? `animate-parallax-right-${slot}` : `animate-parallax-left-${slot}`
}

export type LauncherId =
  | 'steam'
  | 'epicGames'
  | 'battleNet'
  | 'eaApp'
  | 'rockstar'
  | 'ubisoft'

export type ComponentInstallStatus =
  | 'pending'
  | 'checking'
  | 'installed'
  | 'installing'
  | 'verifying'
  | 'error'

export type LauncherSetupStage = 'idle' | 'creating' | 'downloading' | 'installing' | 'done'
