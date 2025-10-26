import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, NavLink, useNavigate } from 'react-router-dom'
import { API_BASE, apiGet } from '../api.js'

export default function AgentLayout() {
  const [closed, setClosed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )
  // Badges state
  const [unreadCount, setUnreadCount] = useState(0)
  const [ordersSubmitted, setOrdersSubmitted] = useState(0)
  const levelThresholds = useMemo(() => [0, 5, 50, 100, 250, 500], [])
  const levelIdx = useMemo(() => {
    const n = Number(ordersSubmitted || 0)
    let idx = 0
    for (let i = 0; i < levelThresholds.length; i++) {
      if (n >= levelThresholds[i]) idx = i
      else break
    }
    return idx
  }, [ordersSubmitted, levelThresholds])
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'dark'
    } catch {
      return 'dark'
    }
  })
  const [navColors, setNavColors] = useState(null)
  useEffect(() => {
    try {
      localStorage.setItem('theme', theme)
    } catch {}
    const root = document.documentElement
    if (theme === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }, [theme])
  // Initialize nav colors from localStorage
  useEffect(() => {
    try {
      const savedColors = JSON.parse(localStorage.getItem('navColors') || 'null')
      if (savedColors) {
        setNavColors(savedColors)
        Object.entries(savedColors).forEach(([k, v]) => {
          document.documentElement.style.setProperty(`--${k}`, v)
        })
      }
    } catch {}
  }, [])
  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Badges: unread inbox and orders submitted (for level & badge)
  useEffect(() => {
    let alive = true
    async function refresh() {
      try {
        const chats = await apiGet('/api/wa/chats')
        if (!alive) return
        const sum = Array.isArray(chats)
          ? chats.reduce((acc, c) => {
              const mc = typeof c.unreadCount === 'number' ? c.unreadCount : c.unread ? 1 : 0
              return acc + (mc || 0)
            }, 0)
          : 0
        setUnreadCount(sum)
      } catch {}
      try {
        const perf = await apiGet('/api/users/agents/me/performance')
        if (!alive) return
        setOrdersSubmitted(Number(perf?.ordersSubmitted || 0))
      } catch {}
    }
    refresh()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    const id = setInterval(refresh, 30000)
    return () => {
      alive = false
      window.removeEventListener('focus', onFocus)
      clearInterval(id)
    }
  }, [])
  // Remove welcome overlay and header greeting per request
  const links = [
    { to: '/agent', label: 'Dashboard' },
    { to: '/agent/inbox/whatsapp', label: 'WhatsApp Inbox' },
    { to: '/agent/quick-replies', label: 'Quick Replies' },
    { to: '/agent/orders', label: 'Submit Orders' },
    { to: '/agent/inhouse-products', label: 'Inhouse Products' },
    { to: '/agent/support', label: 'Support' },
  ]

  // Branding for header logo
  const [branding, setBranding] = useState({ headerLogo: null })
  const [me, setMe] = useState(() => { try{ return JSON.parse(localStorage.getItem('me')||'{}') }catch{ return {} } })
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const j = await apiGet('/api/settings/branding')
        if (!cancelled) setBranding({ headerLogo: j.headerLogo || null })
      } catch {}
      try{
        const r = await apiGet('/api/users/me')
        if (!cancelled) setMe(r?.user||{})
      }catch{}
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const mobileTabs = [
    {
      to: '/agent',
      label: 'Dashboard',
      icon: (
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
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      to: '/agent/inbox/whatsapp',
      label: 'Inbox',
      icon: (
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
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      to: '/agent/orders',
      label: 'Orders',
      icon: (
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
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      to: '/agent/inhouse-products',
      label: 'Products',
      icon: (
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
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      ),
    },
    {
      to: '/agent/me',
      label: 'Me',
      icon: (
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
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ]

  // On mobile, hide bottom tabs within the Inbox for a chat-focused UI
  const isInboxRoute = (location.pathname || '').includes('/inbox/whatsapp')
  const tabsVisible = isMobile && !isInboxRoute
  const hideSidebar = isMobile

  useEffect(() => {
    let startX = 0,
      startY = 0,
      startTime = 0,
      tracking = false
    function onTouchStart(e) {
      if (!e.touches || e.touches.length !== 1) return
      const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : ''
      if (['input', 'textarea', 'button', 'select'].includes(tag)) return
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      startTime = Date.now()
      tracking = true
    }
    function onTouchEnd(e) {
      if (!tracking) return
      tracking = false
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
      if (dx > 40 && fromEdge) {
        setClosed(false)
      } else if (dx < -40) {
        setClosed(true)
      }
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])
  // Swipe-back on inner pages (hide tabs): left-edge swipe right triggers history back
  useEffect(() => {
    if (!isMobile) return
    if (tabsVisible) return
    let sx = 0,
      sy = 0,
      started = false
    function ts(e) {
      if (!e.touches) return
      const t = e.touches[0]
      sx = t.clientX
      sy = t.clientY
      started = sx <= 24
    }
    function te(e) {
      if (!started) return
      const t = (e.changedTouches && e.changedTouches[0]) || null
      if (!t) return
      const dx = t.clientX - sx
      const dy = t.clientY - sy
      if (Math.abs(dy) < 60 && dx > 60) {
        navigate(-1)
      }
    }
    window.addEventListener('touchstart', ts, { passive: true })
    window.addEventListener('touchend', te, { passive: true })
    return () => {
      window.removeEventListener('touchstart', ts)
      window.removeEventListener('touchend', te)
    }
  }, [isMobile, tabsVisible])

  // Swatch helpers for header theme controls
  function applyNavColors(cfg) {
    if (!cfg) return
    const RESET_KEYS = ['sidebar-bg', 'sidebar-border', 'nav-active-bg', 'nav-active-fg']
    const { __theme, __reset, ...vars } = cfg
    if (__reset || Object.keys(vars).length === 0) {
      RESET_KEYS.forEach((k) => document.documentElement.style.removeProperty(`--${k}`))
      try {
        localStorage.removeItem('navColors')
      } catch {}
      setNavColors(null)
    } else {
      Object.entries(vars).forEach(([k, v]) => {
        document.documentElement.style.setProperty(`--${k}`, v)
      })
      localStorage.setItem('navColors', JSON.stringify(vars))
      setNavColors(vars)
    }
    if (__theme) {
      localStorage.setItem('theme', __theme)
      const root = document.documentElement
      if (__theme === 'dark') root.setAttribute('data-theme', 'dark')
      else root.removeAttribute('data-theme')
      setTheme(__theme)
    }
  }
  const navPresets = [
    {
      title: 'Default',
      cfg: { __reset: true },
      sample: 'linear-gradient(135deg,var(--panel-2),var(--panel))',
    },
    {
      title: 'Purple',
      cfg: {
        'sidebar-bg': '#1a1036',
        'sidebar-border': '#2b1856',
        'nav-active-bg': '#3f1d67',
        'nav-active-fg': '#f5f3ff',
      },
      sample: '#7c3aed',
    },
    {
      title: 'Green',
      cfg: {
        'sidebar-bg': '#06251f',
        'sidebar-border': '#0b3b31',
        'nav-active-bg': '#0f3f33',
        'nav-active-fg': '#c7f9ec',
      },
      sample: '#10b981',
    },
    {
      title: 'Blue',
      cfg: {
        'sidebar-bg': '#0b1220',
        'sidebar-border': '#223',
        'nav-active-bg': '#1e293b',
        'nav-active-fg': '#e2e8f0',
      },
      sample: '#2563eb',
    },
    {
      title: 'Slate',
      cfg: {
        'sidebar-bg': '#0f172a',
        'sidebar-border': '#1e293b',
        'nav-active-bg': '#1f2937',
        'nav-active-fg': '#e5e7eb',
      },
      sample: '#334155',
    },
    {
      title: 'Orange',
      cfg: {
        'sidebar-bg': '#2a1304',
        'sidebar-border': '#3b1d08',
        'nav-active-bg': '#4a1f0a',
        'nav-active-fg': '#ffedd5',
      },
      sample: '#f97316',
    },
    {
      title: 'Pink',
      cfg: {
        'sidebar-bg': '#2a0b17',
        'sidebar-border': '#3a0f20',
        'nav-active-bg': '#4b1026',
        'nav-active-fg': '#ffe4e6',
      },
      sample: '#ec4899',
    },
    {
      title: 'Light Pink',
      cfg: {
        'sidebar-bg': '#2b1020',
        'sidebar-border': '#3a152b',
        'nav-active-bg': '#4b1a36',
        'nav-active-fg': '#ffd7ef',
      },
      sample: '#f9a8d4',
    },
    {
      title: 'Blush',
      cfg: {
        __theme: 'light',
        'sidebar-bg': '#FFB5C0',
        'sidebar-border': '#f39bab',
        'nav-active-bg': '#ffdfe6',
        'nav-active-fg': '#111827',
      },
      sample: '#FFB5C0',
    },
    {
      title: 'White',
      cfg: {
        __theme: 'light',
        'sidebar-bg': '#ffffff',
        'sidebar-border': '#e5e7eb',
        'nav-active-bg': '#f1f5f9',
        'nav-active-fg': '#111827',
      },
      sample: '#ffffff',
    },
  ]

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
              {/* Back on inner pages; hamburger on root */}
              {isMobile && !tabsVisible ? (
                <button
                  className="btn secondary"
                  onClick={() => navigate(-1)}
                  title="Back"
                  aria-label="Back"
                  style={{
                    width: 36,
                    height: 36,
                    padding: 0,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  ←
                </button>
              ) : (
                <button
                  className="btn secondary"
                  onClick={() => setClosed((c) => !c)}
                  title={closed ? 'Open menu' : 'Close menu'}
                  aria-label={closed ? 'Open menu' : 'Close menu'}
                  style={{
                    width: 36,
                    height: 36,
                    padding: 0,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  ☰
                </button>
              )}
              {(() => {
                const fallback = `${import.meta.env.BASE_URL}BuySial2.png`
                const src = branding.headerLogo ? `${API_BASE}${branding.headerLogo}` : fallback
                return (
                  <img
                    src={src}
                    alt="BuySial"
                    style={{ height: 28, width: 'auto', objectFit: 'contain' }}
                  />
                )
              })()}
              {/* Agent identity chip */}
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
                <span aria-hidden>🧑‍💼</span>
                <span style={{ fontWeight: 800, letterSpacing: 0.3 }}>
                  {(String(me.firstName||'').split(' ')[0]||'').trim()} Agent
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Swatches left of theme toggle (desktop only) */}
              {!isMobile && (
                <div role="group" aria-label="Theme colors" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {navPresets.map((p) => {
                    const isActive = p.cfg.__reset ? !navColors : (navColors && JSON.stringify(navColors) === JSON.stringify(p.cfg))
                    return (
                      <button
                        key={p.title}
                        title={p.title}
                        className={`swatch ${isActive ? 'active' : ''}`}
                        onClick={() => applyNavColors(p.cfg)}
                        style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: p.sample }}
                      />
                    )
                  })}
                </div>
              )}
              <button
                className="icon-btn secondary"
                onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
                aria-label={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
                style={{ width: 36, height: 36, borderRadius: 10, padding: 0 }}
              >
                {theme === 'light' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                )}
              </button>
              <button type="button" className="btn danger" onClick={doLogout}>Logout</button>
            </div>
          </div>
        )}
        <div
          className={`container ${location.pathname.includes('/inbox/whatsapp') ? 'edge-to-edge' : ''}`}
        >
          <Outlet />
        </div>
      </div>
      {/* Mobile bottom tabs (root only) */}
      {tabsVisible && (
        <nav className="mobile-tabs" role="navigation" aria-label="Primary">
          {mobileTabs.map((tab) => {
            const isInbox = tab.to.includes('/inbox/whatsapp')
            const isOrders = tab.to.endsWith('/orders')
            const isMe = tab.to.endsWith('/me')
            const count = isInbox ? unreadCount : isOrders ? ordersSubmitted : 0
            const showCount = isInbox && count > 0
            // Show level badge when levelIdx > 0 (from Level 1 and above)
            const meBadge = isMe && levelIdx > 1 ? `Level ${levelIdx}` : ''
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/agent'}
                className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
              >
                <span className="icon" style={{ position: 'relative' }}>
                  {tab.icon}
                  {showCount && (
                    <span
                      className="badge"
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -10,
                        fontSize: 10,
                        padding: '0 6px',
                        borderRadius: 999,
                      }}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 11 }}>{tab.label}</span>
                {/* Removed orders count badge per request; keep inbox unread and level badges only */}
                {isMe && meBadge && (
                  <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>
                    {meBadge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>
      )}
      {/* Welcome overlay removed */}
    </div>
  )
}

// AgentWelcome component removed
