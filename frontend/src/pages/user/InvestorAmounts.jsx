import React, { useEffect, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import Modal from '../../components/Modal.jsx'

export default function InvestorAmounts(){
  const toast = useToast()
  const [remittances, setRemittances] = useState([])
  const [loading, setLoading] = useState(false)
  const [detailModal, setDetailModal] = useState(null)
  const [processing, setProcessing] = useState(null)

  useEffect(()=>{
    loadData()
    // Socket live updates
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['polling'], upgrade:false, auth: { token }, withCredentials: true })
      const refresh = ()=>{ loadData() }
      socket.on('investor-remittance.created', refresh)
    }catch{}
    return ()=>{
      try{ socket && socket.off('investor-remittance.created') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  }, [])

  async function loadData(){
    try{
      setLoading(true)
      const res = await apiGet('/api/finance/investor-remittances')
      setRemittances(Array.isArray(res?.remittances) ? res.remittances : [])
    }catch(e){
      console.error('Failed to load remittances:', e)
    }finally{
      setLoading(false)
    }
  }

  async function approveRemittance(id){
    setProcessing(id)
    try{
      await apiPost(`/api/finance/investor-remittances/${id}/approve`, {})
      toast.success('Payment request approved')
      await loadData()
      setDetailModal(null)
    }catch(e){
      toast.error(e?.message || 'Failed to approve')
    }finally{
      setProcessing(null)
    }
  }

  async function markAsSent(id){
    setProcessing(id)
    try{
      await apiPost(`/api/finance/investor-remittances/${id}/send`, {})
      toast.success('Payment marked as sent')
      await loadData()
      setDetailModal(null)
    }catch(e){
      toast.error(e?.message || 'Failed to mark as sent')
    }finally{
      setProcessing(null)
    }
  }

  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function userName(u){ if (!u) return '-'; return `${u.firstName||''} ${u.lastName||''}`.trim() || (u.email||'-') }
  
  function statusBadge(st){
    const s = String(st||'').toLowerCase()
    const colors = { pending:'#f59e0b', approved:'#10b981', sent:'#3b82f6' }
    const color = colors[s] || 'var(--muted)'
    return <span className="chip" style={{border:`1px solid ${color}`, color, background:'transparent', fontWeight:700}}>{s.toUpperCase()}</span>
  }

  const totalPending = remittances.filter(r => r.status === 'pending').reduce((sum, r) => sum + Number(r.amount||0), 0)
  const totalApproved = remittances.filter(r => r.status === 'approved').reduce((sum, r) => sum + Number(r.amount||0), 0)
  const totalSent = remittances.filter(r => r.status === 'sent').reduce((sum, r) => sum + Number(r.amount||0), 0)

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-purple">Investor Amounts</div>
          <div className="page-subtitle">Manage investor profit withdrawals and track performance</div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:12}}>
        <div className="card" style={{background:'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>⏳ Pending Requests</div>
            <div style={{fontSize:28, fontWeight:800}}>{num(totalPending)}</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #10b981 0%, #059669 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>✅ Approved</div>
            <div style={{fontSize:28, fontWeight:800}}>{num(totalApproved)}</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>💸 Sent</div>
            <div style={{fontSize:28, fontWeight:800}}>{num(totalSent)}</div>
          </div>
        </div>
      </div>

      {/* Remittances Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Payment Requests</div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
            <thead>
              <tr>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#8b5cf6'}}>Investor</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#10b981'}}>Amount</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#f59e0b'}}>Status</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#3b82f6'}}>Products</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#6366f1'}}>Date</th>
                <th style={{padding:'10px 12px', textAlign:'left'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:5}).map((_,i)=> (
                  <tr key={`sk${i}`}>
                    <td colSpan={6} style={{padding:'10px 12px'}}>
                      <div style={{height:14, background:'var(--panel-2)', borderRadius:6, animation:'pulse 1.2s ease-in-out infinite'}} />
                    </td>
                  </tr>
                ))
              ) : remittances.length === 0 ? (
                <tr><td colSpan={6} style={{padding:'10px 12px', opacity:0.7, textAlign:'center'}}>No payment requests</td></tr>
              ) : (
                remittances.map((r, idx) => (
                  <tr key={String(r._id)} style={{borderTop:'1px solid var(--border)', background: idx % 2 ? 'transparent' : 'var(--panel)'}}>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>
                      <div style={{fontWeight:700, color:'#8b5cf6'}}>{userName(r.investor)}</div>
                      <div className="helper" style={{fontSize:12}}>{r.investor?.email || ''}</div>
                    </td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>
                      <span style={{color:'#10b981', fontWeight:800}}>{r.currency} {num(r.amount)}</span>
                    </td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>
                      {statusBadge(r.status)}
                    </td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>
                      <div style={{fontSize:13}}>
                        {r.investor?.investorProfile?.assignedProducts?.length || 0} product(s)
                      </div>
                    </td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>
                      <div style={{color:'#6366f1', fontSize:13}}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</div>
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      <button className="btn secondary small" onClick={()=> setDetailModal(r)}>
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {detailModal && (
        <Modal
          title="Payment Request Details"
          open={!!detailModal}
          onClose={()=> setDetailModal(null)}
          footer={
            <>
              <button className="btn secondary" onClick={()=> setDetailModal(null)}>Close</button>
              {detailModal.status === 'pending' && (
                <button 
                  className="btn success" 
                  onClick={()=> approveRemittance(detailModal._id)}
                  disabled={processing === detailModal._id}
                >
                  {processing === detailModal._id ? 'Approving...' : 'Approve'}
                </button>
              )}
              {detailModal.status === 'approved' && (
                <button 
                  className="btn" 
                  onClick={()=> markAsSent(detailModal._id)}
                  disabled={processing === detailModal._id}
                >
                  {processing === detailModal._id ? 'Processing...' : 'Mark as Sent'}
                </button>
              )}
            </>
          }
        >
          <div style={{display:'grid', gap:12}}>
            {/* Investor Info */}
            <div style={{padding:16, background:'var(--panel)', borderRadius:8}}>
              <div style={{fontWeight:700, fontSize:16, marginBottom:12, color:'#8b5cf6'}}>Investor Information</div>
              <div style={{display:'grid', gap:8}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span className="helper">Name:</span>
                  <strong>{userName(detailModal.investor)}</strong>
                </div>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span className="helper">Email:</span>
                  <strong>{detailModal.investor?.email || '-'}</strong>
                </div>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span className="helper">Total Investment:</span>
                  <strong>{detailModal.investor?.investorProfile?.currency || 'SAR'} {num(detailModal.investor?.investorProfile?.investmentAmount || 0)}</strong>
                </div>
              </div>
            </div>

            {/* Request Info */}
            <div style={{padding:16, background:'var(--panel)', borderRadius:8}}>
              <div style={{fontWeight:700, fontSize:16, marginBottom:12, color:'#10b981'}}>Request Details</div>
              <div style={{display:'grid', gap:8}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span className="helper">Amount:</span>
                  <strong style={{color:'#10b981', fontSize:18}}>{detailModal.currency} {num(detailModal.amount)}</strong>
                </div>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span className="helper">Status:</span>
                  {statusBadge(detailModal.status)}
                </div>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span className="helper">Requested:</span>
                  <strong>{detailModal.createdAt ? new Date(detailModal.createdAt).toLocaleString() : '-'}</strong>
                </div>
                {detailModal.note && (
                  <div>
                    <div className="helper">Note:</div>
                    <div style={{marginTop:4, padding:8, background:'var(--panel-2)', borderRadius:6, fontSize:13}}>
                      {detailModal.note}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Assigned Products */}
            {detailModal.investor?.investorProfile?.assignedProducts?.length > 0 && (
              <div style={{padding:16, background:'var(--panel)', borderRadius:8}}>
                <div style={{fontWeight:700, fontSize:16, marginBottom:12, color:'#3b82f6'}}>Assigned Products</div>
                <div style={{display:'grid', gap:8}}>
                  {detailModal.investor.investorProfile.assignedProducts.map((ap, idx) => ap.product && (
                    <div key={idx} style={{padding:10, background:'var(--panel-2)', borderRadius:6, display:'flex', alignItems:'center', gap:10}}>
                      {ap.product.image && (
                        <img 
                          src={`${API_BASE}${ap.product.image}`} 
                          alt={ap.product.name}
                          style={{width:50, height:50, objectFit:'cover', borderRadius:6}}
                          onError={(e)=> e.target.style.display='none'}
                        />
                      )}
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700, fontSize:14}}>{ap.product.name}</div>
                        <div className="helper" style={{fontSize:12}}>
                          {ap.country || 'All Countries'} • Profit: {detailModal.currency} {num(ap.profitPerUnit)}/unit
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
