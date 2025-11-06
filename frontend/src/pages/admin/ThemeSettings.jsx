import React, { useState, useEffect } from 'react'
import { apiGet, apiPost } from '../../api'

export default function ThemeSettings() {
  const [settings, setSettings] = useState({
    primaryColor: '#667eea',
    secondaryColor: '#764ba2',
    accentColor: '#f97316',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerFont: 'Poppins',
    bodyFont: 'Inter',
    buttonRadius: '8',
    cardRadius: '12',
    layoutMode: 'full',
    headerStyle: 'fixed'
  })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const fonts = [
    'Inter', 'Poppins', 'Roboto', 'Lato', 'Montserrat',
    'Open Sans', 'Raleway', 'Playfair Display', 'Merriweather', 'Ubuntu'
  ]

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const data = await apiGet('/api/settings/theme')
      if (data.theme) {
        setSettings(prev => ({ ...prev, ...data.theme }))
      }
    } catch (err) {
      console.error('Failed to load theme:', err)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiPost('/api/settings/theme', settings)
      showToast('✓ Theme settings saved successfully!')
      
      // Apply theme immediately
      document.documentElement.style.setProperty('--primary-color', settings.primaryColor)
      document.documentElement.style.setProperty('--secondary-color', settings.secondaryColor)
    } catch (err) {
      showToast('Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleChange(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>🎭 Theme Settings</h1>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Customize colors, fonts, and layout</p>
      </div>

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Colors Section */}
        <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Colors</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Primary Color
              </label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  style={{ width: '60px', height: '40px', border: '2px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={settings.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Secondary Color
              </label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={settings.secondaryColor}
                  onChange={(e) => handleChange('secondaryColor', e.target.value)}
                  style={{ width: '60px', height: '40px', border: '2px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={settings.secondaryColor}
                  onChange={(e) => handleChange('secondaryColor', e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Accent Color
              </label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => handleChange('accentColor', e.target.value)}
                  style={{ width: '60px', height: '40px', border: '2px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={settings.accentColor}
                  onChange={(e) => handleChange('accentColor', e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Typography Section */}
        <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Typography</h3>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Heading Font
              </label>
              <select
                value={settings.headerFont}
                onChange={(e) => handleChange('headerFont', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
              >
                {fonts.map(font => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Body Font
              </label>
              <select
                value={settings.bodyFont}
                onChange={(e) => handleChange('bodyFont', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
              >
                {fonts.map(font => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Border Radius Section */}
        <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Border Radius</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Buttons: {settings.buttonRadius}px
              </label>
              <input
                type="range"
                min="0"
                max="24"
                value={settings.buttonRadius}
                onChange={(e) => handleChange('buttonRadius', e.target.value)}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Cards: {settings.cardRadius}px
              </label>
              <input
                type="range"
                min="0"
                max="32"
                value={settings.cardRadius}
                onChange={(e) => handleChange('cardRadius', e.target.value)}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* Layout Section */}
        <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Layout</h3>
          
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Layout Mode
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['full', 'boxed'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => handleChange('layoutMode', mode)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: settings.layoutMode === mode ? settings.primaryColor : 'white',
                      color: settings.layoutMode === mode ? 'white' : '#374151',
                      border: '2px solid',
                      borderColor: settings.layoutMode === mode ? settings.primaryColor : '#e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                Header Style
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['fixed', 'static', 'sticky'].map(style => (
                  <button
                    key={style}
                    onClick={() => handleChange('headerStyle', style)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: settings.headerStyle === style ? settings.primaryColor : 'white',
                      color: settings.headerStyle === style ? 'white' : '#374151',
                      border: '2px solid',
                      borderColor: settings.headerStyle === style ? settings.primaryColor : '#e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Preview</h3>
          
          <div style={{ padding: '24px', background: '#f9fafb', borderRadius: '8px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={{
              padding: '12px 24px',
              background: settings.primaryColor,
              color: 'white',
              border: 'none',
              borderRadius: `${settings.buttonRadius}px`,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}>
              Primary Button
            </button>
            
            <button style={{
              padding: '12px 24px',
              background: settings.secondaryColor,
              color: 'white',
              border: 'none',
              borderRadius: `${settings.buttonRadius}px`,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}>
              Secondary Button
            </button>

            <button style={{
              padding: '12px 24px',
              background: settings.accentColor,
              color: 'white',
              border: 'none',
              borderRadius: `${settings.buttonRadius}px`,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}>
              Accent Button
            </button>

            <div style={{
              padding: '16px',
              background: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: `${settings.cardRadius}px`,
              width: '200px'
            }}>
              <h4 style={{ fontFamily: settings.headerFont, fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                Card Title
              </h4>
              <p style={{ fontFamily: settings.bodyFont, fontSize: '14px', color: '#6b7280' }}>
                Card content goes here
              </p>
            </div>
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

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          padding: '12px 20px',
          background: toast.type === 'error' ? '#ef4444' : '#10b981',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          fontSize: '14px',
          fontWeight: 500,
          zIndex: 1000
        }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
