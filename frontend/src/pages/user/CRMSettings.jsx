import React, { useEffect, useState } from 'react'
import { apiGet, apiUpload, API_BASE } from '../../api'

export default function CRMSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [settings, setSettings] = useState({
    navigationLogo: '',
    loginLogo: '',
    favicon: '',
  })
  const [files, setFiles] = useState({
    navigationLogo: null,
    loginLogo: null,
    favicon: null,
  })
  const [previews, setPreviews] = useState({
    navigationLogo: '',
    loginLogo: '',
    favicon: '',
  })

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      setLoading(true)
      const data = await apiGet('/api/settings/crm')
      setSettings({
        navigationLogo: data.navigationLogo || '',
        loginLogo: data.loginLogo || '',
        favicon: data.favicon || '',
      })
      setPreviews({
        navigationLogo: data.navigationLogo ? `${API_BASE}${data.navigationLogo}` : '',
        loginLogo: data.loginLogo ? `${API_BASE}${data.loginLogo}` : '',
        favicon: data.favicon ? `${API_BASE}${data.favicon}` : '',
      })
    } catch (err) {
      console.error('Failed to load CRM settings:', err)
      setMsg('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  function onFileChange(type, file) {
    if (!file) return

    setFiles((prev) => ({ ...prev, [type]: file }))

    // Create preview URL
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviews((prev) => ({ ...prev, [type]: e.target.result }))
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    try {
      setSaving(true)
      setMsg('')

      const formData = new FormData()

      if (files.navigationLogo) {
        formData.append('navigationLogo', files.navigationLogo)
      }
      if (files.loginLogo) {
        formData.append('loginLogo', files.loginLogo)
      }
      if (files.favicon) {
        formData.append('favicon', files.favicon)
      }

      const res = await apiUpload('/api/settings/crm', formData)

      setMsg('Settings saved successfully! Refresh the page to see changes.')

      // Update favicon if changed
      if (res.favicon) {
        const link = document.querySelector("link[rel~='icon']") || document.createElement('link')
        link.type = 'image/x-icon'
        link.rel = 'icon'
        link.href = `${API_BASE}${res.favicon}`
        document.getElementsByTagName('head')[0].appendChild(link)
      }

      await loadSettings()
      setFiles({ navigationLogo: null, loginLogo: null, favicon: null })
    } catch (err) {
      setMsg(err?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 32, padding: '32px 24px' }}>
      {/* Premium Header */}
      <div
        style={{ position: 'relative', paddingBottom: 20, borderBottom: '2px solid var(--border)' }}
      >
        <h1
          className="gradient heading-orange"
          style={{
            fontSize: 36,
            fontWeight: 800,
            margin: 0,
            marginBottom: 12,
            letterSpacing: '-0.5px',
          }}
        >
          CRM Settings
        </h1>
        <p
          style={{
            margin: 0,
            opacity: 0.7,
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          Customize your CRM branding with custom logos and favicon
        </p>
      </div>

      {msg && (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: msg.includes('success') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: msg.includes('success') ? '#10b981' : '#ef4444',
            border: `2px solid ${msg.includes('success') ? '#a7f3d0' : '#fecaca'}`,
            fontWeight: 600,
          }}
        >
          {msg}
        </div>
      )}

      {loading ? (
        <div
          className="card"
          style={{
            padding: 60,
            textAlign: 'center',
            borderRadius: 16,
            border: '1px solid var(--border)',
          }}
        >
          <div className="spinner" style={{ marginBottom: 16 }} />
          <div style={{ opacity: 0.7, fontSize: 15, fontWeight: 500 }}>Loading settings...</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>
          {/* Navigation Logo */}
          <div
            className="card"
            style={{
              padding: 28,
              border: '1px solid var(--border)',
              borderRadius: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Navigation Logo</div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                This logo will appear in the top-left corner of the navigation bar
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                  Upload New Logo
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFileChange('navigationLogo', e.target.files?.[0])}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '2px dashed var(--border)',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
                  Recommended: 180x50px, PNG with transparent background
                </div>
              </div>

              <div>
                <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                  Preview
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 120,
                    borderRadius: 10,
                    border: '2px solid var(--border)',
                    background: '#1f2937',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {previews.navigationLogo ? (
                    <img
                      src={previews.navigationLogo}
                      alt="Navigation Logo"
                      style={{
                        maxWidth: '90%',
                        maxHeight: '90%',
                        objectFit: 'contain',
                      }}
                    />
                  ) : (
                    <div style={{ opacity: 0.4, fontSize: 13, color: '#9ca3af' }}>No logo</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Login Logo */}
          <div
            className="card"
            style={{
              padding: 28,
              border: '1px solid var(--border)',
              borderRadius: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                Login Screen Logo
              </div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                This logo will appear on the login page
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                  Upload New Logo
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFileChange('loginLogo', e.target.files?.[0])}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '2px dashed var(--border)',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
                  Recommended: 200x200px, PNG with transparent background
                </div>
              </div>

              <div>
                <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                  Preview
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 200,
                    borderRadius: 10,
                    border: '2px solid var(--border)',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {previews.loginLogo ? (
                    <img
                      src={previews.loginLogo}
                      alt="Login Logo"
                      style={{
                        maxWidth: '80%',
                        maxHeight: '80%',
                        objectFit: 'contain',
                      }}
                    />
                  ) : (
                    <div style={{ opacity: 0.7, fontSize: 13, color: 'white' }}>No logo</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Favicon */}
          <div
            className="card"
            style={{
              padding: 28,
              border: '1px solid var(--border)',
              borderRadius: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Favicon</div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                This icon will appear in the browser tab
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                  Upload Favicon
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFileChange('favicon', e.target.files?.[0])}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '2px dashed var(--border)',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
                  Recommended: 32x32px or 64x64px, ICO or PNG format
                </div>
              </div>

              <div>
                <div className="label" style={{ marginBottom: 8, fontWeight: 600 }}>
                  Preview
                </div>
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 10,
                    border: '2px solid var(--border)',
                    background: 'var(--panel)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {previews.favicon ? (
                    <img
                      src={previews.favicon}
                      alt="Favicon"
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: 'contain',
                      }}
                    />
                  ) : (
                    <div style={{ opacity: 0.4, fontSize: 13 }}>No icon</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
            <button
              className="btn primary large"
              onClick={handleSave}
              disabled={saving || (!files.navigationLogo && !files.loginLogo && !files.favicon)}
              style={{
                padding: '14px 40px',
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 10,
                boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)',
              }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
