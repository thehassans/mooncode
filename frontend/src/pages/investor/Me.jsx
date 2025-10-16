import React, { useEffect, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import Modal from '../../components/Modal.jsx'

export default function InvestorMe(){
  const toast = useToast()
  const [me, setMe] = useState(null)
  const [remittances, setRemittances] = useState([])
  const [loading, setLoading] = useState(false)
  const [requestModal, setRequestModal] = useState(false)
  const [requestForm, setRequestForm] = useState({ amount: '', note: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(()=>{
    loadData()
    // Socket live updates
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['polling'], upgrade:false, auth: { token }, withCredentials: true })
      const refresh = ()=>{ loadData() }
      socket.on('investor-remittance.approved', refresh)
      socket.on('investor-remittance.sent', refresh)
    }catch{}
    return ()=>{
      try{ socket && socket.off('investor-remittance.approved') }catch{}
      try{ socket && socket.off('investor-remittance.sent') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  }, [])

  async function loadData(){
    try{
      setLoading(true)
      const [userRes, remitRes] = await Promise.all([
        apiGet('/api/users/me'),
        apiGet('/api/finance/investor-remittances')
      ])
      setMe(userRes?.user || null)
      setRemittances(Array.isArray(remitRes?.remittances) ? remitRes.remittances : [])
    }catch(e){
      console.error('Failed to load data:', e)
    }finally{
      setLoading(false)
    }
  }

  async function submitRequest(){
    if (!requestForm.amount){ toast.error('Enter amount'); return }
    const amt = Number(requestForm.amount)
    if (isNaN(amt) || amt <= 0){ toast.error('Enter valid amount'); return }
    
    setSubmitting(true)
    try{
      await apiPost('/api/finance/investor-remittances', {
        amount: amt,
        note: requestForm.note
      })
      toast.success('Payment request submitted')
      setRequestForm({ amount: '', note: '' })
      setRequestModal(false)
      await loadData()
    }catch(e){
      toast.error(e?.message || 'Failed to submit request')
    }finally{
      setSubmitting(false)
    }
  }

  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  
  function statusBadge(st){
    const s = String(st||'').toLowerCase()
    const colors = { pending:'#f59e0b', approved:'#10b981', sent:'#3b82f6' }
    const color = colors[s] || 'var(--muted)'
    return <span className="chip" style={{border:`1px solid ${color}`, color, background:'transparent', fontWeight:700}}>{s.toUpperCase()}</span>
  }

  const currency = me?.investorProfile?.currency || 'SAR'
  const totalPending = remittances.filter(r => r.status === 'pending').reduce((sum, r) => sum + Number(r.amount||0), 0)
  const totalApproved = remittances.filter(r => r.status === 'approved').reduce((sum, r) => sum + Number(r.amount||0), 0)
  const totalSent = remittances.filter(r => r.status === 'sent').reduce((sum, r) => sum + Number(r.amount||0), 0)

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-green">Payment Requests</div>
          <div className="page-subtitle">Request and track your profit withdrawals</div>
        </div>
        <button className="btn success" onClick={()=> setRequestModal(true)}>
          + New Request
        </button>
      </div>

      {/* Summary */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:12}}>
        <div className="card" style={{background:'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>⏳ Pending</div>
            <div style={{fontSize:28, fontWeight:800}}>{currency} {num(totalPending)}</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #10b981 0%, #059669 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>✅ Approved</div>
            <div style={{fontSize:28, fontWeight:800}}>{currency} {num(totalApproved)}</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>💸 Sent</div>
            <div style={{fontSize:28, fontWeight:800}}>{currency} {num(totalSent)}</div>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Payment History</div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
            <thead>
              <tr>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#10b981'}}>Amount</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#f59e0b'}}>Status</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#3b82f6'}}>Note</th>
                <th style={{padding:'10px 12px', textAlign:'left', color:'#6366f1'}}>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:3}).map((_,i)=> (
                  <tr key={`sk${i}`}>
                    <td colSpan={4} style={{padding:'10px 12px'}}>
                      <div style={{height:14, background:'var(--panel-2)', borderRadius:6, animation:'pulse 1.2s ease-in-out infinite'}} />
                    </td>
                  </tr>
                ))
              ) : remittances.length === 0 ? (
                <tr><td colSpan={4} style={{padding:'10px 12px', opacity:0.7, textAlign:'center'}}>No requests yet</td></tr>
              ) : (
                remittances.map((r, idx) => (
                  <tr key={String(r._id)} style={{borderTop:'1px solid var(--border)', background: idx % 2 ? 'transparent' : 'var(--panel)'}}>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>
                      <span style={{color:'#10b981', fontWeight:800}}>{r.currency} {num(r.amount)}</span>
                    </td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>
                      {statusBadge(r.status)}
                    </td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>
                      <span style={{opacity:0.8}}>{r.note || '-'}</span>
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      <div style={{color:'#6366f1', fontSize:13}}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Modal */}
      <Modal
        title="Request Payment"
        open={requestModal}
        onClose={()=> setRequestModal(false)}
        footer={
          <>
            <button className="btn secondary" onClick={()=> setRequestModal(false)} disabled={submitting}>
              Cancel
            </button>
            <button className="btn success" onClick={submitRequest} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </>
        }
      >
        <div style={{display:'grid', gap:12}}>
          <div>
            <label className="helper">Amount ({currency})</label>
            <input 
              type="number" 
              className="input" 
              placeholder="Enter amount"
              value={requestForm.amount}
              onChange={e=> setRequestForm({...requestForm, amount: e.target.value})}
            />
          </div>
          <div>
            <label className="helper">Note (Optional)</label>
            <textarea 
              className="input" 
              placeholder="Add a note..."
              rows={3}
              value={requestForm.note}
              onChange={e=> setRequestForm({...requestForm, note: e.target.value})}
            />
          </div>
          <div style={{padding:12, background:'rgba(59, 130, 246, 0.1)', borderRadius:8, fontSize:13}}>
            <strong>📌 Note:</strong> Your request will be reviewed and approved by the company owner.
          </div>
        </div>
      </Modal>
    </div>
  )
}
