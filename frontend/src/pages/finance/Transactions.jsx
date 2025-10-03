import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet } from '../../api'
import { io } from 'socket.io-client'

export default function Transactions(){
  const [agentRemits, setAgentRemits] = useState([])
  const [driverRemits, setDriverRemits] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(()=>{ refresh() },[])
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token')||''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const reload = ()=>{ try{ refresh() }catch{} }
      socket.on('agentRemit.created', reload)
      socket.on('agentRemit.approved', reload)
      socket.on('agentRemit.sent', reload)
      socket.on('remittance.created', reload)
      socket.on('remittance.accepted', reload)
      socket.on('orders.changed', reload)
    }catch{}
    return ()=>{ try{ socket && socket.off('agentRemit.created') }catch{}; try{ socket && socket.off('agentRemit.approved') }catch{}; try{ socket && socket.off('agentRemit.sent') }catch{}; try{ socket && socket.off('remittance.created') }catch{}; try{ socket && socket.off('remittance.accepted') }catch{}; try{ socket && socket.off('orders.changed') }catch{}; try{ socket && socket.disconnect() }catch{} }
  },[])

  async function refresh(){
    setLoading(true)
    setErr('')
    try{
      const [a, d, o] = await Promise.all([
        apiGet('/api/finance/agent-remittances'),
        apiGet('/api/finance/remittances'),
        apiGet('/api/orders'),
      ])
      setAgentRemits(Array.isArray(a?.remittances)? a.remittances:[])
      setDriverRemits(Array.isArray(d?.remittances)? d.remittances:[])
      setOrders(Array.isArray(o?.orders)? o.orders:[])
    }catch(e){ setErr(e?.message || 'Failed to load transactions') }
    finally{ setLoading(false) }
  }

  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function userName(u){ if (!u) return '-'; return `${u.firstName||''} ${u.lastName||''}`.trim() || (u.email||'-') }
  function msToFriendly(ms){ if (!ms || ms<0) return '-'; const s = Math.floor(ms/1000); if (s<60) return `${s}s`; const m=Math.floor(s/60); if (m<60) return `${m}m`; const h=Math.floor(m/60); if (h<24) return `${h}h ${m%60}m`; const d=Math.floor(h/24); return `${d}d ${h%24}h` }

  function priceOf(o){
    const qty = Math.max(1, Number(o?.quantity||1))
    if (o?.total != null) return Number(o.total)
    const unit = Number(o?.productId?.price||0)
    return unit * qty
  }

  // Build per-agent order metrics
  const agentOrderStats = useMemo(()=>{
    const map = new Map()
    for (const o of orders){
      const createdBy = String(o?.createdBy?._id || o?.createdBy || '')
      const role = o?.createdBy?.role || o?.createdByRole || ''
      if (!createdBy || String(role) !== 'agent') continue
      if (!map.has(createdBy)) map.set(createdBy, { total:0, delivered:0, deliveredSum:0 })
      const s = map.get(createdBy)
      s.total += 1
      if (String(o?.shipmentStatus||'').toLowerCase()==='delivered'){
        s.delivered += 1
        s.deliveredSum += priceOf(o)
      }
    }
    return map
  }, [orders])

  // Build per-agent sent totals (sum of sent remits)
  const agentSentTotals = useMemo(()=>{
    const by = new Map()
    for (const r of agentRemits){
      if (r?.status === 'sent'){
        const id = String(r?.agent?._id || r?.agent || '')
        if (!by.has(id)) by.set(id, 0)
        by.set(id, by.get(id) + Number(r?.amount||0))
      }
    }
    return by
  }, [agentRemits])

  // Agent table totals
  const totalsAgent = useMemo(()=>{
    let requested=0, count=agentRemits.length
    for (const r of agentRemits){ requested += Number(r?.amount||0) }
    return { count, requested }
  }, [agentRemits])

  // Driver table totals
  const totalsDriver = useMemo(()=>{
    let requested=0, count=driverRemits.length, deliveredOrders=0
    for (const r of driverRemits){ requested += Number(r?.amount||0); deliveredOrders += Number(r?.totalDeliveredOrders||0) }
    return { count, requested, deliveredOrders }
  }, [driverRemits])

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header"><div className="page-title">Transactions</div><div className="page-subtitle">Agent and Driver remittance requests with integrated metrics</div></div>
      {err && <div className="error">{err}</div>}

      {/* Agent Remittances */}
      <div className="card">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
          <div style={{fontWeight:700}}>Agent Requests</div>
          <div className="helper">Requests: {totalsAgent.count.toLocaleString()} • Total Requested (PKR): {num(totalsAgent.requested)}</div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
            <thead>
              <tr>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Agent</th>
                <th style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>Requested (PKR)</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Status</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Approver</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Response Time</th>
                <th style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>Agent Orders</th>
                <th style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>Delivered Orders</th>
                <th style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>Delivered Total</th>
                <th style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>Sent Total (PKR)</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Approved</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Sent</th>
                <th style={{padding:'10px 12px', textAlign:'left'}}>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} style={{padding:'10px 12px', opacity:0.7}}>Loading...</td></tr>
              ) : agentRemits.length === 0 ? (
                <tr><td colSpan={12} style={{padding:'10px 12px', opacity:0.7}}>No requests</td></tr>
              ) : (
                agentRemits.map((r, idx)=>{
                  const agentId = String(r?.agent?._id || r?.agent || '')
                  const st = agentOrderStats.get(agentId) || { total:0, delivered:0, deliveredSum:0 }
                  const sentTotal = agentSentTotals.get(agentId) || 0
                  const created = r?.createdAt ? new Date(r.createdAt) : null
                  const responded = r?.approvedAt ? new Date(r.approvedAt) : (r?.sentAt ? new Date(r.sentAt) : null)
                  const rtime = (created && responded) ? (responded.getTime() - created.getTime()) : null
                  return (
                    <tr key={r._id} style={{borderTop:'1px solid var(--border)', background: idx%2? 'transparent':'var(--panel)'}}>
                      <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{userName(r.agent)}<div className="helper">{r.agent?.email||''}</div></td>
                      <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(r.amount)}</td>
                      <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{r.status}</td>
                      <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{r.approverRole}: {String(r.approver||'').slice(-6)}</td>
                      <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{msToFriendly(rtime)}</td>
                      <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{st.total}</td>
                      <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{st.delivered}</td>
                      <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(st.deliveredSum)}</td>
                      <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(sentTotal)}</td>
                      <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{r.approvedAt? new Date(r.approvedAt).toLocaleString(): '-'}</td>
                      <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{r.sentAt? new Date(r.sentAt).toLocaleString(): '-'}</td>
                      <td style={{padding:'10px 12px'}}>{r.createdAt? new Date(r.createdAt).toLocaleString(): ''}</td>
                    </tr>
                  )
                })
              )}
              {!loading && agentRemits.length>0 && (
                <tr style={{borderTop:'2px solid var(--border)', background:'rgba(59,130,246,0.08)'}}>
                  <td style={{padding:'10px 12px', fontWeight:800}}>Totals</td>
                  <td style={{padding:'10px 12px', textAlign:'right', fontWeight:800}}>{num(totalsAgent.requested)}</td>
                  <td colSpan={10}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Driver Remittances */}
      <div className="card">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
          <div style={{fontWeight:700}}>Driver Remittances</div>
          <div className="helper">Requests: {totalsDriver.count.toLocaleString()} • Total Requested: {num(totalsDriver.requested)} • Delivered Orders: {num(totalsDriver.deliveredOrders)}</div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
            <thead>
              <tr>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Driver</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Country</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Currency</th>
                <th style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>Amount</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Status</th>
                <th style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>Delivered Orders</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>From</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>To</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Note</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Accepted</th>
                <th style={{padding:'10px 12px', textAlign:'left'}}>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{padding:'10px 12px', opacity:0.7}}>Loading...</td></tr>
              ) : driverRemits.length === 0 ? (
                <tr><td colSpan={11} style={{padding:'10px 12px', opacity:0.7}}>No remittances</td></tr>
              ) : (
                driverRemits.map((r, idx)=> (
                  <tr key={r._id} style={{borderTop:'1px solid var(--border)', background: idx%2? 'transparent':'var(--panel)'}}>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{userName(r.driver)}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{r.country||'-'}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{r.currency||'-'}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(r.amount)}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{r.status}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(r.totalDeliveredOrders||0)}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{r.fromDate? new Date(r.fromDate).toLocaleDateString(): '-'}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{r.toDate? new Date(r.toDate).toLocaleDateString(): '-'}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{r.note||'-'}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{r.acceptedAt? new Date(r.acceptedAt).toLocaleString(): '-'}</td>
                    <td style={{padding:'10px 12px'}}>{r.createdAt? new Date(r.createdAt).toLocaleString(): ''}</td>
                  </tr>
                ))
              )}
              {!loading && driverRemits.length>0 && (
                <tr style={{borderTop:'2px solid var(--border)', background:'rgba(59,130,246,0.08)'}}>
                  <td style={{padding:'10px 12px', fontWeight:800}}>Totals</td>
                  <td></td>
                  <td></td>
                  <td style={{padding:'10px 12px', textAlign:'right', fontWeight:800}}>{num(totalsDriver.requested)}</td>
                  <td></td>
                  <td style={{padding:'10px 12px', textAlign:'right', fontWeight:800}}>{num(totalsDriver.deliveredOrders)}</td>
                  <td colSpan={5}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// old helpers removed with ledger
