import {
  BattleNetLogo,
  EAAppLogo,
  EpicLogo,
  FolderIcon,
  GameControllerIcon,
  RockstarLogo,
  SteamLogo,
  UbisoftLogo
} from './OnboardingIcons'
import { PcIcon } from './SidebarIcons'

export type PcIconId =
  | 'pc'
  | 'gamepad'
  | 'steam'
  | 'epic'
  | 'battleNet'
  | 'ea'
  | 'rockstar'
  | 'ubisoft'
  | 'bolt'
  | 'flame'
  | 'star'
  | 'folder'

export interface PcIconOption {
  id: PcIconId
  label: string
}

export const PC_ICON_OPTIONS: PcIconOption[] = [
  { id: 'pc', label: 'Desktop' },
  { id: 'gamepad', label: 'Gamepad' },
  { id: 'steam', label: 'Steam' },
  { id: 'epic', label: 'Epic Games' },
  { id: 'battleNet', label: 'Battle.net' },
  { id: 'ea', label: 'EA App' },
  { id: 'rockstar', label: 'Rockstar' },
  { id: 'ubisoft', label: 'Ubisoft' },
  { id: 'bolt', label: 'Performance' },
  { id: 'flame', label: 'Action' },
  { id: 'star', label: 'Favorites' },
  { id: 'folder', label: 'Archive' }
]

interface IconProps {
  className?: string
}

function BoltIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  )
}

function FlameIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  )
}

function StarIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  )
}

export function PcGlyph({ icon, className }: { icon?: string | null; className?: string }) {
  switch (icon) {
    case 'gamepad':
      return <GameControllerIcon className={className} />
    case 'steam':
      return <SteamLogo className={className} />
    case 'epic':
      return <EpicLogo className={className} />
    case 'battleNet':
      return <BattleNetLogo className={className} />
    case 'ea':
      return <EAAppLogo className={className} />
    case 'rockstar':
      return <RockstarLogo className={className} />
    case 'ubisoft':
      return <UbisoftLogo className={className} />
    case 'bolt':
      return <BoltIcon className={className} />
    case 'flame':
      return <FlameIcon className={className} />
    case 'star':
      return <StarIcon className={className} />
    case 'folder':
      return <FolderIcon className={className} />
    case 'pc':
    default:
      return <PcIcon className={className} />
  }
}
