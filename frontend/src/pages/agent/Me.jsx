import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPatch, apiPost } from '../../api.js'
import { io } from 'socket.io-client'
import { useNavigate } from 'react-router-dom'

export default function AgentMe() {
  const navigate = useNavigate()
  const [me, setMe] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('me') || '{}')
    } catch {
      return {}
    }
  })
  const [availability, setAvailability] = useState(() => me?.availability || 'available')
  const [perf, setPerf] = useState({
    avgResponseSeconds: null,
    ordersSubmitted: 0,
    ordersShipped: 0,
  })
  const [loading, setLoading] = useState(true)
  const [savingAvail, setSavingAvail] = useState(false)

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPass, setChangingPass] = useState(false)
  const [showPassModal, setShowPassModal] = useState(false)

  // Setup Me: theme + ringtone
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'dark'
    } catch {
      return 'dark'
    }
  })
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const v = localStorage.getItem('wa_sound')
      return v ? v !== 'false' : true
    } catch {
      return true
    }
  })
  const [ringtone, setRingtone] = useState(() => {
    try {
      return localStorage.getItem('wa_ringtone') || 'shopify'
    } catch {
      return 'shopify'
    }
  })
  const [ringVol, setRingVol] = useState(() => {
    try {
      const v = parseFloat(localStorage.getItem('wa_ringtone_volume') || '1')
      return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1
    } catch {
      return 1
    }
  })
  const [orders, setOrders] = useState([])
  // Agent remit state
  const [managers, setManagers] = useState([])
  const [remReq, setRemReq] = useState({ approverRole:'user', approverId:'', amount:'', note:'' })
  const [remBusy, setRemBusy] = useState(false)
  const [myRemits, setMyRemits] = useState([])
  const [wallet, setWallet] = useState({ byCurrency: {}, totalPKR: 0 })
  // Payout profile
  const [payout, setPayout] = useState(()=>({
    method: (me?.payoutProfile?.method)||'jazzcash',
    accountName: me?.payoutProfile?.accountName||'',
    bankName: me?.payoutProfile?.bankName||'',
    iban: me?.payoutProfile?.iban||'',
    accountNumber: me?.payoutProfile?.accountNumber||'',
    phoneNumber: me?.payoutProfile?.phoneNumber||'',
  }))
  const [savingPayout, setSavingPayout] = useState(false)
  useEffect(()=>{
    try{
      setPayout({
        method: (me?.payoutProfile?.method)||'jazzcash',
        accountName: me?.payoutProfile?.accountName||'',
        bankName: me?.payoutProfile?.bankName||'',
        iban: me?.payoutProfile?.iban||'',
        accountNumber: me?.payoutProfile?.accountNumber||'',
        phoneNumber: me?.payoutProfile?.phoneNumber||'',
      })
    }catch{}
  }, [me?.payoutProfile])

  // Calculate total earnings in PKR (same logic as Dashboard)
  const earnings = useMemo(() => {
    const list = orders || []
    const commissionPct = 0.12
    const valueOf = (o) => {
      if (o && o.total != null && !Number.isNaN(Number(o.total))) return Number(o.total)
      const price = Number(o?.productId?.price || 0)
      const qty = Math.max(1, Number(o?.quantity || 1))
      return price * qty
    }
    const baseOf = (o) => (['AED','OMR','SAR','BHD'].includes(String(o?.productId?.baseCurrency))) ? o.productId.baseCurrency : 'SAR'

    const defaultFx = { AED: 76, OMR: 726, SAR: 72, BHD: 830 }
    let fx = defaultFx
    try{ const saved = JSON.parse(localStorage.getItem('fx_pkr') || 'null'); if (saved && typeof saved === 'object') fx = { ...defaultFx, ...saved } }catch{}

    const isDelivered = (o) => String(o?.shipmentStatus||'').toLowerCase() === 'delivered'
    const isCancelled = (o) => ['cancelled','returned'].includes(String(o?.shipmentStatus||'').toLowerCase())

    let deliveredCommissionPKR = 0
    let upcomingCommissionPKR = 0
    for (const o of list){
      if (isCancelled(o)) continue
      const val = valueOf(o) * commissionPct
      const rate = fx[baseOf(o)] || 0
      const pkr = val * rate
      if (isDelivered(o)) deliveredCommissionPKR += pkr
      else upcomingCommissionPKR += pkr
    }
    deliveredCommissionPKR = Math.round(deliveredCommissionPKR)
    upcomingCommissionPKR = Math.round(upcomingCommissionPKR)
    return { deliveredCommissionPKR, upcomingCommissionPKR }
  }, [orders])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await apiGet('/api/users/me')
        if (!alive) return
        setMe(r?.user || {})
      } catch {}
      try {
        const m = await apiGet('/api/users/agents/me/performance')
        if (!alive) return
        setPerf({
          avgResponseSeconds: m?.avgResponseSeconds ?? null,
          ordersSubmitted: m?.ordersSubmitted ?? 0,
          ordersShipped: m?.ordersShipped ?? 0,
        })
      } catch {}
      try {
        const ordersRes = await apiGet('/api/orders')
        if (!alive) return
        setOrders(ordersRes?.orders || [])
      } catch {}
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  // Sockets for agent remit updates
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const refresh = ()=>{ try{ loadMyRemits(); loadWallet() }catch{} }
      socket.on('agentRemit.approved', refresh)
      socket.on('agentRemit.sent', refresh)
    }catch{}
    return ()=>{
      try{ socket && socket.off('agentRemit.approved') }catch{}
      try{ socket && socket.off('agentRemit.sent') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[])

  // Live: refresh orders when workspace orders change so earnings stay in sync
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const reload = async ()=>{ try{ const r = await apiGet('/api/orders'); setOrders(Array.isArray(r?.orders)? r.orders:[]) }catch{} }
      socket.on('orders.changed', reload)
    }catch{}
    return ()=>{
      try{ socket && socket.off('orders.changed') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[])

  // Load managers for approver option
  async function loadManagers(){
    try{ const res = await apiGet('/api/users/my-managers?sameCountry=false'); setManagers(Array.isArray(res?.users)? res.users:[]) }catch{ setManagers([]) }
  }
  // Load my remittance requests
  async function loadMyRemits(){
    try{ const res = await apiGet('/api/finance/agent-remittances'); setMyRemits(Array.isArray(res?.remittances)? res.remittances:[]) }catch{ setMyRemits([]) }
  }
  // Load wallet summary
  async function loadWallet(){
    try{ const res = await apiGet('/api/finance/agent-remittances/wallet'); const byCurrency = res?.byCurrency || {}; const totalPKR = Number(byCurrency.PKR||0); setWallet({ byCurrency, totalPKR }) }catch{ setWallet({ byCurrency:{}, totalPKR:0 }) }
  }
  // Initial loads for remit UI
  useEffect(()=>{ try{ loadManagers(); loadMyRemits(); loadWallet() }catch{} },[])

  async function submitAgentRemit(){
    try{
      setRemBusy(true)
      const amount = Number(remReq.amount||0)
      if (!Number.isFinite(amount) || amount <= 0) return alert('Enter a valid amount')
      if (amount < 10000) return alert('Minimum withdraw amount is PKR 10000')
      const payload = { amount }
      if ((remReq.note||'').trim()) payload.note = remReq.note.trim()
      await apiPost('/api/finance/agent-remittances', payload)
      setRemReq({ approverRole: 'user', approverId: '', amount:'', note:'' })
      await loadMyRemits(); await loadWallet()
      alert('Request submitted')
    }catch(e){ alert(e?.message || 'Failed to submit request') }
    finally{ setRemBusy(false) }
  }

  async function savePayoutProfile(){
    try{
      setSavingPayout(true)
      const body = { ...payout }
      await apiPatch('/api/users/me/payout-profile', body)
      alert('Payout profile saved')
    }catch(e){ alert(e?.message || 'Failed to save payout profile') }
    finally{ setSavingPayout(false) }
  }

  // Apply theme immediately on change
  useEffect(() => {
    try {
      localStorage.setItem('theme', theme)
    } catch {}
    const root = document.documentElement
    if (theme === 'light') root.setAttribute('data-theme', 'light')
    else root.setAttribute('data-theme', 'dark')
  }, [theme])

  // When modal is open, add a class to the body to apply modal-specific CSS (see styles.css)
  useEffect(() => {
    try {
      const body = document.body
      if (showPassModal) body.classList.add('modal-open')
      else body.classList.remove('modal-open')
      return () => body.classList.remove('modal-open')
    } catch {}
  }, [showPassModal])

  // Professional icons
  function Icon({ name, size = 20 }) {
    const props = {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
    }
    if (name === 'cap')
      return (
        <svg {...props}>
          <path d="M22 10L12 5 2 10l10 5 10-5z" />
          <path d="M6 12v5c0 .7 4 2 6 2s6-1.3 6-2v-5" />
        </svg>
      )
    if (name === 'briefcase')
      return (
        <svg {...props}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          <path d="M2 12h20" />
        </svg>
      )
    if (name === 'star')
      return (
        <svg {...props}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
        </svg>
      )
    if (name === 'flame')
      return (
        <svg {...props}>
          <path d="M8.5 14.5C8.5 16.985 10.515 19 13 19s4.5-2.015 4.5-4.5c0-3.5-3.5-5.5-3.5-8.5 0 0-4 2-4 6 0 .62.13 1.208.36 1.752" />
        </svg>
      )
    if (name === 'award')
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="5" />
          <path d="M8.21 13.89L7 22l5-3 5 3-1.21-8.11" />
        </svg>
      )
    if (name === 'trophy')
      return (
        <svg {...props}>
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
          <path d="M5 8a3 3 0 0 0 3 3" />
          <path d="M19 8a3 3 0 0 1-3 3" />
        </svg>
      )
    return null
  }

  const levels = useMemo(
    () => [
      { count: 0, title: 'Learning Agent', icon: 'cap' },
      { count: 5, title: 'Working Agent', icon: 'briefcase' },
      { count: 50, title: 'Skilled Agent', icon: 'star' },
      { count: 100, title: 'Pro Agent', icon: 'flame' },
      { count: 250, title: 'Senior Agent', icon: 'award' },
      { count: 500, title: 'Elite Agent', icon: 'trophy' },
    ],
    []
  )

  const levelInfo = useMemo(() => {
    const submitted = Number(perf.ordersSubmitted || 0)
    let idx = 0
    for (let i = 0; i < levels.length; i++) {
      if (submitted >= levels[i].count) idx = i
      else break
    }
    const current = levels[idx]
    const next = levels[idx + 1] || null
    let pct = 100
    if (next) {
      const range = next.count - current.count
      const done = Math.max(0, submitted - current.count)
      pct = Math.max(0, Math.min(100, Math.round((done / Math.max(1, range)) * 100)))
    }
    return { idx, current, next, pct, submitted }
  }, [levels, perf.ordersSubmitted])

  async function updateAvailability(val) {
    const v = String(val || '').toLowerCase()
    setAvailability(v)
    setSavingAvail(true)
    try {
      await apiPatch('/api/users/me/availability', { availability: v })
      setMe((m) => {
        const n = { ...m, availability: v }
        try {
          localStorage.setItem('me', JSON.stringify(n))
        } catch {}
        return n
      })
    } catch (err) {
      alert(err?.message || 'Failed to update availability')
    } finally {
      setSavingAvail(false)
    }
  }

  async function changePassword(e) {
    e?.preventDefault?.()
    if (!currentPassword || !newPassword) {
      alert('Please fill all fields')
      return
    }
    if (newPassword.length < 6) {
      alert('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      alert('New password and confirmation do not match')
      return
    }
    setChangingPass(true)
    try {
      await apiPatch('/api/users/me/password', { currentPassword, newPassword })
      alert('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPassModal(false)
    } catch (err) {
      alert(err?.message || 'Failed to change password')
    } finally {
      setChangingPass(false)
    }
  }

  function storeSoundPrefs(enabled, tone, vol) {
    try {
      localStorage.setItem('wa_sound', enabled ? 'true' : 'false')
    } catch {}
    try {
      if (tone) localStorage.setItem('wa_ringtone', tone)
    } catch {}
    try {
      if (typeof vol === 'number') localStorage.setItem('wa_ringtone_volume', String(vol))
    } catch {}
  }
  function playPreview() {
    try {
      const vol = Math.max(0, Math.min(1, ringVol))
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const now = ctx.currentTime
      function toneAt(t, freq, dur = 0.12, type = 'sine', startGain = 0.0001, peakGain = 0.26) {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = type
        o.frequency.setValueAtTime(freq, now + t)
        g.gain.setValueAtTime(startGain, now + t)
        g.gain.exponentialRampToValueAtTime(Math.max(0.03, vol * peakGain), now + t + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, now + t + dur)
        o.connect(g)
        g.connect(ctx.destination)
        o.start(now + t)
        o.stop(now + t + dur + 0.02)
      }
      const n = String(ringtone || '').toLowerCase()
      if (n === 'shopify') {
        toneAt(0.0, 932, 0.12, 'triangle')
        toneAt(0.1, 1047, 0.12, 'triangle')
        toneAt(0.2, 1245, 0.16, 'triangle')
        return
      }
      if (n === 'bell') {
        toneAt(0.0, 880, 0.6, 'sine', 0.0001, 0.4)
        toneAt(0.0, 1760, 0.4, 'sine', 0.0001, 0.18)
        return
      }
      if (n === 'ping') {
        toneAt(0.0, 1320, 0.2, 'sine', 0.0001, 0.35)
        return
      }
      if (n === 'knock') {
        toneAt(0.0, 200, 0.12, 'sine', 0.0001, 0.5)
        toneAt(0.16, 180, 0.12, 'sine', 0.0001, 0.5)
        return
      }
      // default to a simple beep
      toneAt(0.0, 880, 0.5, 'sine', 0.0001, 0.4)
    } catch {}
  }

  function handleLogout() {
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('me')
      navigate('/login', { replace: true })
    } catch {}
  }

  function pill(label, val) {
    const active = availability === val
    const color =
      val === 'available'
        ? '#22c55e'
        : val === 'busy'
          ? '#ef4444'
          : val === 'offline'
            ? '#6b7280'
            : '#f59e0b'
    return (
      <button
        disabled={savingAvail}
        className={`btn small ${active ? 'success' : 'secondary'}`}
        onClick={() => updateAvailability(val)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 999,
            background: color,
          }}
        />
        {label}
      </button>
    )
  }

  return (
    <div
      className="content"
      style={{ display: 'grid', gap: 16, padding: 16, maxWidth: 900, margin: '0 auto' }}
    >
      {/* Profile Header */}
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Profile</div>
        <div className="helper">Manage your profile, settings and view your achievements.</div>
      </div>

      {/* First Card: Agent Details */}
      <div className="panel" style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden style={{ color: 'var(--muted)' }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <div style={{ fontWeight: 800 }}>Agent Details</div>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: 'var(--panel-2)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: 20,
              }}
            >
              {((me.firstName || '')[0] || 'A').toUpperCase()}
            </div>
            <div style={{ display: 'grid', gap: 4, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {(me.firstName || '') + ' ' + (me.lastName || '')}
              </div>
              <div className="helper" style={{ fontSize: 14 }}>
                {me.email || ''}
              </div>
              {me.phone && (
                <div className="helper" style={{ fontSize: 14 }}>
                  {me.phone}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gap: 8,
              padding: 12,
              background: 'var(--panel-2)',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>💰</span>
              <div style={{ fontWeight: 800 }}>Wallet Balance</div>
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ display:'grid', gap:4 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--success)' }}>
                  Total Income (12%): PKR {(earnings.deliveredCommissionPKR||0).toLocaleString()}
                </div>
                <div className="helper" style={{ fontSize: 12 }}>
                  Upcoming Income (undelivered): PKR {(earnings.upcomingCommissionPKR||0).toLocaleString()}
                </div>
                <div className="helper" style={{ fontSize: 12 }}>
                  Paid Out: PKR {(wallet.totalPKR||0).toLocaleString()} • Available Wallet: PKR {Math.max(0, (earnings.deliveredCommissionPKR||0) - (wallet.totalPKR||0)).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payout Profile */}
      <div className="card" style={{ display:'grid', gap:10 }}>
        <div className="card-header">
          <div className="card-title">Payout Profile</div>
          <div className="card-subtitle">Set where you want to receive your payouts</div>
        </div>
        <div className="section" style={{display:'grid', gap:10}}>
          <div className="form-grid">
            <label className="field">
              <div>Method</div>
              <select className="input" value={payout.method} onChange={e=> setPayout(p=>({...p, method: e.target.value}))}>
                <option value="bank">Bank</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="nayapay">NayaPay</option>
                <option value="sadapay">SadaPay</option>
              </select>
            </label>
            <label className="field">
              <div>Name on Account</div>
              <input className="input" value={payout.accountName} onChange={e=> setPayout(p=>({...p, accountName: e.target.value}))} placeholder="e.g. Ahmed Ali" />
            </label>
            {payout.method==='bank' && (
              <>
                <label className="field">
                  <div>Bank Name</div>
                  <input className="input" value={payout.bankName} onChange={e=> setPayout(p=>({...p, bankName: e.target.value}))} placeholder="e.g. HBL" />
                </label>
                <label className="field">
                  <div>IBAN</div>
                  <input className="input" value={payout.iban} onChange={e=> setPayout(p=>({...p, iban: e.target.value}))} placeholder="PK.." />
                </label>
                <label className="field">
                  <div>Account Number</div>
                  <input className="input" value={payout.accountNumber} onChange={e=> setPayout(p=>({...p, accountNumber: e.target.value}))} placeholder="e.g. 1234567890" />
                </label>
              </>
            )}
            {payout.method!=='bank' && (
              <label className="field">
                <div>Phone Number</div>
                <input className="input" value={payout.phoneNumber} onChange={e=> setPayout(p=>({...p, phoneNumber: e.target.value}))} placeholder="e.g. 03XXXXXXXXX" />
              </label>
            )}
          </div>
          <div style={{display:'flex', justifyContent:'flex-end'}}>
            <button className="btn" disabled={savingPayout} onClick={savePayoutProfile}>{savingPayout? 'Saving…' : 'Save Payout Profile'}</button>
          </div>
        </div>
      </div>

      {/* Request Money */}
      <div className="card" style={{ display:'grid', gap:10 }}>
        <div className="card-header">
          <div className="card-title">Request Money</div>
          <div className="card-subtitle">Request payout from your workspace owner. Minimum PKR 10,000.</div>
        </div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:8}}>
          <input className="input" value={me?.createdBy ? 'Workspace Owner' : 'No owner found'} readOnly />
          <input className="input" type="number" min="0" step="0.01" placeholder="Amount (PKR)" value={remReq.amount} onChange={e=> setRemReq(r=>({ ...r, amount: e.target.value }))} />
        </div>
        <div className="section" style={{display:'grid', gap:8}}>
          <div className="helper">Available Wallet: PKR {Math.max(0, (earnings.deliveredCommissionPKR||0) - (wallet.totalPKR||0)).toLocaleString()} • Minimum request: 10,000 PKR</div>
          <textarea className="input" placeholder="Note (optional)" value={remReq.note} onChange={e=> setRemReq(r=>({ ...r, note: e.target.value }))} rows={2} />
          <div style={{display:'flex', justifyContent:'flex-end'}}>
            <button className="btn" disabled={remBusy || !remReq.amount || (Number(remReq.amount||0) < 10000) || (Number(remReq.amount||0) > Math.max(0, (earnings.deliveredCommissionPKR||0) - (wallet.totalPKR||0)))} onClick={submitAgentRemit}>{remBusy? 'Submitting…':'Request Money'}</button>
          </div>
        </div>
      </div>

      {/* My Requests */}
      <div className="card" style={{ display:'grid', gap:10 }}>
        <div className="card-header">
          <div className="card-title">My Requests</div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          {myRemits.length === 0 ? (
            <div className="empty-state">No requests yet</div>
          ) : (
            <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
              <thead>
                <tr>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Date</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Approver</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Role</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Amount</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {myRemits.map(r => (
                  <tr key={String(r._id||r.id)} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'8px 10px'}}>{new Date(r.createdAt).toLocaleString()}</td>
                    <td style={{padding:'8px 10px'}}>{r.approverRole==='user' ? 'Owner' : 'Manager'}</td>
                    <td style={{padding:'8px 10px'}}>{r.approverRole}</td>
                    <td style={{padding:'8px 10px'}}>PKR {Number(r.amount||0).toFixed(2)}</td>
                    <td style={{padding:'8px 10px'}}>
                      {r.status==='pending' && <span className="badge" style={{borderColor:'#f59e0b', color:'#b45309'}}>Pending</span>}
                      {r.status==='approved' && <span className="badge" style={{borderColor:'#3b82f6', color:'#1d4ed8'}}>Approved</span>}
                      {r.status==='sent' && <span className="badge" style={{borderColor:'#10b981', color:'#065f46'}}>Sent</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Settings Card */}
      <div className="panel" style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden style={{ color: 'var(--muted)' }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 3.09V3a2 2 0 0 1 4 0v.09c0 .67.39 1.28 1 1.57h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0c.3.61.91 1 1.58 1H21a2 2 0 0 1 0 4h-.09c-.67 0-1.28.39-1.57 1z" />
            </svg>
          </span>
          <div style={{ fontWeight: 800 }}>Settings</div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {/* Availability Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: availability === 'available' ? '#10b981' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none">
                  {availability === 'available' ? (
                    <path d="M20 6L9 17l-5-5" />
                  ) : (
                    <path d="M18 6L6 18M6 6l12 12" />
                  )}
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Availability</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {availability === 'available' ? 'Available for chats' : 'Currently offline'}
                </div>
              </div>
            </div>
            <button
              type="button"
              className={`btn small ${availability === 'available' ? 'success' : 'secondary'}`}
              onClick={() =>
                setAvailability(availability === 'available' ? 'offline' : 'available')
              }
            >
              {availability === 'available' ? 'Online' : 'Offline'}
            </button>
          </div>

          {/* Theme Selection */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  backgroundColor: 'var(--accent)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Theme</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Choose your preferred theme
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={`btn small ${theme === 'light' ? 'success' : 'secondary'}`}
                onClick={() => setTheme('light')}
              >
                Light
              </button>
              <button
                type="button"
                className={`btn small ${theme === 'dark' ? 'success' : 'secondary'}`}
                onClick={() => setTheme('dark')}
              >
                Dark
              </button>
            </div>
          </div>

          {/* Notification Tone */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  backgroundColor: 'var(--warning)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Notifications</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {soundEnabled ? ringtone.charAt(0).toUpperCase() + ringtone.slice(1) : 'Disabled'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                className="input small"
                value={ringtone}
                onChange={(e) => {
                  const k = e.target.value
                  setRingtone(k)
                  storeSoundPrefs(soundEnabled, k)
                }}
                style={{ minWidth: 100 }}
              >
                <option value="shopify">Shopify</option>
                <option value="bell">Bell</option>
                <option value="ping">Ping</option>
                <option value="knock">Knock</option>
                <option value="beep">Beep</option>
              </select>
              <button type="button" className="btn small secondary" onClick={playPreview}>
                Test
              </button>
            </div>
          </div>

          {/* Change Password */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  backgroundColor: 'var(--danger)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <circle cx="12" cy="16" r="1" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Security</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Update your password</div>
              </div>
            </div>
            <button
              type="button"
              className="btn small secondary"
              onClick={() => {
                setShowPassModal(true)
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
              }}
            >
              Change Password
            </button>
          </div>

          {/* Logout */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  backgroundColor: '#6b7280',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Logout</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sign out of your account</div>
              </div>
            </div>
            <button
              type="button"
              className="btn small danger"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Achievements & Progress */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'var(--success)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="8" r="7" />
              <polyline points="8.21,13.89 7,23 12,20 17,23 15.79,13.88" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Achievements & Progress</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Track your performance and unlock rewards
            </div>
          </div>
        </div>

        {/* Current Level Status */}
        <div
          style={{
            background:
              'linear-gradient(135deg, var(--success) 0%, var(--success-dark, #16a34a) 100%)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 10,
            color: 'white',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name={levelInfo.current.icon} size={24} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Level {levelInfo.idx}</div>
                <div style={{ opacity: 0.9, fontSize: 14 }}>{levelInfo.current.title}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{levelInfo.submitted}</div>
              <div style={{ opacity: 0.9, fontSize: 12 }}>Orders</div>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                position: 'relative',
                height: 8,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.2)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${levelInfo.pct}%`,
                  background: 'rgba(255,255,255,0.9)',
                  borderRadius: 999,
                  transition: 'width .3s',
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: 12, opacity: 0.9 }}>
            {levelInfo.next ? (
              <span>
                Next: {levelInfo.next.title} at {levelInfo.next.count} orders (
                {levelInfo.next.count - levelInfo.submitted} more to go)
              </span>
            ) : (
              <span>🎉 Maximum level achieved! Keep up the excellent work!</span>
            )}
          </div>
        </div>

        {/* Achievement Badges */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--fg)' }}>
            Achievement Badges
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10,
            }}
          >
            {levels.map((lv, i) => {
              const unlocked = (perf.ordersSubmitted || 0) >= lv.count
              return (
                <div
                  key={lv.count}
                  style={{
                    border: '2px solid var(--border)',
                    borderRadius: 12,
                    padding: 16,
                    textAlign: 'center',
                    background: unlocked ? 'var(--panel)' : 'var(--panel-2)',
                    borderColor: unlocked ? 'var(--success)' : 'var(--border)',
                    opacity: unlocked ? 1 : 0.6,
                    transition: 'all 0.2s',
                  }}
                >
                  <div
                    style={{
                      fontSize: 32,
                      marginBottom: 8,
                      color: unlocked ? 'var(--success)' : 'var(--muted)',
                    }}
                  >
                    <Icon name={lv.icon} />
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>{lv.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                    ≥ {lv.count} orders
                  </div>
                  {unlocked ? (
                    <div
                      style={{
                        background: 'var(--success)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        display: 'inline-block',
                      }}
                    >
                      ✓ Unlocked
                    </div>
                  ) : (
                    <div
                      style={{
                        background: 'var(--muted)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        display: 'inline-block',
                      }}
                    >
                      Locked
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Change password modal */}
      {showPassModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            style={{ width: 'min(520px, 96vw)', padding: 16, display: 'grid', gap: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden style={{ color: 'var(--muted)' }}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <div style={{ fontWeight: 800 }}>Change Password</div>
              </div>
              <button
                className="btn secondary"
                onClick={() => setShowPassModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={changePassword} style={{ display: 'grid', gap: 10 }}>
              <div>
                <label className="label">Current password</label>
                <input
                  className="input"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="label">New password</label>
                <input
                  className="input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input
                  className="input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowPassModal(false)}
                >
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={changingPass}>
                  {changingPass ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
