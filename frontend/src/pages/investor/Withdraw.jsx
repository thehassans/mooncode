import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../../api.js'

export default function InvestorWithdraw() {
  const [me, setMe] = useState(null)
  const [remittances, setRemittances] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ amount: '', note: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const [meRes, remitRes] = await Promise.all([
          apiGet('/api/users/me'),
          apiGet('/api/finance/investor-remittances'),
        ])
        if (!alive) return
        setMe(meRes?.user || null)
        setRemittances(Array.isArray(remitRes?.remittances) ? remitRes.remittances : [])
      } catch (e) {
        if (!alive) return
        setError(e?.message || 'Failed to load withdraw data')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const profile = me?.investorProfile || {}
  const currency = profile.currency || 'SAR'
  const earnedProfit = Number(profile.earnedProfit || 0)

  const stats = useMemo(() => {
    let pending = 0
    let approved = 0
    let sent = 0
    for (const r of remittances || []) {
      const amt = Number(r.amount || 0)
      if (r.status === 'pending') pending += amt
      else if (r.status === 'approved') approved += amt
      else if (r.status === 'sent') sent += amt
    }
    const totalRequested = pending + approved + sent
    const available = Math.max(0, earnedProfit - totalRequested)
    return { pending, approved, sent, totalRequested, available }
  }, [remittances, earnedProfit])

  function num(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    const amt = Number(form.amount || 0)
    if (!amt || amt <= 0) {
      setError('Amount must be greater than 0')
      return
    }
    if (amt > stats.available) {
      setError('Amount exceeds available profit balance')
      return
    }
    try {
      setSubmitting(true)
      await apiPost('/api/finance/investor-remittances', {
        amount: amt,
        note: form.note || '',
      })
      setSuccess('Withdraw request submitted successfully')
      setForm({ amount: '', note: '' })
      try {
        const remitRes = await apiGet('/api/finance/investor-remittances')
        setRemittances(Array.isArray(remitRes?.remittances) ? remitRes.remittances : [])
      } catch {}
    } catch (e) {
      setError(e?.message || 'Failed to submit withdraw request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="section" style={{ display: 'grid', gap: 16 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Withdraw Profit</div>
          <div className="page-subtitle">
            Request withdrawal of your earned profit. Your workspace owner will review and send
            payments.
          </div>
        </div>
      </div>

      {error && (
        <div
          className="card"
          style={{ padding: 12, border: '1px solid var(--danger)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="card"
          style={{ padding: 12, border: '1px solid #10b981', color: '#10b981' }}
        >
          {success}
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
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Total Earned Profit</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>
              {currency} {num(earnedProfit)}
            </div>
          </div>
        </div>
        <div
          className="card"
          style={{ border: '1px solid var(--border)', background: 'var(--card-bg)' }}
        >
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Available to Withdraw</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#10b981' }}>
              {currency} {num(stats.available)}
            </div>
          </div>
        </div>
        <div
          className="card"
          style={{ border: '1px solid var(--border)', background: 'var(--card-bg)' }}
        >
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Pending Requests</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>
              {currency} {num(stats.pending)}
            </div>
          </div>
        </div>
        <div
          className="card"
          style={{ border: '1px solid var(--border)', background: 'var(--card-bg)' }}
        >
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Paid Out</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6' }}>
              {currency} {num(stats.sent)}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Request Withdrawal</div>
        </div>
        <form
          onSubmit={handleSubmit}
          className="section"
          style={{ display: 'grid', gap: 16, maxWidth: 480 }}
        >
          <div>
            <div className="label">Amount ({currency})</div>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder={stats.available > 0 ? String(stats.available) : '0.00'}
              disabled={loading || submitting || stats.available <= 0}
            />
            <div className="helper" style={{ fontSize: 12 }}>
              Max available: {currency} {num(stats.available)}
            </div>
          </div>
          <div>
            <div className="label">Note (optional)</div>
            <textarea
              className="input"
              rows={3}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Any additional details about this withdrawal request"
              disabled={loading || submitting}
            />
          </div>
          <button
            type="submit"
            className="btn"
            disabled={loading || submitting || stats.available <= 0}
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">My Withdraw Requests</div>
        </div>
        <div className="section" style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <div className="spinner" />
            </div>
          ) : remittances.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', opacity: 0.7 }}>
              No withdraw requests yet.
            </div>
          ) : (
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
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Amount</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {remittances.map((r) => (
                  <tr key={String(r._id || r.id)} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#10b981' }}>
                      {r.currency || currency} {num(r.amount)}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          background:
                            r.status === 'sent'
                              ? 'rgba(37, 99, 235, 0.1)'
                              : r.status === 'approved'
                                ? 'rgba(16, 185, 129, 0.1)'
                                : 'rgba(245, 158, 11, 0.1)',
                          color:
                            r.status === 'sent'
                              ? '#2563eb'
                              : r.status === 'approved'
                                ? '#10b981'
                                : '#f59e0b',
                        }}
                      >
                        {String(r.status || '').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>
                      {r.note || <span style={{ opacity: 0.6 }}>-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
