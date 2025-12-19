import { useMemo, useState } from 'react'

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function formatCompact(n) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  if (abs >= 10) return `${n.toFixed(0)}`
  return `${n.toFixed(2)}`
}

/**
 * Lightweight SVG chart (no extra deps) for a monthly time series.
 * data: [{ label, value }]
 */
export function MonthLineChart({ data, height = 280, color = '#7c5cff' }) {
  const [hoverIndex, setHoverIndex] = useState(null)

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height,
          display: 'grid',
          placeItems: 'center',
          color: 'rgba(255,255,255,0.70)',
        }}
      >
        No chart data to display.
      </div>
    )
  }

  const { points, yTicks, yMin, yMax } = useMemo(() => {
    const values = data.map((d) => d.value)
    const rawMin = values.length ? Math.min(...values) : 0
    const rawMax = values.length ? Math.max(...values) : 1
    const pad = (rawMax - rawMin) * 0.12 || 1
    const min = rawMin - pad
    const max = rawMax + pad

    const ticks = []
    const steps = 4
    for (let i = 0; i <= steps; i++) {
      ticks.push(min + ((max - min) * i) / steps)
    }

    return { points: values, yTicks: ticks, yMin: min, yMax: max }
  }, [data])

  const w = 1000
  const h = 320
  const padL = 70
  const padR = 18
  const padT = 22
  const padB = 52

  const innerW = w - padL - padR
  const innerH = h - padT - padB

  const xAt = (i) =>
    padL + (data.length <= 1 ? innerW / 2 : (innerW * i) / (data.length - 1))
  const yAt = (v) => {
    const t = (v - yMin) / (yMax - yMin || 1)
    return padT + innerH * (1 - clamp(t, 0, 1))
  }

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(d.value).toFixed(2)}`)
    .join(' ')

  const areaPath = `${linePath} L ${xAt(data.length - 1).toFixed(2)} ${(
    padT + innerH
  ).toFixed(2)} L ${xAt(0).toFixed(2)} ${(padT + innerH).toFixed(2)} Z`

  const hover = hoverIndex != null ? data[hoverIndex] : null

  return (
    <div style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Monthly chart"
        style={{ display: 'block' }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.30" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* grid + y axis labels */}
        {yTicks.map((t, idx) => {
          const y = yAt(t)
          return (
            <g key={idx}>
              <line
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
              />
              <text
                x={padL - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fill="rgba(255,255,255,0.65)"
              >
                {formatCompact(t)}
              </text>
            </g>
          )
        })}

        {/* axes */}
        <line
          x1={padL}
          x2={w - padR}
          y1={padT + innerH}
          y2={padT + innerH}
          stroke="rgba(255,255,255,0.12)"
        />
        <line
          x1={padL}
          x2={padL}
          y1={padT}
          y2={padT + innerH}
          stroke="rgba(255,255,255,0.12)"
        />

        {/* area + line */}
        <path d={areaPath} fill="url(#areaFill)" />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* x labels (sparse) */}
        {data.map((d, i) => {
          const show = data.length <= 12 || i % Math.ceil(data.length / 8) === 0 || i === data.length - 1
          if (!show) return null
          return (
            <text
              key={d.key || d.label || i}
              x={xAt(i)}
              y={h - 18}
              textAnchor="middle"
              fontSize="12"
              fill="rgba(255,255,255,0.62)"
            >
              {d.label}
            </text>
          )
        })}

        {/* hover targets */}
        {data.map((d, i) => (
          <g key={d.key || i}>
            <circle
              cx={xAt(i)}
              cy={yAt(d.value)}
              r={hoverIndex === i ? 6 : 4}
              fill={hoverIndex === i ? '#ffffff' : color}
              opacity={hoverIndex === i ? 1 : 0.85}
            />
            <rect
              x={xAt(i) - innerW / Math.max(data.length, 1) / 2}
              y={padT}
              width={innerW / Math.max(data.length, 1)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
            />
          </g>
        ))}

        {/* tooltip */}
        {hover ? (
          <g>
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={padT}
              y2={padT + innerH}
              stroke="rgba(255,255,255,0.10)"
            />
            <g transform={`translate(${clamp(xAt(hoverIndex) - 90, padL, w - padR - 180)}, ${padT + 8})`}>
              <rect
                width="180"
                height="56"
                rx="12"
                fill="rgba(0,0,0,0.55)"
                stroke="rgba(255,255,255,0.16)"
              />
              <text x="12" y="22" fontSize="12" fill="rgba(255,255,255,0.72)">
                {hover.fullLabel || hover.label}
              </text>
              <text x="12" y="42" fontSize="16" fill="rgba(255,255,255,0.92)">
                {formatCompact(hover.value)}
              </text>
            </g>
          </g>
        ) : null}
      </svg>
    </div>
  )
}


