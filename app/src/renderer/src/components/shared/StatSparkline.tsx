import { useId } from 'react'
import type { StatPoint } from '../../../../shared/ipc'

function clampCoord(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

export function StatSparkline({
  points,
  className = 'mt-3.5 h-[42px] w-full'
}: {
  points: StatPoint[]
  className?: string
}) {
  const gradientId = useId().replace(/:/g, '')
  const width = 240
  const height = 46
  const padX = 4
  const padTop = 7
  const padBottom = 6
  const baseY = height - padBottom

  const hasNonZero = points.some((point) => point.value > 0)
  if (points.length < 2 || !hasNonZero) {
    return (
      <div className={className}>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" aria-hidden="true">
          <path
            d={`M ${padX} ${baseY} L ${width - padX} ${baseY}`}
            fill="none"
            stroke="#713131"
            strokeOpacity="0.18"
            strokeWidth={1.75}
            strokeLinecap="round"
          />
        </svg>
      </div>
    )
  }

  const minVal = Math.min(...points.map((point) => point.value))
  const maxVal = Math.max(...points.map((point) => point.value))
  const range = maxVal - minVal || 1
  const usableWidth = width - padX * 2
  const usableHeight = height - padTop - padBottom

  const coords = points.map((point, index) => {
    const x = padX + (index / (points.length - 1)) * usableWidth
    const normalized = (point.value - minVal) / range
    const y = padTop + (1 - normalized) * usableHeight
    return { x, y }
  })

  let linePath = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)]
    const p1 = coords[i]
    const p2 = coords[i + 1]
    const p3 = coords[Math.min(coords.length - 1, i + 2)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = clampCoord(p1.y + (p2.y - p0.y) / 6, padTop, baseY)
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = clampCoord(p2.y - (p3.y - p1.y) / 6, padTop, baseY)

    linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }

  const last = coords[coords.length - 1]
  const areaPath = `${linePath} L ${last.x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`

  return (
    <div className={`animate-sparkline-reveal ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#713131" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#713131" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="#713131"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={last.x} cy={last.y} r="3" fill="#713131" />
      </svg>
    </div>
  )
}
