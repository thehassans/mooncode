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
  // Settings modal
  const [showSettings, setShowSettings] = useState(false)
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
        {/* Professional topbar matching user panel */}
        {(
          <div
            className="topbar"
            style={{
              background: 'var(--sidebar-bg)',
              borderBottom: '1px solid var(--sidebar-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'nowrap',
              minHeight: '60px',
              padding: '0 1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              {(() => {
                const fallback = `${import.meta.env.BASE_URL}BuySial2.png`
                const src = me.headerLogo ? `${API_BASE}${me.headerLogo}` : fallback
                return (
                  <img
                    src={src}
                    alt="BuySial"
                    style={{ height: 36, width: 'auto', objectFit: 'contain' }}
                  />
                )
              })()}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  whiteSpace: 'nowrap'
                }}
              >
                <span aria-hidden style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
                  boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
                  fontSize: '16px'
                }}>🚚</span>
                <div style={{display: 'flex', flexDirection: 'column', gap: '1px'}}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>Driver</span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>{me.firstName || 'Driver'} {me.lastName || ''}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {/* Premium Theme Toggle */}
              <button
                onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                aria-label={theme === 'light' ? 'Dark mode' : 'Light mode'}
                style={{
                  position: 'relative',
                  width: '60px',
                  height: '30px',
                  background: theme === 'dark' ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                  borderRadius: '15px',
                  border: theme === 'dark' ? '2px solid #334155' : '2px solid #cbd5e1',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: theme === 'dark' ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.1)',
                  padding: 0,
                  overflow: 'hidden'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  left: theme === 'dark' ? '2px' : '30px',
                  width: '22px',
                  height: '22px',
                  background: theme === 'dark' ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' : 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                  borderRadius: '50%',
                  transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {theme === 'light' ? '🌙' : '☀️'}
                </div>
              </button>
              {/* Settings Icon Button */}
              <button
                type="button"
                className="icon-btn secondary"
                onClick={() => setShowSettings(true)}
                title="Settings"
                aria-label="Settings"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
                  border: '2px solid rgba(99, 102, 241, 0.3)',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2l4.2-4.2"/>
                </svg>
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
      {/* Settings Modal */}
      {showSettings && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
          onClick={() => setShowSettings(false)}
        >
          <div
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  padding: 0,
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ padding: '12px', background: 'var(--panel-2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Name</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{me.firstName || 'Driver'} {me.lastName || ''}</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--panel-2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Email</div>
                <div style={{ fontSize: '14px' }}>{me.email || 'N/A'}</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--panel-2)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Phone</div>
                <div style={{ fontSize: '14px' }}>{me.phone || 'N/A'}</div>
              </div>
              <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className="btn danger"
                  onClick={doLogout}
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
