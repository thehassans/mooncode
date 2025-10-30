import React, { useEffect, useState, useMemo } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { useToast } from '../../ui/Toast.jsx'
import Modal from '../../components/Modal.jsx'

export default function DriverCommissionApprovals() {
  const toast = useToast()
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('pending') // pending, approved, rejected, all
  const [processing, setProcessing] = useState(null)
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    loadPayouts()
  }, [])

  async function loadPayouts() {
    try {
      setLoading(true)
      const res = await apiGet('/api/finance/driver-commission-payouts')
      setPayouts(Array.isArray(res?.payouts) ? res.payouts : [])
    } catch (e) {
      toast.error(e?.message || 'Failed to load commission payouts')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(payoutId) {
    setProcessing(payoutId)
    try {
      await apiPost(`/api/finance/driver-commission-payouts/${payoutId}/approve`, {})
      toast.success('Commission approved and paid to driver')
      await loadPayouts()
    } catch (e) {
      toast.error(e?.message || 'Failed to approve commission')
    } finally {
      setProcessing(null)
    }
  }

  async function handleReject() {
    if (!rejectModal) return
    setProcessing(rejectModal._id)
    try {
      await apiPost(`/api/finance/driver-commission-payouts/${rejectModal._id}/reject`, {
        reason: rejectReason
      })
      toast.warn('Commission rejected')
      setRejectModal(null)
      setRejectReason('')
      await loadPayouts()
    } catch (e) {
      toast.error(e?.message || 'Failed to reject commission')
    } finally {
      setProcessing(null)
    }
  }

  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }

  const filteredPayouts = useMemo(() => {
    if (filter === 'all') return payouts
    return payouts.filter(p => p.status === filter)
  }, [payouts, filter])

  const stats = useMemo(() => {
    const pending = payouts.filter(p => p.status === 'pending').length
    const approved = payouts.filter(p => p.status === 'approved').length
    const rejected = payouts.filter(p => p.status === 'rejected').length
    const totalPending = payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const totalApproved = payouts.filter(p => p.status === 'approved').reduce((sum, p) => sum + Number(p.amount || 0), 0)
    return { pending, approved, rejected, totalPending, totalApproved }
  }, [payouts])

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Driver Commission Approvals</div>
          <div className="page-subtitle">Review and approve driver commission payments from managers</div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff' }}>
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Pending Approvals</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{stats.pending}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>SAR {num(stats.totalPending)}</div>
          </div>
        </div>
        <div className="card" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff' }}>
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Approved</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{stats.approved}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>SAR {num(stats.totalApproved)}</div>
          </div>
        </div>
        <div className="card" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff' }}>
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Rejected</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{stats.rejected}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="section" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button 
            className={`btn ${filter === 'pending' ? 'primary' : 'secondary'}`}
            onClick={() => setFilter('pending')}
            style={{ fontSize: 14 }}
          >
            Pending ({stats.pending})
          </button>
          <button 
            className={`btn ${filter === 'approved' ? 'primary' : 'secondary'}`}
            onClick={() => setFilter('approved')}
            style={{ fontSize: 14 }}
          >
            Approved ({stats.approved})
          </button>
          <button 
            className={`btn ${filter === 'rejected' ? 'primary' : 'secondary'}`}
            onClick={() => setFilter('rejected')}
            style={{ fontSize: 14 }}
          >
            Rejected ({stats.rejected})
          </button>
          <button 
            className={`btn ${filter === 'all' ? 'primary' : 'secondary'}`}
            onClick={() => setFilter('all')}
            style={{ fontSize: 14 }}
          >
            All ({payouts.length})
          </button>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--panel)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Driver</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Manager</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Country</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Amount</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Receipt</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk${i}`}>
                    <td colSpan={8} style={{ padding: '12px' }}>
                      <div style={{ height: 14, background: 'var(--panel-2)', borderRadius: 6, animation: 'pulse 1.2s ease-in-out infinite' }} />
                    </td>
                  </tr>
                ))
              ) : filteredPayouts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '20px', textAlign: 'center', opacity: 0.7 }}>
                    No commission payouts found
                  </td>
                </tr>
              ) : (
                filteredPayouts.map((p, idx) => (
                  <tr key={String(p._id || idx)} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 700 }}>{p.driver?.firstName || ''} {p.driver?.lastName || ''}</div>
                      <div className="helper" style={{ fontSize: 11 }}>{p.driver?.phone || ''}</div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div>{p.manager?.firstName || ''} {p.manager?.lastName || ''}</div>
                      <div className="helper" style={{ fontSize: 11 }}>{p.manager?.email || ''}</div>
                    </td>
                    <td style={{ padding: '12px' }}>{p.country || '-'}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <span style={{ fontWeight: 800, color: '#10b981' }}>{p.currency} {num(p.amount)}</span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span className={`badge ${p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning'}`}>
                        {String(p.status || '').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: 13 }}>
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {p.pdfPath ? (
                        <a 
                          href={`${API_BASE}/api/finance/driver-commission-payouts/${p._id}/download-pdf`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn small"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                        >
                          Download
                        </a>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {p.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            className="btn success small"
                            onClick={() => handleApprove(p._id)}
                            disabled={processing === p._id}
                            style={{ fontSize: 12, padding: '4px 8px' }}
                          >
                            {processing === p._id ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            className="btn danger small"
                            onClick={() => setRejectModal(p)}
                            disabled={processing === p._id}
                            style={{ fontSize: 12, padding: '4px 8px' }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : p.status === 'approved' ? (
                        <span style={{ color: 'var(--success)', fontSize: 13 }}>
                          ✓ Approved {p.approvedAt ? `on ${new Date(p.approvedAt).toLocaleDateString()}` : ''}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--danger)', fontSize: 13 }}>
                          ✗ Rejected
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      <Modal
        title="Reject Commission Payment"
        open={!!rejectModal}
        onClose={() => setRejectModal(null)}
        footer={
          <>
            <button className="btn secondary" onClick={() => setRejectModal(null)} disabled={!!processing}>Cancel</button>
            <button 
              className="btn danger" 
              onClick={handleReject}
              disabled={!!processing}
            >
              {processing ? 'Rejecting...' : 'Reject Payment'}
            </button>
          </>
        }
      >
        {rejectModal && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ marginBottom: 16 }}>
              Are you sure you want to reject commission payment of <strong style={{ color: '#ef4444' }}>{rejectModal.currency} {num(rejectModal.amount)}</strong> for <strong>{rejectModal.driver?.firstName || ''} {rejectModal.driver?.lastName || ''}</strong>?
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Reason for Rejection (Optional)</label>
              <textarea
                className="input"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide a reason for rejection..."
                rows={3}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
