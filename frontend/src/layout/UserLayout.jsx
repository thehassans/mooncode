import React, { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { API_BASE, apiGet } from '../api.js'
import Sidebar from '../components/Sidebar.jsx'
import Modal from '../components/Modal.jsx'
import NotificationsDropdown from '../components/NotificationsDropdown.jsx'
 

export default function UserLayout(){
  const navigate = useNavigate()
  const [closed, setClosed] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  const [isMobile, setIsMobile] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  const [theme, setTheme] = useState('dark')
  const location = useLocation()
  const me = JSON.parse(localStorage.getItem('me') || '{}')
  const links = [
    { to: '/user', label: 'Dashboard', icon: '📊' },
    { to: '/user/notifications', label: 'Notifications', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    {
      label: 'Inbox', icon: '💬',
      children: [
        { to: '/user/inbox/whatsapp', label: 'Whatsapp Inbox', icon: '🗨️' },
        { to: '/user/inbox/connect', label: 'Whatsapp Connect', icon: '🔗' },
      ]
    },
    {
      label: 'Create', icon: '➕',
      children: [
        { to: '/user/agents', label: 'Agents', icon: '👥' },
        { to: '/user/managers', label: 'Managers', icon: '🧑‍💼' },
        { to: '/user/investors', label: 'Investors', icon: '💼' },
        { to: '/user/drivers', label: 'Drivers', icon: '🚛' },
      ]
    },
    {
      label: 'Commerce', icon: '🛍️',
      children: [
        { to: '/user/orders', label: 'Orders', icon: '🧾' },
        { to: '/user/online-orders', label: 'Online Orders', icon: '🌐' },
        { to: '/user/products', label: 'Product Detail', icon: '📦' },
        { to: '/user/inhouse-products', label: 'Inhouse Products', icon: '🏷️' },
        { to: '/user/warehouses', label: 'Warehouses', icon: '🏬' },
        { to: '/user/shipments', label: 'Shipments', icon: '🚚' },
        { to: '/user/expense', label: 'Expense Management', icon: '💸' },
        { to: '/user/currency', label: 'Currency Conversion', icon: '💱' },
      ]
    },
    {
      label: 'Amount Office', 
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="2" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      children: [
        { to: '/user/transactions', label: 'Driver Settlement', icon: '💳' },
        { to: '/user/manager-finances', label: 'Manager Finances', icon: '📊' },
        { to: '/user/agent-amounts', label: 'Agent Amounts', icon: '💰' },
        { to: '/user/investor-amounts', label: 'Investor Amounts', icon: '💼' },
        { to: '/user/driver-amounts', label: 'Driver Amounts', icon: '🚗' },
      ]
    },
    { 
      label: 'Insights', 
      icon: '📈', 
      children: [
        { to: '/user/reports', label: 'Business Reports', icon: '📑' },
        { to: '/user/driver-reports', label: 'Driver Reports', icon: '🚗' },
        { to: '/user/campaigns', label: 'Campaigns', icon: '📢' },
        { to: '/user/finances', label: 'Finances', icon: '💰' },
      ] 
    },
    { to: '/user/support', label: 'Support', icon: '🛟' },
  ]

  // Branding (header logo)
  const [branding, setBranding] = useState({ headerLogo: null })
  useEffect(()=>{
    let cancelled = false
    ;(async()=>{
      try{
        const j = await apiGet('/api/settings/branding')
        if (!cancelled) setBranding({ headerLogo: j.headerLogo || null })
      }catch{}
    })()
    return ()=>{ cancelled = true }
  },[])

  useEffect(()=>{
    function onResize(){
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      if (mobile) setClosed(true)
    }
    window.addEventListener('resize', onResize)
    return ()=> window.removeEventListener('resize', onResize)
  },[])

  // Initialize theme from localStorage or system preference
  useEffect(()=>{
    const saved = localStorage.getItem('theme')
    let t = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark')
  },[])

  // Mobile swipe gestures to open/close sidebar
  useEffect(()=>{
    let startX = 0, startY = 0, startTime = 0, tracking = false
    function onTouchStart(e){
      if (!e.touches || e.touches.length !== 1) return
      const t = e.touches[0]
      // ignore starting over inputs/buttons to avoid conflicts
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : ''
      if (['input','textarea','button','select'].includes(tag)) return
      startX = t.clientX; startY = t.clientY; startTime = Date.now(); tracking = true
    }
    function onTouchEnd(e){
      if (!tracking) return; tracking = false
      const t = (e.changedTouches && e.changedTouches[0]) || null
      if (!t) return
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      const dt = Date.now() - startTime
      const isHorizontal = Math.abs(dx) > 40 && Math.abs(dy) < 50
      const isQuick = dt < 500
      const fromEdge = startX <= 40 // left-edge gesture
      const isMobile = window.innerWidth <= 768
      if (!isMobile || !isHorizontal || !isQuick) return
      if (dx > 40 && fromEdge){
        // swipe right from edge -> open
        setClosed(false)
      }else if (dx < -40){
        // swipe left anywhere -> close
        setClosed(true)
      }
    }
    window.addEventListener('touchstart', onTouchStart, { passive:true })
    window.addEventListener('touchend', onTouchEnd, { passive:true })
    return ()=>{
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  },[])

  // Swatch helpers: apply sidebar/header colors and persist
  function applyNavColors(cfg){
    if (!cfg) return
    const RESET_KEYS = ['sidebar-bg','sidebar-border','nav-active-bg','nav-active-fg']
    const { __theme, __reset, ...vars } = cfg
    if (__reset || Object.keys(vars).length === 0){
      RESET_KEYS.forEach(k => document.documentElement.style.removeProperty(`--${k}`))
      try{ localStorage.removeItem('navColors') }catch{}
    } else {
      Object.entries(vars).forEach(([k,v])=>{
        document.documentElement.style.setProperty(`--${k}`, v)
      })
      localStorage.setItem('navColors', JSON.stringify(vars))
    }
    if (__theme){
      localStorage.setItem('theme', __theme)
      document.documentElement.setAttribute('data-theme', __theme === 'light' ? 'light' : 'dark')
      setTheme(__theme)
    }
  }

  const navPresets = [
    { title:'Default', cfg:{ __reset:true }, sample:'linear-gradient(135deg,var(--panel-2),var(--panel))' },
    { title:'Purple',  cfg:{ 'sidebar-bg':'#1a1036', 'sidebar-border':'#2b1856', 'nav-active-bg':'#3f1d67', 'nav-active-fg':'#f5f3ff' }, sample:'#7c3aed' },
    { title:'Green',   cfg:{ 'sidebar-bg':'#06251f', 'sidebar-border':'#0b3b31', 'nav-active-bg':'#0f3f33', 'nav-active-fg':'#c7f9ec' }, sample:'#10b981' },
    { title:'Blue',    cfg:{ 'sidebar-bg':'#0b1220', 'sidebar-border':'#223',    'nav-active-bg':'#1e293b', 'nav-active-fg':'#e2e8f0' }, sample:'#2563eb' },
    { title:'Slate',   cfg:{ 'sidebar-bg':'#0f172a', 'sidebar-border':'#1e293b', 'nav-active-bg':'#1f2937', 'nav-active-fg':'#e5e7eb' }, sample:'#334155' },
    { title:'Orange',  cfg:{ 'sidebar-bg':'#2a1304', 'sidebar-border':'#3b1d08', 'nav-active-bg':'#4a1f0a', 'nav-active-fg':'#ffedd5' }, sample:'#f97316' },
    { title:'Pink',    cfg:{ 'sidebar-bg':'#2a0b17', 'sidebar-border':'#3a0f20', 'nav-active-bg':'#4b1026', 'nav-active-fg':'#ffe4e6' }, sample:'#ec4899' },
    { title:'Light Pink', cfg:{ 'sidebar-bg':'#2b1020', 'sidebar-border':'#3a152b', 'nav-active-bg':'#4b1a36', 'nav-active-fg':'#ffd7ef' }, sample:'#f9a8d4' },
    { title:'Blush',   cfg:{ '__theme':'light', 'sidebar-bg':'#FFB5C0', 'sidebar-border':'#f39bab', 'nav-active-bg':'#ffdfe6', 'nav-active-fg':'#111827' }, sample:'#FFB5C0' },
    { title:'White',   cfg:{ '__theme':'light', 'sidebar-bg':'#ffffff', 'sidebar-border':'#e5e7eb', 'nav-active-bg':'#f1f5f9', 'nav-active-fg':'#111827' }, sample:'#ffffff' },
  ]

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [errorLogs, setErrorLogs] = useState([])

  function loadErrorLogs(){
    try{ setErrorLogs(JSON.parse(localStorage.getItem('error_logs') || '[]')) }catch{ setErrorLogs([]) }
  }
  function clearErrorLogs(){ try{ localStorage.setItem('error_logs','[]') }catch{}; setErrorLogs([]) }
  function downloadErrorLogs(){
    try{
      const blob = new Blob([JSON.stringify(errorLogs, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `error-logs-${new Date().toISOString().slice(0,19)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }catch{}
  }
  function fmtTime(ts){ try{ return new Date(Number(ts||0)).toLocaleString() }catch{ return '' } }

  function toggleTheme(){
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next === 'light' ? 'light' : 'dark')
  }

  function doLogout(){
    try{
      localStorage.removeItem('token')
      localStorage.removeItem('me')
      localStorage.removeItem('navColors')
    }catch{}
    try{ navigate('/login', { replace:true }) }catch{}
    setTimeout(()=>{ try{ window.location.assign('/login') }catch{} }, 30)
  }
  return (
    <div>
      <Sidebar closed={closed} links={links} onToggle={()=>setClosed(c=>!c)} />
      <div className={`main ${closed ? 'full' : ''}`}>
        <div className="topbar" style={{background:'var(--sidebar-bg)', borderBottom:'1px solid var(--sidebar-border)'}}>
          <div className="flex items-center gap-3">
            {/* Always-visible hamburger + logo */}
            <button
              className="btn secondary w-9 h-9 p-0 grid place-items-center"
              onClick={()=> setClosed(c=>!c)}
              title={closed ? 'Open menu' : 'Close menu'}
              aria-label={closed ? 'Open menu' : 'Close menu'}
            >
              ☰
            </button>
            <img src={branding.headerLogo || `${import.meta.env.BASE_URL}BuySial2.png`} alt="BuySial" className="h-7 w-auto object-contain" />
            {!isMobile && (
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--panel)] border border-[var(--border)] shadow-[inset_0_1px_0_rgba(0,0,0,0.15)]">
                <span aria-hidden className="inline-flex items-center text-[var(--muted)]">
                  {/* User/hand icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="10" cy="7" r="3"/>
                  </svg>
                </span>
                <span className="font-extrabold tracking-tight">
                  {`Welcome ${me.firstName||''} ${me.lastName||''}`.trim()}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Swatches positioned left to the theme toggle */}
            {!isMobile && (
              <div role="group" aria-label="Theme colors" className="flex items-center gap-2">
                {navPresets.map(p => (
                  <button
                    key={p.title}
                    type="button"
                    title={p.title}
                    aria-label={p.title}
                    onClick={()=> applyNavColors(p.cfg)}
                    className="w-4 h-4 rounded-full border border-white/30 shadow-inner cursor-pointer"
                    style={{ background: p.sample }}
                  />
                ))}
              </div>
            )}
            <button
              className="btn secondary w-9 h-9 p-0 grid place-items-center"
              onClick={toggleTheme}
              title={theme==='light' ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-label={theme==='light' ? 'Dark mode' : 'Light mode'}
            >
              {theme==='light' ? '🌙' : '☀️'}
            </button>
            {/* Notifications dropdown component */}
            <NotificationsDropdown />
            {/* Settings gear replaces direct logout */}
            <button className="btn w-9 h-9 p-0 grid place-items-center" title="Settings" aria-label="Settings" onClick={()=> { setShowSettings(true); setTimeout(loadErrorLogs, 0) }}>
              ⚙️
            </button>
          </div>
        </div>
        <div className={`container ${location.pathname.includes('/inbox/whatsapp') ? 'edge-to-edge' : ''}`}>
          <Outlet />
        </div>
        {/* Mobile bottom tabs removed for user panel */}
      </div>
      {/* Settings Modal */}
      <Modal
        title="Settings"
        open={showSettings}
        onClose={()=>{ setShowSettings(false); setTestMsg('') }}
        footer={(
          <>
            <button type="button" className="btn secondary" onClick={doLogout}>Logout</button>
            <button className="btn" onClick={()=>{ setTestMsg('Settings saved'); setTimeout(()=> setTestMsg(''), 1500) }}>Done</button>
          </>
        )}
      >
        <div className="section" style={{display:'grid', gap:16}}>
          <div className="card" style={{display:'grid', gap:8}}>
            <div className="card-title" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span>API Setup</span>
              <button
                className="btn"
                type="button"
                onClick={()=>{ setShowSettings(false); navigate('/user/api-setup') }}
                title="Open API Setup"
              >Open</button>
            </div>
            <div className="card-subtitle">Configure AI and Maps API keys for product generation and geocoding.</div>
          </div>

          <div className="card" style={{display:'grid', gap:8}}>
            <div className="card-title" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span>Error Logs</span>
              <button
                className="btn"
                type="button"
                onClick={()=>{ setShowSettings(false); navigate('/user/error-logs') }}
                title="View Error Logs"
              >Open</button>
            </div>
            <div className="card-subtitle">View and manage system error logs and debugging information.</div>
          </div>

          {testMsg && <div className="helper" style={{fontWeight:600}}>{testMsg}</div>}
        </div>
      </Modal>
    </div>
  )
}
