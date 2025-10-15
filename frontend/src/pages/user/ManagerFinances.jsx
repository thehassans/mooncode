import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPost, apiUpload } from '../../api'
import { io } from 'socket.io-client'
import Modal from '../../components/Modal.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function ManagerFinances(){
  const toast = useToast()
  const [country, setCountry] = useState('')
  const [countries, setCountries] = useState([])
  const [mgrList, setMgrList] = useState([]) // managers in workspace
  const [driverRemits, setDriverRemits] = useState([]) // driver->manager (accepted)
  const [mgrRemits, setMgrRemits] = useState([]) // manager->company
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [acceptModal, setAcceptModal] = useState(null)
  const [historyFor, setHistoryFor] = useState('')

  // Load country options
  useEffect(()=>{
    (async()=>{
      try{
        const r = await apiGet('/api/orders/options')
        const arr = Array.isArray(r?.countries)? r.countries: []
        const set = new Set(arr.map(x=> String(x||'').trim()).filter(Boolean))
        setCountries(Array.from(set))
      }catch{ setCountries([]) }
    })()
  },[])

  // Load managers list (for names)
  useEffect(()=>{
    (async()=>{
      try{ const r = await apiGet('/api/users/managers') ; setMgrList(Array.isArray(r?.users)? r.users: []) }catch{ setMgrList([]) }
    })()
  },[])

  useEffect(()=>{
    if (!country){ setDriverRemits([]); setMgrRemits([]); return }
    let alive = true
    ;(async()=>{
      try{
        setLoading(true)
        const [dr, mr] = await Promise.all([
          apiGet('/api/finance/remittances').catch(()=>({ remittances: [] })),
          apiGet(`/api/finance/manager-remittances?country=${encodeURIComponent(country)}`).catch(()=>({ remittances: [] })),
        ])
        if (!alive) return
        const remits = Array.isArray(dr?.remittances) ? dr.remittances : []
        const filtered = remits.filter(r=> String(r?.status||'').toLowerCase()==='accepted' && String(r?.country||'').trim().toLowerCase()===String(country).trim().toLowerCase())
        setDriverRemits(filtered)
        setMgrRemits(Array.isArray(mr?.remittances)? mr.remittances: [])
        setErr('')
      }catch(e){ if (alive) setErr(e?.message||'Failed to load') }
      finally{ if (alive) setLoading(false) }
    })()
    return ()=>{ alive=false }
  },[country])

  // Sockets for live updates
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token')||''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const refresh = async()=>{
        try{
          if (!country) return
          const mr = await apiGet(`/api/finance/manager-remittances?country=${encodeURIComponent(country)}`)
          setMgrRemits(Array.isArray(mr?.remittances)? mr.remittances: [])
          const dr = await apiGet('/api/finance/remittances')
          const remits = Array.isArray(dr?.remittances) ? dr.remittances : []
          const filtered = remits.filter(r=> String(r?.status||'').toLowerCase()==='accepted' && String(r?.country||'').trim().toLowerCase()===String(country).trim().toLowerCase())
          setDriverRemits(filtered)
        }catch{}
      }
      socket.on('remittance.accepted', refresh)
      socket.on('managerRemit.created', refresh)
      socket.on('managerRemit.accepted', refresh)
      socket.on('managerRemit.rejected', refresh)
    }catch{}
    return ()=>{
      try{ socket && socket.off('remittance.accepted') }catch{}
      try{ socket && socket.off('managerRemit.created') }catch{}
      try{ socket && socket.off('managerRemit.accepted') }catch{}
      try{ socket && socket.off('managerRemit.rejected') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[country])

  function userName(u){ if (!u) return '-' ; return `${u.firstName||''} ${u.lastName||''}`.trim() || (u.email||'-') }
  function num(n){ return Number(n||0).toLocaleString(undefined,{ maximumFractionDigits: 2 }) }

  // Aggregate: total from drivers accepted per manager
  const byManager = useMemo(()=>{
    const map = new Map()
    for (const r of driverRemits){
      const mid = String(r?.manager?._id || r?.manager || '')
      if (!mid) continue
      if (!map.has(mid)) map.set(mid, { total:0, manager:r.manager, country:r.country })
      const s = map.get(mid)
      s.total += Number(r?.amount||0)
    }
    return map
  }, [driverRemits])

  const rows = useMemo(()=>{
    const out = []
    for (const [mid, info] of byManager.entries()){
      out.push({ id: mid, manager: info.manager, country: info.country, fromDriversAccepted: info.total })
    }
    // include managers with zero totals if in selected country
    for (const m of mgrList){
      if (country && String(m.country||'')!==String(country)) continue
      const id = String(m._id)
      if (!out.find(x=> x.id===id)) out.push({ id, manager: m, country: m.country || country, fromDriversAccepted: 0 })
    }
    out.sort((a,b)=> (b.fromDriversAccepted||0) - (a.fromDriversAccepted||0))
    return out
  }, [byManager, mgrList, country])

  async function acceptManagerRemit(id){ try{ await apiPost(`/api/finance/manager-remittances/${id}/accept`,{}); toast.success('Accepted'); setAcceptModal(null) }catch(e){ toast.error(e?.message||'Failed to accept') } }
  async function rejectManagerRemit(id){ try{ await apiPost(`/api/finance/manager-remittances/${id}/reject`,{}); toast.warn('Rejected'); setAcceptModal(null) }catch(e){ toast.error(e?.message||'Failed to reject') } }

  const filteredMgrRemits = useMemo(()=> mgrRemits.filter(r => !historyFor || String(r?.manager?._id||r?.manager||'')===String(historyFor)), [mgrRemits, historyFor])

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-green">Manager Finances</div>
          <div className="page-subtitle">Monitor driver collections accepted by managers and approve manager remittances to company</div>
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header"><div className="card-title">Filters</div></div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:8}}>
          <select className="input" value={country} onChange={e=> setCountry(e.target.value)}>
            <option value=''>Select Country</option>
            {countries.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* From Drivers Accepted per Manager */}
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header">
          <div className="card-title">Accepted From Drivers (by Manager)</div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          {loading ? (
            <div className="helper">Loading…</div>
          ) : err ? (
            <div className="error">{err}</div>
          ) : rows.length===0 ? (
            <div className="helper">No data</div>
          ) : (
            <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
              <thead>
                <tr>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Manager</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Country</th>
                  <th style={{textAlign:'right', padding:'8px 10px', color:'#22c55e'}}>From Drivers Accepted</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>History</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r=> (
                  <tr key={r.id} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'8px 10px'}}>{userName(r.manager)}</td>
                    <td style={{padding:'8px 10px'}}><span className="badge">{r.country||'-'}</span></td>
                    <td style={{padding:'8px 10px', textAlign:'right', color:'#22c55e', fontWeight:800}}>{num(r.fromDriversAccepted)}</td>
                    <td style={{padding:'8px 10px'}}>
                      <button className="btn secondary" onClick={()=> setHistoryFor(r.id)}>History</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Manager -> Company Remittances (Actionable) */}
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header">
          <div className="card-title">Manager Remittances to Company</div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          {mgrRemits.length===0 ? (
            <div className="helper">No remittances found</div>
          ) : (
            <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
              <thead>
                <tr>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Manager</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Country</th>
                  <th style={{textAlign:'right', padding:'8px 10px'}}>Amount</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Method</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Status</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Created</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mgrRemits.map(r=> (
                  <tr key={String(r._id||r.id)} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'8px 10px'}}>{userName(r.manager)}</td>
                    <td style={{padding:'8px 10px'}}>{r.country||'-'}</td>
                    <td style={{padding:'8px 10px', textAlign:'right', fontWeight:800}}>{(r.currency||'') + ' ' + Number(r.amount||0).toFixed(2)}</td>
                    <td style={{padding:'8px 10px'}}>{String(r.method||'hand').toUpperCase()}</td>
                    <td style={{padding:'8px 10px'}}>{String(r.status||'').toUpperCase()}</td>
                    <td style={{padding:'8px 10px'}}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</td>
                    <td style={{padding:'8px 10px'}}>
                      <div style={{display:'flex', gap:6}}>
                        <button className="btn" onClick={()=> setAcceptModal(r)}>View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Accept/Reject modal */}
      {acceptModal && (
        <Modal
          title="Manager Remittance"
          open={!!acceptModal}
          onClose={()=> setAcceptModal(null)}
          footer={
            <>
              <button className="btn secondary" onClick={()=> setAcceptModal(null)}>Close</button>
              {String(acceptModal.status||'').toLowerCase()==='pending' && (
                <>
                  <button className="btn danger" onClick={()=> acceptModal && rejectManagerRemit(String(acceptModal._id||''))}>Reject</button>
                  <button className="btn success" onClick={()=> acceptModal && acceptManagerRemit(String(acceptModal._id||''))}>Accept</button>
                </>
              )}
            </>
          }
        >
          <div style={{display:'grid', gap:8}}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:8}}>
              <Info label="Manager" value={userName(acceptModal.manager)} />
              <Info label="Country" value={acceptModal.country||'-'} />
              <Info label="Amount" value={`${acceptModal.currency||''} ${Number(acceptModal.amount||0).toFixed(2)}`} />
              <Info label="Method" value={String(acceptModal.method||'hand').toUpperCase()} />
              {acceptModal.paidToName ? <Info label="Paid To" value={acceptModal.paidToName} /> : null}
              {acceptModal.note ? <Info label="Note" value={acceptModal.note} /> : null}
              <Info label="Created" value={acceptModal.createdAt ? new Date(acceptModal.createdAt).toLocaleString() : '-'} />
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

      {/* History modal (per manager) */}
      {historyFor && (
        <Modal
          title="Manager Remittance History"
          open={!!historyFor}
          onClose={()=> setHistoryFor('')}
          footer={<button className="btn" onClick={()=> setHistoryFor('')}>Close</button>}
        >
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
              <thead><tr>
                <th style={{textAlign:'left', padding:'6px 8px'}}>Amount</th>
                <th style={{textAlign:'left', padding:'6px 8px'}}>Method</th>
                <th style={{textAlign:'left', padding:'6px 8px'}}>Status</th>
                <th style={{textAlign:'left', padding:'6px 8px'}}>Created</th>
              </tr></thead>
              <tbody>
                {filteredMgrRemits.map(r=> (
                  <tr key={String(r._id||r.id)} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'6px 8px'}}>{(r.currency||'') + ' ' + Number(r.amount||0).toFixed(2)}</td>
                    <td style={{padding:'6px 8px'}}>{String(r.method||'hand').toUpperCase()}</td>
                    <td style={{padding:'6px 8px'}}>{String(r.status||'').toUpperCase()}</td>
                    <td style={{padding:'6px 8px'}}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
