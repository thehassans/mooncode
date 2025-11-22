import React, { useState } from 'react'

export default function Chart({ analytics }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [tooltipData, setTooltipData] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

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

  // Filter to show only selected country if one is chosen
  const visibleKeys = selectedCountry ? [selectedCountry] : seriesKeys

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
              onClick={() => setSelectedCountry(selectedCountry === k ? null : k)}
              className={`group flex cursor-pointer items-center gap-3 rounded-xl border px-5 py-3 shadow-sm backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-md ${
                selectedCountry === k
                  ? 'border-slate-300 bg-neutral-900 shadow-lg dark:border-neutral-700 dark:bg-neutral-900'
                  : 'border-slate-200 bg-black hover:shadow-md dark:border-black dark:bg-black'
              }`}
            >
              <span
                className="h-4 w-4 rounded-full shadow-lg transition-all duration-300 group-hover:scale-125"
                style={{ background: colors[k].line, boxShadow: colors[k].shadow }}
              />
              <span className="text-sm font-black text-white">{k}</span>
              <span className="text-xs font-bold text-neutral-400">({total})</span>
            </div>
          )
        })}
      </div>

      {/* Chart */}
      <div className="relative w-full overflow-x-auto rounded-2xl border border-slate-200 bg-black p-6 shadow-lg dark:border-black dark:bg-black">
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
          <g className="stroke-slate-200 dark:stroke-neutral-800" strokeWidth="1" opacity="0.5">
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
          <g className="fill-slate-500 text-xs font-bold dark:fill-neutral-400">
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
          {visibleKeys.map((k) => {
            const areaPointsArray = dataByKey[k].map((v, i) => {
              const x = padding + i * ((width - 2 * padding) / Math.max(1, dataByKey[k].length - 1))
              const y = height - padding - (v / max) * (height - 2 * padding)
              return { x, y }
            })

            let areaPathD = `M ${padding},${height - padding}` // Start at bottom-left
            if (areaPointsArray.length > 0) {
              // Add the curve path
              areaPathD += ` L ${areaPointsArray[0].x},${areaPointsArray[0].y}`
              for (let i = 0; i < areaPointsArray.length - 1; i++) {
                const current = areaPointsArray[i]
                const next = areaPointsArray[i + 1]
                const controlX = (current.x + next.x) / 2
                areaPathD += ` Q ${controlX},${current.y} ${(current.x + next.x) / 2},${(current.y + next.y) / 2}`
                areaPathD += ` Q ${controlX},${next.y} ${next.x},${next.y}`
              }
              // Close the path back to the bottom-right and then bottom-left
              areaPathD += ` L ${width - padding},${height - padding} Z`
            } else {
              areaPathD += ` L ${width - padding},${height - padding} Z` // Just a rectangle if no data
            }

            return (
              <path
                key={`area-${k}`}
                d={areaPathD}
                fill={`url(#gradient-${k})`}
                opacity={selectedCountry === k ? 0.4 : hoveredIndex !== null ? 0.1 : 0.15}
                className="cursor-pointer transition-all duration-500 hover:opacity-30"
                onClick={() => setSelectedCountry(selectedCountry === k ? null : k)}
              />
            )
          })}

          {/* Lines */}
          {visibleKeys.map((k) => (
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
              className="text-slate-300 dark:text-neutral-600"
              strokeDasharray="6 6"
              opacity="0.5"
            />
          )}

          {/* Data Points */}
          {visibleKeys.map((k) => (
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
                      onClick={(e) => {
                        const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect()
                        const breakdown = {}
                        seriesKeys.forEach((key) => {
                          breakdown[key] = dataByKey[key][i] || 0
                        })
                        setTooltipData({
                          date: parsed[i].full,
                          breakdown,
                          total: Object.values(breakdown).reduce((a, b) => a + b, 0),
                        })
                        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                      }}
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
                          strokeWidth="4"
                          className="cursor-pointer transition-all duration-500"
                          style={{
                            filter: selectedCountry === k ? colors[k].shadow : 'none',
                            strokeWidth: selectedCountry === k ? '5' : '4',
                          }}
                          onClick={() => setSelectedCountry(selectedCountry === k ? null : k)}
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
                      r="8"
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
                className="fill-slate-500 text-xs font-bold dark:fill-neutral-400"
              >
                {it.full}
              </text>
            )
          })}
        </svg>

        {/* Premium Tooltip */}
        {tooltipData && (
          <>
            {/* Backdrop to close tooltip */}
            <div className="fixed inset-0 z-40" onClick={() => setTooltipData(null)} />

            {/* Tooltip Content */}
            <div
              className="animate-in fade-in slide-in-from-bottom-2 absolute z-50 w-64 duration-300"
              style={{
                left: `${Math.min(tooltipPos.x, width - 270)}px`,
                top: `${Math.max(20, tooltipPos.y - 100)}px`,
              }}
            >
              <div className="rounded-2xl border border-slate-200/50 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-neutral-700/50 dark:bg-neutral-900/95">
                {/* Header */}
                <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-neutral-800">
                  <span className="font-bold text-black dark:text-neutral-400">
                    {tooltipData.date}
                  </span>
                  <button
                    onClick={() => setTooltipData(null)}
                    className="text-slate-400 transition-colors hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                  >
                    ✕
                  </button>
                </div>

                {/* Country Breakdown */}
                <div className="space-y-2">
                  {seriesKeys.map((country) => {
                    const value = tooltipData.breakdown[country] || 0
                    if (value === 0) return null
                    return (
                      <div key={country} className="flex items-center gap-2">
                        <div
                          className="h-6 flex-1 rounded-lg px-2 text-xs font-bold text-white shadow-sm transition-all hover:scale-105"
                          style={{
                            backgroundColor: colors[country].line,
                            minWidth: '80px',
                          }}
                        >
                          <div className="flex h-full items-center justify-between">
                            <span>{country}</span>
                            <span>{value}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
