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
  // Commission history
  const [commissionHistory, setCommissionHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
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
        const [u, m, s, h] = await Promise.all([
          apiGet('/api/users/me').catch(()=>({})),
          apiGet('/api/orders/driver/metrics').catch(()=>null),
          apiGet('/api/finance/remittances/summary').catch(()=>null),
          apiGet('/api/finance/commission-history').catch(()=>({ history: [] })),
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
        if (alive) setCommissionHistory(h?.history || [])
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
        // Refresh commission history
        try {
          const h = await apiGet('/api/finance/commission-history').catch(()=>({ history: [] }))
          setCommissionHistory(h?.history || [])
        } catch {}
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
  const totalCommission = Number(me?.driverProfile?.totalCommission ?? 0) || ((commissionPerOrder > 0 && deliveredCount >= 0) ? (commissionPerOrder * deliveredCount) : 0)
  const baseCommission = deliveredCount * commissionPerOrder
  const extraCommission = Math.max(0, totalCommission - baseCommission)

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

      {/* Commission History */}
      <div className="card" style={{padding: '20px', borderRadius: '16px'}}>
        <h2 style={{fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)'}}>Commission History</h2>
        <p style={{fontSize: '14px', color: 'var(--muted)', marginBottom: '16px'}}>Your commission payment receipts</p>
        
        {loading || loadingHistory ? (
          <div style={{padding: '20px', textAlign: 'center', color: 'var(--muted)'}}>Loading...</div>
        ) : commissionHistory.length === 0 ? (
          <div style={{padding: '40px 20px', textAlign: 'center', background: 'var(--panel-2)', borderRadius: '12px'}}>
            <div style={{fontSize: '48px', marginBottom: '12px'}}>📋</div>
            <div style={{fontSize: '14px', color: 'var(--muted)'}}>No commission payments yet</div>
          </div>
        ) : (
          <div style={{display: 'grid', gap: '12px'}}>
            {commissionHistory.map(item => (
              <div 
                key={item.id}
                style={{
                  padding: '16px',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  background: 'var(--panel-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{flex: 1, minWidth: '200px'}}>
                  <div style={{fontSize: '18px', fontWeight: 700, color: '#22c55e', marginBottom: '4px'}}>
                    {item.currency} {Number(item.amount).toFixed(2)}
                  </div>
                  <div style={{fontSize: '12px', color: 'var(--muted)'}}>
                    Paid on {new Date(item.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                  {item.receiptPath && (
                    <a 
                      href={`${API_BASE}${item.receiptPath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn secondary"
                      style={{
                        fontSize: '13px',
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                      </svg>
                      Receipt
                    </a>
                  )}
                  {item.settlementPath && (
                    <a 
                      href={`${API_BASE}${item.settlementPath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn primary"
                      style={{
                        fontSize: '13px',
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="12" y1="18" x2="12" y2="12"/>
                        <line x1="9" y1="15" x2="15" y2="15"/>
                      </svg>
                      Settlement
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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

