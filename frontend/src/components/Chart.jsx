import React, { useState } from 'react'

export default function Chart({ analytics }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  const days = Array.isArray(analytics?.days) ? analytics.days : []
  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  const parsed = days.map((d) => {
    const s = String(d.day || '')
    const [y, m, dd] = s.split('-').map(Number)
    const full = isFinite(m) && isFinite(dd) ? `${MONTHS[m - 1]} ${dd}` : s
    return { y, m, d: dd, full, raw: s }
  })

  const tickCount = Math.min(8, Math.max(2, parsed.length))
  const interval = Math.max(1, Math.ceil(parsed.length / tickCount))
  const labelFlags = parsed.map((_, i) => i % interval === 0 || i === parsed.length - 1)

  const seriesKeys = ['UAE', 'Oman', 'KSA', 'Bahrain', 'India', 'Kuwait', 'Qatar']
  const colors = {
    UAE: '#3b82f6', // Blue
    Oman: '#10b981', // Emerald
    KSA: '#f59e0b', // Amber
    Bahrain: '#ef4444', // Red
    India: '#8b5cf6', // Violet
    Kuwait: '#14b8a6', // Teal
    Qatar: '#f97316', // Orange
  }

  const dataByKey = Object.fromEntries(
    seriesKeys.map((k) => [k, days.map((d) => Number(d[k] || 0))])
  )
  const allValues = seriesKeys.flatMap((k) => dataByKey[k])

  const padding = 40
  const height = 350
  const width = Math.min(1200, Math.max(640, padding * 2 + parsed.length * 40))
  const max = Math.max(1, ...allValues) * 1.1 // Add 10% headroom
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(p * max))

  function toPoints(arr) {
    if (!arr || arr.length === 0) return ''
    return arr
      .map((v, i) => {
        const x = padding + i * ((width - 2 * padding) / Math.max(1, arr.length - 1))
        const y = height - padding - (v / max) * (height - 2 * padding)
        return `${x},${y}`
      })
      .join(' ')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sales Trend</h3>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Daily performance by country
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {seriesKeys.map((k) => (
            <div
              key={k}
              className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: colors[k] }} />
              {k}
            </div>
          ))}
        </div>
      </div>

      <div className="relative w-full overflow-x-auto pb-6">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[640px]"
        >
          {/* Grid Lines - Very subtle */}
          <g className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="1">
            {yTicks.map((v, i) => {
              const y = height - padding - (v / max) * (height - 2 * padding)
              return <line key={i} x1={padding} x2={width - padding} y1={y} y2={y} />
            })}
          </g>

          {/* Y-Axis Labels */}
          <g className="fill-slate-400 text-[10px] font-medium dark:fill-slate-600">
            {yTicks.map((v, i) => {
              const y = height - padding - (v / max) * (height - 2 * padding)
              return (
                <text key={i} x={10} y={y + 3}>
                  {v}
                </text>
              )
            })}
          </g>

          {/* Lines */}
          {seriesKeys.map((k) => (
            <polyline
              key={k}
              fill="none"
              stroke={colors[k]}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={toPoints(dataByKey[k])}
              className="transition-opacity duration-300"
              style={{ opacity: hoveredIndex !== null ? 0.3 : 1 }}
            />
          ))}

          {/* Highlighted Line on Hover */}
          {hoveredIndex !== null &&
            seriesKeys.map((k) => {
              // This logic is tricky without knowing which line is hovered.
              // For now, let's just keep all lines visible but dim them,
              // and maybe highlight the points.
              return null
            })}

          {/* Hover Overlay Line */}
          {hoveredIndex !== null && (
            <line
              x1={padding + hoveredIndex * ((width - 2 * padding) / Math.max(1, parsed.length - 1))}
              x2={padding + hoveredIndex * ((width - 2 * padding) / Math.max(1, parsed.length - 1))}
              y1={padding}
              y2={height - padding}
              stroke="currentColor"
              strokeWidth="1"
              className="text-slate-300 dark:text-slate-600"
              strokeDasharray="4 4"
            />
          )}

          {/* Data Points */}
          {seriesKeys.map((k) => (
            <g key={`pts-${k}`} fill={colors[k]}>
              {dataByKey[k].map((v, i) => {
                const x =
                  padding + i * ((width - 2 * padding) / Math.max(1, dataByKey[k].length - 1))
                const y = height - padding - (v / max) * (height - 2 * padding)
                const isHovered = hoveredIndex === i

                return (
                  <g key={i}>
                    {/* Invisible target */}
                    <circle
                      cx={x}
                      cy={y}
                      r={12}
                      fill="transparent"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className="cursor-pointer"
                    />
                    {/* Visible dot - only show on hover or if it's a peak/valley? No, show all but small */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 5 : 0}
                      className="transition-all duration-200"
                      stroke="white"
                      strokeWidth={isHovered ? 2 : 0}
                    />
                  </g>
                )
              })}
            </g>
          ))}

          {/* X-Axis Labels */}
          {parsed.map((it, i) => {
            if (!labelFlags[i]) return null
            const x = padding + i * ((width - 2 * padding) / Math.max(1, parsed.length - 1))
            const y = height - padding + 20
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                className="fill-slate-400 text-[10px] font-bold dark:fill-slate-500"
              >
                {it.full}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
