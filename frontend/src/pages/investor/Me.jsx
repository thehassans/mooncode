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
    <div className="section" style={{display:'grid', gap:16}}>
      <div className="page-header">
        <div>
          <div className="page-title">Payment Requests</div>
          <div className="page-subtitle">Request and track your profit withdrawals</div>
        </div>
        <button className="btn success" onClick={()=> setRequestModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6}}>
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Request
        </button>
      </div>

      {/* Summary */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:16}}>
        <div className="card" style={{border:'1px solid var(--border)', background:'var(--card-bg)'}}>
          <div style={{padding:'20px', display:'flex', alignItems:'center', gap:16}}>
            <div style={{width:48, height:48, borderRadius:12, background:'rgba(245, 158, 11, 0.1)', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, opacity:0.7, marginBottom:4}}>Pending</div>
              <div style={{fontSize:24, fontWeight:800, color:'#f59e0b'}}>{currency} {num(totalPending)}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{border:'1px solid var(--border)', background:'var(--card-bg)'}}>
          <div style={{padding:'20px', display:'flex', alignItems:'center', gap:16}}>
            <div style={{width:48, height:48, borderRadius:12, background:'rgba(16, 185, 129, 0.1)', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, opacity:0.7, marginBottom:4}}>Approved</div>
              <div style={{fontSize:24, fontWeight:800, color:'#10b981'}}>{currency} {num(totalApproved)}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{border:'1px solid var(--border)', background:'var(--card-bg)'}}>
          <div style={{padding:'20px', display:'flex', alignItems:'center', gap:16}}>
            <div style={{width:48, height:48, borderRadius:12, background:'rgba(59, 130, 246, 0.1)', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13, opacity:0.7, marginBottom:4}}>Sent</div>
              <div style={{fontSize:24, fontWeight:800, color:'#3b82f6'}}>{currency} {num(totalSent)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title" style={{display:'flex', alignItems:'center', gap:8}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            Payment History
          </div>
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
          <div style={{padding:12, background:'var(--panel)', border:'1px solid var(--border)', borderRadius:8, fontSize:13, display:'flex', alignItems:'start', gap:10}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginTop:2, flexShrink:0}}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <div><strong>Note:</strong> Your request will be reviewed and approved by the company owner.</div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
