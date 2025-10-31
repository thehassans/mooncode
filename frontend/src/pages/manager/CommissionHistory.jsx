import React, { useEffect, useState } from 'react'
import { apiGet, API_BASE } from '../../api.js'
import { useToast } from '../../ui/Toast.jsx'

export default function CommissionHistory() {
  const toast = useToast()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('me') || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    try {
      setLoading(true)
      const r = await apiGet('/api/finance/commission/history')
      setHistory(Array.isArray(r?.payouts) ? r.payouts : [])
    } catch (err) {
      toast.error(err?.message || 'Failed to load commission history')
      setHistory([])
    } finally {
      setLoading(false)
    }
  }

  function num(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  function getStatusColor(status) {
    const s = String(status).toLowerCase()
    if (s === 'pending_approval') return '#f59e0b'
    if (s === 'approved' || s === 'paid') return '#10b981'
    if (s === 'rejected') return '#ef4444'
    return 'var(--muted)'
  }

  function getStatusLabel(status) {
    const s = String(status).toLowerCase()
    if (s === 'pending_approval') return 'Pending Approval'
    if (s === 'approved') return 'Approved'
    if (s === 'paid') return 'Paid'
    if (s === 'rejected') return 'Rejected'
    if (s === 'unpaid') return 'Unpaid'
    return status
  }

  const totalPaid = history.filter(h => h.status === 'approved' || h.status === 'paid')
    .reduce((sum, h) => sum + (Number(h.commissionAmount) || 0), 0)
  
  const totalPending = history.filter(h => h.status === 'pending_approval')
    .reduce((sum, h) => sum + (Number(h.commissionAmount) || 0), 0)

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-purple">Commission History</div>
          <div className="page-subtitle">View all commission payment records</div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="card">
        <div className="section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', padding: '16px', borderRadius: 10 }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Total Paid</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>SAR {num(totalPaid)}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', padding: '16px', borderRadius: 10 }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Pending</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>SAR {num(totalPending)}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: '#fff', padding: '16px', borderRadius: 10 }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Total Records</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{history.length}</div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">All Commission Payouts</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--panel)' }}>
                {me.role !== 'driver' && (
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Driver</th>
                )}
                {me.role !== 'manager' && (
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Manager</th>
                )}
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Period</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Orders</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Amount</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Initiated</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Completed</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`sk${i}`}>
                    <td colSpan={9} style={{ padding: '12px' }}>
                      <div style={{ height: 14, background: 'var(--panel-2)', borderRadius: 6, animation: 'pulse 1.2s ease-in-out infinite' }} />
                    </td>
                  </tr>
                ))
              ) : history.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '12px', textAlign: 'center', opacity: 0.7 }}>No commission history</td></tr>
              ) : (
                history.map(h => (
                  <tr key={h._id} style={{ borderTop: '1px solid var(--border)' }}>
                    {me.role !== 'driver' && (
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600 }}>{h.driver ? `${h.driver.firstName || ''} ${h.driver.lastName || ''}`.trim() : '-'}</div>
                        <div className="helper" style={{ fontSize: 11 }}>{h.driver?.email || ''}</div>
                      </td>
                    )}
                    {me.role !== 'manager' && (
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600 }}>{h.manager ? `${h.manager.firstName || ''} ${h.manager.lastName || ''}`.trim() : '-'}</div>
                        <div className="helper" style={{ fontSize: 11 }}>{h.manager?.email || ''}</div>
                      </td>
                    )}
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontSize: 13 }}>
                        {new Date(h.fromDate).toLocaleDateString()} - {new Date(h.toDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>{num(h.totalOrders)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: 16, color: '#10b981' }}>
                      {h.currency} {num(h.commissionAmount)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span className="badge" style={{ fontSize: 10, background: getStatusColor(h.status), color: '#fff' }}>
                        {getStatusLabel(h.status)}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: 12 }}>
                      {h.initiatedAt ? new Date(h.initiatedAt).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: 12 }}>
                      {h.approvedAt ? new Date(h.approvedAt).toLocaleDateString() : 
                       h.rejectedAt ? new Date(h.rejectedAt).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {h.receiptPath && (h.status === 'approved' || h.status === 'paid') ? (
                        <a href={`${API_BASE}/api/finance/commission/${h._id}/download-receipt`} target="_blank" rel="noopener noreferrer" className="btn" style={{ fontSize: 13, padding: '6px 12px' }}>
                          Download
                        </a>
                      ) : '—'}
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
