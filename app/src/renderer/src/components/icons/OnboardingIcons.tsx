interface IconProps {
  className?: string
}

interface CheckIconProps extends IconProps {
  animated?: boolean
}

export function CheckIcon({ className, animated = true }: CheckIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5 13l4 4L19 7"
        pathLength={1}
        className={animated ? 'animate-check-write' : undefined}
      />
    </svg>
  )
}

export function DownloadIcon({ className }: IconProps) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  )
}

export function FolderIcon({ className }: IconProps) {
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
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  )
}

export function ExternalLinkIcon({ className }: IconProps) {
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
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  )
}

export function InfoIcon({ className }: IconProps) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}

export function SparklesIcon({ className }: IconProps) {
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
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
    </svg>
  )
}

export function DirectX12Logo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 5l14 14M19 5L5 19"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <rect
        x="13.5"
        y="13.5"
        width="8.5"
        height="7"
        rx="2"
        fill="currentColor"
      />
      <text
        x="17.75"
        y="18.6"
        textAnchor="middle"
        fontSize="5.2"
        fontWeight="700"
        fill="#ffffff"
        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
      >
        12
      </text>
    </svg>
  )
}

export function DirectX11Logo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 5l14 14M19 5L5 19"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <rect
        x="13.5"
        y="13.5"
        width="8.5"
        height="7"
        rx="2"
        fill="currentColor"
      />
      <text
        x="17.75"
        y="18.6"
        textAnchor="middle"
        fontSize="5.2"
        fontWeight="700"
        fill="#ffffff"
        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
      >
        11
      </text>
    </svg>
  )
}

export function DirectX11CompatLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 5l14 14M19 5L5 19"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeDasharray="2.5 2.5"
      />
      <rect
        x="13.5"
        y="13.5"
        width="8.5"
        height="7"
        rx="2"
        fill="currentColor"
      />
      <text
        x="17.75"
        y="18.6"
        textAnchor="middle"
        fontSize="5.2"
        fontWeight="700"
        fill="#ffffff"
        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
      >
        11
      </text>
    </svg>
  )
}

export function DirectX9Logo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 5l14 14M19 5L5 19"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <rect
        x="14.5"
        y="13.5"
        width="7.5"
        height="7"
        rx="2"
        fill="currentColor"
      />
      <text
        x="18.25"
        y="18.6"
        textAnchor="middle"
        fontSize="5.4"
        fontWeight="700"
        fill="#ffffff"
        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
      >
        9
      </text>
    </svg>
  )
}

export function OpenGLVulkanLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <polygon
        points="12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 9.5 12 16l3.5-6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SteamLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="15" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8" cy="16" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M10.1 14.5 12.8 10.6M4 13.5l2.2 1.1"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function EpicLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5 4h14v11.5L12 20l-7-4.5V4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 8.5h5M9.5 12h4M9.5 15.5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function BattleNetLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <ellipse
        cx="12"
        cy="12"
        rx="8.5"
        ry="3.6"
        transform="rotate(30 12 12)"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="8.5"
        ry="3.6"
        transform="rotate(90 12 12)"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="8.5"
        ry="3.6"
        transform="rotate(150 12 12)"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function EAAppLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M7.2 9.5h4.2M7.2 12h3.5M7.2 14.5h4.2M13.5 14.5l2.1-5 2.1 5M14.2 13h2.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function RockstarLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.5 15.5V8.5h3.2a2 2 0 0 1 0 4H8.5M11.4 12.5l2.2 3M16.2 13.8l.6 1.2 1.3.2-.9.9.2 1.3-1.2-.6-1.2.6.2-1.3-.9-.9 1.3-.2.6-1.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UbisoftLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M15.5 12a3.5 3.5 0 1 1-3.5-3.5c2.2 0 3.5 1.5 3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12.5" r="1.2" fill="currentColor" />
    </svg>
  )
}

export function ClockIcon({ className }: IconProps) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

export function GameControllerIcon({ className }: IconProps) {
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
      <line x1="6" x2="10" y1="11" y2="11" />
      <line x1="8" x2="8" y1="9" y2="13" />
      <line x1="15" x2="15.01" y1="12" y2="12" />
      <line x1="18" x2="18.01" y1="10" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
    </svg>
  )
}

export function ShieldAlertIcon({ className }: IconProps) {
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
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  )
}

export function SpinnerIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ? `animate-spin ${className}` : 'animate-spin'}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
