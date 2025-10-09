import React, { useEffect, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'

export default function DriverDashboard(){
  const nav = useNavigate()
  const [metrics, setMetrics] = useState({ totalAssignedAllTime: 0, status: { assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0 } })
  const [assigned, setAssigned] = useState([])
  const [payout, setPayout] = useState({ currency:'', totalCollectedAmount:0, deliveredToCompany:0, pendingToCompany:0 })
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [range, setRange] = useState('last7') // today | last7 | last30

  const rangeDates = React.useMemo(()=>{
    try{
      const now = new Date()
      const end = new Date(now); end.setHours(23,59,59,999)
      let from
      if (range==='today'){
        const s = new Date(now); s.setHours(0,0,0,0); from = s
      } else if (range==='last30'){
        const s = new Date(now); s.setDate(now.getDate()-29); s.setHours(0,0,0,0); from = s
      } else { // last7
        const s = new Date(now); s.setDate(now.getDate()-6); s.setHours(0,0,0,0); from = s
      }
      return { from: from.toISOString(), to: end.toISOString() }
    }catch{ return null }
  }, [range])
  const qsRangeBare = React.useMemo(()=>{
    try{ return (rangeDates && rangeDates.from && rangeDates.to) ? `fromDate=${encodeURIComponent(rangeDates.from)}&toDate=${encodeURIComponent(rangeDates.to)}` : '' }catch{ return '' }
  }, [rangeDates])
  const appendRange = (url)=> qsRangeBare ? (url + (url.includes('?') ? '&' : '?') + qsRangeBare) : url

  async function loadData(){
    setLoading(true)
    try{
      const [meRes, a, m, s] = await Promise.all([
        apiGet('/api/users/me').catch(()=>({})),
        apiGet(appendRange('/api/orders/driver/assigned')),
        apiGet(appendRange('/api/orders/driver/metrics')),
        apiGet(appendRange('/api/finance/remittances/summary')).catch(()=>({}))
      ])
      if (meRes && meRes.user) setUser(meRes.user)
      if (m && typeof m.totalAssignedAllTime === 'number' && m.status){
        setMetrics({
          totalAssignedAllTime: Number(m.totalAssignedAllTime||0),
          status: {
            assigned: Number(m.status.assigned||0),
            picked_up: Number(m.status.picked_up||0),
            in_transit: Number(m.status.in_transit||0),
            out_for_delivery: Number(m.status.out_for_delivery||0),
            delivered: Number(m.status.delivered||0),
            no_response: Number(m.status.no_response||0),
            returned: Number(m.status.returned||0),
            cancelled: Number(m.status.cancelled||0),
          }
        })
      } else {
        setMetrics({ totalAssignedAllTime: 0, status: { assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0 } })
      }
      if (s){
        setPayout({
          currency: s.currency||'',
          totalCollectedAmount: Number(s?.totalCollectedAmount||0),
          deliveredToCompany: Number(s?.deliveredToCompany||0),
          pendingToCompany: Number(s?.pendingToCompany||0),
        })
      }
      setAssigned((a.orders||[])
        .filter(o => String(o?.shipmentStatus||'').toLowerCase() !== 'picked_up')
        .slice(0,5))
    }catch{
      setMetrics({ totalAssignedAllTime: 0, status: { assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0 } })
      setAssigned([])
      setPayout({ currency:'', totalCollectedAmount:0, deliveredToCompany:0, pendingToCompany:0 })
    }finally{ setLoading(false) }
  }
  useEffect(()=>{ loadData() },[qsRangeBare])

  // Real-time: refresh counts on order events
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['polling'], upgrade:false, auth: { token }, withCredentials: true })
      const refresh = ()=>{ try{ loadData() }catch{} }
      socket.on('order.assigned', refresh)
      socket.on('order.updated', refresh)
      socket.on('order.shipped', refresh)
    }catch{}
    return ()=>{
      try{ socket && socket.off('order.assigned') }catch{}
      try{ socket && socket.off('order.updated') }catch{}
      try{ socket && socket.off('order.shipped') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[])

  const money = (v)=> `${payout.currency||''} ${Number(v||0).toFixed(2)}`
  const metricCards = [
    { key:'total_assigned_all', title:'Total Orders Assigned (All Time)', value: metrics.totalAssignedAllTime, to:null, color:'#0ea5e9' },
    { key:'assigned', title:'Currently Assigned', value: metrics.status.assigned, to:'/driver/orders/assigned', color:'#3b82f6' },
    { key:'picked_up', title:'Picked Up', value: metrics.status.picked_up, to:'/driver/orders/picked', color:'#f59e0b' },
    { key:'in_transit', title:'In Transit', value: metrics.status.in_transit, to:'/driver/orders/history?ship=in_transit', color:'#0284c7' },
    { key:'out_for_delivery', title:'Out for Delivery', value: metrics.status.out_for_delivery, to:'/driver/orders/history?ship=out_for_delivery', color:'#f97316' },
    { key:'delivered', title:'Delivered', value: metrics.status.delivered, to:'/driver/orders/delivered', color:'#10b981' },
    { key:'no_response', title:'No Response', value: metrics.status.no_response, to:'/driver/orders/history?ship=no_response', color:'#ef4444' },
    { key:'returned', title:'Returned', value: metrics.status.returned, to:'/driver/orders/history?ship=returned', color:'#737373' },
    { key:'cancelled', title:'Cancelled', value: metrics.status.cancelled, to:'/driver/orders/cancelled', color:'#b91c1c' },
  ]
  const deliveredCount = Number(metrics?.status?.delivered||0)
  const commissionPerOrder = Number(user?.commissionPerOrder||0)
  const commissionCurrency = (user?.commissionCurrency ? String(user.commissionCurrency).toUpperCase() : (payout.currency||'')).trim() || 'SAR'
  const walletDelivered = (commissionPerOrder>0 && deliveredCount>=0) ? (commissionPerOrder * deliveredCount) : 0
  const payoutCards = [
    { key:'wallet_delivered', title:'Wallet (Delivered Commission)', value: `${commissionCurrency} ${walletDelivered.toFixed(2)}`, to:'/driver/orders/delivered', color:'#22c55e' },
    { key:'collected_amount', title:'Total Collected (Delivered)', value: money(payout.totalCollectedAmount), to:'/driver/orders/delivered', color:'#0ea5e9' },
    { key:'delivered_company', title:'Delivered to Company', value: money(payout.deliveredToCompany), to:'/driver/payout#remittances', color:'#22c55e' },
    { key:'pending_company', title:'Pending Delivery to Company', value: money(payout.pendingToCompany), to:'/driver/payout#pay', color:'#f59e0b' },
  ]

  function orderCountryCurrency(c){
    const k = String(c||'')
    if (k==='KSA' || k==='Saudi Arabia') return 'SAR'
    if (k==='UAE' || k==='United Arab Emirates') return 'AED'
    if (k==='Oman' || k==='OM') return 'OMR'
    if (k==='Bahrain' || k==='BH') return 'BHD'
    if (k==='India' || k==='IN') return 'INR'
    if (k==='Kuwait' || k==='KW') return 'KWD'
    if (k==='Qatar' || k==='QA') return 'QAR'
    return 'SAR'
  }
  function fmtPrice(o){
    try{
      const qty = Math.max(1, Number(o?.quantity||1))
      const price = (o && o.total != null) ? Number(o.total||0) : Number(o?.productId?.price||0) * qty
      const cur = orderCountryCurrency(o?.orderCountry) || o?.productId?.baseCurrency || 'SAR'
      return `${cur} ${price.toFixed(2)}`
    }catch{ return 'SAR 0.00' }
  }

  async function markPicked(o){
    try{
      await apiPost(`/api/orders/${o._id||o.id}/shipment/update`, { shipmentStatus: 'picked_up' })
      await loadCounts()
    }catch(e){ alert(e?.message || 'Failed to mark picked up') }
  }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Driver Dashboard</div>
          <div className="page-subtitle">Overview of your delivery workload</div>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="section" style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:8}}>
        {[
          {k:'today', label:'Today'},
          {k:'last7', label:'Last 7 Days'},
          {k:'last30', label:'Last 30 Days'},
        ].map(opt=>{
          const active = range===opt.k
          return (
            <button key={opt.k} className={active? 'chip primary' : 'chip'} onClick={()=> setRange(opt.k)}
              style={{cursor:'pointer', border:'1px solid var(--border)', background: active? 'var(--panel-2)' : 'var(--panel)'}}>
              {opt.label}
            </button>
          )
        })}
      </div>

      <div className="card" style={{padding:16}}>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:12}}>
          {metricCards.map(c => (
            <button key={c.key} className="tile" onClick={()=> c.to ? nav(c.to) : null} style={{
              display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12
            }}>
              <div style={{fontSize:12, color:'var(--muted)'}}>{c.title}</div>
              <div style={{fontSize:28, fontWeight:800, color:c.color}}>{loading? '…' : c.value}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{padding:16}}>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:12}}>
          {payoutCards.map(c => (
            <button key={c.key} className="tile" onClick={()=> nav(c.to)} style={{
              display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12
            }}>
              <div style={{fontSize:12, color:'var(--muted)'}}>{c.title}</div>
              <div style={{fontSize:28, fontWeight:800, color:c.color}}>{loading? '…' : c.value}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:8, padding:16}}>
        <div className="card-title">Assigned Now</div>
        <div className="section" style={{display:'grid', gap:8}}>
          {assigned.length === 0 ? (
            <div className="helper">No current assigned orders</div>
          ) : assigned.map(o => (
            <div key={String(o._id||o.id)} style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px'}}>
              <div style={{display:'grid', gap:2}}>
                <div style={{fontWeight:700}}>#{o.invoiceNumber || String(o._id||'').slice(-6)}</div>
                <div className="helper" style={{fontSize:12}}>{o.customerName || 'Customer'} • {fmtPrice(o)}</div>
              </div>
              <button className="btn" onClick={()=> markPicked(o)}>Picked Up</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
