import React, { useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'
import Modal from '../../components/Modal.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function ManagerFinances(){
  const toast = useToast()
  const [countryOptions, setCountryOptions] = useState([])
  const [country, setCountry] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [driverRemits, setDriverRemits] = useState([]) // accepted driver->manager
  const [mgrRemits, setMgrRemits] = useState([]) // manager->owner requests of all statuses
  const [acceptModal, setAcceptModal] = useState(null)

  // Countries
  useEffect(()=>{
    (async()=>{
      try{
        const r = await apiGet('/api/orders/options')
        const arr = Array.isArray(r?.countries) ? r.countries : []
        const map = new Map()
        for (const c of arr){ const raw=String(c||'').trim(); const key=raw.toLowerCase(); if(!map.has(key)) map.set(key, raw.toUpperCase()==='UAE'?'UAE':raw) }
        setCountryOptions(Array.from(map.values()))
      }catch{ setCountryOptions([]) }
    })()
  },[])

  // Load remittances for country
  async function loadAll(){
    setLoading(true); setErr('')
    try{
      // Driver->Manager accepted remittances, owner scope
      const dList = []
      let page=1, hasMore=true
      while(hasMore && page<=10){
        const url = `/api/finance/remittances?workspace=1&page=${page}&limit=200`
        const r = await apiGet(url)
        const arr = Array.isArray(r?.remittances)? r.remittances: []
        dList.push(...arr)
        hasMore = !!r?.hasMore
        page+=1
      }
      const filteredD = dList.filter(x=> String(x?.status||'').toLowerCase()==='accepted')
        .filter(x=> country? String(x?.country||'').trim().toLowerCase()===String(country).trim().toLowerCase(): true)
        .filter(x=> (fromDate||toDate) ? dateInRange(x?.acceptedAt||x?.createdAt, fromDate, toDate): true)
      setDriverRemits(filteredD)

      // Manager->Owner remittances
      const mList = []
      page=1; hasMore=true
      while(hasMore && page<=10){
        const q = new URLSearchParams(); if(country) q.set('country', country); q.set('page', String(page)); q.set('limit','200')
        const r = await apiGet(`/api/finance/manager-remittances?${q.toString()}`)
        const arr = Array.isArray(r?.remittances)? r.remittances: []
        mList.push(...arr)
        hasMore = !!r?.hasMore
        page+=1
      }
      const filteredM = mList.filter(x=> (fromDate||toDate) ? dateInRange(x?.acceptedAt||x?.createdAt, fromDate, toDate): true)
      setMgrRemits(filteredM)
    }catch(e){ setErr(e?.message||'Failed to load data') }
    finally{ setLoading(false) }
  }
  useEffect(()=>{ if(country) loadAll() }, [country, fromDate, toDate])

  // Live updates
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token')||''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const onChange = ()=>{ loadAll().catch(()=>{}) }
      socket.on('remittance.accepted', onChange)
      socket.on('mgrRemit.created', onChange)
      socket.on('mgrRemit.accepted', onChange)
      socket.on('mgrRemit.rejected', onChange)
    }catch{}
    return ()=>{ try{ socket && socket.disconnect() }catch{} }
  }, [country, fromDate, toDate])

  // Aggregations per manager
  const rows = useMemo(()=>{
    const by = new Map()
    for(const r of driverRemits){
      const mid = String(r?.manager?._id || r?.manager || '')
      if(!mid) continue
      if(!by.has(mid)) by.set(mid, { id: mid, manager: r.manager, country: r.country||country||'', fromDrivers:0, sentToCompany:0 })
      by.get(mid).fromDrivers += Number(r?.amount||0)
    }
    for(const m of mgrRemits){
      const mid = String(m?.manager?._id || m?.manager || '')
      if(!mid) continue
      if(!by.has(mid)) by.set(mid, { id: mid, manager: m.manager, country: m.country||country||'', fromDrivers:0, sentToCompany:0 })
      if (String(m?.status||'').toLowerCase()==='accepted') by.get(mid).sentToCompany += Number(m?.amount||0)
    }
    const out = Array.from(by.values()).map(x=> ({ ...x, pendingToCompany: Math.max(0, (x.fromDrivers||0) - (x.sentToCompany||0)) }))
    out.sort((a,b)=> (b.pendingToCompany||0) - (a.pendingToCompany||0))
    return out
  }, [driverRemits, mgrRemits, country])

  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function userName(u){ if (!u) return '-'; return `${u.firstName||''} ${u.lastName||''}`.trim() || (u.email||'-') }
  function dateInRange(d, from, to){ try{ if (!d) return false; const t = new Date(d).getTime(); if (from){ const f = new Date(from).setHours(0,0,0,0); if (t < f) return false } if (to){ const tt = new Date(to).setHours(23,59,59,999); if (t > tt) return false } return true }catch{ return true } }

  async function acceptManagerRemit(id){ try{ await apiPost(`/api/finance/manager-remittances/${id}/accept`,{}); toast.success('Accepted'); await loadAll() }catch(e){ toast.error(e?.message||'Failed to accept') } }
  async function rejectManagerRemit(id){ try{ await apiPost(`/api/finance/manager-remittances/${id}/reject`,{}); toast.warn('Rejected'); await loadAll() }catch(e){ toast.error(e?.message||'Failed to reject') } }

  const pendingList = useMemo(()=> mgrRemits.filter(m=> String(m?.status||'').toLowerCase()==='pending'), [mgrRemits])

  return (
    <div className="content" style={{ display:'grid', gap:16, padding:16 }}>
      <div style={{ display:'grid', gap:6 }}>
        <div className="page-title gradient heading-blue">Manager Finances</div>
        <div className="page-subtitle">Total received from drivers and manager remittances to company</div>
      </div>

      <div className="card" style={{ display:'grid', gap:10 }}>
        <div className="card-header"><div className="card-title">Filters</div></div>
        <div className="section" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
          <select className="input" value={country} onChange={e=> setCountry(e.target.value)}>
            <option value=''>Select Country</option>
            {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="input" type="date" value={fromDate} onChange={e=> setFromDate(e.target.value)} />
          <input className="input" type="date" value={toDate} onChange={e=> setToDate(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontWeight: 700 }}>Managers {country ? `in ${country}` : ''}</div>
        </div>
        <div style={{ overflowX:'auto' }}>
          {loading ? (
            <div className="section">Loading…</div>
          ) : err ? (
            <div className="section error">{err}</div>
          ) : rows.length===0 ? (
            <div className="section">No data</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
              <thead>
                <tr>
                  <th style={{ padding:'10px 12px', textAlign:'left' }}>Manager</th>
                  <th style={{ padding:'10px 12px', textAlign:'left' }}>Country</th>
                  <th style={{ padding:'10px 12px', textAlign:'right', color:'#22c55e' }}>From Drivers</th>
                  <th style={{ padding:'10px 12px', textAlign:'right', color:'#22c55e' }}>Sent to Company</th>
                  <th style={{ padding:'10px 12px', textAlign:'right', color:'#ef4444' }}>Pending to Company</th>
                  <th style={{ padding:'10px 12px', textAlign:'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx)=> (
                  <tr key={r.id} style={{ borderTop:'1px solid var(--border)', background: idx % 2 ? 'transparent' : 'var(--panel)' }}>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ fontWeight:700 }}>{userName(r.manager)}</div>
                      <div className="helper">{r.manager?.email||''}</div>
                    </td>
                    <td style={{ padding:'10px 12px' }}>{r.country||country||'-'}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:'#22c55e', fontWeight:800 }}>{num(r.fromDrivers)}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:'#22c55e', fontWeight:800 }}>{num(r.sentToCompany)}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', color:'#ef4444', fontWeight:800 }}>{num(r.pendingToCompany)}</td>
                    <td style={{ padding:'10px 12px' }}>
                      {(()=>{
                        const p = pendingList.find(x=> String(x?.manager?._id||x?.manager||'')===r.id)
                        if (!p) return <span className="helper">—</span>
                        return <button className="btn" onClick={()=> setAcceptModal(p)}>Accept Pending</button>
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {acceptModal && (
        <Modal
          title="Accept Manager Remittance"
          open={!!acceptModal}
          onClose={()=> setAcceptModal(null)}
          footer={
            <>
              <button className="btn secondary" onClick={()=> setAcceptModal(null)}>Close</button>
              <button className="btn danger" onClick={async()=>{ const id=String(acceptModal?._id||''); await rejectManagerRemit(id); setAcceptModal(null) }}>Reject</button>
              <button className="btn success" onClick={async()=>{ const id=String(acceptModal?._id||''); await acceptManagerRemit(id); setAcceptModal(null) }}>Accept</button>
            </>
          }
        >
          <div style={{display:'grid', gap:8}}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:8}}>
              <Info label="Manager" value={userName(acceptModal?.manager)} />
              <Info label="Country" value={acceptModal?.country||country||'-'} />
              <Info label="Amount" value={`${acceptModal?.currency||''} ${Number(acceptModal?.amount||0).toFixed(2)}`} />
              <Info label="Method" value={String(acceptModal?.method||'hand').toUpperCase()} />
              {acceptModal?.note ? <Info label="Note" value={acceptModal?.note} /> : null}
              <Info label="Created" value={acceptModal?.createdAt ? new Date(acceptModal.createdAt).toLocaleString() : '-'} />
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
