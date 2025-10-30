import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, NavLink, useNavigate } from 'react-router-dom'
import { API_BASE, apiGet, apiPatch } from '../api.js'

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

  const [me, setMe] = useState(() => { try{ return JSON.parse(localStorage.getItem('me')||'{}') }catch{ return {} } })
  // Settings
  const [showSettings, setShowSettings] = useState(false)
  const [availability, setAvailability] = useState('available')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [ringtone, setRingtone] = useState('shopify')
  const [showPassModal, setShowPassModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPass, setChangingPass] = useState(false)
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
                        navigate('/driver/me')
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

                  {/* Payout */}
                  <div style={{padding: '12px 8px', borderBottom: '1px solid var(--border)'}}>
                    <button
                      className="btn small secondary"
                      onClick={() => {
                        setShowSettings(false)
                        navigate('/driver/payout')
                      }}
                      style={{width: '100%', fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <path d="M2 10h20"/>
                        <circle cx="16" cy="14" r="2"/>
                      </svg>
                      Payout
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
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowPassModal(false)}
                  style={{flex: 1}}
                  disabled={changingPass}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  style={{flex: 1}}
                  disabled={changingPass}
                >
                  {changingPass ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
