import React, { useEffect, useState } from 'react'
import { Outlet, useLocation, NavLink, useNavigate } from 'react-router-dom'
import { API_BASE } from '../api.js'

export default function InvestorLayout() {
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
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme)
    } catch {}
    const root = document.documentElement
    if (theme === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }, [theme])

  useEffect(() => {
    function handleClickOutside(e) {
      if (!showSettings) return
      const dropdown = document.querySelector('.investor-settings-dropdown')
      const button = document.querySelector('.investor-settings-button')
      if (dropdown && dropdown.contains(e.target)) return
      if (button && button.contains(e.target)) return
      setShowSettings(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettings])
  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const me = JSON.parse(localStorage.getItem('me') || '{}')

  const mobileTabs = [
    {
      to: '/investor',
      label: 'Plans',
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
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        </svg>
      ),
    },
    {
      to: '/investor/referrals',
      label: 'Referrals',
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
          <path d="M7 7h.01M17 7h.01M12 3a9 9 0 1 0 9 9" />
          <path d="M12 12l7-3-3 7-2-3-2 3-3-7 3 3z" />
        </svg>
      ),
    },
    {
      to: '/investor/my-invest',
      label: 'My Invest',
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
          <path d="M12 1v22" />
          <path d="M5 8h14" />
          <path d="M7 12h10" />
          <path d="M9 16h6" />
        </svg>
      ),
    },
    {
      to: '/investor/profile',
      label: 'Profile',
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
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
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
    <div
      style={{
        minHeight: '100vh',
        background:
          theme === 'light'
            ? 'radial-gradient(1200px circle at top, rgba(59,130,246,0.10), transparent), radial-gradient(1200px circle at bottom, rgba(16,185,129,0.08), var(--bg))'
            : 'radial-gradient(1200px circle at top, rgba(129,140,248,0.18), transparent), radial-gradient(1200px circle at bottom, rgba(248,113,113,0.16), #020617)',
        color: 'var(--fg)',
      }}
    >
      <div
        className={`main ${hideSidebar ? 'full-mobile' : closed ? 'full' : ''} ${tabsVisible ? 'with-mobile-tabs' : ''}`}
      >
        {!isMobile && !closed && (
          <aside
            className="sidebar"
            style={{
              background:
                'linear-gradient(180deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.08) 100%)',
              backdropFilter: 'blur(20px)',
              borderRight: '1px solid rgba(102, 126, 234, 0.2)',
              boxShadow: '4px 0 24px rgba(102, 126, 234, 0.12)',
            }}
          >
            <div
              style={{
                padding: '20px 16px',
                borderBottom: '1px solid rgba(102, 126, 234, 0.15)',
                background:
                  'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
                backdropFilter: 'blur(10px)',
              }}
            >
              {(() => {
                const fallback = `${import.meta.env.BASE_URL}BuySial2.png`
                const src = me.headerLogo ? `${API_BASE}${me.headerLogo}` : fallback
                return (
                  <img
                    src={src}
                    alt="BuySial"
                    style={{
                      height: 36,
                      width: 'auto',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 2px 8px rgba(102, 126, 234, 0.3))',
                    }}
                  />
                )
              })()}
            </div>
            <nav style={{ padding: '12px 8px' }}>
              <NavLink
                to="/investor"
                end
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                style={{
                  margin: '4px 0',
                  borderRadius: '12px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
                <span>Plans</span>
              </NavLink>
              <NavLink
                to="/investor/referrals"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                style={{
                  margin: '4px 0',
                  borderRadius: '12px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 13a5 5 0 0 1 7-7l2 2a5 5 0 0 1-7 7l-1-1" />
                  <path d="M14 11a5 5 0 0 1-7 7l-2-2a5 5 0 0 1 7-7l1 1" />
                </svg>
                <span>Referrals</span>
              </NavLink>
              <NavLink
                to="/investor/my-invest"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                style={{
                  margin: '4px 0',
                  borderRadius: '12px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span>My Invest</span>
              </NavLink>
              <NavLink
                to="/investor/profile"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                style={{
                  margin: '4px 0',
                  borderRadius: '12px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Profile</span>
              </NavLink>
            </nav>
            <div
              style={{
                marginTop: 'auto',
                padding: '16px 12px',
                borderTop: '1px solid rgba(102, 126, 234, 0.15)',
                background: 'linear-gradient(180deg, transparent, rgba(102, 126, 234, 0.05))',
              }}
            >
              <button
                className="btn secondary"
                onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                style={{
                  width: '100%',
                  marginBottom: 10,
                  background: 'rgba(102, 126, 234, 0.1)',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  backdropFilter: 'blur(10px)',
                  fontWeight: 600,
                }}
              >
                {theme === 'light' ? '🌙 Dark Mode' : '🌞 Light Mode'}
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={doLogout}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  fontWeight: 600,
                }}
              >
                Logout
              </button>
            </div>
          </aside>
        )}
        {
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
              padding: '0 1rem',
              boxShadow: '0 4px 24px rgba(15,23,42,0.45)',
              position: 'sticky',
              top: 0,
              zIndex: 100,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
              }}
            >
              {!isMobile && (
                <button
                  className="btn secondary"
                  onClick={() => setClosed((c) => !c)}
                  title={closed ? 'Open menu' : 'Close menu'}
                  aria-label={closed ? 'Open menu' : 'Close menu'}
                  style={{
                    width: 40,
                    height: 40,
                    padding: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 18,
                    boxShadow: '0 2px 8px rgba(15,23,42,0.35)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  ☰
                </button>
              )}
              {(() => {
                const fallback = `${import.meta.env.BASE_URL}BuySial2.png`
                const src = me.headerLogo ? `${API_BASE}${me.headerLogo}` : fallback
                return (
                  <img
                    src={src}
                    alt="BuySial"
                    style={{
                      height: 32,
                      width: 'auto',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 2px 8px rgba(15,23,42,0.4))',
                    }}
                  />
                )
              })()}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 16px',
                  borderRadius: 12,
                  background:
                    'linear-gradient(135deg, rgba(56,189,248,0.12) 0%, rgba(129,140,248,0.14) 100%)',
                  border: '1px solid rgba(59,130,246,0.35)',
                  boxShadow: '0 4px 16px rgba(15,23,42,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(10px)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
                    fontSize: 16,
                  }}
                >
                  💼
                </span>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      background: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    Investor Panel
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: -0.02,
                      background: 'linear-gradient(135deg, #e5e7eb 0%, #ffffff 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {`${me.firstName || 'Investor'} ${me.lastName || ''}`.trim()}
                  </span>
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <button
                className="btn secondary"
                onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                style={{
                  position: 'relative',
                  width: 60,
                  height: 30,
                  background:
                    theme === 'dark'
                      ? 'linear-gradient(135deg, #0f172a 0%, #020617 100%)'
                      : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                  borderRadius: 15,
                  border: theme === 'dark' ? '2px solid #1f2937' : '2px solid #cbd5e1',
                  cursor: 'pointer',
                  padding: 0,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: theme === 'dark' ? 32 : 4,
                    transform: 'translateY(-50%)',
                    width: 22,
                    height: 22,
                    borderRadius: '999px',
                    background:
                      theme === 'dark'
                        ? 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)'
                        : 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
                    boxShadow: '0 2px 6px rgba(15,23,42,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    transition: 'left 0.3s ease',
                  }}
                >
                  {theme === 'dark' ? '🌙' : '☀️'}
                </div>
              </button>
              <button
                type="button"
                className="btn secondary investor-settings-button"
                title="Investor settings"
                onClick={() => setShowSettings((s) => !s)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--panel)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
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
              </button>
              {showSettings && (
                <div
                  className="investor-settings-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 220,
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(15,23,42,0.6)',
                    padding: 8,
                    zIndex: 200,
                  }}
                >
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      setShowSettings(false)
                      navigate('/investor/profile')
                    }}
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      padding: '8px 10px',
                      borderRadius: 8,
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => {
                      setShowSettings(false)
                      doLogout()
                    }}
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      padding: '8px 10px',
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        }
        <div
          className={`container ${location.pathname.includes('/inbox/whatsapp') ? 'edge-to-edge' : ''}`}
          style={{
            padding: '24px',
            maxWidth: 1400,
            margin: '0 auto',
          }}
        >
          <Outlet />
        </div>
      </div>
      {tabsVisible && (
        <nav
          className="mobile-tabs"
          role="navigation"
          aria-label="Primary"
          style={{
            background: 'var(--panel-2)',
            borderTop: '1px solid var(--border)',
            boxShadow: '0 -4px 24px rgba(15,23,42,0.85)',
          }}
        >
          {mobileTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/investor'}
              className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
              style={{
                transition: 'all 0.3s ease',
              }}
            >
              <span className="icon">{tab.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{tab.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
