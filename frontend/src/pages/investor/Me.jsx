import React, { useEffect, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import Modal from '../../components/Modal.jsx'

export default function InvestorMe(){
  const toast = useToast()
  const [isMobile, setIsMobile] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  const [me, setMe] = useState(null)
  const [remittances, setRemittances] = useState([])
  const [loading, setLoading] = useState(false)
  const [requestModal, setRequestModal] = useState(false)
  const [requestForm, setRequestForm] = useState({ amount: '', note: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(()=>{
    function onResize(){ setIsMobile(window.innerWidth <= 768) }
    window.addEventListener('resize', onResize)
    return ()=> window.removeEventListener('resize', onResize)
  },[])

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
    <div className="section" style={{display:'grid', gap: isMobile ? 16 : 20, padding: isMobile ? '12px' : '20px'}}>
      <div className="page-header" style={{flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 0, alignItems: isMobile ? 'stretch' : 'center'}}>
        <div>
          <div className="page-title" style={{fontSize: isMobile ? 22 : 28}}>Payment Requests</div>
          <div className="page-subtitle" style={{fontSize: isMobile ? 13 : 14}}>Request and track your profit withdrawals</div>
        </div>
        <button className="btn success" onClick={()=> setRequestModal(true)} style={{width: isMobile ? '100%' : 'auto'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6}}>
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Request
        </button>
      </div>

      {/* Summary */}
      <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px,1fr))', gap: isMobile ? 12 : 16}}>
        <div className="card" style={{border:'1px solid var(--border)', background:'var(--card-bg)', transition:'transform 0.2s, box-shadow 0.2s'}}>
          <div style={{padding: isMobile ? '16px' : '20px', display:'flex', alignItems:'center', gap: isMobile ? 12 : 16}}>
            <div style={{width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius:12, background:'rgba(245, 158, 11, 0.1)', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <svg width={isMobile ? 20 : 24} height={isMobile ? 20 : 24} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize: isMobile ? 12 : 13, opacity:0.7, marginBottom:4}}>Pending</div>
              <div style={{fontSize: isMobile ? 20 : 24, fontWeight:800, color:'#f59e0b'}}>{currency} {num(totalPending)}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{border:'1px solid var(--border)', background:'var(--card-bg)', transition:'transform 0.2s, box-shadow 0.2s'}}>
          <div style={{padding: isMobile ? '16px' : '20px', display:'flex', alignItems:'center', gap: isMobile ? 12 : 16}}>
            <div style={{width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius:12, background:'rgba(16, 185, 129, 0.1)', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <svg width={isMobile ? 20 : 24} height={isMobile ? 20 : 24} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize: isMobile ? 12 : 13, opacity:0.7, marginBottom:4}}>Approved</div>
              <div style={{fontSize: isMobile ? 20 : 24, fontWeight:800, color:'#10b981'}}>{currency} {num(totalApproved)}</div>
            </div>
          </div>
        </div>
        <div className="card" style={{border:'1px solid var(--border)', background:'var(--card-bg)', transition:'transform 0.2s, box-shadow 0.2s'}}>
          <div style={{padding: isMobile ? '16px' : '20px', display:'flex', alignItems:'center', gap: isMobile ? 12 : 16}}>
            <div style={{width: isMobile ? 40 : 48, height: isMobile ? 40 : 48, borderRadius:12, background:'rgba(59, 130, 246, 0.1)', display:'flex', alignItems:'center', justifyContent:'center'}}>
              <svg width={isMobile ? 20 : 24} height={isMobile ? 20 : 24} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize: isMobile ? 12 : 13, opacity:0.7, marginBottom:4}}>Sent</div>
              <div style={{fontSize: isMobile ? 20 : 24, fontWeight:800, color:'#3b82f6'}}>{currency} {num(totalSent)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="card" style={{border:'1px solid var(--border)', overflow: isMobile ? 'hidden' : 'visible'}}>
        <div className="card-header" style={{padding: isMobile ? '16px' : '20px'}}>
          <div className="card-title" style={{fontSize: isMobile ? 16 : 18}}>Recent Requests</div>
        </div>
        {loading ? (
          <div style={{padding: isMobile ? 30 : 40, textAlign:'center'}}>
            <div style={{width: isMobile ? 32 : 40, height: isMobile ? 32 : 40, border:'3px solid var(--border)', borderTopColor:'#8b5cf6', borderRadius:'50%', margin:'0 auto 16px', animation:'spin 0.8s linear infinite'}} />
            <div style={{fontSize: isMobile ? 13 : 14}}>Loading...</div>
          </div>
        ) : remittances.length === 0 ? (
          <div style={{padding: isMobile ? 30 : 40, textAlign:'center', opacity:0.6}}>
            <svg width={isMobile ? 40 : 48} height={isMobile ? 40 : 48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{margin:'0 auto 16px', opacity:0.3}}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div style={{fontSize: isMobile ? 13 : 14}}>No payment requests yet</div>
          </div>
        ) : isMobile ? (
          <div style={{padding:'12px', display:'grid', gap:12}}>
            {remittances.map(r => (
              <div key={r._id} style={{padding:16, background:'var(--panel)', borderRadius:10, border:'1px solid var(--border)'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12}}>
                  <div>
                    <div style={{fontSize:18, fontWeight:700, color:'#10b981', marginBottom:4}}>{currency} {num(r.amount)}</div>
                    <div style={{fontSize:11, opacity:0.6}}>{fmtDate(r.createdAt)}</div>
                  </div>
                  {statusBadge(r.status)}
                </div>
                {r.note && <div style={{fontSize:12, opacity:0.7, marginTop:8, padding:8, background:'var(--panel-2)', borderRadius:6}}>{r.note}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'2px solid var(--border)', background:'var(--panel)'}}>
                  <th style={{padding:'12px', textAlign:'left', fontWeight:700}}>Amount</th>
                  <th style={{padding:'12px', textAlign:'left', fontWeight:700}}>Status</th>
                  <th style={{padding:'12px', textAlign:'left', fontWeight:700}}>Note</th>
                  <th style={{padding:'12px', textAlign:'left', fontWeight:700}}>Date</th>
                </tr>
              </thead>
              <tbody>
                {remittances.map((r, idx) => (
                  <tr key={String(r._id)} style={{borderBottom:'1px solid var(--border)', background: idx % 2 ? 'transparent' : 'var(--panel)'}}>
                    <td style={{padding:'12px'}}>
                      <span style={{color:'#10b981', fontWeight:700, fontSize:15}}>{r.currency} {num(r.amount)}</span>
                    </td>
                    <td style={{padding:'12px'}}>
                      {statusBadge(r.status)}
                    </td>
                    <td style={{padding:'12px'}}>
                      <span style={{opacity:0.8, fontSize:13}}>{r.note || '-'}</span>
                    </td>
                    <td style={{padding:'12px'}}>
                      <div style={{fontSize:13, opacity:0.7}}>{fmtDate(r.createdAt)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
