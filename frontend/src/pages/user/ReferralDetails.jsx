import React, { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../../api'

export default function ReferralDetails() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

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
        setError(e?.message || 'Failed to load referrals')
        setRows([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => {
    const text = String(q || '')
      .trim()
      .toLowerCase()
    if (!text) return rows
    return rows.filter((r) => {
      const name = `${r.firstName || ''} ${r.lastName || ''}`.toLowerCase()
      const email = String(r.email || '').toLowerCase()
      const refName =
        `${r.referredBy?.firstName || ''} ${r.referredBy?.lastName || ''}`.toLowerCase()
      const refEmail = String(r.referredBy?.email || '').toLowerCase()
      const code = String(r.referralCode || '').toLowerCase()
      const byCode = String(r.referredByCode || '').toLowerCase()
      return (
        name.includes(text) ||
        email.includes(text) ||
        refName.includes(text) ||
        refEmail.includes(text) ||
        code.includes(text) ||
        byCode.includes(text)
      )
    })
  }, [rows, q])

  function num(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  return (
    <div className="section" style={{ display: 'grid', gap: 16 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Referral Details</div>
          <div className="page-subtitle">
            See which investors joined via referral and how many orders are assigned to them.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            placeholder="Search by investor, referrer, or code"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 260 }}
          />
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

      <div className="card">
        <div className="card-header">
          <div className="card-title">Referred Investors ({filtered.length})</div>
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
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Referred By</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Referral Code</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Investment</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Earned Profit</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Orders</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Total Order Value</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 16, textAlign: 'center' }}>
                    <div className="spinner" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 16, textAlign: 'center', opacity: 0.7 }}>
                    No referred investors yet.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const name = `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || '-'
                  const inv = r.investorProfile || {}
                  const currency = inv.currency || 'SAR'
                  const refName = r.referredBy
                    ? `${r.referredBy.firstName || ''} ${r.referredBy.lastName || ''}`.trim() ||
                      r.referredBy.email ||
                      '-'
                    : ''
                  const refEmail = r.referredBy?.email || ''
                  const refLabel = refName || r.referredByCode || '-'
                  const stats = r.orderStats || {}
                  const orders = Array.isArray(stats.latestOrders) ? stats.latestOrders : []
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700 }}>{name}</div>
                        <div className="helper" style={{ fontSize: 12 }}>
                          {r.email}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        <div>{refLabel}</div>
                        {refEmail && (
                          <div className="helper" style={{ fontSize: 12 }}>
                            {refEmail}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        {r.referralCode || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        {currency} {num(inv.investmentAmount)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        {currency} {num(inv.earnedProfit)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        <div style={{ fontWeight: 700 }}>{stats.orderCount || 0}</div>
                        {orders.length > 0 && (
                          <div className="helper" style={{ fontSize: 11 }}>
                            Last: #{orders[0].invoiceNumber || orders[0]._id || ''}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        {currency} {num(stats.totalOrderValue)}
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
