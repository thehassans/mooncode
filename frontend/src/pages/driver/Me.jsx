import React, { useEffect, useState } from 'react'
import { apiGet } from '../../api.js'
import { useNavigate } from 'react-router-dom'

export default function DriverMe() {
  const navigate = useNavigate()
  const [me, setMe] = useState(() => {
    try { return JSON.parse(localStorage.getItem('me') || '{}') } catch { return {} }
  })
  const [loading, setLoading] = useState(true)
  const [drvMetrics, setDrvMetrics] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try { const r = await apiGet('/api/users/me'); if (alive) { setMe(r?.user || {}) } } catch {}
      try { const m = await apiGet('/api/orders/driver/metrics'); if (alive) setDrvMetrics(m||null) } catch { if (alive) setDrvMetrics(null) }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  // Minimal page: no sockets/remittances/profile settings here

  function handleLogout(){
    try{
      localStorage.removeItem('token')
      localStorage.removeItem('me')
      localStorage.removeItem('navColors')
    }catch{}
    try{ navigate('/login', { replace:true }) }catch{}
    setTimeout(()=>{ try{ window.location.assign('/login') }catch{} }, 30)
  }

  const deliveredCount = Number(drvMetrics?.status?.delivered || 0)
  const commissionPerOrder = Number(me?.commissionPerOrder || 0)
  const commissionCurrency = String(me?.commissionCurrency || '').toUpperCase() || 'SAR'
  const walletAmount = (commissionPerOrder > 0 && deliveredCount >= 0) ? (commissionPerOrder * deliveredCount) : 0

  return (
    <div className="content" style={{ display: 'grid', gap: 16, padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Driver Wallet</div>
          <div className="page-subtitle">Earnings from delivered orders</div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <button className="btn danger" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="card" style={{padding:16}}>
        <div className="card-title" style={{marginBottom:6}}>Wallet Amount (Delivered)</div>
        {loading ? (
          <div className="helper">Loading…</div>
        ) : (
          <div style={{display:'grid', gap:8}}>
            <div style={{fontSize:28, fontWeight:900, color:'var(--success)'}}>{commissionCurrency} {Number(walletAmount||0).toFixed(2)}</div>
            <div className="helper">Commission per order: {commissionCurrency} {Number(commissionPerOrder||0).toFixed(2)}</div>
            <div className="helper">Delivered orders counted: {deliveredCount}</div>
            <div>
              <a className="btn secondary" href="/driver/orders/delivered">View Delivered Orders</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

