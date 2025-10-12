import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, NavLink, useNavigate } from 'react-router-dom'
import { API_BASE, apiGet } from '../api.js'

export default function DriverLayout() {
  const [closed, setClosed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'dark'
    } catch {
      return 'dark'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('theme', theme)
    } catch {}
    const root = document.documentElement
    if (theme === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }, [theme])
  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const me = JSON.parse(localStorage.getItem('me') || '{}')
  // Driver level for badge (based on delivered orders)
  const [deliveredCount, setDeliveredCount] = useState(0)
  const levelThresholds = useMemo(()=>[0,10,50,100,250,500], [])
  const levelIdx = useMemo(()=>{
    const n = Number(deliveredCount||0)
    let idx = 0
    for (let i=0;i<levelThresholds.length;i++){ if (n >= levelThresholds[i]) idx = i; else break }
    return idx
  }, [deliveredCount, levelThresholds])
  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{ const m = await apiGet('/api/orders/driver/metrics'); if (alive) setDeliveredCount(Number(m?.status?.delivered||0)) }catch{}
    })()
    return ()=>{ alive = false }
  }, [])

  const mobileTabs = [
    {
      to: '/driver',
      label: 'Dashboard',
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      to: '/driver/panel',
      label: 'Panel',
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      to: '/driver/orders/history',
      label: 'History',
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      to: '/driver/payout',
      label: 'Payout',
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M2 10h20" />
          <circle cx="16" cy="14" r="2" />
        </svg>
      ),
    },
    {
      to: '/driver/me',
      label: 'Me',
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M6 20a6 6 0 0 1 12 0" />
        </svg>
      ),
    },
  ]

  const tabsVisible = isMobile
  const hideSidebar = isMobile

  function doLogout() {
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('me')
      localStorage.removeItem('navColors')
    } catch {}
    try {
      navigate('/login', { replace: true })
    } catch {}
    setTimeout(() => {
      try {
        window.location.assign('/login')
      } catch {}
    }, 30)
  }

  return (
    <div>
      <div
        className={`main ${hideSidebar ? 'full-mobile' : closed ? 'full' : ''} ${tabsVisible ? 'with-mobile-tabs' : ''}`}
      >
        {/* Show topbar on all viewports to allow theme toggle and identity on mobile */}
        {(
          <div
            className="topbar"
            style={{
              background: 'var(--sidebar-bg)',
              borderBottom: '1px solid var(--sidebar-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48 }}>
              <button
                className="btn secondary"
                onClick={() => setClosed((c) => !c)}
                title={closed ? 'Open menu' : 'Close menu'}
                aria-label={closed ? 'Open menu' : 'Close menu'}
                style={{ width: 36, height: 36, padding: 0, display: 'grid', placeItems: 'center' }}
              >
                ☰
              </button>
              {(() => {
                const fallback = `${import.meta.env.BASE_URL}BuySial2.png`
                const src = me.headerLogo ? `${API_BASE}${me.headerLogo}` : fallback
                return (
                  <img
                    src={src}
                    alt="BuySial"
                    style={{ height: 28, width: 'auto', objectFit: 'contain' }}
                  />
                )
              })()}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                }}
              >
                <span aria-hidden>🚚</span>
                <span style={{ fontWeight: 800, letterSpacing: 0.3 }}>
                  {(String(me.firstName||'').split(' ')[0]||'').trim()} Driver
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="icon-btn secondary"
                onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
                aria-label={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
                style={{ width: 36, height: 36, borderRadius: 10, padding: 0 }}
              >
                {theme === 'light' ? (
                  // Moon icon
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  // Sun icon
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                )}
              </button>
              <button type="button" className="btn danger" onClick={doLogout}>
                Logout
              </button>
            </div>
          </div>
        )}
        <div
          className={`container ${location.pathname.includes('/inbox/whatsapp') ? 'edge-to-edge' : ''}`}
        >
          <Outlet />
        </div>
      </div>
      {tabsVisible && (
        <nav className="mobile-tabs" role="navigation" aria-label="Primary" style={{gap:6}}>
          {mobileTabs.map((tab) => {
            const isMe = tab.to.endsWith('/me')
            const meBadge = isMe && levelIdx > 1 ? `Level ${levelIdx}` : ''
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/driver'}
                className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
                style={{padding:'8px 6px'}}
              >
                <span className="icon" style={{position:'relative'}}>
                  {tab.icon}
                </span>
                <span style={{ fontSize: 11 }}>{tab.label}</span>
                {isMe && meBadge && (
                  <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>{meBadge}</span>
                )}
              </NavLink>
            )
          })}
        </nav>
      )}
    </div>
  )
}
