import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPatch } from '../../api.js'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'

export default function DriverMe() {
  const navigate = useNavigate()
  const [me, setMe] = useState(() => {
    try { return JSON.parse(localStorage.getItem('me') || '{}') } catch { return {} }
  })
  const [loading, setLoading] = useState(true)
  const [drvMetrics, setDrvMetrics] = useState(null)
  const [payout, setPayout] = useState({ currency:'', totalCollectedAmount:0, deliveredToCompany:0, pendingToCompany:0 })
  const [theme, setTheme] = useState(() => {
    try{
      const attr = document.documentElement.getAttribute('data-theme')
      if (attr === 'light') return 'light'
      return localStorage.getItem('theme') || 'dark'
    }catch{ return 'dark' }
  })
  useEffect(()=>{
    try{ localStorage.setItem('theme', theme) }catch{}
    const root = document.documentElement
    if (theme === 'light') root.setAttribute('data-theme','light')
    else root.removeAttribute('data-theme')
  }, [theme])
  // Change password (modal like Agent Me)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPass, setChangingPass] = useState(false)
  const [showPassModal, setShowPassModal] = useState(false)

  useEffect(() => {
    let alive = true
    const loadAll = async()=>{
      setLoading(true)
      try {
        const [u, m, s] = await Promise.all([
          apiGet('/api/users/me').catch(()=>({})),
          apiGet('/api/orders/driver/metrics').catch(()=>null),
          apiGet('/api/finance/remittances/summary').catch(()=>null),
        ])
        if (alive) setMe(u?.user || {})
        if (alive) setDrvMetrics(m||null)
        if (alive && s){
          setPayout({
            currency: s.currency||'',
            totalCollectedAmount: Number(s?.totalCollectedAmount||0),
            deliveredToCompany: Number(s?.deliveredToCompany||0),
            pendingToCompany: Number(s?.pendingToCompany||0),
          })
        }
      } finally {
        if (alive) setLoading(false)
      }
    }
    loadAll()
    return () => { alive = false }
  }, [])

  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const refresh = async()=>{
        try{
          const [m, s] = await Promise.all([
            apiGet('/api/orders/driver/metrics').catch(()=>null),
            apiGet('/api/finance/remittances/summary').catch(()=>null),
          ])
          if (m) setDrvMetrics(m)
          if (s) setPayout({ currency: s.currency||'', totalCollectedAmount: Number(s?.totalCollectedAmount||0), deliveredToCompany: Number(s?.deliveredToCompany||0), pendingToCompany: Number(s?.pendingToCompany||0) })
        }catch{}
      }
      socket.on('order.assigned', refresh)
      socket.on('order.updated', refresh)
      socket.on('order.shipped', refresh)
      socket.on('remittance.created', refresh)
      socket.on('remittance.accepted', refresh)
      socket.on('remittance.rejected', refresh)
    }catch{}
    return ()=>{
      try{ socket && socket.off('order.assigned') }catch{}
      try{ socket && socket.off('order.updated') }catch{}
      try{ socket && socket.off('order.shipped') }catch{}
      try{ socket && socket.off('remittance.created') }catch{}
      try{ socket && socket.off('remittance.accepted') }catch{}
      try{ socket && socket.off('remittance.rejected') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
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
  const commissionPerOrder = Number((me?.driverProfile?.commissionPerOrder ?? me?.commissionPerOrder) || 0)
  const commissionCurrency = (String((me?.driverProfile?.commissionCurrency ?? me?.commissionCurrency) || '').toUpperCase() || String(payout?.currency||'').toUpperCase() || 'SAR')
  const walletAmount = (commissionPerOrder > 0 && deliveredCount >= 0) ? (commissionPerOrder * deliveredCount) : 0
  // Driver achievement level by delivered count
  const levels = useMemo(()=>[
    { count: 0, title: 'New Driver' },
    { count: 10, title: 'Active Driver' },
    { count: 50, title: 'Reliable Driver' },
    { count: 100, title: 'Pro Driver' },
  ], [])
  const levelInfo = useMemo(()=>{
    const n = deliveredCount
    let idx = 0
    for (let i=0;i<levels.length;i++){ if (n >= levels[i].count) idx=i; else break }
    const current = levels[idx]
    const next = levels[idx+1] || null
    let pct = 100
    if (next){ const range = next.count - current.count; const done = Math.max(0, n - current.count); pct = Math.max(0, Math.min(100, Math.round((done/Math.max(1,range))*100))) }
    return { idx, current, next, pct }
  }, [deliveredCount, levels])

  return (
    <div className="content" style={{ display: 'grid', gap: 16, padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Driver Wallet</div>
          <div className="page-subtitle">Earnings from delivered orders</div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <button className="btn secondary" onClick={()=> setTheme(t=> t==='light' ? 'dark':'light')}>{theme==='light'?'🌙 Dark':'🌞 Light'}</button>
          <button className="btn danger" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="card" style={{padding:16}}>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:12}}>
          <button className="tile" onClick={()=> navigate('/driver/orders/delivered')} style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div style={{fontSize:12, color:'var(--muted)'}}>Wallet (Delivered Commission)</div>
            <div style={{fontSize:28, fontWeight:800, color:'#22c55e'}}>{loading? '…' : `${commissionCurrency} ${Number(walletAmount||0).toFixed(2)}`}</div>
          </button>
          <button className="tile" onClick={()=> navigate('/driver/orders/delivered')} style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div style={{fontSize:12, color:'var(--muted)'}}>Total Collected (Delivered)</div>
            <div style={{fontSize:28, fontWeight:800, color:'#0ea5e9'}}>{loading? '…' : `${payout.currency||''} ${Number(payout.totalCollectedAmount||0).toFixed(2)}`}</div>
          </button>
          <button className="tile" onClick={()=> navigate('/driver/payout#remittances')} style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div style={{fontSize:12, color:'var(--muted)'}}>Delivered to Company</div>
            <div style={{fontSize:28, fontWeight:800, color:'#22c55e'}}>{loading? '…' : `${payout.currency||''} ${Number(payout.deliveredToCompany||0).toFixed(2)}`}</div>
          </button>
          <button className="tile" onClick={()=> navigate('/driver/payout#pay')} style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div style={{fontSize:12, color:'var(--muted)'}}>Pending Delivery to Company</div>
            <div style={{fontSize:28, fontWeight:800, color:'#f59e0b'}}>{loading? '…' : `${payout.currency||''} ${Number(payout.pendingToCompany||0).toFixed(2)}`}</div>
          </button>
          <button className="tile" onClick={()=> navigate('/driver/orders/assigned')} style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div style={{fontSize:12, color:'var(--muted)'}}>Currently Assigned</div>
            <div style={{fontSize:28, fontWeight:800, color:'#3b82f6'}}>{loading? '…' : Number(drvMetrics?.status?.assigned||0)}</div>
          </button>
          <button className="tile" onClick={()=> navigate('/driver/orders/delivered')} style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div style={{fontSize:12, color:'var(--muted)'}}>Delivered Orders</div>
            <div style={{fontSize:28, fontWeight:800, color:'#10b981'}}>{loading? '…' : Number(drvMetrics?.status?.delivered||0)}</div>
          </button>
        </div>
        <div className="section" style={{marginTop:8}}>
          <div className="helper">Commission per order: {commissionCurrency} {Number(commissionPerOrder||0).toFixed(2)} • Delivered orders counted: {deliveredCount}</div>
        </div>
      </div>

      {/* Achievements & Progress */}
      <div className="panel" style={{display:'grid', gap:10}}>
        <div className="card-title">Achievements</div>
        <div className="helper">Current: {levelInfo.current.title} • Next: {levelInfo.next? levelInfo.next.title : 'Max level'}</div>
        <div style={{height:10, background:'var(--panel-2)', borderRadius:6, overflow:'hidden'}}>
          <div style={{width:`${levelInfo.pct}%`, height:'100%', background:'var(--wa-accent)'}} />
        </div>
      </div>

      {/* Change Password (modal trigger) */}
      <div className="panel" style={{display:'grid', gap:10}}>
        <div className="card-title">Security</div>
        <div className="helper">Manage your password</div>
        <div style={{display:'flex', justifyContent:'flex-end'}}>
          <button className="btn" onClick={()=> setShowPassModal(true)}>Change Password</button>
        </div>
      </div>

      {showPassModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Change Password</div>
              <button className="btn light" onClick={()=> setShowPassModal(false)}>Close</button>
            </div>
            <div className="modal-body" style={{display:'grid', gap:8}}>
              <input className="input" type="password" placeholder="Current password" value={currentPassword} onChange={e=> setCurrentPassword(e.target.value)} />
              <input className="input" type="password" placeholder="New password" value={newPassword} onChange={e=> setNewPassword(e.target.value)} />
              <input className="input" type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e=> setConfirmPassword(e.target.value)} />
            </div>
            <div className="modal-footer" style={{display:'flex', justifyContent:'flex-end', gap:8}}>
              <button className="btn light" onClick={()=> setShowPassModal(false)}>Cancel</button>
              <button className="btn primary" disabled={changingPass} onClick={async()=>{
                if (!currentPassword || !newPassword) return alert('Please fill all fields')
                if (newPassword.length < 6) return alert('Password must be at least 6 characters')
                if (newPassword !== confirmPassword) return alert('Passwords do not match')
                try{ setChangingPass(true); await apiPatch('/api/users/me/password', { currentPassword, newPassword }); alert('Password updated'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPassModal(false) }catch(e){ alert(e?.message||'Failed to update password') } finally { setChangingPass(false) }
              }}>Update Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

