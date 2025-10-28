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
  const [payout, setPayout] = useState({ currency:'SAR', totalCollectedAmount:0, deliveredToCompany:0, pendingToCompany:0 })
  // Password change modal
  const [showPassModal, setShowPassModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPass, setChangingPass] = useState(false)

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
      
      const refreshMetrics = async()=>{
        try{
          const [m, s] = await Promise.all([
            apiGet('/api/orders/driver/metrics').catch(()=>null),
            apiGet('/api/finance/remittances/summary').catch(()=>null),
          ])
          if (m) setDrvMetrics(m)
          if (s) setPayout({ currency: s.currency||'', totalCollectedAmount: Number(s?.totalCollectedAmount||0), deliveredToCompany: Number(s?.deliveredToCompany||0), pendingToCompany: Number(s?.pendingToCompany||0) })
        }catch{}
      }
      
      const refreshUserProfile = async()=>{
        try{
          const u = await apiGet('/api/users/me').catch(()=>({}))
          if (u?.user) {
            setMe(u.user)
            localStorage.setItem('me', JSON.stringify(u.user))
          }
        }catch{}
      }
      
      // Listen for order events
      socket.on('order.assigned', refreshMetrics)
      socket.on('order.updated', async () => {
        await refreshMetrics()
        await refreshUserProfile() // Also refresh profile for commission updates
      })
      socket.on('order.shipped', refreshMetrics)
      
      // Listen for remittance events
      socket.on('remittance.created', refreshMetrics)
      socket.on('remittance.accepted', async () => {
        await refreshMetrics()
        await refreshUserProfile() // Refresh for paidCommission updates
      })
      socket.on('remittance.rejected', refreshMetrics)
      
      // Listen for driver commission updates (broadcast from backend)
      socket.on('driver.commission.updated', async (data) => {
        console.log('Commission updated:', data)
        await refreshUserProfile()
        await refreshMetrics()
      })
    }catch{}
    return ()=>{
      try{ socket && socket.off('order.assigned') }catch{}
      try{ socket && socket.off('order.updated') }catch{}
      try{ socket && socket.off('order.shipped') }catch{}
      try{ socket && socket.off('remittance.created') }catch{}
      try{ socket && socket.off('remittance.accepted') }catch{}
      try{ socket && socket.off('remittance.rejected') }catch{}
      try{ socket && socket.off('driver.commission.updated') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  }, [])

  const deliveredCount = Number(drvMetrics?.status?.delivered || 0)
  const commissionPerOrder = Number((me?.driverProfile?.commissionPerOrder ?? me?.commissionPerOrder) || 0)
  const commissionCurrency = (String((me?.driverProfile?.commissionCurrency ?? me?.commissionCurrency) || '').toUpperCase() || String(payout?.currency||'').toUpperCase() || 'SAR')
  
  // Commission calculations (integrated with backend)
  // Always use backend totalCommission if available (includes extra commission from order-specific rates)
  const backendTotalCommission = me?.driverProfile?.totalCommission
  
  // Calculate fallback (base commission only)
  const fallbackCommission = (commissionPerOrder > 0 && deliveredCount > 0) 
    ? (commissionPerOrder * deliveredCount) 
    : 0
  
  // Use backend value if it exists and is a valid number, otherwise use fallback
  const totalCommission = (backendTotalCommission !== undefined && backendTotalCommission !== null && !isNaN(backendTotalCommission))
    ? Number(backendTotalCommission) 
    : fallbackCommission
  
  const baseCommission = deliveredCount * commissionPerOrder
  const extraCommission = Math.max(0, totalCommission - baseCommission)
  
  // Debug log for commission tracking
  console.log('Driver Commission Debug:', {
    meObject: me,
    driverProfile: me?.driverProfile,
    backendTotal: backendTotalCommission,
    backendType: typeof backendTotalCommission,
    fallbackCommission,
    calculatedTotal: totalCommission,
    baseCommission,
    extraCommission,
    deliveredCount,
    commissionPerOrder,
    loading
  })

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
      {/* Professional Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
        border: '1px solid rgba(34, 197, 94, 0.2)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '8px',
        boxShadow: '0 4px 12px rgba(34, 197, 94, 0.1)'
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px'}}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 4px 16px rgba(34, 197, 94, 0.3)'
          }}>
            💰
          </div>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 800,
              margin: 0,
              background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Driver Wallet
            </h1>
            <p style={{margin: 0, fontSize: '14px', color: 'var(--muted)', marginTop: '4px'}}>
              Track your earnings and commission
            </p>
          </div>
        </div>
      </div>

      {/* Commission Stats Grid */}
      <div className="card" style={{padding: '20px', borderRadius: '16px'}}>
        <h2 style={{fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text)'}}>Commission Overview</h2>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:12}}>
          {/* Total Orders Delivered */}
          <button className="tile" onClick={()=> navigate('/driver/orders/delivered')} style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div style={{fontSize:12, color:'var(--muted)'}}>Total Orders Delivered</div>
            <div style={{fontSize:32, fontWeight:800, color:'#10b981'}}>{loading? '…' : deliveredCount}</div>
          </button>
          
          {/* Commission per Order */}
          <div className="tile" style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div style={{fontSize:12, color:'var(--muted)'}}>Commission per Order</div>
            <div style={{fontSize:32, fontWeight:800, color:'#a855f7'}}>{loading? '…' : `${commissionCurrency} ${Number(commissionPerOrder||0).toFixed(2)}`}</div>
          </div>
          
          {/* Total Commission Earned */}
          <button className="tile" onClick={()=> navigate('/driver/orders/delivered')} style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div style={{fontSize:12, color:'var(--muted)'}}>Total Commission Earned</div>
            <div style={{fontSize:32, fontWeight:800, color:'#22c55e'}}>{loading? '…' : `${commissionCurrency} ${Number(totalCommission||0).toFixed(2)}`}</div>
          </button>
          
          {/* Extra Commission */}
          <div className="tile" style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div style={{fontSize:12, color:'var(--muted)'}}>Extra Commission</div>
            <div style={{fontSize:32, fontWeight:800, color:'#ec4899'}}>{loading? '…' : `${commissionCurrency} ${Number(extraCommission||0).toFixed(2)}`}</div>
          </div>
        </div>
      </div>

      {/* Payment Status */}
      <div className="card" style={{padding: '20px', borderRadius: '16px'}}>
        <h2 style={{fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text)'}}>Payment Status</h2>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:12}}>
          {/* Pending Payment */}
          <div style={{padding:16, background:'linear-gradient(135deg, rgba(251, 146, 60, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%)', border:'1px solid rgba(251, 146, 60, 0.3)', borderRadius:12}}>
            <div style={{fontSize:12, color:'#ea580c', marginBottom:8}}>Pending Payment</div>
            <div style={{fontSize:28, fontWeight:800, color:'#ea580c'}}>
              {loading? '…' : `${commissionCurrency} ${Number((me?.driverProfile?.totalCommission || 0) - (me?.driverProfile?.paidCommission || 0)).toFixed(2)}`}
            </div>
            <div style={{fontSize:11, color:'#9a3412', marginTop:4}}>Awaiting payment from company</div>
          </div>
          
          {/* Received Payment */}
          <div style={{padding:16, background:'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)', border:'1px solid rgba(34, 197, 94, 0.3)', borderRadius:12}}>
            <div style={{fontSize:12, color:'#16a34a', marginBottom:8}}>Received Payment</div>
            <div style={{fontSize:28, fontWeight:800, color:'#16a34a'}}>
              {loading? '…' : `${commissionCurrency} ${Number(me?.driverProfile?.paidCommission || 0).toFixed(2)}`}
            </div>
            <div style={{fontSize:11, color:'#166534', marginTop:4}}>Successfully received</div>
          </div>
        </div>
      </div>

      {/* Achievements & Progress */}
      <div className="card" style={{padding: '20px', borderRadius: '16px'}}>
        <h2 style={{fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)'}}>Achievements</h2>
        <p style={{fontSize: '14px', color: 'var(--muted)', marginBottom: '16px'}}>
          Current: <strong>{levelInfo.current.title}</strong> • Next: <strong>{levelInfo.next? levelInfo.next.title : 'Max level'}</strong>
        </p>
        <div style={{height: 12, background: 'var(--panel-2)', borderRadius: 8, overflow: 'hidden', position: 'relative'}}>
          <div style={{
            width: `${levelInfo.pct}%`, 
            height: '100%', 
            background: 'linear-gradient(90deg, #22c55e 0%, #10b981 100%)',
            transition: 'width 0.3s ease',
            borderRadius: 8
          }} />
        </div>
        <div style={{marginTop: '8px', textAlign: 'right', fontSize: '12px', color: 'var(--muted)'}}>
          {levelInfo.pct}% to next level
        </div>
      </div>

      {/* Security Section */}
      <div className="card" style={{padding: '20px', borderRadius: '16px'}}>
        <h2 style={{fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)'}}>Security</h2>
        <p style={{fontSize: '14px', color: 'var(--muted)', marginBottom: '16px'}}>Manage your account password</p>
        <button 
          className="btn primary" 
          onClick={()=> setShowPassModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Change Password
        </button>
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

