import React, { useState } from 'react'

// Multi-series sales line chart
// Props: analytics = { days: [{ day:'YYYY-MM-DD', UAE:number, Oman:number, KSA:number, Bahrain:number, India:number, Kuwait:number, Qatar:number }], totals: {...} }
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
    const [y, m, dd] = s.split('-').map((v) => Number(v))
    const full =
      isFinite(m) && isFinite(dd) ? `${MONTHS[m - 1] || ''} ${String(dd).padStart(2, '0')}` : s
    return { y, m, d: dd, full, raw: s }
  })

  // Limit x-axis ticks to keep labels readable
  const tickCount = Math.min(8, Math.max(2, parsed.length))
  const interval = Math.max(1, Math.ceil(parsed.length / tickCount))
  const labelFlags = parsed.map((_, i) => i % interval === 0 || i === parsed.length - 1)

  const seriesKeys = ['UAE', 'Oman', 'KSA', 'Bahrain', 'India', 'Kuwait', 'Qatar']
  const colors = {
    UAE: '#3b82f6',
    Oman: '#10b981',
    KSA: '#f59e0b',
    Bahrain: '#ef4444',
    India: '#8b5cf6',
    Kuwait: '#14b8a6',
    Qatar: '#f97316',
  }

  const dataByKey = Object.fromEntries(
    seriesKeys.map((k) => [k, days.map((d) => Number(d[k] || 0))])
  )
  const allValues = seriesKeys.flatMap((k) => dataByKey[k])

  const padding = 40
  const height = 300
  // Make width adaptive to number of points, clamped to a reasonable range
  const width = Math.min(1200, Math.max(640, padding * 2 + parsed.length * 40))
  const max = Math.max(1, ...allValues)
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm font-bold text-slate-500 dark:text-slate-400">Sales Trend</div>
        <div className="flex flex-wrap gap-3">
          {seriesKeys.map((k) => (
            <div
              key={k}
              className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[k] }} />
              {k}
            </div>
          ))}
        </div>
      </div>

      <div className="relative w-full overflow-x-auto rounded-xl bg-slate-50/50 p-4 dark:bg-slate-800/50">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[640px]"
          shapeRendering="geometricPrecision"
        >
          {/* Grid Lines */}
          <g
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeWidth="1"
            strokeDasharray="4 4"
          >
            {[0, 1, 2, 3, 4].map((i) => {
              const y = padding + i * ((height - 2 * padding) / 4)
              return <line key={i} x1={padding} x2={width - padding} y1={y} y2={y} />
            })}
          </g>

          {/* Y-Axis Labels */}
          <g className="fill-slate-400 text-[10px] font-medium dark:fill-slate-500">
            {yTicks.map((v, i) => {
              const y = height - padding - (v / max) * (height - 2 * padding)
              return (
                <text key={i} x={10} y={y + 4}>
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
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={toPoints(dataByKey[k])}
              className="transition-all duration-300 hover:opacity-100"
              style={{ opacity: 0.9 }}
            />
          ))}

          {/* Hover Effects & Data Points */}
          {seriesKeys.map((k) => (
            <g key={`pts-${k}`} fill={colors[k]}>
              {dataByKey[k].map((v, i) => {
                const x =
                  padding + i * ((width - 2 * padding) / Math.max(1, dataByKey[k].length - 1))
                const y = height - padding - (v / max) * (height - 2 * padding)
                const isHovered = hoveredIndex === i

                return (
                  <g key={i}>
                    {/* Invisible larger target for hover */}
                    <circle
                      cx={x}
                      cy={y}
                      r={8}
                      fill="transparent"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className="cursor-pointer"
                    />
                    {/* Visible dot */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 6 : 3}
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
            const y = height - padding + 24
            const monthChanged = i === 0 || parsed[i - 1].m !== it.m
            const text = monthChanged ? it.full : String(it.d)
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                className="fill-slate-400 text-[10px] font-bold dark:fill-slate-500"
              >
                {text}
              </text>
            )
          })}

          {/* Tooltip Overlay (Simplified) */}
          {hoveredIndex !== null && (
            <line
              x1={padding + hoveredIndex * ((width - 2 * padding) / Math.max(1, parsed.length - 1))}
              x2={padding + hoveredIndex * ((width - 2 * padding) / Math.max(1, parsed.length - 1))}
              y1={padding}
              y2={height - padding}
              stroke="currentColor"
              strokeWidth="1"
              className="text-slate-300 dark:text-slate-600"
              strokeDasharray="2 2"
            />
          )}
        </svg>
      </div>

      {/* Summary Table */}
      {days.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  {seriesKeys.map((k) => (
                    <th key={k} className="px-4 py-3 text-center">
                      {k}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-900">
                {days.map((d, i) => {
                  const total = seriesKeys.reduce((acc, k) => acc + Number(d[k] || 0), 0)
                  const isHovered = hoveredIndex === i
                  return (
                    <tr
                      key={i}
                      className={`transition-colors ${isHovered ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                        {parsed[i]?.full || d.day}
                      </td>
                      {seriesKeys.map((k) => (
                        <td
                          key={k}
                          className="px-4 py-3 text-center text-slate-600 dark:text-slate-400"
                        >
                          {Number(d[k] || 0) > 0 ? (
                            <span className="font-bold text-slate-800 dark:text-white">
                              {Number(d[k])}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">-</span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-black text-slate-800 dark:text-white">
                        {total}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
