import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, apiGet, apiPost } from '../../api.js'
import { io } from 'socket.io-client'

function Badge({ status }){
  const s = String(status||'').toLowerCase()
  const style = s==='pending' ? {borderColor:'#f59e0b', color:'#b45309'} : (s==='approved' || s==='accepted' ? {borderColor:'#3b82f6', color:'#1d4ed8'} : {borderColor:'#10b981', color:'#065f46'})
  const label = s==='pending' ? 'Pending' : (s==='approved' || s==='accepted' ? (s==='approved'?'Approved':'Accepted') : 'Sent')
  return <span className="badge" style={style}>{label}</span>
}

export default function ManagerFinances(){
  const [drv, setDrv] = useState({ items: [], loading: true, page:1, hasMore:true })
  const [agt, setAgt] = useState({ items: [], loading: true, busyId:'', page:1, hasMore:true })
  const drvLoadingRef = useRef(false)
  const agtLoadingRef = useRef(false)
  const drvEndRef = useRef(null)
  const agtEndRef = useRef(null)
  const showAgentSection = false

  const [country, setCountry] = useState('')
  const [managerCountries, setManagerCountries] = useState([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [drivers, setDrivers] = useState([])
  const [driverRemits, setDriverRemits] = useState([])
  const [deliveredOrders, setDeliveredOrders] = useState([])
  const [countryOrders, setCountryOrders] = useState([])
  const [errStats, setErrStats] = useState('')

  async function loadDriverRemitsPage(page){
    if (drvLoadingRef.current) return
    drvLoadingRef.current = true
    try{
      const r = await apiGet(`/api/finance/remittances?page=${page}&limit=20`)
      const items = Array.isArray(r?.remittances)? r.remittances:[]
      setDrv(prev=> ({ items: page===1? items: [...prev.items, ...items], loading:false, page, hasMore: !!r?.hasMore }))
    }catch{ setDrv(prev=> ({ ...prev, loading:false, hasMore:false })) }
    finally{ drvLoadingRef.current = false }
  }
  async function loadAgentRemitsPage(page){
    if (agtLoadingRef.current) return
    agtLoadingRef.current = true
    try{
      const r = await apiGet(`/api/finance/agent-remittances?page=${page}&limit=20`)
      const items = Array.isArray(r?.remittances)? r.remittances:[]
      setAgt(prev=> ({ ...prev, items: page===1? items: [...prev.items, ...items], loading:false, page, hasMore: !!r?.hasMore }))
    }catch{ setAgt(prev=> ({ ...prev, loading:false, hasMore:false })) }
    finally{ agtLoadingRef.current = false }
  }
  useEffect(()=>{ loadDriverRemitsPage(1); loadAgentRemitsPage(1) },[])

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{
        const { user } = await apiGet('/api/users/me')
        const norm = (c)=> c==='Saudi Arabia' ? 'KSA' : (c==='United Arab Emirates' ? 'UAE' : c)
        const arr = Array.isArray(user?.assignedCountries) && user.assignedCountries.length ? user.assignedCountries.map(norm) : (user?.assignedCountry ? [norm(String(user.assignedCountry))] : [])
        if (!arr || !arr.length) { setManagerCountries([]); setCountry(''); return }
        if (alive){ setManagerCountries(arr); setCountry(arr[0]||'') }
      }catch{}
    })()
    return ()=>{ alive=false }
  },[])

  useEffect(()=>{
    if (!country) { setDrivers([]); setDeliveredOrders([]); setCountryOrders([]); setDriverRemits([]); return }
    let alive = true
    ;(async()=>{
      try{
        setLoadingStats(true)
        const lim = 200
        const loadDrivers = apiGet(`/api/users/drivers?country=${encodeURIComponent(country)}`).then(r=>{ if(alive) setDrivers(Array.isArray(r?.users)? r.users:[]) }).catch(()=>{ if(alive) setDrivers([]) })
        const loadRemits = apiGet('/api/finance/remittances').then(r=>{ const all = Array.isArray(r?.remittances)? r.remittances:[]; const filtered = all.filter(x=> String(x?.country||'').trim().toLowerCase()===String(country).trim().toLowerCase()); if(alive) setDriverRemits(filtered) }).catch(()=>{ if(alive) setDriverRemits([]) })
        const loadDelivered = (async()=>{
          let page=1, more=true, acc=[]
          while(more && page<=10){
            const q = new URLSearchParams(); q.set('country', country); q.set('ship','delivered'); q.set('page', String(page)); q.set('limit', String(lim))
            const r = await apiGet(`/api/orders?${q.toString()}`)
            const arr = Array.isArray(r?.orders)? r.orders:[]
            acc = acc.concat(arr); more = !!r?.hasMore; page+=1
          }
          if (alive) setDeliveredOrders(acc)
        })()
        const loadAll = (async()=>{
          let p=1, more=true, acc=[]
          while(more && p<=10){
            const q = new URLSearchParams(); q.set('country', country); q.set('page', String(p)); q.set('limit', String(lim))
            const r = await apiGet(`/api/orders?${q.toString()}`)
            const arr = Array.isArray(r?.orders)? r.orders:[]
            acc = acc.concat(arr); more = !!r?.hasMore; p+=1
          }
          if (alive) setCountryOrders(acc)
        })()
        await Promise.all([loadDrivers, loadRemits, loadDelivered, loadAll])
      }catch(e){ if(alive) setErrStats(e?.message||'Failed to load driver stats') }
      finally{ if(alive) setLoadingStats(false) }
    })()
    return ()=>{ alive=false }
  },[country])

  function normalizeShip(s){
    const n = String(s||'').toLowerCase().trim().replace(/\s+/g,'_').replace(/-/g,'_')
    if (n==='picked' || n==='pickedup' || n==='pick_up' || n==='pick-up' || n==='pickup') return 'picked_up'
    if (n==='shipped' || n==='contacted' || n==='attempted') return 'in_transit'
    if (n==='open') return 'open'
    return n
  }
  function orderNumericTotal(o){
    try{
      if (o && o.total != null && !Number.isNaN(Number(o.total))) return Number(o.total)
      if (Array.isArray(o?.items) && o.items.length){ let sum=0; for(const it of o.items){ const price=Number(it?.productId?.price||0); const qty=Math.max(1, Number(it?.quantity||1)); sum+=price*qty } return sum }
      const price = Number(o?.productId?.price||0); const qty = Math.max(1, Number(o?.quantity||1)); return price*qty
    }catch{ return 0 }
  }
  function collectedOf(o){ const c = Number(o?.collectedAmount); if (!Number.isNaN(c) && c>0) return c; const cod = Number(o?.codAmount); if (!Number.isNaN(cod) && cod>0) return cod; return orderNumericTotal(o) }

  const driverStats = useMemo(()=>{
    const map = new Map()
    for (const o of deliveredOrders){
      const did = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
      if (!did) continue
      if (!map.has(did)) map.set(did, { deliveredCount:0, collectedSum:0 })
      const s = map.get(did)
      s.deliveredCount += 1
      s.collectedSum += collectedOf(o)
    }
    return map
  }, [deliveredOrders])
  const driverAcceptedSum = useMemo(()=>{
    const by = new Map()
    for (const r of driverRemits){
      const st = String(r?.status||'')
      if (st==='accepted' || st==='received'){
        const id = String(r?.driver?._id || r?.driver || '')
        if (!id) continue
        if (!by.has(id)) by.set(id, 0)
        by.set(id, by.get(id) + Number(r?.amount||0))
      }
    }
    return by
  }, [driverRemits])
  const openAssignedByDriver = useMemo(()=>{
    const map = new Map()
    for (const o of countryOrders){
      const did = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
      if (!did) continue
      const ship = normalizeShip(o?.shipmentStatus || o?.status)
      const isOpen = ['pending','assigned','picked_up','in_transit','out_for_delivery','no_response'].includes(ship)
      if (!isOpen) continue
      if (!map.has(did)) map.set(did, 0)
      map.set(did, map.get(did) + 1)
    }
    return map
  }, [countryOrders])
  const totalAssignedByDriver = useMemo(()=>{
    const map = new Map()
    for (const o of countryOrders){
      const did = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
      if (!did) continue
      if (!map.has(did)) map.set(did, 0)
      map.set(did, map.get(did) + 1)
    }
    return map
  }, [countryOrders])
  const rows = useMemo(()=>{
    const arr = drivers.map(d => {
      const id = String(d?._id)
      const s = driverStats.get(id) || { deliveredCount:0, collectedSum:0 }
      const rem = driverAcceptedSum.get(id) || 0
      const variance = (s.collectedSum || 0) - (rem || 0)
      const openAssigned = openAssignedByDriver.get(id) || 0
      const totalAssigned = totalAssignedByDriver.get(id) || 0
      const perOrder = Number(d?.driverProfile?.commissionPerOrder||0)
      const commCur = d?.driverProfile?.commissionCurrency || ''
      const commissionTotal = (s.deliveredCount||0) * perOrder
      return { id, driver:d, openAssigned, totalAssigned, deliveredCount:s.deliveredCount||0, collectedSum:s.collectedSum||0, remittedSum:rem||0, wallet:variance, commissionCurrency: commCur, commissionPerOrder: perOrder, commissionTotal }
    })
    arr.sort((a,b)=> (b.wallet||0) - (a.wallet||0))
    return arr
  }, [drivers, driverStats, driverAcceptedSum, openAssignedByDriver, totalAssignedByDriver])
  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }

  // live sockets
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const refreshDrivers = ()=>{ try{ loadDriverRemitsPage(1) }catch{} }
      const refreshAgents = ()=>{ try{ loadAgentRemitsPage(1) }catch{} }
      socket.on('remittance.created', refreshDrivers)
      socket.on('agentRemit.created', refreshAgents)
      socket.on('agentRemit.approved', refreshAgents)
      socket.on('agentRemit.sent', refreshAgents)
    }catch{}
    return ()=>{
      try{ socket && socket.off('remittance.created') }catch{}
      try{ socket && socket.off('agentRemit.created') }catch{}
      try{ socket && socket.off('agentRemit.approved') }catch{}
      try{ socket && socket.off('agentRemit.sent') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[])

  // Infinite scroll observers
  useEffect(()=>{
    const el = drvEndRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries)=>{
      const [e] = entries
      if (e.isIntersecting && drv.hasMore && !drvLoadingRef.current){
        loadDriverRemitsPage(drv.page + 1)
      }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return ()=> { try{ obs.disconnect() }catch{} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drvEndRef.current, drv.hasMore, drv.page])

  useEffect(()=>{
    const el = agtEndRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries)=>{
      const [e] = entries
      if (e.isIntersecting && agt.hasMore && !agtLoadingRef.current){
        loadAgentRemitsPage(agt.page + 1)
      }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return ()=> { try{ obs.disconnect() }catch{} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agtEndRef.current, agt.hasMore, agt.page])

  // Actions
  async function setProof(id, ok){ try{ await apiPost(`/api/finance/remittances/${id}/proof`,{ ok }); await loadDriverRemitsPage(1) }catch(e){ alert(e?.message||'Failed to set proof') } }
  async function acceptRemit(id){ try{ await apiPost(`/api/finance/remittances/${id}/accept`,{}); await loadDriverRemitsPage(1) }catch(e){ alert(e?.message||'Failed to accept remittance') } }
  async function rejectRemit(id){ try{ await apiPost(`/api/finance/remittances/${id}/reject`,{}); await loadDriverRemitsPage(1) }catch(e){ alert(e?.message||'Failed to reject remittance') } }
  async function approveAgent(id){ try{ setAgt(a=>({ ...a, busyId:id })); await apiPost(`/api/finance/agent-remittances/${id}/approve`,{}); await loadAgentRemitsPage(1) }catch(e){ alert(e?.message||'Failed to approve') } finally{ setAgt(a=>({ ...a, busyId:'' })) } }
  async function sendAgent(id){ try{ setAgt(a=>({ ...a, busyId:id })); await apiPost(`/api/finance/agent-remittances/${id}/send`,{}); await loadAgentRemitsPage(1) }catch(e){ alert(e?.message||'Failed to mark as sent') } finally{ setAgt(a=>({ ...a, busyId:'' })) } }

  function waShareAgent(item){
    const phone = String(item?.agent?.phone||'').replace(/[^\d+]/g,'')
    const name = `${item?.agent?.firstName||''} ${item?.agent?.lastName||''}`.trim() || 'Agent'
    const text = encodeURIComponent(`Hi ${name}, your payout request of PKR ${Number(item.amount||0).toFixed(2)} is ${item.status==='approved'?'approved':'sent'}.`)
    if (phone) try{ window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer') }catch{}
  }
  function waShareDriver(r){
    const text = `Remittance Receipt\n\nDriver: ${r?.driver?.firstName||''} ${r?.driver?.lastName||''}\nCountry: ${r?.country||''}\nPeriod: ${(r?.fromDate? new Date(r.fromDate).toLocaleDateString():'-')} — ${(r?.toDate? new Date(r.toDate).toLocaleDateString():'-')}\nDeliveries: ${r?.totalDeliveredOrders||0}\nAmount: ${(r?.currency||'') + ' ' + Number(r?.amount||0).toFixed(2)}\nStatus: ${r?.status||'-'}\nCreated: ${r?.createdAt? new Date(r.createdAt).toLocaleString(): ''}`
    try{ window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer') }catch{}
  }

  const pendingDrivers = useMemo(()=> drv.items.filter(x=> String(x.status||'').toLowerCase()==='pending'), [drv.items])
  const actionableAgents = useMemo(()=> agt.items.filter(x=> ['pending','approved'].includes(String(x.status||'').toLowerCase())), [agt.items])

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span aria-hidden>{/* finance icon */}<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><path d="M6 14h4"/></svg></span>
          <div>
            <div className="page-title">Finances</div>
            <div className="page-subtitle">Manage Driver and Agent remittances</div>
          </div>
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header" style={{alignItems:'center', justifyContent:'space-between'}}>
          <div className="card-title">Driver Commission (by Country)</div>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <select className="input" value={country} onChange={e=> setCountry(e.target.value)}>
              <option value="">Select Country</option>
              {managerCountries.map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          {errStats && <div className="helper">{errStats}</div>}
          {!country ? (
            <div className="helper">Select a country to view driver stats</div>
          ) : loadingStats ? (
            <div className="helper">Loading…</div>
          ) : rows.length===0 ? (
            <div className="helper">No drivers found</div>
          ) : (
            <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
              <thead>
                <tr>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Driver</th>
                  <th style={{textAlign:'right', padding:'8px 10px'}}>Delivered</th>
                  <th style={{textAlign:'right', padding:'8px 10px'}}>Per Order</th>
                  <th style={{textAlign:'right', padding:'8px 10px'}}>Total Commission</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r=> (
                  <tr key={r.id} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'8px 10px'}}>{`${r.driver.firstName||''} ${r.driver.lastName||''}`.trim() || (r.driver.email||'-')}</td>
                    <td style={{padding:'8px 10px', textAlign:'right'}}>{num(r.deliveredCount)}</td>
                    <td style={{padding:'8px 10px', textAlign:'right'}}>{(r.commissionCurrency||'') + ' ' + num(r.commissionPerOrder)}</td>
                    <td style={{padding:'8px 10px', textAlign:'right', fontWeight:800}}>{(r.commissionCurrency||'') + ' ' + num(r.commissionTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Drivers Remittances */}
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header" style={{alignItems:'center', justifyContent:'space-between'}}>
          <div className="card-title">Drivers Remittances</div>
          <Link to="/manager/finances/history/drivers" className="btn light small">Go to history</Link>
        </div>
        <div className="section" style={{display:'grid', gap:10}}>
          {drv.loading ? (
            <div className="helper">Loading…</div>
          ) : pendingDrivers.length===0 ? (
            <div className="empty-state">No pending driver remittances</div>
          ) : (
            pendingDrivers.map(r=>{
              const id = String(r._id||r.id)
              const name = `${r?.driver?.firstName||''} ${r?.driver?.lastName||''}`.trim() || 'Driver'
              return (
                <div className="panel" style={{display:'grid', gap:8, padding:12}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{display:'grid', gap:2}}>
                      <div style={{fontWeight:800}}>{name}</div>
                      <div className="helper">Amount: {(r?.currency||'') + ' ' + Number(r?.amount||0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="helper">Delivered Orders: {r?.totalDeliveredOrders||0} • Country: {r?.country||'-'}</div>
                  <div className="helper">
                    Method: {(r?.method||'hand').toUpperCase()} {r?.receiptPath ? (
                      <>
                        • <a href={`${API_BASE}${r.receiptPath}`} target="_blank" rel="noopener noreferrer" download>Download Proof</a>
                      </>
                    ) : null}
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <div className="helper">Proof Verified:</div>
                    <div style={{display:'flex', gap:6}}>
                      <button className={`btn small ${r?.proofOk===true?'':'secondary'}`} onClick={()=> setProof(id, true)}>Yes</button>
                      <button className={`btn small ${r?.proofOk===false?'':'secondary'}`} onClick={()=> setProof(id, false)}>No</button>
                    </div>
                  </div>
                  <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                    <button className="btn" onClick={()=> acceptRemit(id)}>Accept</button>
                    <button className="btn secondary" onClick={()=> rejectRemit(id)}>Reject</button>
                    <button className="btn secondary" onClick={()=> waShareDriver(r)}>WhatsApp</button>
                  </div>
                </div>
              )
            })
          )}
          <div ref={drvEndRef} />
        </div>
      </div>

      {/* Agent Remittances (hidden) */}
      {showAgentSection && (
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header" style={{alignItems:'center', justifyContent:'space-between'}}>
          <div className="card-title">Agent Remittances</div>
          <Link to="/manager/finances/history/agents" className="btn light small">Go to history</Link>
        </div>
        <div className="section" style={{display:'grid', gap:10}}>
          {agt.loading ? (
            <div className="helper">Loading…</div>
          ) : actionableAgents.length===0 ? (
            <div className="empty-state">No pending/approved agent remittances</div>
          ) : (
            actionableAgents.map(it=>{
              const id = String(it._id||it.id)
              const name = `${it?.agent?.firstName||''} ${it?.agent?.lastName||''}`.trim() || 'Agent'
              const pending = String(it.status).toLowerCase()==='pending'
              const approved = String(it.status).toLowerCase()==='approved'
              const busy = agt.busyId===id
              return (
                <div key={id} className="panel" style={{display:'grid', gap:8, padding:12}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{display:'grid', gap:2}}>
                      <div style={{fontWeight:800}}>{name}</div>
                      <div className="helper">Amount: PKR {Number(it?.amount||0).toFixed(2)}</div>
                    </div>
                    <Badge status={it.status} />
                  </div>
                  <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                    <button className="btn secondary" disabled={!pending || busy} onClick={()=> approveAgent(id)}>{busy? 'Working…':'Approve'}</button>
                    <button className="btn" disabled={!approved || busy} onClick={()=> sendAgent(id)}>{busy? 'Working…':'Mark as Sent'}</button>
                    <button className="btn light" onClick={()=> waShareAgent(it)}>WhatsApp</button>
                  </div>
                </div>
              )
            })
          )}
          <div ref={agtEndRef} />
        </div>
      </div>
      )}
    </div>
  )
}
