import React, { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../../api.js'

export default function InvestorDaily() {
  const [investors, setInvestors] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await apiGet('/api/users/investors')
        if (!alive) return
        const list = Array.isArray(res?.users) ? res.users : []
        setInvestors(list)
      } catch (e) {
        if (!alive) return
        setError(e?.message || 'Failed to load investors')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  function num(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  const rows = useMemo(() => {
    return investors
      .map((inv) => {
        const p = inv.investorProfile || {}
        const investmentAmount = Number(p.investmentAmount || 0)
        const currency = p.currency || 'SAR'
        const status = p.status || 'inactive'
        const profitPercentage = Number(p.profitPercentage || 0)
        // Daily profit: invested * profit% / 30
        const dailyProfit =
          investmentAmount > 0 && status === 'active' && profitPercentage > 0
            ? (investmentAmount * (profitPercentage / 100)) / 30
            : 0
        return {
          id: String(inv._id || inv.id || ''),
          name: `${inv.firstName || ''} ${inv.lastName || ''}`.trim() || inv.email || '-',
          email: inv.email || '-',
          currency,
          investmentAmount,
          profitPercentage,
          dailyProfit,
          status,
        }
      })
      .filter((r) => r.investmentAmount > 0)
  }, [investors])

  const totalDaily = useMemo(() => rows.reduce((sum, r) => sum + (r.dailyProfit || 0), 0), [rows])

  return (
    <div className="section" style={{ display: 'grid', gap: 16 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Investor Daily</div>
          <div className="page-subtitle">
            Daily profit overview for active investors based on each investor's profit percentage
            target divided by 30 days
          </div>
        </div>
      </div>

      {error && (
        <div
          className="card"
          style={{ padding: 12, border: '1px solid var(--border)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}

      {/* Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))',
          gap: 16,
        }}
      >
        <div
          className="card"
          style={{ border: '1px solid var(--border)', background: 'var(--card-bg)' }}
        >
          <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'rgba(59,130,246,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 24 }}>📅</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Active Investors</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>
                {rows.filter((r) => r.status === 'active').length}
              </div>
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{ border: '1px solid var(--border)', background: 'var(--card-bg)' }}
        >
          <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'rgba(16,185,129,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 24 }}>💰</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Total Daily Profit</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>
                {rows[0]?.currency || 'SAR'} {num(totalDaily)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Investor Daily Breakdown</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: 0,
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Investor</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Investment</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Profit %</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>
                  Daily Profit (profit% / 30)
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, textAlign: 'center' }}>
                    <div className="spinner" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, textAlign: 'center', opacity: 0.7 }}>
                    No investors with active investment
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 700 }}>{r.name}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{r.email}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, textTransform: 'capitalize' }}>
                      {r.status}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                      {r.currency} {num(r.investmentAmount)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{num(r.profitPercentage)}%</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#10b981' }}>
                      {r.currency} {num(r.dailyProfit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
