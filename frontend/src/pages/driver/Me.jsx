import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch } from '../../api.js'
import { useNavigate } from 'react-router-dom'

export default function DriverMe() {
  const navigate = useNavigate()
  const [me, setMe] = useState(() => {
    try { return JSON.parse(localStorage.getItem('me') || '{}') } catch { return {} }
  })
  const [loading, setLoading] = useState(true)
  const [drvMetrics, setDrvMetrics] = useState(null)
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
  // Change password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPass, setChangingPass] = useState(false)

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

      {/* Achievements & Progress */}
      <div className="panel" style={{display:'grid', gap:10}}>
        <div style={{fontWeight:800}}>Achievements</div>
        <div className="helper">Current: {levelInfo.current.title} • Next: {levelInfo.next? levelInfo.next.title : 'Max level'}</div>
        <div style={{height:10, background:'var(--panel-2)', borderRadius:6, overflow:'hidden'}}>
          <div style={{width:`${levelInfo.pct}%`, height:'100%', background:'var(--wa-accent)'}} />
        </div>
      </div>

      {/* Change Password */}
      <div className="panel" style={{display:'grid', gap:10}}>
        <div style={{fontWeight:800}}>Change Password</div>
        <div className="form-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:8}}>
          <input className="input" type="password" placeholder="Current password" value={currentPassword} onChange={e=> setCurrentPassword(e.target.value)} />
          <input className="input" type="password" placeholder="New password" value={newPassword} onChange={e=> setNewPassword(e.target.value)} />
          <input className="input" type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e=> setConfirmPassword(e.target.value)} />
        </div>
        <div style={{display:'flex', justifyContent:'flex-end'}}>
          <button className="btn" disabled={changingPass} onClick={async()=>{
            if (!currentPassword || !newPassword) return alert('Please fill all fields')
            if (newPassword.length < 6) return alert('Password must be at least 6 characters')
            if (newPassword !== confirmPassword) return alert('Passwords do not match')
            try{ setChangingPass(true); await apiPatch('/api/users/me/password', { currentPassword, newPassword }); alert('Password updated'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }catch(e){ alert(e?.message||'Failed to update password') } finally { setChangingPass(false) }
          }}>Update Password</button>
        </div>
      </div>
    </div>
  )
}

