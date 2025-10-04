import React, { useEffect, useState } from 'react'
import { API_BASE, apiGet } from '../../api'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'

export default function DriverDashboard(){
  const nav = useNavigate()
  const [counts, setCounts] = useState({ assigned: 0, picked: 0, delivered: 0, cancelled: 0 })
  const [loading, setLoading] = useState(false)

  async function loadCounts(){
    setLoading(true)
    try{
      const [a,p,d,c] = await Promise.all([
        apiGet('/api/orders/driver/assigned'),
        apiGet('/api/orders/driver/picked'),
        apiGet('/api/orders/driver/delivered'),
        apiGet('/api/orders/driver/cancelled'),
      ])
      setCounts({
        assigned: (a.orders||[]).length,
        picked: (p.orders||[]).length,
        delivered: (d.orders||[]).length,
        cancelled: (c.orders||[]).length,
      })
    }catch{
      setCounts({ assigned:0, picked:0, delivered:0, cancelled:0 })
    }finally{ setLoading(false) }
  }
  useEffect(()=>{ loadCounts() },[])

  // Real-time: refresh counts on order events
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['polling'], upgrade:false, auth: { token }, withCredentials: true })
      const refresh = ()=>{ try{ loadCounts() }catch{} }
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

  const cards = [
    { key:'assigned', title:'Orders Assigned', value: counts.assigned, to:'/driver/orders/assigned', color:'#3b82f6' },
    { key:'picked', title:'Total Picked Up', value: counts.picked, to:'/driver/orders/picked', color:'#f59e0b' },
    { key:'delivered', title:'Total Delivered', value: counts.delivered, to:'/driver/orders/delivered', color:'#10b981' },
    { key:'cancelled', title:'Total Cancelled', value: counts.cancelled, to:'/driver/orders/cancelled', color:'#ef4444' },
  ]

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Driver Dashboard</div>
          <div className="page-subtitle">Overview of your delivery workload</div>
        </div>
      </div>

      <div className="card" style={{padding:16}}>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:12}}>
          {cards.map(c => (
            <button key={c.key} className="tile" onClick={()=> nav(c.to)} style={{
              display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12
            }}>
              <div style={{fontSize:12, color:'var(--muted)'}}>{c.title}</div>
              <div style={{fontSize:28, fontWeight:800, color:c.color}}>{loading? '…' : c.value}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:10, padding:16}}>
        <div className="card-title">Quick Actions</div>
        <div className="section" style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <a className="btn" href="/driver/panel">Open Driver Panel</a>
          <a className="btn secondary" href="/driver/orders/history">Order History</a>
        </div>
      </div>
    </div>
  )
}
