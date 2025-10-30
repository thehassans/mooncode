import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, NavLink, useNavigate } from 'react-router-dom'
import { API_BASE, apiGet, apiPatch } from '../api.js'

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
  const [showSettings, setShowSettings] = useState(false)
  const [availability, setAvailability] = useState('available')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [ringtone, setRingtone] = useState('shopify')
  const [showPassModal, setShowPassModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPass, setChangingPass] = useState(false)
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

  // Settings functions
  async function updateAvailability(val) {
    try {
      await apiPatch('/api/users/me/availability', { availability: val })
      setAvailability(val)
      setMe(n => {
        const updated = { ...n, availability: val }
        try {
          localStorage.setItem('me', JSON.stringify(updated))
        } catch {}
        return updated
      })
    } catch (err) {
      alert(err?.message || 'Failed to update availability')
    }
  }

  function storeSoundPrefs(enabled, tone) {
    try {
      localStorage.setItem('wa_sound', enabled ? 'true' : 'false')
      localStorage.setItem('wa_ringtone', tone)
    } catch {}
  }

  function playPreview() {
    if (!soundEnabled) {
      setSoundEnabled(true)
      storeSoundPrefs(true, ringtone)
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const toneAt = (when, freq, dur, type = 'sine', attack = 0.01, release = 0.1) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = type
        osc.frequency.value = freq
        osc.connect(gain)
        gain.connect(ctx.destination)
        const now = ctx.currentTime + when
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(0.3, now + attack)
        gain.gain.linearRampToValueAtTime(0, now + dur - release)
        osc.start(now)
        osc.stop(now + dur)
      }
      const n = ringtone || 'shopify'
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
        toneAt(0, 1200, 0.08)
        return
      }
      if (n === 'knock') {
        toneAt(0, 100, 0.05, 'square')
        toneAt(0.08, 100, 0.05, 'square')
        return
      }
      if (n === 'beep') {
        toneAt(0, 800, 0.15)
        return
      }
    } catch {}
  }

  async function handlePasswordChange(e) {
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
      await apiPatch('/api/users/me/password', {
        currentPassword,
        newPassword,
      })
      alert('Password changed successfully!')
      setShowPassModal(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      alert(err?.message || 'Failed to change password')
    } finally {
      setChangingPass(false)
    }
  }

  // Click outside to close settings
  useEffect(() => {
    function handleClickOutside(e) {
      if (showSettings && !e.target.closest('.settings-dropdown') && !e.target.closest('.settings-button')) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettings])

  // Initialize settings from localStorage and user data
  useEffect(() => {
    try {
      const v = localStorage.getItem('wa_sound')
      setSoundEnabled(v ? v !== 'false' : true)
    } catch {}
    try {
      setRingtone(localStorage.getItem('wa_ringtone') || 'shopify')
    } catch {}
    if (me?.availability) {
      setAvailability(me.availability)
    }
  }, [me])

  return (
    <div>
      <div
        className={`main ${hideSidebar ? 'full-mobile' : closed ? 'full' : ''} ${tabsVisible ? 'with-mobile-tabs' : ''}`}
      >
        {/* Professional topbar matching driver panel */}
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
                const src = branding.headerLogo ? `${API_BASE}${branding.headerLogo}` : fallback
                return (
                  <img
                    src={src}
                    alt="BuySial"
                    style={{ height: 36, width: 'auto', objectFit: 'contain' }}
                  />
                )
              })()}
              {/* Professional Agent identity chip */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
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
                  background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                  fontSize: '16px'
                }}>🧑‍💼</span>
                <div style={{display: 'flex', flexDirection: 'column', gap: '1px'}}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>Agent</span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>{me.firstName || 'Agent'} {me.lastName || ''}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, position: 'relative' }}>
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
                  top: '50%',
                  left: theme === 'dark' ? '32px' : '4px',
                  transform: 'translateY(-50%)',
                  width: '22px',
                  height: '22px',
                  background: theme === 'dark' ? 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)' : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  borderRadius: '50%',
                  transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px'
                }}>
                  {theme === 'dark' ? '🌙' : '☀️'}
                </div>
              </button>
              
              {/* Settings Button */}
              <button
                className="settings-button"
                onClick={() => setShowSettings(!showSettings)}
                title="Settings"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'var(--panel)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: showSettings ? '0 0 0 2px var(--accent)' : 'none'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 3.09V3a2 2 0 0 1 4 0v.09c0 .67.39 1.28 1 1.57h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0c.3.61.91 1 1.58 1H21a2 2 0 0 1 0 4h-.09c-.67 0-1.28.39-1.57 1z"/>
                </svg>
              </button>

              {/* Settings Dropdown */}
              {showSettings && (
                <div 
                  className="settings-dropdown"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    width: '320px',
                    maxHeight: '500px',
                    overflowY: 'auto',
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    padding: '12px'
                  }}
                >
                  <div style={{fontSize: '14px', fontWeight: 700, marginBottom: '12px', padding: '0 4px'}}>Settings</div>
                  
                  {/* Availability */}
                  <div style={{padding: '12px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                      <div style={{width: 20, height: 20, borderRadius: '50%', background: availability === 'available' ? '#10b981' : '#ef4444'}}></div>
                      <div style={{fontSize: '13px', fontWeight: 600}}>Availability</div>
                    </div>
                    <button
                      className={`btn small ${availability === 'available' ? 'success' : 'secondary'}`}
                      onClick={() => updateAvailability(availability === 'available' ? 'offline' : 'available')}
                      style={{fontSize: '11px', padding: '4px 10px'}}
                    >
                      {availability === 'available' ? 'Online' : 'Offline'}
                    </button>
                  </div>

                  {/* Notifications */}
                  <div style={{padding: '12px 8px', borderBottom: '1px solid var(--border)'}}>
                    <div style={{fontSize: '13px', fontWeight: 600, marginBottom: '8px'}}>Notifications</div>
                    <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
                      <select
                        className="input small"
                        value={ringtone}
                        onChange={(e) => {
                          setRingtone(e.target.value)
                          storeSoundPrefs(soundEnabled, e.target.value)
                        }}
                        style={{flex: 1, fontSize: '12px', padding: '4px 8px'}}
                      >
                        <option value="shopify">Shopify</option>
                        <option value="bell">Bell</option>
                        <option value="ping">Ping</option>
                        <option value="knock">Knock</option>
                        <option value="beep">Beep</option>
                      </select>
                      <button className="btn small secondary" onClick={playPreview} style={{fontSize: '11px', padding: '4px 10px'}}>Test</button>
                    </div>
                  </div>

                  {/* Profile */}
                  <div style={{padding: '12px 8px', borderBottom: '1px solid var(--border)'}}>
                    <button
                      className="btn small secondary"
                      onClick={() => {
                        setShowSettings(false)
                        navigate('/agent/me')
                      }}
                      style={{width: '100%', fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      Profile
                    </button>
                  </div>

                  {/* Payout Profile */}
                  <div style={{padding: '12px 8px', borderBottom: '1px solid var(--border)'}}>
                    <button
                      className="btn small secondary"
                      onClick={() => {
                        setShowSettings(false)
                        navigate('/agent/me')
                      }}
                      style={{width: '100%', fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <path d="M2 10h20"/>
                        <circle cx="16" cy="14" r="2"/>
                      </svg>
                      Payout Profile
                    </button>
                  </div>

                  {/* Change Password */}
                  <div style={{padding: '12px 8px', borderBottom: '1px solid var(--border)'}}>
                    <button
                      className="btn small secondary"
                      onClick={() => {
                        setShowPassModal(true)
                        setShowSettings(false)
                      }}
                      style={{width: '100%', fontSize: '12px', padding: '6px 12px'}}
                    >
                      Change Password
                    </button>
                  </div>

                  {/* Logout */}
                  <div style={{padding: '12px 8px'}}>
                    <button
                      className="btn small danger"
                      onClick={() => {
                        setShowSettings(false)
                        doLogout()
                      }}
                      style={{width: '100%', fontSize: '12px', padding: '6px 12px'}}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
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
            const count = isInbox ? unreadCount : 0
            const showCount = isInbox && count > 0
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
              </NavLink>
            )
          })}
        </nav>
      )}
      {/* Welcome overlay removed */}
      
      {/* Password Change Modal */}
      {showPassModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPassModal(false)
          }}
        >
          <div
            style={{
              background: 'var(--panel)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}
          >
            <h3 style={{margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700}}>Change Password</h3>
            <form onSubmit={handlePasswordChange} style={{display: 'grid', gap: '12px'}}>
              <div>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600}}>Current Password</label>
                <input
                  type="password"
                  className="input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600}}>New Password</label>
                <input
                  type="password"
                  className="input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 600}}>Confirm New Password</label>
                <input
                  type="password"
                  className="input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                <button type="submit" className="btn" disabled={changingPass} style={{flex: 1}}>
                  {changingPass ? 'Changing...' : 'Change Password'}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowPassModal(false)}
                  disabled={changingPass}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// AgentWelcome component removed
