import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE, apiGet } from '../../api'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode, aedToPKR } from '../../util/currency'

export default function AgentDashboard(){
  const navigate = useNavigate()
  const toast = useToast()
  const me = useMemo(()=>{
    try{ return JSON.parse(localStorage.getItem('me')||'{}') }catch{ return {} }
  },[])
  const [loading, setLoading] = useState(true)
  const [assignedCount, setAssignedCount] = useState(0)
  // Orders for metrics
  const [orders, setOrders] = useState([])
  const [avgResponseSeconds, setAvgResponseSeconds] = useState(null)
  const [ordersSubmittedOverride, setOrdersSubmittedOverride] = useState(null)
  // Agent-submitted status counts
  const [statusCounts, setStatusCounts] = useState({ total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0 })
  const [currencyCfg, setCurrencyCfg] = useState(null) // normalized { anchor:'AED', perAED, enabled }
  const [walletAED, setWalletAED] = useState(0)
  const [walletPKR, setWalletPKR] = useState(0)

  // Load metrics for the signed-in agent
  async function load(){
    setLoading(true)
    try{
      const [meRes, chats, ordRes, perf, cfg] = await Promise.all([
        apiGet('/api/users/me').catch(()=>({})),
        apiGet('/api/wa/chats').catch(()=>[]),
        apiGet('/api/orders').catch(()=>({ orders: [] })),
        apiGet('/api/users/agents/me/performance').catch(()=>({})),
        getCurrencyConfig().catch(()=>null),
      ])
      // meRes.user available for id checks below
      const chatList = Array.isArray(chats) ? chats : []
      setAssignedCount(chatList.length)
      const allOrders = Array.isArray(ordRes?.orders) ? ordRes.orders : []
      setOrders(allOrders)
      if (typeof perf?.avgResponseSeconds === 'number') setAvgResponseSeconds(perf.avgResponseSeconds)
      if (typeof perf?.ordersSubmitted === 'number') setOrdersSubmittedOverride(perf.ordersSubmitted)
      if (cfg) setCurrencyCfg(cfg)
      // compute status counts for orders submitted by this agent
      try{
        const meId = String((meRes?.user?._id) || (me?._id) || '')
        const mine = (Array.isArray(allOrders)? allOrders: []).filter(o => {
          const createdBy = String(o?.createdBy?._id || o?.createdBy || '')
          return createdBy && createdBy === meId
        })
        const init = { total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0 }
        const next = mine.reduce((acc, o)=>{
          acc.total += 1
          const s = String(o?.shipmentStatus||'').toLowerCase()
          if (acc[s] != null){ acc[s] += 1 }
          else { acc.pending += 1 }
          return acc
        }, init)
        setStatusCounts(next)
        // compute wallet from agent-submitted orders -> convert each to AED then sum, then convert total to PKR
        function orderTotal(o){
          try{
            if (o && o.total != null) return Number(o.total||0)
            if (Array.isArray(o?.items) && o.items.length){
              return o.items.reduce((s,it)=> s + (Number(it?.productId?.price||0) * Math.max(1, Number(it?.quantity||1))), 0)
            }
            const unit = Number(o?.productId?.price||0)
            return unit * Math.max(1, Number(o?.quantity||1))
          }catch{ return 0 }
        }
        function baseCur(o){
          if (Array.isArray(o?.items) && o.items.length){ return o.items[0]?.productId?.baseCurrency || 'SAR' }
          return (o?.productId?.baseCurrency) || 'SAR'
        }
        // Wallet: 12% commission on DELIVERED orders only
        let deliveredAED = 0
        for (const o of mine){
          const st = String(o?.shipmentStatus||'').toLowerCase()
          if (st !== 'delivered') continue
          const amt = orderTotal(o)
          const curCode = String(baseCur(o) || 'SAR').toUpperCase()
          const amtAED = toAEDByCode(amt, curCode, cfg)
          deliveredAED += amtAED
        }
        const commissionAED = deliveredAED * 0.12
        setWalletAED(commissionAED)
        setWalletPKR(aedToPKR(commissionAED, cfg))
      }catch{}
    }finally{ setLoading(false) }
  }

  useEffect(()=>{ load() },[])
  // Removed recent orders infinite scroll and related fetches from dashboard

  // Fallback: periodic polling to keep data fresh even if socket misses an event
  useEffect(()=>{
    const id = setInterval(()=>{ load() }, 20000) // 20s
    function onVis(){ if (document.visibilityState === 'visible') load() }
    window.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return ()=>{ clearInterval(id); window.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis) }
  },[])

  // Live refresh on order changes across the workspace
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['polling'], upgrade: false, auth: { token }, withCredentials: true })
      socket.on('orders.changed', (payload={})=>{
        load()
        try{
          const { orderId, invoiceNumber, action, status } = payload
          let msg = null
          const code = invoiceNumber ? `#${invoiceNumber}` : `#${String(orderId||'').slice(-5)}`
          if (action === 'delivered') msg = `Order ${code} delivered`
          else if (action === 'assigned') msg = `Order ${code} assigned`
          else if (action === 'cancelled') msg = `Order ${code} cancelled`
          else if (action === 'shipment_updated'){
            const label = (status === 'picked_up') ? 'picked up' : (String(status||'').replace('_',' '))
            msg = `Shipment ${label} (${code})`
          }
          if (msg) toast.info(msg)
        }catch{}
      })
    }catch{}
    return ()=>{
      try{ socket && socket.off('orders.changed') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[toast])

  // Derived metrics
  const ordersSubmitted = ordersSubmittedOverride != null ? ordersSubmittedOverride : statusCounts.total

  // Build driver-like tiles for status counts (agent submitted)
  const statusTiles = [
    { key:'total', title:'Total Orders (Submitted)', value: ordersSubmitted, color:'#0ea5e9', to:'/agent/orders' },
    { key:'pending', title:'Pending', value: statusCounts.pending, color:'#64748b', to:'/agent/orders?ship=pending' },
    { key:'assigned', title:'Assigned', value: statusCounts.assigned, color:'#3b82f6', to:'/agent/orders?ship=assigned' },
    { key:'picked_up', title:'Picked Up', value: statusCounts.picked_up, color:'#f59e0b', to:'/agent/orders?ship=picked_up' },
    { key:'in_transit', title:'In Transit', value: statusCounts.in_transit, color:'#0284c7', to:'/agent/orders?ship=in_transit' },
    { key:'out_for_delivery', title:'Out for Delivery', value: statusCounts.out_for_delivery, color:'#f97316', to:'/agent/orders?ship=out_for_delivery' },
    { key:'delivered', title:'Delivered', value: statusCounts.delivered, color:'#10b981', to:'/agent/orders?ship=delivered' },
    { key:'no_response', title:'No Response', value: statusCounts.no_response, color:'#ef4444', to:'/agent/orders?ship=no_response' },
    { key:'returned', title:'Returned', value: statusCounts.returned, color:'#737373', to:'/agent/orders?ship=returned' },
    { key:'cancelled', title:'Cancelled', value: statusCounts.cancelled, color:'#b91c1c', to:'/agent/orders?ship=cancelled' },
  ]

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-green">Agent Dashboard</div>
          <div className="page-subtitle">Overview of your chats and orders you submitted</div>
        </div>
      </div>

      {/* Top metrics (like driver tiles) */}
      <div className="card" style={{padding:16}}>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px,1fr))', gap:12}}>
          <div className="tile" style={{display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:8, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div>
              <div style={{fontSize:12, color:'var(--muted)'}}>Assigned Chats</div>
              <div style={{fontSize:28, fontWeight:800, color:'#3b82f6'}}>{loading? '…' : assignedCount}</div>
            </div>
            <button className="btn" onClick={()=> navigate('/agent/inbox/whatsapp')}>Go to Chats</button>
          </div>
          <div className="tile" style={{display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:8, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div>
              <div style={{fontSize:12, color:'var(--muted)'}}>Orders Submitted</div>
              <div style={{fontSize:28, fontWeight:800, color:'#10b981'}}>{loading? '…' : ordersSubmitted}</div>
            </div>
            <button className="btn secondary" onClick={()=> navigate('/agent/orders/history')}>Order History</button>
          </div>
          <div className="tile" style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div style={{fontSize:12, color:'var(--muted)'}}>Avg. Response Time</div>
            <div style={{fontSize:28, fontWeight:800, color:'#f59e0b'}}>{avgResponseSeconds!=null? formatDuration(avgResponseSeconds) : '—'}</div>
          </div>
        </div>
      </div>

      {/* Wallet amount */}
      <div className="card" style={{padding:16}}>
        <div className="card-title" style={{marginBottom:8}}>Wallet Amount</div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:12}}>
          <div className="tile" style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div className="helper">Total (AED)</div>
            <div style={{fontSize:28, fontWeight:800, color:'#2563eb'}}>{Math.round(walletAED).toLocaleString()}</div>
          </div>
          <div className="tile" style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div className="helper">Total (PKR)</div>
            <div style={{fontSize:28, fontWeight:800, color:'#0ea5e9'}}>{Math.round(walletPKR).toLocaleString()}</div>
          </div>
        </div>
        <div className="helper" style={{marginTop:8}}>12% commission on delivered orders only. We convert each delivered order to AED using User Panel rates, sum, take 12%, then convert that commission to PKR. Order History shows amounts in original currencies.</div>
      </div>

      {/* Order status metrics for agent-submitted orders */}
      <div className="card" style={{padding:16}}>
        <div className="card-title" style={{marginBottom:8}}>Your Orders by Status</div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:12}}>
          {statusTiles.map(c => (
            <button key={c.key} className="tile" onClick={()=> c.to ? navigate(c.to) : null} style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
              <div style={{fontSize:12, color:'var(--muted)'}}>{c.title}</div>
              <div style={{fontSize:28, fontWeight:800, color:c.color}}>{loading? '…' : c.value}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatDuration(seconds){
  const s = Math.max(0, Math.round(seconds||0))
  const m = Math.floor(s/60), r = s%60
  if (m>0) return `${m}m ${r}s`
  return `${r}s`
}

// removed currency breakdown and formatting helpers (no longer used)
