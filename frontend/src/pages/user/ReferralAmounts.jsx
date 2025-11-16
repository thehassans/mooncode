import React, { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../../api'

export default function ReferralAmounts() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await apiGet('/api/users/referrals/summary')
        if (!alive) return
        const list = Array.isArray(res?.referrals) ? res.referrals : []
        setRows(list)
      } catch (e) {
        if (!alive) return
        setError(e?.message || 'Failed to load referral amounts')
        setRows([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const referred = useMemo(
    () =>
      rows.filter(
        (r) =>
          (r.referredBy && r.referredBy.email) ||
          (r.referredByCode && String(r.referredByCode).trim())
      ),
    [rows]
  )

  const totals = useMemo(() => {
    let investors = referred.length
    let investment = 0
    let earned = 0
    let target = 0
    for (const r of referred) {
      const p = r.investorProfile || {}
      investment += Number(p.investmentAmount || 0)
      earned += Number(p.earnedProfit || 0)
      target += Number(p.profitAmount || 0)
    }
    return { investors, investment, earned, target }
  }, [referred])

  function num(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  const currency = referred[0]?.investorProfile?.currency || 'SAR'

  return (
    <div className="section" style={{ display: 'grid', gap: 16 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Referral Amount</div>
          <div className="page-subtitle">
            Only investors who joined via a referral code and their investment/profit amounts.
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
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Referred Investors</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{totals.investors}</div>
          </div>
        </div>
        <div
          className="card"
          style={{ border: '1px solid var(--border)', background: 'var(--card-bg)' }}
        >
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Total Investment</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>
              {currency} {num(totals.investment)}
            </div>
          </div>
        </div>
        <div
          className="card"
          style={{ border: '1px solid var(--border)', background: 'var(--card-bg)' }}
        >
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Target Profit</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>
              {currency} {num(totals.target)}
            </div>
          </div>
        </div>
        <div
          className="card"
          style={{ border: '1px solid var(--border)', background: 'var(--card-bg)' }}
        >
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Earned Profit</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>
              {currency} {num(totals.earned)}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Referral Amounts ({referred.length})</div>
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
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Referral Code</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Referred By</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Investment</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Target Profit</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Earned Profit</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Remaining</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 16, textAlign: 'center' }}>
                    <div className="spinner" />
                  </td>
                </tr>
              ) : referred.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 16, textAlign: 'center', opacity: 0.7 }}>
                    No investors joined via referral yet.
                  </td>
                </tr>
              ) : (
                referred.map((r) => {
                  const name = `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || '-'
                  const p = r.investorProfile || {}
                  const c = p.currency || currency
                  const remaining = Number(p.profitAmount || 0) - Number(p.earnedProfit || 0)
                  const status = p.status || 'active'
                  const refName = r.referredBy
                    ? `${r.referredBy.firstName || ''} ${r.referredBy.lastName || ''}`.trim() ||
                      r.referredBy.email ||
                      '-'
                    : r.referredByCode || '-'
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700 }}>{name}</div>
                        <div className="helper" style={{ fontSize: 12 }}>
                          {r.email}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        {r.referralCode || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>{refName}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        {c} {num(p.investmentAmount)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        {c} {num(p.profitAmount)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#10b981' }}>
                        {c} {num(p.earnedProfit)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        {c} {num(remaining)}
                      </td>
                      <td
                        style={{ padding: '10px 12px', fontSize: 13, textTransform: 'capitalize' }}
                      >
                        {status}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
