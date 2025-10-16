import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/Modal.jsx'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, convert } from '../../util/currency'

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
  const [curCfg, setCurCfg] = useState(null)

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{ 
        const [userRes, curRes] = await Promise.all([
          apiGet('/api/users/me'),
          getCurrencyConfig()
        ])
        if (alive){ 
          setMe(userRes?.user||{})
          setCurCfg(curRes || null)
        }
      }catch{}
    })()
    return ()=>{ alive=false }
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
      } catch { setCountryOptions([]) }
    })()
  }, [])

  // Load remittances
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const r = await apiGet('/api/finance/manager-remittances')
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
      const r = await apiGet('/api/finance/manager-remittances')
      setRemittances(Array.isArray(r?.remittances) ? r.remittances : [])
    }catch{}
  }

  async function acceptRemit(id){ 
    try{ 
      await apiPost(`/api/finance/manager-remittances/${id}/accept`,{})
      await refreshRemittances()
      toast.success('Manager remittance accepted') 
    }catch(e){ 
      toast.error(e?.message||'Failed to accept') 
    } 
  }

  async function rejectRemit(id){ 
    try{ 
      await apiPost(`/api/finance/manager-remittances/${id}/reject`,{})
      await refreshRemittances()
      toast.warn('Manager remittance rejected') 
    }catch(e){ 
      toast.error(e?.message||'Failed to reject') 
    } 
  }

  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function userName(u){ if (!u) return '-'; return `${u.firstName||''} ${u.lastName||''}`.trim() || (u.email||'-') }
  function dateInRange(d, from, to){ 
    try{ 
      if (!d) return false
      const t = new Date(d).getTime()
      if (from){ const f = new Date(from).setHours(0,0,0,0); if (t < f) return false } 
      if (to){ const tt = new Date(to).setHours(23,59,59,999); if (t > tt) return false } 
      return true 
    }catch{ return true } 
  }

  const filteredRemittances = useMemo(()=>{
    return remittances.filter(r => {
      if (country && String(r?.country||'').trim().toLowerCase() !== String(country).trim().toLowerCase()) return false
      if (statusFilter && String(r?.status||'').toLowerCase() !== String(statusFilter).toLowerCase()) return false
      if ((fromDate || toDate) && !dateInRange(r?.createdAt, fromDate, toDate)) return false
      return true
    })
  }, [remittances, country, statusFilter, fromDate, toDate])

  const totals = useMemo(()=>{
    let totalAmountAED = 0, acceptedAED = 0, pendingAED = 0, rejectedAED = 0
    const byCountry = {}
    const byCurrency = {}
    
    for (const r of filteredRemittances){
      const amount = Number(r.amount||0)
      const currency = r.currency || 'SAR'
      // Get country from remittance or manager, fallback to currency code
      let countryKey = r.country || r.manager?.country || r.manager?.assignedCountry
      if (Array.isArray(r.manager?.assignedCountries) && r.manager.assignedCountries.length > 0) {
        countryKey = countryKey || r.manager.assignedCountries[0]
      }
      // If still no country, use currency code as the grouping key
      countryKey = countryKey || currency
      
      // Convert to AED
      const amountAED = curCfg ? convert(amount, currency, 'AED', curCfg) : amount
      
      totalAmountAED += amountAED
      if (r.status === 'accepted') acceptedAED += amountAED
      else if (r.status === 'pending') pendingAED += amountAED
      else if (r.status === 'rejected') rejectedAED += amountAED
      
      // Track by country
      if (!byCountry[countryKey]) byCountry[countryKey] = { count: 0, amount: 0, currency }
      byCountry[countryKey].count++
      byCountry[countryKey].amount += amount
      
      // Track by currency
      if (!byCurrency[currency]) byCurrency[currency] = { count: 0, amount: 0 }
      byCurrency[currency].count++
      byCurrency[currency].amount += amount
    }
    
    return { 
      totalAmountAED, 
      acceptedAED, 
      pendingAED, 
      rejectedAED,
      byCountry: Object.entries(byCountry).map(([k,v])=> ({country:k, ...v})),
      byCurrency: Object.entries(byCurrency).map(([k,v])=> ({currency:k, ...v}))
    }
  }, [filteredRemittances, curCfg])

  function statusBadge(st){
    const s = String(st||'').toLowerCase()
    const map = { pending:'#f59e0b', accepted:'#10b981', rejected:'#ef4444' }
    const color = map[s] || 'var(--muted)'
    return <span className="chip" style={{border:`1px solid ${color}`, color, background:'transparent', fontWeight:700}}>{s.toUpperCase()}</span>
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

      {/* Filters */}
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
          <input className="input" type="date" value={fromDate} onChange={e=> setFromDate(e.target.value)} />
          <input className="input" type="date" value={toDate} onChange={e=> setToDate(e.target.value)} />
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:12 }}>
        <div className="card" style={{background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Total Amount (AED)</div>
            <div style={{fontSize:28, fontWeight:800}}>AED {num(totals.totalAmountAED)}</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #10b981 0%, #059669 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Accepted (AED)</div>
            <div style={{fontSize:28, fontWeight:800}}>AED {num(totals.acceptedAED)}</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Pending (AED)</div>
            <div style={{fontSize:28, fontWeight:800}}>AED {num(totals.pendingAED)}</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Rejected (AED)</div>
            <div style={{fontSize:28, fontWeight:800}}>AED {num(totals.rejectedAED)}</div>
          </div>
        </div>
      </div>

      {/* Breakdown by Country and Currency */}
      {(totals.byCountry.length > 0 || totals.byCurrency.length > 0) && (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:12}}>
          {/* By Country */}
          {totals.byCountry.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">📍 By Country</div>
              </div>
              <div style={{display:'grid', gap:6}}>
                {totals.byCountry.map(item => (
                  <div key={item.country} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'var(--panel)', borderRadius:6}}>
                    <div>
                      <div style={{fontWeight:700, color:'#6366f1'}}>{item.country}</div>
                      <div className="helper" style={{fontSize:12}}>{item.count} remittance{item.count !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{fontWeight:800, color:'#10b981'}}>{item.currency} {num(item.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Currency */}
          {totals.byCurrency.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">💰 By Currency</div>
              </div>
              <div style={{display:'grid', gap:6}}>
                {totals.byCurrency.map(item => (
                  <div key={item.currency} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'var(--panel)', borderRadius:6}}>
                    <div>
                      <div style={{fontWeight:700, color:'#f59e0b'}}>{item.currency}</div>
                      <div className="helper" style={{fontSize:12}}>{item.count} remittance{item.count !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{fontWeight:800, color:'#10b981'}}>{item.currency} {num(item.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Remittances Table */}
      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontWeight: 700 }}>Manager Remittances</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#8b5cf6' }}>Manager</th>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#6366f1' }}>Country</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e' }}>Amount</th>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#3b82f6' }}>Method</th>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#f59e0b' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#6366f1' }}>Date</th>
                <th style={{ padding: '10px 12px', textAlign:'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:5}).map((_,i)=> (
                  <tr key={`sk${i}`}>
                    <td colSpan={7} style={{ padding:'10px 12px' }}>
                      <div style={{ height:14, background:'var(--panel-2)', borderRadius:6, animation:'pulse 1.2s ease-in-out infinite' }} />
                    </td>
                  </tr>
                ))
              ) : filteredRemittances.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '10px 12px', opacity: 0.7, textAlign:'center' }}>No manager remittances found</td></tr>
              ) : (
                filteredRemittances.map((r, idx) => (
                  <tr key={String(r._id)} style={{ borderTop: '1px solid var(--border)', background: idx % 2 ? 'transparent' : 'var(--panel)' }}>
                    <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                      <div style={{fontWeight:700, color:'#8b5cf6'}}>{userName(r.manager)}</div>
                      <div className="helper">{r.manager?.email || ''}</div>
                    </td>
                    <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#6366f1', fontWeight:700}}>
                        {r.country || r.manager?.country || r.manager?.assignedCountry || 
                         (Array.isArray(r.manager?.assignedCountries) && r.manager.assignedCountries.length > 0 ? r.manager.assignedCountries[0] : null) || 
                         r.currency || 'SAR'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#22c55e', fontWeight:800}}>{r.currency} {num(r.amount)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#3b82f6', fontWeight:700}}>{String(r.method||'hand').toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                      {statusBadge(r.status)}
                    </td>
                    <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                      <div style={{color:'#6366f1', fontSize:13}}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {r.status === 'pending' ? (
                        <button className="btn small" onClick={()=> setAcceptModal(r)}>Accept</button>
                      ) : (
                        <button className="btn secondary small" onClick={()=> setAcceptModal(r)}>Details</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accept/Details Modal */}
      {acceptModal && (
        <Modal
          title={acceptModal.status === 'pending' ? 'Accept Manager Remittance' : 'Manager Remittance Details'}
          open={!!acceptModal}
          onClose={()=> setAcceptModal(null)}
          footer={
            <>
              <button className="btn secondary" onClick={()=> setAcceptModal(null)}>Close</button>
              {acceptModal.status === 'pending' && (
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
              <Info label="Country" value={
                acceptModal?.country || 
                acceptModal?.manager?.country || 
                acceptModal?.manager?.assignedCountry || 
                (Array.isArray(acceptModal?.manager?.assignedCountries) && acceptModal?.manager?.assignedCountries.length > 0 ? acceptModal?.manager?.assignedCountries[0] : null) || 
                acceptModal?.currency || 'SAR'
              } />
              <Info label="Amount" value={`${acceptModal?.currency||''} ${Number(acceptModal?.amount||0).toFixed(2)}`} />
              <Info label="Method" value={String(acceptModal?.method||'hand').toUpperCase()} />
              <Info label="Status" value={String(acceptModal?.status||'').toUpperCase()} />
              {acceptModal?.note ? <Info label="Note" value={acceptModal?.note} /> : null}
              <Info label="Created" value={acceptModal?.createdAt ? new Date(acceptModal.createdAt).toLocaleString() : '-'} />
              {acceptModal?.acceptedAt ? <Info label="Processed" value={new Date(acceptModal.acceptedAt).toLocaleString()} /> : null}
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
