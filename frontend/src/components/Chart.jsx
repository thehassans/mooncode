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
    UAE: {
      line: '#3b82f6',
      fill: 'rgba(59, 130, 246, 0.1)',
      shadow: '0 0 20px rgba(59, 130, 246, 0.3)',
    },
    Oman: {
      line: '#10b981',
      fill: 'rgba(16, 185, 129, 0.1)',
      shadow: '0 0 20px rgba(16, 185, 129, 0.3)',
    },
    KSA: {
      line: '#f59e0b',
      fill: 'rgba(245, 158, 11, 0.1)',
      shadow: '0 0 20px rgba(245, 158, 11, 0.3)',
    },
    Bahrain: {
      line: '#ef4444',
      fill: 'rgba(239, 68, 68, 0.1)',
      shadow: '0 0 20px rgba(239, 68, 68, 0.3)',
    },
    India: {
      line: '#8b5cf6',
      fill: 'rgba(139, 92, 246, 0.1)',
      shadow: '0 0 20px rgba(139, 92, 246, 0.3)',
    },
    Kuwait: {
      line: '#14b8a6',
      fill: 'rgba(20, 184, 166, 0.1)',
      shadow: '0 0 20px rgba(20, 184, 166, 0.3)',
    },
    Qatar: {
      line: '#f97316',
      fill: 'rgba(249, 115, 22, 0.1)',
      shadow: '0 0 20px rgba(249, 115, 22, 0.3)',
    },
  }

  const dataByKey = Object.fromEntries(
    seriesKeys.map((k) => [k, days.map((d) => Number(d[k] || 0))])
  )
  const allValues = seriesKeys.flatMap((k) => dataByKey[k])

  const padding = 60
  const height = 400
  const width = Math.min(1400, Math.max(700, padding * 2 + parsed.length * 50))
  const max = Math.max(1, ...allValues) * 1.15
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

  function toPath(arr) {
    if (!arr || arr.length === 0) return ''
    const points = arr.map((v, i) => {
      const x = padding + i * ((width - 2 * padding) / Math.max(1, arr.length - 1))
      const y = height - padding - (v / max) * (height - 2 * padding)
      return { x, y }
    })

    let path = `M ${points[0].x},${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i]
      const next = points[i + 1]
      const controlX = (current.x + next.x) / 2
      path += ` Q ${controlX},${current.y} ${(current.x + next.x) / 2},${(current.y + next.y) / 2}`
      path += ` Q ${controlX},${next.y} ${next.x},${next.y}`
    }
    return path
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {seriesKeys.map((k) => {
          const total = dataByKey[k].reduce((sum, val) => sum + val, 0)
          return (
            <div
              key={k}
              className="group flex items-center gap-2 rounded-xl border border-slate-200/50 bg-gradient-to-br from-white to-slate-50 px-4 py-2 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-slate-700/50 dark:from-slate-800 dark:to-slate-900"
            >
              <span
                className="h-3 w-3 rounded-full shadow-lg transition-all duration-300 group-hover:scale-125"
                style={{ background: colors[k].line, boxShadow: colors[k].shadow }}
              />
              <span className="text-xs font-black text-slate-700 dark:text-slate-300">{k}</span>
              <span className="text-xs font-bold text-slate-400">({total})</span>
            </div>
          )
        })}
      </div>

      {/* Chart */}
      <div className="relative w-full overflow-x-auto rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-slate-50 p-6 shadow-lg backdrop-blur-sm dark:border-slate-700/50 dark:from-slate-800 dark:to-slate-900">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[700px]"
        >
          {/* Gradient Backgrounds for Hover */}
          <defs>
            {seriesKeys.map((k) => (
              <React.Fragment key={k}>
                <linearGradient id={`gradient-${k}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={colors[k].line} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={colors[k].line} stopOpacity="0" />
                </linearGradient>
                <filter id={`glow-${k}`}>
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </React.Fragment>
            ))}
          </defs>

          {/* Grid Lines */}
          <g className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" opacity="0.5">
            {yTicks.map((v, i) => {
              const y = height - padding - (v / max) * (height - 2 * padding)
              return (
                <line
                  key={i}
                  x1={padding}
                  x2={width - padding}
                  y1={y}
                  y2={y}
                  strokeDasharray="4 4"
                />
              )
            })}
          </g>

          {/* Y-Axis Labels */}
          <g className="fill-slate-500 text-xs font-bold dark:fill-slate-400">
            {yTicks.map((v, i) => {
              const y = height - padding - (v / max) * (height - 2 * padding)
              return (
                <text key={i} x={padding - 10} y={y + 4} textAnchor="end">
                  {v}
                </text>
              )
            })}
          </g>

          {/* Area Fills (subtle) */}
          {seriesKeys.map((k) => {
            const points = dataByKey[k]
              .map((v, i) => {
                const x =
                  padding + i * ((width - 2 * padding) / Math.max(1, dataByKey[k].length - 1))
                const y = height - padding - (v / max) * (height - 2 * padding)
                return `${x},${y}`
              })
              .join(' ')

            const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`

            return (
              <polygon
                key={`area-${k}`}
                points={areaPoints}
                fill={`url(#gradient-${k})`}
                opacity="0.3"
              />
            )
          })}

          {/* Lines */}
          {seriesKeys.map((k) => (
            <path
              key={k}
              d={toPath(dataByKey[k])}
              fill="none"
              stroke={colors[k].line}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-500"
              style={{
                filter: hoveredIndex !== null ? 'none' : `url(#glow-${k})`,
                opacity: hoveredIndex !== null ? 0.2 : 1,
              }}
            />
          ))}

          {/* Hover Line */}
          {hoveredIndex !== null && (
            <line
              x1={padding + hoveredIndex * ((width - 2 * padding) / Math.max(1, parsed.length - 1))}
              x2={padding + hoveredIndex * ((width - 2 * padding) / Math.max(1, parsed.length - 1))}
              y1={padding}
              y2={height - padding}
              stroke="currentColor"
              strokeWidth="2"
              className="text-slate-300 dark:text-slate-600"
              strokeDasharray="6 6"
              opacity="0.5"
            />
          )}

          {/* Data Points */}
          {seriesKeys.map((k) => (
            <g key={`pts-${k}`}>
              {dataByKey[k].map((v, i) => {
                const x =
                  padding + i * ((width - 2 * padding) / Math.max(1, dataByKey[k].length - 1))
                const y = height - padding - (v / max) * (height - 2 * padding)
                const isHovered = hoveredIndex === i

                return (
                  <g key={i}>
                    <circle
                      cx={x}
                      cy={y}
                      r={20}
                      fill="transparent"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className="cursor-pointer"
                    />
                    {isHovered && (
                      <>
                        <circle cx={x} cy={y} r={8} fill={colors[k].line} opacity="0.2" />
                        <circle
                          cx={x}
                          cy={y}
                          r={5}
                          fill={colors[k].line}
                          stroke="white"
                          strokeWidth="2"
                          filter={`url(#glow-${k})`}
                        />
                      </>
                    )}
                  </g>
                )
              })}
            </g>
          ))}

          {/* Tooltip */}
          {hoveredIndex !== null && (
            <g>
              {seriesKeys.map((k, idx) => {
                const value = dataByKey[k][hoveredIndex]
                const x =
                  padding + hoveredIndex * ((width - 2 * padding) / Math.max(1, parsed.length - 1))
                const baseY = 30
                const yOffset = baseY + idx * 25

                return (
                  <g key={k}>
                    <rect
                      x={x + 15}
                      y={yOffset}
                      width={120}
                      height={20}
                      rx="6"
                      fill={colors[k].line}
                      opacity="0.95"
                    />
                    <text x={x + 25} y={yOffset + 14} className="fill-white text-xs font-bold">
                      {k}: {value}
                    </text>
                  </g>
                )
              })}
            </g>
          )}

          {/* X-Axis Labels */}
          {parsed.map((it, i) => {
            if (!labelFlags[i]) return null
            const x = padding + i * ((width - 2 * padding) / Math.max(1, parsed.length - 1))
            const y = height - padding + 25
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                className="fill-slate-500 text-xs font-bold dark:fill-slate-400"
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
