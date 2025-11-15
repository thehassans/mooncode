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
  useEffect(() => {
    try {
      localStorage.setItem('theme', theme)
    } catch {}
    const root = document.documentElement
    if (theme === 'light') root.setAttribute('data-theme', 'light')
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
          'radial-gradient(1200px circle at top, rgba(129,140,248,0.18), transparent), radial-gradient(1200px circle at bottom, rgba(248,113,113,0.16), #020617)',
        color: 'var(--text)',
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
        {!isMobile && (
          <div
            className="topbar"
            style={{
              background:
                'linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15))',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(102, 126, 234, 0.2)',
              boxShadow: '0 4px 24px rgba(102, 126, 234, 0.12)',
              position: 'sticky',
              top: 0,
              zIndex: 100,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 56 }}>
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
                  background: 'rgba(102, 126, 234, 0.15)',
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: 18,
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)',
                  transition: 'all 0.3s ease',
                }}
              >
                ☰
              </button>
              {closed &&
                (() => {
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
                        filter: 'drop-shadow(0 2px 8px rgba(102, 126, 234, 0.3))',
                      }}
                    />
                  )
                })()}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 20px',
                  borderRadius: 999,
                  background:
                    'linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2))',
                  border: '1px solid rgba(102, 126, 234, 0.4)',
                  boxShadow:
                    '0 4px 16px rgba(102, 126, 234, 0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: 20,
                    filter: 'drop-shadow(0 2px 4px rgba(102, 126, 234, 0.5))',
                  }}
                >
                  💼
                </span>
                <span
                  style={{
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontSize: 15,
                  }}
                >
                  {`Investor ${me.firstName || ''} ${me.lastName || ''}`.trim()}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {closed && (
                <>
                  <button
                    className="btn secondary"
                    onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                    title="Toggle theme"
                    style={{
                      background: 'rgba(102, 126, 234, 0.15)',
                      border: '1px solid rgba(102, 126, 234, 0.3)',
                      borderRadius: '10px',
                      fontWeight: 600,
                      padding: '8px 16px',
                      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)',
                    }}
                  >
                    {theme === 'light' ? '🌙 Dark' : '🌞 Light'}
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={doLogout}
                    style={{
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: 600,
                      padding: '8px 16px',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>
        )}
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
            background:
              'linear-gradient(180deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.15))',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(102, 126, 234, 0.25)',
            boxShadow: '0 -4px 24px rgba(102, 126, 234, 0.15)',
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
