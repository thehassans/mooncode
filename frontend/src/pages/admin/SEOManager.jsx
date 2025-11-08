import React, { useState, useEffect } from 'react'
import { apiGet, apiPost } from '../../api'

export default function SEOManager() {
  const [seoSettings, setSeoSettings] = useState({
    siteTitle: '',
    siteDescription: '',
    keywords: '',
    ogImage: '',
    twitterCard: 'summary_large_image',
    googleAnalytics: '',
    facebookPixel: '',
    tiktokPixel: '',
    structuredData: true
  })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const data = await apiGet('/api/settings/seo')
      if (data.seo) {
        setSeoSettings(prev => ({ ...prev, ...data.seo }))
      }
    } catch (err) {
      console.error('Failed to load SEO settings:', err)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiPost('/api/settings/seo', seoSettings)
      showToast('✓ SEO settings saved successfully!')
    } catch (err) {
      showToast('Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleChange(key, value) {
    setSeoSettings(prev => ({ ...prev, [key]: value }))
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10000,
          padding: '12px 20px',
          background: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          fontSize: '14px',
          fontWeight: 500,
          animation: 'slideIn 0.3s ease'
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>🔍 SEO Manager</h1>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Optimize your website for search engines and track analytics</p>
      </div>

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* General Settings */}
        <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>General SEO</h3>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Site Title
              </label>
              <input
                type="text"
                value={seoSettings.siteTitle}
                onChange={(e) => handleChange('siteTitle', e.target.value)}
                placeholder="Your Website Title"
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Appears in search results and browser tabs
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Meta Description
              </label>
              <textarea
                value={seoSettings.siteDescription}
                onChange={(e) => handleChange('siteDescription', e.target.value)}
                placeholder="Brief description of your website..."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }}
              />
              <p style={{ 
                fontSize: '12px', 
                color: seoSettings.siteDescription.length > 160 ? '#ef4444' : '#6b7280', 
                marginTop: '4px',
                fontWeight: seoSettings.siteDescription.length > 160 ? 600 : 400
              }}>
                {seoSettings.siteDescription.length}/160 characters 
                {seoSettings.siteDescription.length > 160 && ' ⚠️ Too long'}
                {seoSettings.siteDescription.length >= 120 && seoSettings.siteDescription.length <= 160 && ' ✓ Good'}
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Keywords
              </label>
              <input
                type="text"
                value={seoSettings.keywords}
                onChange={(e) => handleChange('keywords', e.target.value)}
                placeholder="ecommerce, online shop, products"
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Comma-separated keywords for your site
              </p>
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Social Media</h3>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Open Graph Image URL
              </label>
              <input
                type="text"
                value={seoSettings.ogImage}
                onChange={(e) => handleChange('ogImage', e.target.value)}
                placeholder="https://example.com/og-image.jpg"
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Image shown when sharing on Facebook, LinkedIn, etc.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Twitter Card Type
              </label>
              <select
                value={seoSettings.twitterCard}
                onChange={(e) => handleChange('twitterCard', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
              >
                <option value="summary">Summary</option>
                <option value="summary_large_image">Summary Large Image</option>
                <option value="app">App</option>
                <option value="player">Player</option>
              </select>
            </div>
          </div>
        </div>

        {/* Analytics */}
        <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Analytics & Tracking</h3>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                📊 Google Analytics ID
              </label>
              <input
                type="text"
                value={seoSettings.googleAnalytics}
                onChange={(e) => handleChange('googleAnalytics', e.target.value)}
                placeholder="G-XXXXXXXXXX or UA-XXXXXXXXX"
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Track website traffic and user behavior
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                📘 Facebook Pixel ID
              </label>
              <input
                type="text"
                value={seoSettings.facebookPixel}
                onChange={(e) => handleChange('facebookPixel', e.target.value)}
                placeholder="123456789012345"
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Track Facebook ad conversions and retarget visitors
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                🎵 TikTok Pixel ID
              </label>
              <input
                type="text"
                value={seoSettings.tiktokPixel}
                onChange={(e) => handleChange('tiktokPixel', e.target.value)}
                placeholder="XXXXXXXXXXXXXXX"
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Track TikTok ad performance and optimize campaigns
              </p>
            </div>
          </div>
        </div>

        {/* Advanced */}
        <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Advanced</h3>
          
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={seoSettings.structuredData}
                onChange={(e) => handleChange('structuredData', e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Enable Structured Data</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  Helps search engines understand your content better
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={() => loadSettings()}
            style={{
              padding: '12px 24px',
              background: 'white',
              color: '#374151',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '12px 24px',
              background: saving ? '#e5e7eb' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? '💾 Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
