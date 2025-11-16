import React from 'react'

// Multi-series sales line chart
// Props: analytics = { days: [{ day:'YYYY-MM-DD', UAE:number, Oman:number, KSA:number, Bahrain:number, India:number, Kuwait:number, Qatar:number }], totals: {...} }
export default function Chart({ analytics }) {
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
  const padding = 28
  const height = 200
  // Make width adaptive to number of points, clamped to a reasonable range
  const width = Math.min(900, Math.max(640, padding * 2 + parsed.length * 22))
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
    <div className="card" style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 700 }}>Sales Trend</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {seriesKeys.map((k) => (
            <span
              key={k}
              className="badge"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: colors[k],
                  borderRadius: 2,
                  display: 'inline-block',
                }}
              />{' '}
              {k}
            </span>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', maxWidth: width, height: 'auto' }}
          shapeRendering="geometricPrecision"
        >
          {/* grid */}
          <g style={{ stroke: 'var(--border)' }} strokeWidth="1">
            {[0, 1, 2, 3, 4].map((i) => {
              const y = padding + i * ((height - 2 * padding) / 4)
              return <line key={i} x1={padding} x2={width - padding} y1={y} y2={y} />
            })}
          </g>
          {/* y-axis labels */}
          <g style={{ fill: 'var(--muted)' }} fontSize="10">
            {yTicks.map((v, i) => {
              const y = height - padding - (v / max) * (height - 2 * padding)
              return (
                <text key={i} x={6} y={y + 3}>
                  {v}
                </text>
              )
            })}
          </g>
          {/* lines */}
          {seriesKeys.map((k) => (
            <polyline
              key={k}
              fill="none"
              stroke={colors[k]}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={toPoints(dataByKey[k])}
            />
          ))}
          {/* data points */}
          {seriesKeys.map((k) => (
            <g key={`pts-${k}`} fill={colors[k]}>
              {dataByKey[k].map((v, i) => {
                const x =
                  padding + i * ((width - 2 * padding) / Math.max(1, dataByKey[k].length - 1))
                const y = height - padding - (v / max) * (height - 2 * padding)
                return <circle key={i} cx={x} cy={y} r={2} />
              })}
            </g>
          ))}
          {/* x labels */}
          {parsed.map((it, i) => {
            if (!labelFlags[i]) return null
            const x = padding + i * ((width - 2 * padding) / Math.max(1, parsed.length - 1))
            const y = height - padding + 16
            const monthChanged = i === 0 || parsed[i - 1].m !== it.m
            const text = monthChanged ? it.full : String(it.d)
            return (
              <text
                key={i}
                x={x}
                y={y}
                fontSize="10"
                textAnchor="middle"
                style={{ fill: 'var(--muted)' }}
              >
                {text}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Summary table: dates as rows, totals per day */}
      {days.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>Date</th>
                {seriesKeys.map((k) => (
                  <th key={k} style={{ textAlign: 'left', padding: '8px 10px' }}>
                    {k}
                  </th>
                ))}
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => {
                const total = seriesKeys.reduce((acc, k) => acc + Number(d[k] || 0), 0)
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px' }}>{parsed[i]?.full || d.day}</td>
                    {seriesKeys.map((k) => (
                      <td key={k} style={{ padding: '8px 10px' }}>
                        {Number(d[k] || 0)}
                      </td>
                    ))}
                    <td style={{ padding: '8px 10px', fontWeight: 700 }}>{total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
