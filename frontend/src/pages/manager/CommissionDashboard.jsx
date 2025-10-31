import React, { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../api.js'
import { useToast } from '../../ui/Toast.jsx'

export default function CommissionDashboard() {
  const toast = useToast()
  const [dashboard, setDashboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState('')
  const [countryOptions, setCountryOptions] = useState([])
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(1) // First day of month
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [payoutModal, setPayoutModal] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('hand')
  const [managerNote, setManagerNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadCountryOptions()
  }, [])

  useEffect(() => {
    if (country) loadDashboard()
  }, [country, fromDate, toDate])

  async function loadCountryOptions() {
    try {
      const r = await apiGet('/api/orders/options')
      const arr = Array.isArray(r?.countries) ? r.countries : []
      const map = new Map()
      for (const c of arr) {
        const raw = String(c || '').trim()
        const key = raw.toLowerCase()
        if (!map.has(key)) map.set(key, raw.toUpperCase() === 'UAE' ? 'UAE' : raw)
      }
      setCountryOptions(Array.from(map.values()))
    } catch {
      setCountryOptions([])
    }
  }

  async function loadDashboard() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (country) params.set('country', country)
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)
      
      const r = await apiGet(`/api/finance/commission/dashboard?${params.toString()}`)
      setDashboard(Array.isArray(r?.dashboard) ? r.dashboard : [])
    } catch (err) {
      toast.error(err?.message || 'Failed to load dashboard')
      setDashboard([])
    } finally {
      setLoading(false)
    }
  }

  async function initiatePayout(driverData) {
    try {
      setSubmitting(true)
      await apiPost('/api/finance/commission/initiate', {
        driverId: driverData.driver._id,
        fromDate,
        toDate,
        paymentMethod,
        managerNote
      })
      toast.success('Commission payout initiated! Driver will be notified.')
      setPayoutModal(null)
      setPaymentMethod('hand')
      setManagerNote('')
      await loadDashboard()
    } catch (err) {
      toast.error(err?.message || 'Failed to initiate payout')
    } finally {
      setSubmitting(false)
    }
  }

  function num(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  function getStatusColor(status) {
    if (!status) return 'var(--muted)'
    const s = String(status).toLowerCase()
    if (s === 'pending_approval') return '#f59e0b'
    if (s === 'approved' || s === 'paid') return '#10b981'
    if (s === 'rejected') return '#ef4444'
    return 'var(--muted)'
  }

  function getStatusLabel(status) {
    if (!status) return 'Unpaid'
    const s = String(status).toLowerCase()
    if (s === 'pending_approval') return 'Pending Approval'
    if (s === 'approved') return 'Approved'
    if (s === 'paid') return 'Paid'
    if (s === 'rejected') return 'Rejected'
    return 'Unpaid'
  }

  const totals = dashboard.reduce((acc, d) => {
    acc.totalOrders += d.totalOrders || 0
    acc.totalEarnings += d.totalEarnings || 0
    acc.commissionOwed += d.commissionOwed || 0
    acc.commissionPaid += d.commissionPaid || 0
    acc.commissionPending += d.commissionPending || 0
    return acc
  }, { totalOrders: 0, totalEarnings: 0, commissionOwed: 0, commissionPaid: 0, commissionPending: 0 })

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-green">Commission Dashboard</div>
          <div className="page-subtitle">Manage driver commission payouts</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Filters</div>
        </div>
        <div className="section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Select Country</option>
            {countryOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className="input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <input className="input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
      </div>

      {/* Summary Cards */}
      {country && (
        <div className="card">
          <div className="section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', padding: '16px', borderRadius: 10 }}>
              <div style={{ fontSize: 14, opacity: 0.9 }}>Total Orders</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{num(totals.totalOrders)}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', padding: '16px', borderRadius: 10 }}>
              <div style={{ fontSize: 14, opacity: 0.9 }}>Commission Paid</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>SAR {num(totals.commissionPaid)}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', padding: '16px', borderRadius: 10 }}>
              <div style={{ fontSize: 14, opacity: 0.9 }}>Commission Pending</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>SAR {num(totals.commissionPending)}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: '#fff', padding: '16px', borderRadius: 10 }}>
              <div style={{ fontSize: 14, opacity: 0.9 }}>Total Owed</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>SAR {num(totals.commissionOwed)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Drivers Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Drivers {country ? `in ${country}` : ''}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--panel)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Driver</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Orders</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Earnings</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Rate</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Owed</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Paid</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Pending</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk${i}`}>
                    <td colSpan={9} style={{ padding: '12px' }}>
                      <div style={{ height: 14, background: 'var(--panel-2)', borderRadius: 6, animation: 'pulse 1.2s ease-in-out infinite' }} />
                    </td>
                  </tr>
                ))
              ) : !country ? (
                <tr><td colSpan={9} style={{ padding: '12px', textAlign: 'center', opacity: 0.7 }}>Select a country to view commission dashboard</td></tr>
              ) : dashboard.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '12px', textAlign: 'center', opacity: 0.7 }}>No drivers found</td></tr>
              ) : (
                dashboard.map((d, idx) => (
                  <tr key={d.driver._id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600 }}>{d.driver.name}</div>
                      <div className="helper" style={{ fontSize: 11 }}>{d.driver.email}</div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>{num(d.totalOrders)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}>SAR {num(d.totalEarnings)}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>SAR {num(d.commissionRate)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#8b5cf6' }}>SAR {num(d.commissionOwed)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>SAR {num(d.commissionPaid)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#f59e0b' }}>SAR {num(d.commissionPending)}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {d.pendingPayout ? (
                        <span className="badge" style={{ fontSize: 10, background: getStatusColor(d.pendingPayout.status), color: '#fff' }}>
                          {getStatusLabel(d.pendingPayout.status)}
                        </span>
                      ) : (
                        <span className="badge" style={{ fontSize: 10 }}>Unpaid</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {!d.pendingPayout && d.commissionPending > 0 ? (
                        <button className="btn primary" style={{ fontSize: 13, padding: '6px 12px' }} onClick={() => setPayoutModal(d)}>
                          Pay Commission
                        </button>
                      ) : d.pendingPayout ? (
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Awaiting Driver</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout Modal */}
      {payoutModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={(e) => { if (e.target === e.currentTarget) setPayoutModal(null) }}>
          <div style={{ background: 'var(--panel)', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700 }}>Initiate Commission Payout</h3>
            
            <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', background: 'var(--panel-2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Driver</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{payoutModal.driver.name}</div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ padding: '12px', background: 'var(--panel-2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Orders</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>{num(payoutModal.totalOrders)}</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--panel-2)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Rate</div>
                  <div style={{ fontSize: '16px', fontWeight: 600 }}>SAR {num(payoutModal.commissionRate)}</div>
                </div>
              </div>
              
              <div style={{ padding: '16px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '8px', color: '#fff' }}>
                <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>Commission Amount</div>
                <div style={{ fontSize: '24px', fontWeight: 800 }}>SAR {num(payoutModal.commissionPending)}</div>
              </div>
              
              <label style={{ display: 'block' }}>
                <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Payment Method</div>
                <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="hand">Hand</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="mobile_wallet">Mobile Wallet</option>
                </select>
              </label>
              
              <label style={{ display: 'block' }}>
                <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Note (Optional)</div>
                <textarea className="input" value={managerNote} onChange={(e) => setManagerNote(e.target.value)} rows={3} placeholder="Add any notes for the driver..." />
              </label>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn secondary" onClick={() => setPayoutModal(null)} style={{ flex: 1 }} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="btn primary" onClick={() => initiatePayout(payoutModal)} style={{ flex: 1 }} disabled={submitting}>
                {submitting ? 'Initiating...' : 'Initiate Payout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
