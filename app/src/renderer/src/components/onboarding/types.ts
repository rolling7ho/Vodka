export type GraphicsChoiceId =
  | 'automatic'
  | 'directX12'
  | 'directX11'
  | 'directX11Compatibility'
  | 'directX9'
  | 'openGL'

export interface DiscoveredBottle {
  id: string
  name: string
  path: string
}

export type ComponentInstallStatus =
  | 'pending'
  | 'checking'
  | 'installed'
  | 'installing'
  | 'verifying'
  | 'error'

export type SteamSetupStage = 'idle' | 'creating' | 'downloading' | 'installing' | 'done'
