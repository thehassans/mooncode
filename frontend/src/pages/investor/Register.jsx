import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { apiPost, apiGet, API_BASE } from '../../api.js'
import { useToast } from '../../ui/Toast.jsx'
import PasswordInput from '../../components/PasswordInput.jsx'

export default function InvestorRegister() {
  const toast = useToast()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    country: 'UAE',
    acceptTerms: false,
  })
  const [loading, setLoading] = useState(false)
  const [branding, setBranding] = useState({ headerLogo: null, loginLogo: null })
  const [referralCode, setReferralCode] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const j = await apiGet('/api/settings/branding')
        if (!cancelled)
          setBranding({ headerLogo: j.headerLogo || null, loginLogo: j.loginLogo || null })
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const r = sp.get('ref') || ''
      if (r) setReferralCode(r)
    } catch {}
  }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      toast.error('First name is required')
      return false
    }
    if (!formData.lastName.trim()) {
      toast.error('Last name is required')
      return false
    }
    if (!formData.email.trim()) {
      toast.error('Email is required')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error('Please enter a valid email address')
      return false
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return false
    }
    if (!formData.acceptTerms) {
      toast.error('Please accept the terms and conditions')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      const registrationData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim(),
        country: formData.country,
        referralCode: referralCode || undefined,
        referredBy: referralCode || undefined,
      }

      const data = await apiPost('/api/auth/register-investor', registrationData)

      toast.success('Registration successful! Redirecting to your dashboard...')

      if (data.token) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('me', JSON.stringify(data.user))
        window.location.href = '/investor'
      }
    } catch (err) {
      const status = err?.status
      const msg = String(err?.message || '')

      if (status === 409 || msg.includes('already exists')) {
        toast.error('An account with this email already exists')
      } else if (status === 404) {
        toast.error(msg || 'Not found. Please check the information and try again.')
      } else if (status === 400) {
        toast.error(msg || 'Please check your information and try again')
      } else {
        toast.error(msg || 'Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <div
        className="header flex items-center justify-between px-6 py-4"
        style={{ background: 'transparent', borderBottom: '1px solid transparent' }}
      >
        <Link
          to="/catalog"
          className="flex items-center gap-2 text-white transition-colors hover:text-orange-200"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Catalog
        </Link>
        <Link
          to="/login"
          className="font-medium text-white transition-colors hover:text-orange-200"
        >
          Already an investor? Sign In
        </Link>
      </div>
      <div className="login-main">
        <div className="login-shell">
          <div className="login-grid">
            <div className="login-left">
              <div className="login-left-top">
                {(() => {
                  const fallback = `${import.meta.env.BASE_URL}BuySial2.png`
                  const src = branding.loginLogo ? `${API_BASE}${branding.loginLogo}` : fallback
                  return (
                    <img
                      src={src}
                      alt="BuySial"
                      className="login-logo"
                      style={{ height: 72, width: 'auto' }}
                    />
                  )
                })()}
              </div>
              <div className="login-left-copy">
                <div className="login-eyebrow">
                  Welcome to <span className="login-heading-buysl">BuyS</span>
                  <span className="login-heading-ia">ia</span>
                  <span className="login-heading-buysl">l</span>
                </div>
                <h1 className="login-heading">Create your account</h1>
                <p className="login-subtext">It takes just a minute and it’s free.</p>
              </div>
            </div>
            <div className="login-right">
              <form onSubmit={handleSubmit} className="login-card" aria-busy={loading}>
                <div className="login-card-header">
                  <div className="login-card-title">Investor Sign Up</div>
                  <div className="login-card-subtitle">
                    Create your investor account and access your dashboard.
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label
                    htmlFor="referralCode"
                    className="mb-1 block text-sm font-medium text-gray-300"
                  >
                    Referral Code (optional)
                  </label>
                  <input
                    id="referralCode"
                    name="referralCode"
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    className="input login-field-input"
                    placeholder="Enter referral code if you have one"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="firstName"
                      className="mb-1 block text-sm font-medium text-gray-300"
                    >
                      First Name *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      className="input login-field-input"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lastName"
                      className="mb-1 block text-sm font-medium text-gray-300"
                    >
                      Last Name *
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      className="input login-field-input"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-300">
                    Your Email (for login) *
                  </label>
                  <div className="login-field">
                    <div className="login-field-icon" aria-hidden>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="input login-field-input"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-300">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="input login-field-input"
                      placeholder="+971 50 123 4567"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="country"
                      className="mb-1 block text-sm font-medium text-gray-300"
                    >
                      Country
                    </label>
                    <select
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className="input login-field-input"
                    >
                      <option value="UAE">UAE</option>
                      <option value="Oman">Oman</option>
                      <option value="KSA">Saudi Arabia</option>
                      <option value="Bahrain">Bahrain</option>
                      <option value="India">India</option>
                      <option value="Kuwait">Kuwait</option>
                      <option value="Qatar">Qatar</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1 block text-sm font-medium text-gray-300"
                  >
                    Password *
                  </label>
                  <div className="login-field">
                    <div className="login-field-icon" aria-hidden>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={(value) => setFormData((prev) => ({ ...prev, password: value }))}
                      required
                      placeholder="Enter your password"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Must be at least 6 characters long</p>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-1 block text-sm font-medium text-gray-300"
                  >
                    Confirm Password *
                  </label>
                  <div className="login-field">
                    <div className="login-field-icon" aria-hidden>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={(value) =>
                        setFormData((prev) => ({ ...prev, confirmPassword: value }))
                      }
                      required
                      placeholder="Confirm your password"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="acceptTerms"
                    name="acceptTerms"
                    checked={formData.acceptTerms}
                    onChange={handleChange}
                    required
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
                  />
                  <label htmlFor="acceptTerms" className="text-sm text-gray-300">
                    I agree to the{' '}
                    <Link to="/terms" className="text-emerald-300 underline hover:text-emerald-200">
                      Terms and Conditions
                    </Link>{' '}
                    and{' '}
                    <Link
                      to="/privacy"
                      className="text-emerald-300 underline hover:text-emerald-200"
                    >
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                <button type="submit" disabled={loading} className="btn login-submit w-full">
                  {loading ? 'Creating Account...' : 'Create Investor Account'}
                </button>

                <div className="text-center text-sm text-gray-300">
                  Already an investor?{' '}
                  <Link to="/login" className="font-medium text-emerald-300 hover:text-emerald-200">
                    Sign in here
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
