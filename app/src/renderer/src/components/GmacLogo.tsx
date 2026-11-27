interface GmacLogoProps {
  className?: string
}

export function GmacLogo({ className }: GmacLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="56 56 288 288"
      fill="none"
      role="img"
      aria-label="Gmac"
      className={className}
    >
      <path
        d="M 189 183 L 217 200 L 189 217 Z"
        fill="#713131"
        stroke="#713131"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M 292.1 117.0 A 124 124 0 1 0 324 200 L 248 200"
        stroke="#713131"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 250.5 154.5 A 68 68 0 1 0 234.0 258.9"
        stroke="#713131"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
