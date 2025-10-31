import React, { useEffect, useState } from 'react'
import { apiGet, apiPost, API_BASE } from '../../api.js'
import { useToast } from '../../ui/Toast.jsx'
import { io } from 'socket.io-client'

export default function DriverCommission() {
  const toast = useToast()
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [approveModal, setApproveModal] = useState(null)
  const [rejectModal, setRejectModal] = useState(null)
  const [driverNote, setDriverNote] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadPayouts()
    
    // Setup socket for real-time updates
    const token = localStorage.getItem('token') || ''
    const socket = io(API_BASE || undefined, { 
      path: '/socket.io', 
      transports: ['polling'], 
      upgrade: false, 
      withCredentials: true, 
      auth: { token } 
    })
    
    socket.on('commission.pending_approval', () => {
      loadPayouts()
      toast.info('New commission payout requires your approval!')
    })
    
    return () => {
      socket.off('commission.pending_approval')
      socket.disconnect()
    }
  }, [])

  async function loadPayouts() {
    try {
      setLoading(true)
      const r = await apiGet('/api/finance/commission/my-payouts')
      setPayouts(Array.isArray(r?.payouts) ? r.payouts : [])
    } catch (err) {
      toast.error(err?.message || 'Failed to load payouts')
      setPayouts([])
    } finally {
      setLoading(false)
    }
  }

  async function approvePayout() {
    try {
      setSubmitting(true)
      await apiPost(`/api/finance/commission/${approveModal._id}/approve`, { driverNote })
      toast.success('Commission payout approved! Receipt is being generated.')
      setApproveModal(null)
      setDriverNote('')
      await loadPayouts()
    } catch (err) {
      toast.error(err?.message || 'Failed to approve payout')
    } finally {
      setSubmitting(false)
    }
  }

  async function rejectPayout() {
    try {
      setSubmitting(true)
      await apiPost(`/api/finance/commission/${rejectModal._id}/reject`, { rejectionReason })
      toast.warn('Commission payout rejected.')
      setRejectModal(null)
      setRejectionReason('')
      await loadPayouts()
    } catch (err) {
      toast.error(err?.message || 'Failed to reject payout')
    } finally {
      setSubmitting(false)
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
    return status
  }

  const pendingPayouts = payouts.filter(p => p.status === 'pending_approval')
  const completedPayouts = payouts.filter(p => p.status !== 'pending_approval')

  const totalEarned = payouts.filter(p => p.status === 'approved' || p.status === 'paid')
    .reduce((sum, p) => sum + (Number(p.commissionAmount) || 0), 0)

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-green">My Commission</div>
          <div className="page-subtitle">View and approve commission payouts</div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="card">
        <div className="section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', padding: '16px', borderRadius: 10 }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Total Earned</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>SAR {num(totalEarned)}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', padding: '16px', borderRadius: 10 }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Pending Approval</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{pendingPayouts.length}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', padding: '16px', borderRadius: 10 }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Total Payouts</div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{payouts.length}</div>
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingPayouts.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ color: '#f59e0b' }}>⚠️ Pending Approval</div>
            <div className="card-subtitle">Review and approve commission payouts</div>
          </div>
          <div className="section" style={{ display: 'grid', gap: 12 }}>
            {pendingPayouts.map(p => (
              <div key={p._id} style={{ padding: '16px', background: 'var(--panel-2)', borderRadius: '8px', border: '2px solid #f59e0b' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Period</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {new Date(p.fromDate).toLocaleDateString()} - {new Date(p.toDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Orders</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{num(p.totalOrders)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Rate</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.currency} {num(p.commissionRate)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Amount</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>
                      {p.currency} {num(p.commissionAmount)}
                    </div>
                  </div>
                </div>
                
                {p.managerNote && (
                  <div style={{ marginBottom: 12, padding: '8px', background: 'var(--panel)', borderRadius: 6, fontSize: 13 }}>
                    <strong>Manager Note:</strong> {p.managerNote}
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn danger" onClick={() => setRejectModal(p)} style={{ flex: 1 }}>
                    Reject
                  </button>
                  <button className="btn success" onClick={() => setApproveModal(p)} style={{ flex: 1 }}>
                    Approve Payment
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payout History */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Payout History</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--panel)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Period</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Orders</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Amount</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk${i}`}>
                    <td colSpan={6} style={{ padding: '12px' }}>
                      <div style={{ height: 14, background: 'var(--panel-2)', borderRadius: 6, animation: 'pulse 1.2s ease-in-out infinite' }} />
                    </td>
                  </tr>
                ))
              ) : completedPayouts.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '12px', textAlign: 'center', opacity: 0.7 }}>No payout history</td></tr>
              ) : (
                completedPayouts.map(p => (
                  <tr key={p._id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {new Date(p.fromDate).toLocaleDateString()} - {new Date(p.toDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>{num(p.totalOrders)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, fontSize: 16, color: '#10b981' }}>
                      {p.currency} {num(p.commissionAmount)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span className="badge" style={{ fontSize: 10, background: getStatusColor(p.status), color: '#fff' }}>
                        {getStatusLabel(p.status)}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: 12 }}>
                      {p.approvedAt ? new Date(p.approvedAt).toLocaleDateString() : 
                       p.rejectedAt ? new Date(p.rejectedAt).toLocaleDateString() : '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {p.receiptPath && p.status === 'approved' ? (
                        <a href={`${API_BASE}/api/finance/commission/${p._id}/download-receipt`} target="_blank" rel="noopener noreferrer" className="btn" style={{ fontSize: 13, padding: '6px 12px' }}>
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

      {/* Approve Modal */}
      {approveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={(e) => { if (e.target === e.currentTarget) setApproveModal(null) }}>
          <div style={{ background: 'var(--panel)', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700 }}>Approve Commission Payment</h3>
            
            <div style={{ padding: '16px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '8px', color: '#fff', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '4px' }}>You will receive</div>
              <div style={{ fontSize: '28px', fontWeight: 800 }}>{approveModal.currency} {num(approveModal.commissionAmount)}</div>
              <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '8px' }}>
                For {num(approveModal.totalOrders)} delivered orders
              </div>
            </div>
            
            <label style={{ display: 'block', marginBottom: '16px' }}>
              <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Note (Optional)</div>
              <textarea className="input" value={driverNote} onChange={(e) => setDriverNote(e.target.value)} rows={3} placeholder="Add any notes or comments..." />
            </label>
            
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: '16px', padding: '12px', background: 'var(--panel-2)', borderRadius: 6 }}>
              ℹ️ By approving, you confirm receipt of this commission payment. A receipt will be generated automatically.
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn secondary" onClick={() => setApproveModal(null)} style={{ flex: 1 }} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="btn success" onClick={approvePayout} style={{ flex: 1 }} disabled={submitting}>
                {submitting ? 'Approving...' : 'Approve Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={(e) => { if (e.target === e.currentTarget) setRejectModal(null) }}>
          <div style={{ background: 'var(--panel)', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#ef4444' }}>Reject Commission Payment</h3>
            
            <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', color: '#ef4444', marginBottom: '8px' }}>
                <strong>Amount:</strong> {rejectModal.currency} {num(rejectModal.commissionAmount)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Are you sure you want to reject this commission payout?
              </div>
            </div>
            
            <label style={{ display: 'block', marginBottom: '16px' }}>
              <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: 600 }}>Reason for Rejection</div>
              <textarea className="input" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3} placeholder="Please explain why you're rejecting this payout..." required />
            </label>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn secondary" onClick={() => setRejectModal(null)} style={{ flex: 1 }} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="btn danger" onClick={rejectPayout} style={{ flex: 1 }} disabled={submitting || !rejectionReason.trim()}>
                {submitting ? 'Rejecting...' : 'Reject Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
