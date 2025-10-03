import React, { useEffect, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'

export default function DriverDashboard(){
  const [assigned, setAssigned] = useState([])
  const [loading, setLoading] = useState(false)

  async function loadAssigned(){
    setLoading(true)
    try{ const data = await apiGet('/api/orders/driver/assigned'); setAssigned(data.orders||[]) }catch{ setAssigned([]) }
    finally{ setLoading(false) }
  }
  useEffect(()=>{ loadAssigned() },[])
  

  // Real-time updates: listen for order events targeted to this driver
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['polling'], upgrade:false, auth: { token }, withCredentials: true })
      const onAssigned = (_payload)=>{ try{ loadAssigned() }catch{} }
      const onUpdated = (_payload)=>{ try{ loadAssigned() }catch{} }
      socket.on('order.assigned', onAssigned)
      socket.on('order.updated', onUpdated)
    }catch{}
    return ()=>{
      try{ socket && socket.off('order.assigned') }catch{}
      try{ socket && socket.off('order.updated') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[])

  function fmtDate(s){ try{ return new Date(s).toLocaleString() }catch{ return '' } }
  function fmtPrice(o){
    try{
      const qty = Math.max(1, Number(o?.quantity||1))
      const price = Number(o?.productId?.price||0)
      const cur = o?.productId?.baseCurrency || 'SAR'
      const total = price * qty
      return `${cur} ${total.toFixed(2)}`
    }catch{ return 'SAR 0.00' }
  }
  function mapsUrl(o){
    const lat = o?.locationLat, lng = o?.locationLng
    if (typeof lat === 'number' && typeof lng === 'number'){
      return `https://www.google.com/maps?q=${lat},${lng}`
    }
    const addr = o?.customerAddress || o?.customerLocation || ''
    if (addr) return `https://www.google.com/maps?q=${encodeURIComponent(addr)}`
    return ''
  }
  function openMaps(o){ const url = mapsUrl(o); if (url) window.open(url, '_blank', 'noopener,noreferrer') }

  async function deliverOrder(o){
    try{
      const note = window.prompt('Add delivery note (optional):', '')
      const amtStr = window.prompt('Collected amount (optional):', '')
      const payload = {}
      if (note && note.trim()) payload.note = note.trim()
      const amt = Number(amtStr)
      if (!Number.isNaN(amt) && amtStr !== null && amtStr !== '') payload.collectedAmount = Math.max(0, amt)
      await apiPost(`/api/orders/${o._id||o.id}/deliver`, payload)
      await loadAssigned()
    }catch(e){ alert(e?.message || 'Failed to mark delivered') }
  }
  async function cancelOrder(o){
    try{
      const reason = window.prompt('Reason for cancellation:', '')
      if (reason === null) return
      await apiPost(`/api/orders/${o._id||o.id}/cancel`, { reason })
      await loadAssigned()
    }catch(e){ alert(e?.message || 'Failed to cancel order') }
  }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">My Orders</div>
          <div className="page-subtitle">Please use the Driver Panel to manage your delivery orders.</div>
        </div>
        
      </div>

      <div className="card" style={{display:'grid', gap:12, padding:16}}>
        <div className="card-header">
          <div className="card-title">Driver Panel</div>
          <div className="card-subtitle">All order actions are handled in the Driver Panel.</div>
        </div>
        <div className="section" style={{display:'grid', gap:10}}>
          <div className="helper">Use the button below to open your panel.</div>
          <a className="btn" href="/driver/panel">Open Driver Panel</a>
        </div>
      </div>

      {/* Available in My Country section removed for a focused driver dashboard */}
    </div>
  )
}
