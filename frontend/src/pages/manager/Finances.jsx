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
  async function acceptDriverRemit(id){ try{ await apiPost(`/api/finance/remittances/${id}/accept`,{}); await loadDriverRemitsPage(1) }catch(e){ alert(e?.message||'Failed to accept') } }
  async function rejectDriverRemit(id){ try{ await apiPost(`/api/finance/remittances/${id}/reject`,{}); await loadDriverRemitsPage(1) }catch(e){ alert(e?.message||'Failed to reject') } }
  async function setProof(id, ok){ try{ await apiPost(`/api/finance/remittances/${id}/proof`,{ ok }); await loadDriverRemitsPage(1) }catch(e){ alert(e?.message||'Failed to set proof') } }
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
                    <button className="btn" onClick={()=> acceptDriverRemit(id)}>Accept</button>
                    <button className="btn light" onClick={()=> rejectDriverRemit(id)}>Reject</button>
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
