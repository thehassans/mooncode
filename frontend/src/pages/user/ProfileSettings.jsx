import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '../../api.js'

export default function ProfileSettings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Profile data
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  // API Keys
  const [geminiKey, setGeminiKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [mapsKey, setMapsKey] = useState('')

  // Custom Domain
  const [customDomain, setCustomDomain] = useState('')

  // Load current user data
  useEffect(() => {
    const me = JSON.parse(localStorage.getItem('me') || '{}')
    setFirstName(me.firstName || '')
    setLastName(me.lastName || '')
    setEmail(me.email || '')
    setPhone(me.phone || '')

    // Load API keys and custom domain
    loadAPIKeys()
    loadCustomDomain()
  }, [])

  async function loadAPIKeys() {
    try {
      const data = await apiGet('/api/settings/api-keys')
      setGeminiKey(data.geminiKey || '')
      setOpenaiKey(data.openaiKey || '')
      setMapsKey(data.mapsKey || '')
    } catch (err) {
      console.error('Failed to load API keys:', err)
    }
  }

  async function loadCustomDomain() {
    try {
      const data = await apiGet('/api/users/custom-domain')
      setCustomDomain(data.customDomain || '')
    } catch (err) {
      console.error('Failed to load custom domain:', err)
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const res = await apiPost('/api/user/update-profile', {
        firstName,
        lastName,
        phone,
      })

      // Update localStorage
      const me = JSON.parse(localStorage.getItem('me') || '{}')
      me.firstName = firstName
      me.lastName = lastName
      me.phone = phone
      localStorage.setItem('me', JSON.stringify(me))

      setMessage('Profile updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveAPIKeys(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      await apiPost('/api/settings/api-keys', {
        geminiKey,
        openaiKey,
        mapsKey,
      })

      setMessage('API keys updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update API keys')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveCustomDomain(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      await apiPost('/api/users/custom-domain', {
        customDomain: customDomain.trim(),
      })

      setMessage('Custom domain updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update custom domain')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="section">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
            Profile Settings
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            Manage your account settings and preferences
          </p>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: '16px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            color: '#10b981',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          ✓ {message}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            color: '#ef4444',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          ✗ {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Personal Information Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '24px',
              borderBottom: '1px solid var(--border)',
              background:
                'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
                  Personal Information
                </h2>
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                  Update your personal details
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="field">
                  <label className="label">First Name</label>
                  <input
                    type="text"
                    className="input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label className="label">Last Name</label>
                  <input
                    type="text"
                    className="input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">Email Address</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
                <div className="helper" style={{ marginTop: '8px' }}>
                  Email cannot be changed
                </div>
              </div>

              <div className="field">
                <label className="label">Phone Number</label>
                <input
                  type="tel"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => navigate('/user/change-password')}
                >
                  Change Password
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* API Configuration Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '24px',
              borderBottom: '1px solid var(--border)',
              background:
                'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(5, 150, 105, 0.05))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
                  API Configuration
                </h2>
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                  Configure API keys for AI and Maps integration
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveAPIKeys} style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gap: '20px' }}>
              <div className="field">
                <label className="label">
                  Google Gemini API Key
                  <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: '8px' }}>
                    (For AI-powered product generation)
                  </span>
                </label>
                <input
                  type="password"
                  className="input"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                />
              </div>

              <div className="field">
                <label className="label">
                  OpenAI API Key
                  <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: '8px' }}>
                    (Alternative AI provider)
                  </span>
                </label>
                <input
                  type="password"
                  className="input"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </div>

              <div className="field">
                <label className="label">
                  Google Maps API Key
                  <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: '8px' }}>
                    (For geocoding and location services)
                  </span>
                </label>
                <input
                  type="password"
                  className="input"
                  value={mapsKey}
                  onChange={(e) => setMapsKey(e.target.value)}
                  placeholder="AIza..."
                />
              </div>

              <div
                style={{
                  padding: '16px',
                  background: 'rgba(99, 102, 241, 0.05)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: '10px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
                  📘 API Setup Guide
                </div>
                <ul style={{ color: 'var(--muted)', paddingLeft: '20px', margin: 0 }}>
                  <li>
                    Gemini API: Visit{' '}
                    <a
                      href="https://makersuite.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#6366f1' }}
                    >
                      Google AI Studio
                    </a>
                  </li>
                  <li>
                    OpenAI API: Get your key from{' '}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#6366f1' }}
                    >
                      OpenAI Platform
                    </a>
                  </li>
                  <li>
                    Maps API: Create a key in{' '}
                    <a
                      href="https://console.cloud.google.com/google/maps-apis"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#6366f1' }}
                    >
                      Google Cloud Console
                    </a>
                  </li>
                </ul>
              </div>

              <button type="submit" className="btn" disabled={loading}>
                {loading ? 'Saving...' : 'Save API Keys'}
              </button>
            </div>
          </form>
        </div>

        {/* Custom Domain Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '24px',
              borderBottom: '1px solid var(--border)',
              background:
                'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(236, 72, 153, 0.05))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
                  Custom Domain
                </h2>
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                  Connect your own domain to your e-commerce store
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveCustomDomain} style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gap: '20px' }}>
              <div className="field">
                <label className="label">
                  Domain Name
                  <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: '8px' }}>
                    (e.g., buysial.com)
                  </span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  placeholder="yourdomain.com"
                />
              </div>

              <div
                style={{
                  padding: '16px',
                  background: 'rgba(168, 85, 247, 0.05)',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  borderRadius: '10px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
                  🌐 Domain Setup Instructions
                </div>
                <ol style={{ color: 'var(--muted)', paddingLeft: '20px', margin: 0 }}>
                  <li>Enter your domain name in the field above (e.g., buysial.com)</li>
                  <li>Point your domain's DNS to buysial.com using a CNAME record</li>
                  <li>Wait for DNS propagation (usually 5-10 minutes)</li>
                  <li>Your e-commerce store will be accessible on your custom domain</li>
                </ol>
                {customDomain && (
                  <div
                    style={{
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(168, 85, 247, 0.2)',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text)' }}>
                      Current Domain:
                    </div>
                    <a
                      href={`https://${customDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#a855f7', textDecoration: 'none', fontWeight: 500 }}
                    >
                      {customDomain} →
                    </a>
                  </div>
                )}
              </div>

              <button type="submit" className="btn" disabled={loading}>
                {loading ? 'Saving...' : 'Save Custom Domain'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
