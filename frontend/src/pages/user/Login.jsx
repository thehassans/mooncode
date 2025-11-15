import React, { useEffect, useState } from 'react'
import PasswordInput from '../../components/PasswordInput.jsx'
import { API_BASE, apiGet, apiPost } from '../../api.js'
import { useToast } from '../../ui/Toast.jsx'

export default function UserLogin() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState({ ok: false, dbLabel: 'unknown' })
  const [branding, setBranding] = useState({ headerLogo: null, loginLogo: null })

  // Check if user is already logged in and redirect
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const me = JSON.parse(localStorage.getItem('me') || '{}')
        if (me.role === 'admin') location.href = '/admin'
        else if (me.role === 'agent') location.href = '/agent'
        else if (me.role === 'manager') location.href = '/manager'
        else if (me.role === 'investor') location.href = '/investor'
        else if (me.role === 'driver') location.href = '/driver'
        else if (me.role === 'user') location.href = '/user'
      } catch {}
    }
  }, [])

  // Health check with backoff; stop once healthy
  useEffect(() => {
    let cancelled = false
    let attempt = 0
    const delays = [3000, 7000, 15000, 30000]
    async function run() {
      try {
        const j = await apiGet('/api/health')
        if (cancelled) return
        const dbLabel = j?.db?.label || 'unknown'
        const ok = j?.status === 'ok'
        setHealth({ ok, dbLabel })
        if (!ok) {
          const d = delays[Math.min(attempt, delays.length - 1)]
          attempt++
          setTimeout(() => {
            if (!cancelled) run()
          }, d)
        }
      } catch {
        if (cancelled) return
        setHealth({ ok: false, dbLabel: 'unreachable' })
        const d = delays[Math.min(attempt, delays.length - 1)]
        attempt++
        setTimeout(() => {
          if (!cancelled) run()
        }, d)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  // Load branding (public, no auth needed)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const j = await apiGet('/api/settings/branding')
        if (!cancelled)
          setBranding({ headerLogo: j.headerLogo || null, loginLogo: j.loginLogo || null })
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function login(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await apiPost('/api/auth/login', { email, password })
      localStorage.setItem('token', data.token)
      localStorage.setItem('me', JSON.stringify(data.user))
      if (data.user.role === 'admin') location.href = '/admin'
      else if (data.user.role === 'agent') location.href = '/agent'
      else if (data.user.role === 'manager') location.href = '/manager'
      else if (data.user.role === 'investor') location.href = '/investor'
      else if (data.user.role === 'driver') location.href = '/driver'
      else location.href = '/user'
    } catch (e) {
      const status = e?.status
      const msg = String(e?.message || '')
      if (status === 429) {
        toast.info('Too many requests. Please wait a few seconds and try again.')
      } else if (status === 400 || /invalid|incorrect|credentials|password|email/i.test(msg)) {
        toast.error('Incorrect email or password')
      } else {
        toast.error(msg || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const fallbackLogo = `${import.meta.env.BASE_URL}BuySial2.png`
  const logoSrc = branding.loginLogo ? `${API_BASE}${branding.loginLogo}` : fallbackLogo

  return (
    <div className="login-root">
      {/* Header bar transparent on login to reveal gradient */}
      <div
        className="header flex items-center justify-center py-2"
        style={{ background: 'transparent', borderBottom: '1px solid transparent' }}
      >
        {/* Brand removed per request to keep header clean on login */}
      </div>

      {/* Main content */}
      <div className="login-main">
        <div className="login-shell">
          <div className="login-grid">
            <div className="login-left">
              <div className="login-left-top">
                <div className="login-logo-badge">
                  <img src={logoSrc} alt="BuySial" className="login-logo" />
                </div>
              </div>
              <div className="login-left-copy">
                <h1 className="login-heading" style={{ color: '#23559D' }}>
                  Welcome to BuyS<span style={{ color: '#EC8538' }}>ia</span>l
                </h1>
                <p className="login-subtext">Sign in to continue to your workspace dashboard.</p>
              </div>
            </div>
            <div className="login-right">
              <form onSubmit={login} className="login-card" aria-busy={loading}>
                <div className="login-card-header">
                  <div className="login-card-title">Sign in to continue</div>
                  <div className="login-card-subtitle">
                    Use your email and password to access your dashboard.
                  </div>
                </div>

                <div>
                  <div className="label">Email</div>
                  <div className="login-field">
                    <div className="login-field-icon" aria-hidden>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
                        <path
                          d="M4 20.5C4.8 17.5 8 15 12 15C16 15 19.2 17.5 20 20.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <input
                      className="input login-field-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@buysial.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
                <div>
                  <div className="label">Password</div>
                  <div className="login-field">
                    <div className="login-field-icon" aria-hidden>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect
                          x="5"
                          y="10"
                          width="14"
                          height="10"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                        <path
                          d="M8 10V8.5C8 6.57 9.57 5 11.5 5H12.5C14.43 5 16 6.57 16 8.5V10"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <PasswordInput
                      value={password}
                      onChange={setPassword}
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <div className="login-forgot-row">
                  <a
                    className="login-forgot-link"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      toast.info('Forgot password coming soon')
                    }}
                  >
                    Forgot password?
                  </a>
                </div>

                <button className="btn login-submit" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner mr-2 align-middle"></span>Signing in…
                    </>
                  ) : (
                    'Login'
                  )}
                </button>

                <div className="login-health">
                  {(() => {
                    const dbLabel = String(health.dbLabel || '').toLowerCase()
                    const allGood = health.ok && dbLabel === 'connected'
                    if (allGood) return null
                    const apiLabel = health.ok ? 'ok' : 'down'
                    const statusText = `API: ${apiLabel} · DB: ${health.dbLabel || 'unknown'}`
                    return (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          className="btn danger"
                          title={statusText}
                          onClick={() => window.location.reload()}
                        >
                          Connection issue
                        </button>
                      </div>
                    )
                  })()}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
