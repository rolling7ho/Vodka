export type { DiscoveredBottle } from '../../../../shared/ipc'

export type GraphicsChoiceId =
  | 'automatic'
  | 'directX12'
  | 'directX11'
  | 'directX11Compatibility'
  | 'directX9'
  | 'openGL'

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
