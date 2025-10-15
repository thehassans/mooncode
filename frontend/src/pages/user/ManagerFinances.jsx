import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/Modal.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function ManagerFinances(){
  const navigate = useNavigate()
  const toast = useToast()
  const [me, setMe] = useState(()=>{ try{ return JSON.parse(localStorage.getItem('me')||'{}') }catch{ return {} } })
  const [remittances, setRemittances] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [country, setCountry] = useState('')
  const [countryOptions, setCountryOptions] = useState([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [acceptModal, setAcceptModal] = useState(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{ const r = await apiGet('/api/users/me'); if (alive){ setMe(r?.user||{}) } }
      catch{}
    })()
    return ()=>{ alive=false }
  },[])

  useEffect(()=>{
    try{
      const onResize = ()=> setIsMobile(typeof window !== 'undefined' && window.innerWidth < 720)
      onResize()
      window.addEventListener('resize', onResize)
      return ()=> window.removeEventListener('resize', onResize)
    }catch{}
  },[])

  // Load country options
  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet('/api/orders/options')
        const arr = Array.isArray(r?.countries) ? r.countries : []
        const map = new Map()
        for (const c of arr){
          const raw = String(c||'').trim()
          const key = raw.toLowerCase()
          if (!map.has(key)) map.set(key, raw.toUpperCase() === 'UAE' ? 'UAE' : raw)
        }
        setCountryOptions(Array.from(map.values()))
      } catch {
        setCountryOptions([])
      }
    })()
  }, [])

  // Load manager remittances
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const r = await apiGet('/api/finance/manager-remittances?limit=200')
        if (alive) setRemittances(Array.isArray(r?.remittances) ? r.remittances : [])
        setErr('')
      } catch (e) {
        if (alive) setErr(e?.message || 'Failed to load manager remittances')
      } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  // Live updates
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token')||''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const onRemit = async ()=>{ try{ await refreshRemittances() }catch{} }
      socket.on('manager-remittance.created', onRemit)
      socket.on('manager-remittance.accepted', onRemit)
      socket.on('manager-remittance.rejected', onRemit)
    }catch{}
    return ()=>{
      try{ socket && socket.off('manager-remittance.created') }catch{}
      try{ socket && socket.off('manager-remittance.accepted') }catch{}
      try{ socket && socket.off('manager-remittance.rejected') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  }, [])

  async function refreshRemittances(){
    try{
      const r = await apiGet('/api/finance/manager-remittances?limit=200')
      setRemittances(Array.isArray(r?.remittances) ? r.remittances : [])
    }catch{}
  }

  async function acceptRemit(id){ 
    try{ 
      await apiPost(`/api/finance/manager-remittances/${id}/accept`,{}); 
      await refreshRemittances(); 
      toast.success('Manager remittance accepted') 
    }catch(e){ toast.error(e?.message||'Failed to accept') } 
  }
  
  async function rejectRemit(id){ 
    try{ 
      await apiPost(`/api/finance/manager-remittances/${id}/reject`,{}); 
      await refreshRemittances(); 
      toast.warn('Manager remittance rejected') 
    }catch(e){ toast.error(e?.message||'Failed to reject') } 
  }

  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function userName(u){ if (!u) return '-'; return `${u.firstName||''} ${u.lastName||''}`.trim() || (u.email||'-') }
  function dateInRange(d, from, to){ 
    try{ 
      if (!d) return false; 
      const t = new Date(d).getTime(); 
      if (from){ const f = new Date(from).setHours(0,0,0,0); if (t < f) return false } 
      if (to){ const tt = new Date(to).setHours(23,59,59,999); if (t > tt) return false } 
      return true 
    }catch{ return true } 
  }

  const filteredRows = useMemo(()=>{
    let arr = remittances
    if (country) arr = arr.filter(r => String(r?.country||'').trim().toLowerCase() === String(country).trim().toLowerCase())
    if (statusFilter) arr = arr.filter(r => String(r?.status||'').toLowerCase() === statusFilter.toLowerCase())
    if (fromDate || toDate) arr = arr.filter(r => dateInRange(r?.createdAt, fromDate, toDate))
    return arr
  }, [remittances, country, statusFilter, fromDate, toDate])

  const totals = useMemo(()=>{
    let total=0, pending=0, accepted=0, rejected=0
    for (const r of filteredRows){
      const amt = Number(r.amount||0)
      total += amt
      if (String(r.status||'').toLowerCase() === 'pending') pending += amt
      if (String(r.status||'').toLowerCase() === 'accepted') accepted += amt
      if (String(r.status||'').toLowerCase() === 'rejected') rejected += amt
    }
    return { total, pending, accepted, rejected }
  }, [filteredRows])

  function exportCsv(){
    try{
      const header = ['Manager','Country','Amount','Currency','Status','Method','Created','Accepted']
      const lines = [header.join(',')]
      for (const r of filteredRows){
        lines.push([
          userName(r.manager),
          r.country||'',
          r.amount||0,
          r.currency||'',
          r.status||'',
          r.method||'',
          r.createdAt ? new Date(r.createdAt).toLocaleString() : '',
          r.acceptedAt ? new Date(r.acceptedAt).toLocaleString() : '',
        ].map(v => typeof v==='string' && v.includes(',') ? `"${v.replace(/"/g,'""')}"` : v).join(','))
      }
      const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `manager-finances-${country||'all'}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }catch{}
  }

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-purple">Manager Finances</div>
          <div className="page-subtitle">Monitor manager remittances to company</div>
        </div>
      </div>
      {err && <div className="error">{err}</div>}

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="card-header"><div className="card-title">Filters</div></div>
        <div className="section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          <select className="input" value={country} onChange={(e)=> setCountry(e.target.value)}>
            <option value="">All Countries</option>
            {countryOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select className="input" value={statusFilter} onChange={(e)=> setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
          <input className="input" type="date" value={fromDate} onChange={e=> setFromDate(e.target.value)} placeholder="From Date" />
          <input className="input" type="date" value={toDate} onChange={e=> setToDate(e.target.value)} placeholder="To Date" />
          <button className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      {/* Summary */}
      <div className="card" style={{ display:'grid', gap:10 }}>
        <div className="card-header"><div className="card-title">Summary</div></div>
        <div className="section" style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <span className="badge">Total: {num(totals.total)}</span>
          <span className="badge warning">Pending: {num(totals.pending)}</span>
          <span className="badge success">Accepted: {num(totals.accepted)}</span>
          <span className="badge danger">Rejected: {num(totals.rejected)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          {!isMobile && (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)' }}>Manager</th>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#6366f1' }}>Country</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e' }}>Amount</th>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#f59e0b' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)' }}>Method</th>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)' }}>Created</th>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)' }}>Accepted</th>
                <th style={{ padding: '10px 12px', textAlign:'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:5}).map((_,i)=> (
                  <tr key={`sk${i}`}>
                    <td colSpan={8} style={{ padding:'10px 12px' }}>
                      <div style={{ height:14, background:'var(--panel-2)', borderRadius:6, animation:'pulse 1.2s ease-in-out infinite' }} />
                    </td>
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '10px 12px', opacity: 0.7 }}>No manager remittances found</td></tr>
              ) : (
                filteredRows.map((r, idx) => {
                  const statusColor = r.status==='accepted' ? '#22c55e' : r.status==='rejected' ? '#ef4444' : '#f59e0b'
                  return (
                    <tr key={String(r._id)} style={{ borderTop: '1px solid var(--border)', background: idx % 2 ? 'transparent' : 'var(--panel)' }}>
                      <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                        <span style={{ fontWeight:700 }}>{userName(r.manager)}</span>
                        <div className="helper">{r.manager?.email || ''}</div>
                      </td>
                      <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)', color:'#6366f1', fontWeight:700 }}>{r.country||'-'}</td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e', fontWeight:800 }}>
                        {r.currency||''} {num(r.amount)}
                      </td>
                      <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                        <span className="chip" style={{border:`1px solid ${statusColor}`, color:statusColor, background:'transparent'}}>{String(r.status||'').toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>{String(r.method||'hand').toUpperCase()}</td>
                      <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</td>
                      <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>{r.acceptedAt ? new Date(r.acceptedAt).toLocaleString() : '-'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {r.status==='pending' ? (
                          <button className="btn small" onClick={()=> setAcceptModal(r)}>Accept</button>
                        ) : (
                          <button className="btn secondary small" onClick={()=> setAcceptModal(r)}>Details</button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:'2px solid var(--border)', background:'var(--panel)' }}>
                <td style={{ padding:'10px 12px', fontWeight:800 }} colSpan={2}>Totals</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, color:'#22c55e' }}>{num(totals.total)}</td>
                <td colSpan={5}></td>
              </tr>
            </tfoot>
          </table>
          )}
          {isMobile && (
            <div style={{ display:'grid', gap:8 }}>
              {loading ? (
                <div className="helper">Loading…</div>
              ) : filteredRows.length===0 ? (
                <div className="helper">No manager remittances found</div>
              ) : filteredRows.map(r => {
                const statusColor = r.status==='accepted' ? '#22c55e' : r.status==='rejected' ? '#ef4444' : '#f59e0b'
                return (
                  <div key={String(r._id)} className="card" style={{ display:'grid', gap:8, padding:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontWeight:800 }}>{userName(r.manager)}</div>
                      <span className="chip" style={{border:`1px solid ${statusColor}`, color:statusColor, background:'transparent'}}>{String(r.status||'').toUpperCase()}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
                      <span style={{ color:'#6366f1', fontWeight:700 }}>Country: {r.country||'-'}</span>
                      <span style={{ color:'#22c55e', fontWeight:800 }}>Amount: {r.currency||''} {num(r.amount)}</span>
                      <span>Method: {String(r.method||'hand').toUpperCase()}</span>
                      <span>Created: {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'}</span>
                    </div>
                    <div style={{display:'flex', gap:6}}>
                      {r.status==='pending' && (
                        <button className="btn small" onClick={()=> setAcceptModal(r)}>Accept</button>
                      )}
                      <button className="btn secondary small" onClick={()=> setAcceptModal(r)}>Details</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Accept/Details Modal */}
      {acceptModal && (
        <Modal
          title={acceptModal.status==='pending' ? 'Accept Manager Remittance' : 'Manager Remittance Details'}
          open={!!acceptModal}
          onClose={()=> setAcceptModal(null)}
          footer={
            <>
              <button className="btn secondary" onClick={()=> setAcceptModal(null)}>Close</button>
              {acceptModal.status==='pending' && (
                <>
                  <button className="btn danger" onClick={async()=>{ const id=String(acceptModal?._id||''); await rejectRemit(id); setAcceptModal(null) }}>Reject</button>
                  <button className="btn success" onClick={async()=>{ const id=String(acceptModal?._id||''); await acceptRemit(id); setAcceptModal(null) }}>Accept</button>
                </>
              )}
            </>
          }
        >
          <div style={{display:'grid', gap:8}}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:8}}>
              <Info label="Manager" value={userName(acceptModal?.manager)} />
              <Info label="Country" value={acceptModal?.country||'-'} />
              <Info label="Amount" value={`${acceptModal?.currency||''} ${Number(acceptModal?.amount||0).toFixed(2)}`} />
              <Info label="Method" value={String(acceptModal?.method||'hand').toUpperCase()} />
              {acceptModal?.paidToName ? <Info label="Paid To" value={acceptModal?.paidToName} /> : null}
              {acceptModal?.note ? <Info label="Note" value={acceptModal?.note} /> : null}
              <Info label="Status" value={String(acceptModal?.status||'').toUpperCase()} />
              <Info label="Created" value={acceptModal?.createdAt ? new Date(acceptModal.createdAt).toLocaleString() : '-'} />
              {acceptModal?.acceptedAt ? <Info label="Accepted" value={new Date(acceptModal.acceptedAt).toLocaleString()} /> : null}
            </div>
            {acceptModal?.receiptPath ? (
              <div>
                <div className="helper">Proof</div>
                <img src={`${API_BASE}${acceptModal.receiptPath}`} alt="Proof" style={{maxWidth:'100%', borderRadius:8, border:'1px solid var(--border)'}} />
              </div>
            ) : null}
          </div>
        </Modal>
      )}
    </div>
  )
}

function Info({ label, value }){
  return (
    <div className="panel" style={{ padding:10, borderRadius:10 }}>
      <div className="helper" style={{ fontSize:12 }}>{label}</div>
      <div style={{ fontWeight:700 }}>{value}</div>
    </div>
  )
}
