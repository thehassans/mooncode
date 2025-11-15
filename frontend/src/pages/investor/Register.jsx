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
    ownerEmail: '',
    acceptTerms: false,
  })
  const [loading, setLoading] = useState(false)
  const [branding, setBranding] = useState({ headerLogo: null, loginLogo: null })

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
    if (!formData.ownerEmail.trim()) {
      toast.error('Owner email is required')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) {
      toast.error('Please enter a valid owner email')
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
        ownerEmail: formData.ownerEmail.trim().toLowerCase(),
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
      } else if (status === 404 || msg.toLowerCase().includes('owner')) {
        toast.error(msg || 'Workspace owner not found. Please check the owner email.')
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
    <div className="animated-gradient grid min-h-[100dvh] grid-rows-[auto_1fr]">
      <div
        className="header flex items-center justify-between px-6 py-4"
        style={{
          background: 'rgba(255,255,255,0.1)',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
        }}
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

      <div className="grid place-items-center p-6">
        <form
          onSubmit={handleSubmit}
          className="card grid w-full max-w-lg gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)]"
          aria-busy={loading}
        >
          <div className="mb-4 grid place-items-center gap-2">
            {(() => {
              const fallback = `${import.meta.env.BASE_URL}BuySial2.png`
              const src = branding.loginLogo ? `${API_BASE}${branding.loginLogo}` : fallback
              return (
                <img
                  src={src}
                  alt="BuySial"
                  className="h-16 w-16 rounded-xl bg-white object-contain"
                />
              )
            })()}
            <div className="page-title gradient heading-brand text-[28px] tracking-tight">
              Investor Sign Up
            </div>
            <div className="helper text-center">
              Create your investor account and access your dashboard
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-gray-700">
                First Name *
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                placeholder="John"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-gray-700">
                Last Name *
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Your Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="ownerEmail" className="mb-1 block text-sm font-medium text-gray-700">
              Workspace Owner Email *
            </label>
            <input
              type="email"
              id="ownerEmail"
              name="ownerEmail"
              value={formData.ownerEmail}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
              placeholder="owner@business.com"
            />
            <p className="mt-1 text-xs text-gray-500">
              Ask the business owner for the email they use to log in to BuySial.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                placeholder="+971 50 123 4567"
              />
            </div>
            <div>
              <label htmlFor="country" className="mb-1 block text-sm font-medium text-gray-700">
                Country
              </label>
              <select
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
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
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Password *
            </label>
            <PasswordInput
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            />
            <p className="mt-1 text-xs text-gray-500">Must be at least 6 characters long</p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Confirm Password *
            </label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm your password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="acceptTerms"
              name="acceptTerms"
              checked={formData.acceptTerms}
              onChange={handleChange}
              required
              className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <label htmlFor="acceptTerms" className="text-sm text-gray-700">
              I agree to the{' '}
              <Link to="/terms" className="text-orange-600 underline hover:text-orange-700">
                Terms and Conditions
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-orange-600 underline hover:text-orange-700">
                Privacy Policy
              </Link>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-orange-500 px-4 py-3 font-medium text-white transition-colors outline-none hover:bg-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:bg-gray-400"
          >
            {loading ? 'Creating Account...' : 'Create Investor Account'}
          </button>

          <div className="text-center text-sm text-gray-600">
            Already an investor?{' '}
            <Link to="/login" className="font-medium text-orange-600 hover:text-orange-700">
              Sign in here
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
