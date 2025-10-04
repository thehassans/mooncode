import React, { useEffect, useState } from 'react'
import { apiGet } from '../../api'
import { useNavigate } from 'react-router-dom'

export default function DriverDashboard(){
  const navigate = useNavigate()
  const [stats, setStats] = useState({ assigned: 0, delivered: 0, picked_up: 0, cancelled: 0, in_transit: 0, attempted: 0, contacted: 0, no_response: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadStats(){
    setLoading(true)
    setError('')
    try{ const d = await apiGet('/api/orders/driver/stats'); setStats(d||{}) }
    catch(e){ setError(e?.message || 'Failed to load stats') }
    finally{ setLoading(false) }
  }
  useEffect(()=>{ loadStats() },[])

  function Card({ title, value, color='#0ea5e9', onClick }){
    return (
      <button className="card" onClick={onClick} style={{textAlign:'left', borderColor:'var(--border)', cursor:'pointer'}}>
        <div className="section" style={{display:'grid', gap:8}}>
          <div className="helper" style={{fontWeight:700, color:'var(--muted)'}}>{title}</div>
          <div className="page-title" style={{margin:0, color}}>{Number(value||0)}</div>
        </div>
      </button>
    )
  }

  function go(view){
    navigate(`/driver/orders?view=${encodeURIComponent(view)}`)
  }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Driver Dashboard</div>
          <div className="page-subtitle">Overview of your delivery performance</div>
        </div>
      </div>

      {error ? <div className="card"><div className="section"><div className="helper-text error">{error}</div></div></div> : null}

      <div className="card">
        <div className="card-header">
          <div className="card-title">My Stats</div>
          <div className="card-subtitle">Tap a card to view details</div>
        </div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12}}>
          <Card title="Orders Assigned" value={stats.assigned} color="#6366f1" onClick={()=>go('assigned')} />
          <Card title="Delivered" value={stats.delivered} color="#10b981" onClick={()=>go('delivered')} />
          <Card title="Picked Up" value={stats.picked_up} color="#06b6d4" onClick={()=>go('picked_up')} />
          <Card title="In Transit" value={stats.in_transit} color="#0ea5e9" onClick={()=>go('in_transit')} />
          <Card title="Attempted" value={stats.attempted} color="#f59e0b" onClick={()=>go('attempted')} />
          <Card title="Contacted" value={stats.contacted} color="#a855f7" onClick={()=>go('contacted')} />
          <Card title="No Response" value={stats.no_response} color="#ef4444" onClick={()=>go('no_response')} />
          <Card title="Cancelled" value={stats.cancelled} color="#ef4444" onClick={()=>go('cancelled')} />
        </div>
      </div>
    </div>
  )
}
