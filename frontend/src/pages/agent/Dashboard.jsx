import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE, apiGet } from '../../api'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'

export default function AgentDashboard(){
  const navigate = useNavigate()
  const toast = useToast()
  const me = useMemo(()=>{
    try{ return JSON.parse(localStorage.getItem('me')||'{}') }catch{ return {} }
  },[])
  const [meUser, setMeUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [assignedCount, setAssignedCount] = useState(0)
  const [orders, setOrders] = useState([])
  const [avgResponseSeconds, setAvgResponseSeconds] = useState(null)
  const [ordersSubmittedOverride, setOrdersSubmittedOverride] = useState(null)

  // Load metrics for the signed-in agent
  async function load(){
    setLoading(true)
    try{
      const [meRes, chats, ordRes, perf] = await Promise.all([
        apiGet('/api/users/me').catch(()=>({})),
        apiGet('/api/wa/chats').catch(()=>[]),
        apiGet('/api/orders').catch(()=>({ orders: [] })),
        apiGet('/api/users/agents/me/performance').catch(()=>({})),
      ])
      if (meRes && meRes.user) setMeUser(meRes.user)
      const chatList = Array.isArray(chats) ? chats : []
      const allOrders = Array.isArray(ordRes?.orders) ? ordRes.orders : []
      setAssignedCount(chatList.length)
      setOrders(allOrders)
      if (typeof perf?.avgResponseSeconds === 'number') setAvgResponseSeconds(perf.avgResponseSeconds)
      if (typeof perf?.ordersSubmitted === 'number') setOrdersSubmittedOverride(perf.ordersSubmitted)
    }finally{ setLoading(false) }
  }

  useEffect(()=>{ load() },[])

  // Fallback: periodic polling to keep table fresh even if socket misses an event
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
  const ordersSubmitted = ordersSubmittedOverride != null ? ordersSubmittedOverride : orders.length
  const shipped = orders.filter(o => (o?.status||'').toLowerCase()==='shipped')
  const inTransit = orders.filter(o => (o?.shipmentStatus||'').toLowerCase()==='in_transit')
  const pending = orders.filter(o => (o?.status||'').toLowerCase()==='pending')
  const valueOf = (o)=> (o?.productId?.price || 0) * Math.max(1, Number(o?.quantity||1))
  const baseOf = (o)=> (o?.productId?.baseCurrency || 'SAR')
  const commissionPct = 0.08
  function commissionByCurrency(list){
    const sums = { AED:0, OMR:0, SAR:0, BHD:0 }
    for (const o of list){
      const cur = ['AED','OMR','SAR','BHD'].includes(baseOf(o)) ? baseOf(o) : 'SAR'
      sums[cur] += valueOf(o) * commissionPct
    }
    return sums
  }
  const totalByCur = commissionByCurrency(shipped)
  // Upcoming = Pending + In Transit (so new orders affect the wallet immediately)
  const upcomingByCur = commissionByCurrency([...pending, ...inTransit])
  const totalIncome = Object.values(totalByCur).reduce((a,b)=>a+b,0)
  const upcomingIncome = Object.values(upcomingByCur).reduce((a,b)=>a+b,0)

  // FX: PKR conversion (configurable via localStorage key 'fx_pkr')
  const defaultFx = { AED: 76, OMR: 726, SAR: 72, BHD: 830 } // approx; can be updated in settings
  let fx = defaultFx
  try{
    const saved = JSON.parse(localStorage.getItem('fx_pkr')||'null')
    if (saved && typeof saved==='object') fx = { ...defaultFx, ...saved }
  }catch{}
  const toPKR = (sums)=> Math.round(
    (sums.AED||0)*fx.AED + (sums.OMR||0)*fx.OMR + (sums.SAR||0)*fx.SAR + (sums.BHD||0)*fx.BHD
  )
  const totalPKR = toPKR(totalByCur)
  const upcomingPKR = toPKR(upcomingByCur)

  return (
    <div className="grid responsive-grid" style={{gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-green">Agent Dashboard</div>
          <div className="page-subtitle">Your performance and earnings overview</div>
        </div>
      </div>

      {/* Top summary cards */}
      <div className="card-grid">
        <MetricCard
          title="Assigned Chats"
          value={assignedCount}
          hint="Chats currently assigned to you"
          icon="💬"
          actionLabel="Go to chats"
          onAction={()=> navigate('/agent/inbox/whatsapp')}
        />
        <MetricCard title="Orders Submitted" value={ordersSubmitted} hint="Orders you created" icon="🧾" />
        <MetricCard title="Avg. Response Time" value={avgResponseSeconds!=null? formatDuration(avgResponseSeconds) : '—'} hint="Time to first reply on new chats" icon="⏱️" />
        <MetricCard
          title="Total Income"
          value={<CurrencyBreakdown rows={[
            { code:'AED', amount: totalByCur.AED },
            { code:'OMR', amount: totalByCur.OMR },
            { code:'SAR', amount: totalByCur.SAR },
            { code:'BHD', amount: totalByCur.BHD },
          ]} />}
          icon="💰"
        />
        <MetricCard
          title="Upcoming Income"
          value={<CurrencyBreakdown rows={[
            { code:'AED', amount: upcomingByCur.AED },
            { code:'OMR', amount: upcomingByCur.OMR },
            { code:'SAR', amount: upcomingByCur.SAR },
            { code:'BHD', amount: upcomingByCur.BHD },
          ]} />}
          icon="📦"
        />
      </div>

      {/* Revenue chart */}
      <div className="card" style={{display:'grid', gap:12}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',display:'grid',placeItems:'center',color:'#fff',fontWeight:800, fontSize:18}}>📈</div>
            <div>
              <div style={{fontWeight:800}}>Earnings Overview</div>
              <div className="helper">Commission at 8% of order value</div>
            </div>
          </div>
          <button className="btn secondary" onClick={load} disabled={loading}>{loading? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <MiniBarChart
          items={[
            { label:'Upcoming (PKR)', value: upcomingPKR, color:'#f59e0b' },
            { label:'Total (PKR)', value: totalPKR, color:'#10b981' },
          ]}
        />
      </div>

      {/* Recent Orders table */}
      {(()=>{
        const meId = String(meUser?._id || me?._id || '')
        const myOrders = meId
          ? orders.filter(o => String(o?.createdBy?._id || o?.createdBy || '') === meId)
          : orders.filter(o => String(o?.createdByRole||'').toLowerCase()==='agent')
        function createdMs(o){
          if (o?.createdAt) return new Date(o.createdAt).getTime()
          try{
            const hex = String(o?._id||'').slice(0,8)
            const seconds = parseInt(hex, 16)
            if (!isNaN(seconds)) return seconds*1000
          }catch{}
          return 0
        }
        const recent = myOrders
          .slice()
          .sort((a,b)=> createdMs(b) - createdMs(a))
          .slice(0, 50)

        function orderQty(o){ return Math.max(1, Number(o?.quantity||1)) }
        function orderTotal(o){
          if (o?.total != null) return Number(o.total)
          const unit = Number(o?.productId?.price||0)
          return unit * orderQty(o)
        }
        function baseCur(o){ return (o?.productId?.baseCurrency)||'SAR' }
        function fmt2(n){ try{ return Number(n||0).toFixed(2) }catch{ return '0.00' } }
        function upcomingCommission(o){
          const st = String(o?.status||'').toLowerCase()
          const ship = String(o?.shipmentStatus||'').toLowerCase()
          const qualifies = (st==='pending') || (ship==='in_transit') || (ship==='assigned')
          return qualifies ? (orderTotal(o) * commissionPct) : 0
        }
        const totalsRecent = recent.reduce((acc,o)=>{
          acc.total += orderTotal(o)
          acc.upcoming += upcomingCommission(o)
          return acc
        }, { total:0, upcoming:0 })

        return (
          <div className="card" style={{display:'grid', gap:12}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#10b981,#22c55e)',display:'grid',placeItems:'center',color:'#fff',fontWeight:800, fontSize:18}}>📄</div>
                <div>
                  <div style={{fontWeight:800}}>Recent Orders</div>
                  <div className="helper">Latest 50 orders you submitted</div>
                </div>
              </div>
              <div className="helper">Total: {fmtCurrency(totalsRecent.total)} • Upcoming Income: {fmtCurrency(totalsRecent.upcoming)}</div>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left', padding:'10px 12px'}}>Date</th>
                    <th style={{textAlign:'left', padding:'10px 12px'}}>Customer</th>
                    <th style={{textAlign:'left', padding:'10px 12px'}}>Product</th>
                    <th style={{textAlign:'right', padding:'10px 12px'}}>Qty</th>
                    <th style={{textAlign:'right', padding:'10px 12px'}}>Total Price</th>
                    <th style={{textAlign:'right', padding:'10px 12px'}}>Upcoming Income</th>
                    <th style={{textAlign:'left', padding:'10px 12px'}}>Order Status</th>
                    <th style={{textAlign:'left', padding:'10px 12px'}}>Shipment</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length===0 ? (
                    <tr><td colSpan={8} style={{padding:'10px 12px', opacity:.8}}>No recent orders.</td></tr>
                  ) : recent.map((o,idx)=>{
                    const tot = orderTotal(o)
                    const comm = upcomingCommission(o)
                    const prod = o?.productId?.name || (o?.details ? String(o.details).slice(0,64) : '-')
                    const date = o?.createdAt ? new Date(o.createdAt).toLocaleString() : ''
                    return (
                      <tr key={o._id||idx} style={{borderTop:'1px solid var(--border)'}}>
                        <td style={{padding:'10px 12px'}}>{date}</td>
                        <td style={{padding:'10px 12px'}}>{o.customerName||'-'}</td>
                        <td style={{padding:'10px 12px'}}>{prod}</td>
                        <td style={{padding:'10px 12px', textAlign:'right'}}>{orderQty(o)}</td>
                        <td style={{padding:'10px 12px', textAlign:'right'}}>{fmtCurrency(tot)} <span className="helper">{baseCur(o)}</span></td>
                        <td style={{padding:'10px 12px', textAlign:'right'}}>{fmtCurrency(comm)}</td>
                        <td style={{padding:'10px 12px'}}>{String(o.status||'-')}</td>
                        <td style={{padding:'10px 12px'}}>{String(o.shipmentStatus||'-')}</td>
                      </tr>
                    )
                  })}
                  {recent.length>0 && (
                    <tr style={{borderTop:'2px solid var(--border)', background:'rgba(59,130,246,0.08)'}}>
                      <td style={{padding:'10px 12px', fontWeight:800}}>Totals</td>
                      <td colSpan={3}></td>
                      <td style={{padding:'10px 12px', textAlign:'right', fontWeight:800}}>{fmtCurrency(totalsRecent.total)}</td>
                      <td style={{padding:'10px 12px', textAlign:'right', fontWeight:800}}>{fmtCurrency(totalsRecent.upcoming)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function MetricCard({ title, value, hint, icon, actionLabel, onAction }){
  return (
    <div className="card" style={{display:'flex', alignItems:'center', gap:14}}>
      <div style={{width:42, height:42, borderRadius:999, background:'var(--panel-2)', display:'grid', placeItems:'center', fontSize:20, flexShrink:0}}>
        {icon}
      </div>
      <div style={{display:'grid', gap:2}}>
        <div className="label" style={{fontSize:13}}>{title}</div>
        <div style={{fontSize:20, fontWeight:800}}>{value}</div>
        {hint && <div className="helper" style={{fontSize:11}}>{hint}</div>}
      </div>
      {actionLabel && onAction && (
        <div style={{marginLeft:'auto'}}>
          <button className="btn secondary small" onClick={onAction}>{actionLabel}</button>
        </div>
      )}
    </div>
  )
}

function MiniBarChart({ items }){
  const max = Math.max(1, ...items.map(i=>i.value||0))
  return (
    <div style={{display:'grid', gap:12}}>
      <div style={{display:'grid', gridTemplateColumns:`repeat(${items.length}, 1fr)`, gap:16, alignItems:'end', height:180, background:'var(--panel-2)', padding:'12px', borderRadius:8}}>
        {items.map((it,idx)=>{
          const h = Math.max(6, Math.round((it.value||0)/max*160))
          return (
            <div key={idx} style={{display:'grid', alignContent:'end', justifyItems:'center', gap:8}}>
              <div style={{width:'80%', height:h, background:it.color, borderRadius:6, transition:'transform 150ms ease', cursor:'pointer'}} title={`${it.label}: ${formatCurrency(it.value||0)}`}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
              ></div>
            </div>
          )
        })}
      </div>
      <div style={{display:'flex', justifyContent:'center', gap:16, flexWrap:'wrap'}}>
        {items.map((it,idx)=>(<div key={idx} style={{display:'flex', alignItems:'center', gap:8, fontSize:12}}>
            <div style={{width:12, height:12, borderRadius:4, background:it.color}}></div>
            <div>{it.label}: <strong style={{color:'var(--fg)'}}>{formatCurrency(it.value||0)}</strong></div>
          </div>))}
      </div>
    </div>
  )
}

function formatCurrency(v){
  try{
    return new Intl.NumberFormat('en-US', { style:'currency', currency:'PKR', maximumFractionDigits:0 }).format(v||0)
  }catch{
    return `PKR ${Math.round(v||0).toLocaleString()}`
  }
}

// Alias used by Recent Orders table
function fmtCurrency(v){
  return formatCurrency(v)
}

function formatDuration(seconds){
  const s = Math.max(0, Math.round(seconds||0))
  const m = Math.floor(s/60), r = s%60
  if (m>0) return `${m}m ${r}s`
  return `${r}s`
}

function fmt(n){
  const v = Math.round(n||0)
  return v.toLocaleString()
}

function CurrencyBreakdown({ rows }){
  return (
    <div style={{display:'grid', gap:4, fontSize:18}}>
      {rows.map(r => (
        <div key={r.code} style={{display:'flex', justifyContent:'space-between'}}>
          <span style={{opacity:.9}}>{r.code}</span>
          <strong>{fmt(r.amount)}</strong>
        </div>
      ))}
    </div>
  )
}
