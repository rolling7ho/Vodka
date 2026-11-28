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
  | 'laptop'
  | 'cpu'
  | 'headset'
  | 'sword'
  | 'rocket'
  | 'car'
  | 'trophy'
  | 'globe'
  | 'music'
  | 'terminal'
  | 'shield'
  | 'heart'

export interface PcIconOption {
  id: PcIconId
  label: string
}

export const PC_ICON_OPTIONS: PcIconOption[] = [
  { id: 'pc', label: 'Desktop' },
  { id: 'laptop', label: 'Laptop' },
  { id: 'gamepad', label: 'Gamepad' },
  { id: 'cpu', label: 'Chip' },
  { id: 'steam', label: 'Steam' },
  { id: 'epic', label: 'Epic Games' },
  { id: 'battleNet', label: 'Battle.net' },
  { id: 'ea', label: 'EA App' },
  { id: 'rockstar', label: 'Rockstar' },
  { id: 'ubisoft', label: 'Ubisoft' },
  { id: 'bolt', label: 'Performance' },
  { id: 'flame', label: 'Action' },
  { id: 'sword', label: 'RPG' },
  { id: 'rocket', label: 'Sci-Fi' },
  { id: 'car', label: 'Racing' },
  { id: 'trophy', label: 'Competitive' },
  { id: 'headset', label: 'Headset' },
  { id: 'globe', label: 'Online' },
  { id: 'shield', label: 'Classic' },
  { id: 'star', label: 'Starred' },
  { id: 'heart', label: 'Favorites' },
  { id: 'music', label: 'Audio' },
  { id: 'terminal', label: 'Sandbox' },
  { id: 'folder', label: 'Archive' }
]

interface IconProps {
  className?: string
}

function SvgIcon({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}) {
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
      {children}
    </svg>
  )
}

function BoltIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </SvgIcon>
  )
}

function FlameIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </SvgIcon>
  )
}

function StarIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </SvgIcon>
  )
}

function LaptopIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />
    </SvgIcon>
  )
}

function CpuIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <rect width="12" height="12" x="6" y="6" rx="2" />
      <rect width="4" height="4" x="10" y="10" rx="0.5" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </SvgIcon>
  )
}

function HeadsetIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    </SvgIcon>
  )
}

function SwordIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" x2="19" y1="19" y2="13" />
      <line x1="16" x2="20" y1="16" y2="20" />
      <line x1="19" x2="21" y1="21" y2="19" />
    </SvgIcon>
  )
}

function RocketIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </SvgIcon>
  )
}

function CarIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </SvgIcon>
  )
}

function TrophyIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </SvgIcon>
  )
}

function GlobeIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </SvgIcon>
  )
}

function MusicIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </SvgIcon>
  )
}

function TerminalIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </SvgIcon>
  )
}

function ShieldIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </SvgIcon>
  )
}

function HeartIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </SvgIcon>
  )
}

export function PcGlyph({ icon, className }: { icon?: string | null; className?: string }) {
  switch (icon) {
    case 'laptop':
      return <LaptopIcon className={className} />
    case 'gamepad':
      return <GameControllerIcon className={className} />
    case 'cpu':
      return <CpuIcon className={className} />
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
    case 'sword':
      return <SwordIcon className={className} />
    case 'rocket':
      return <RocketIcon className={className} />
    case 'car':
      return <CarIcon className={className} />
    case 'trophy':
      return <TrophyIcon className={className} />
    case 'headset':
      return <HeadsetIcon className={className} />
    case 'globe':
      return <GlobeIcon className={className} />
    case 'shield':
      return <ShieldIcon className={className} />
    case 'star':
      return <StarIcon className={className} />
    case 'heart':
      return <HeartIcon className={className} />
    case 'music':
      return <MusicIcon className={className} />
    case 'terminal':
      return <TerminalIcon className={className} />
    case 'folder':
      return <FolderIcon className={className} />
    case 'pc':
    default:
      return <PcIcon className={className} />
  }
}
