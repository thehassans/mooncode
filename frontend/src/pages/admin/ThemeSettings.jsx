import React, { useState, useEffect } from 'react'
import { apiGet, apiPost } from '../../api'

// 5 Professional E-commerce Themes
const THEMES = {
  modern: {
    name: '🎨 Modern Minimal',
    description: 'Clean, contemporary design inspired by Shopify',
    primary: '#000000',
    secondary: '#ffffff',
    accent: '#f59e0b',
    success: '#10b981',
    danger: '#ef4444',
    headerBg: '#ffffff',
    headerText: '#000000',
    cardBg: '#ffffff',
    buttonStyle: 'solid',
    headerFont: 'Inter',
    bodyFont: 'Inter',
    buttonRadius: '8',
    cardRadius: '12',
    borderStyle: '1px solid #e5e7eb',
    shadow: '0 1px 3px rgba(0,0,0,0.1)',
    headerStyle: 'sticky'
  },
  alibaba: {
    name: '🐉 Alibaba Orange',
    description: 'Bold, energetic design inspired by Alibaba',
    primary: '#ff6a00',
    secondary: '#ff9900',
    accent: '#ff4d00',
    success: '#52c41a',
    danger: '#ff4d4f',
    headerBg: '#ff6a00',
    headerText: '#ffffff',
    cardBg: '#ffffff',
    buttonStyle: 'gradient',
    headerFont: 'Poppins',
    bodyFont: 'Roboto',
    buttonRadius: '4',
    cardRadius: '8',
    borderStyle: '1px solid #f0f0f0',
    shadow: '0 2px 8px rgba(0,0,0,0.08)',
    headerStyle: 'fixed'
  },
  flipkart: {
    name: '⚡ Flipkart Blue',
    description: 'Trust-building blue theme inspired by Flipkart',
    primary: '#2874f0',
    secondary: '#388e3c',
    accent: '#ff9800',
    success: '#388e3c',
    danger: '#e53935',
    headerBg: '#2874f0',
    headerText: '#ffffff',
    cardBg: '#ffffff',
    buttonStyle: 'solid',
    headerFont: 'Roboto',
    bodyFont: 'Roboto',
    buttonRadius: '2',
    cardRadius: '4',
    borderStyle: '1px solid #f0f0f0',
    shadow: '0 2px 4px rgba(0,0,0,0.08)',
    headerStyle: 'sticky'
  },
  luxury: {
    name: '💎 Luxury Gold',
    description: 'Premium, elegant design for high-end products',
    primary: '#1a1a1a',
    secondary: '#d4af37',
    accent: '#c9a55e',
    success: '#2d6930',
    danger: '#8b0000',
    headerBg: '#1a1a1a',
    headerText: '#d4af37',
    cardBg: '#fafafa',
    buttonStyle: 'outlined',
    headerFont: 'Playfair Display',
    bodyFont: 'Lato',
    buttonRadius: '0',
    cardRadius: '0',
    borderStyle: '2px solid #d4af37',
    shadow: '0 4px 12px rgba(0,0,0,0.15)',
    headerStyle: 'fixed'
  },
  fresh: {
    name: '🌿 Fresh Green',
    description: 'Natural, eco-friendly theme for organic products',
    primary: '#059669',
    secondary: '#10b981',
    accent: '#f59e0b',
    success: '#059669',
    danger: '#dc2626',
    headerBg: '#ffffff',
    headerText: '#059669',
    cardBg: '#ffffff',
    buttonStyle: 'rounded',
    headerFont: 'Poppins',
    bodyFont: 'Open Sans',
    buttonRadius: '24',
    cardRadius: '16',
    borderStyle: '2px solid #d1fae5',
    shadow: '0 4px 14px rgba(5,150,105,0.1)',
    headerStyle: 'sticky'
  }
}

export default function ThemeSettings() {
  const [selectedTheme, setSelectedTheme] = useState('modern')
  const [customizing, setCustomizing] = useState(false)
  const [settings, setSettings] = useState(THEMES.modern)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const fonts = [
    'Inter', 'Poppins', 'Roboto', 'Lato', 'Montserrat',
    'Open Sans', 'Raleway', 'Playfair Display', 'Merriweather', 'Ubuntu'
  ]

  const buttonStyles = ['solid', 'gradient', 'outlined', 'rounded']

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    // Apply theme immediately when changed
    applyTheme(settings)
  }, [settings])

  async function loadSettings() {
    try {
      const data = await apiGet('/api/settings/theme')
      if (data.theme) {
        if (data.theme.themeName && THEMES[data.theme.themeName]) {
          setSelectedTheme(data.theme.themeName)
          setSettings(THEMES[data.theme.themeName])
        } else {
          setSettings(prev => ({ ...prev, ...data.theme }))
        }
      }
    } catch (err) {
      console.error('Failed to load theme:', err)
    }
  }

  function applyTheme(theme) {
    const root = document.documentElement
    root.style.setProperty('--theme-primary', theme.primary)
    root.style.setProperty('--theme-secondary', theme.secondary)
    root.style.setProperty('--theme-accent', theme.accent)
    root.style.setProperty('--theme-success', theme.success)
    root.style.setProperty('--theme-danger', theme.danger)
    root.style.setProperty('--theme-header-bg', theme.headerBg)
    root.style.setProperty('--theme-header-text', theme.headerText)
    root.style.setProperty('--theme-card-bg', theme.cardBg)
    root.style.setProperty('--theme-button-radius', theme.buttonRadius + 'px')
    root.style.setProperty('--theme-card-radius', theme.cardRadius + 'px')
  }

  async function handleSave() {
    setSaving(true)
    try {
      const themeData = {
        ...settings,
        themeName: customizing ? 'custom' : selectedTheme
      }
      await apiPost('/api/settings/theme', themeData)
      showToast('✓ Theme saved successfully! Changes will apply to e-commerce site.')
      applyTheme(settings)
      
      // Reload to apply theme globally
      setTimeout(() => {
        window.dispatchEvent(new Event('themeChanged'))
      }, 500)
    } catch (err) {
      showToast('Save failed: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  function selectTheme(themeKey) {
    setSelectedTheme(themeKey)
    setSettings(THEMES[themeKey])
    setCustomizing(false)
  }

  function handleChange(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          🎭 E-commerce Theme Manager
        </h1>
        <p style={{ color: '#6b7280', fontSize: '16px' }}>Choose from 5 professional themes or customize your own</p>
      </div>

      {/* Theme Selection Grid */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Select Theme</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {Object.entries(THEMES).map(([key, theme]) => (
            <div
              key={key}
              onClick={() => selectTheme(key)}
              style={{
                background: 'white',
                border: selectedTheme === key ? `3px solid ${theme.primary}` : '2px solid #e5e7eb',
                borderRadius: '16px',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: selectedTheme === key ? `0 8px 24px ${theme.primary}33` : '0 2px 8px rgba(0,0,0,0.08)',
                transform: selectedTheme === key ? 'translateY(-4px)' : 'none',
                position: 'relative'
              }}
            >
              {selectedTheme === key && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', background: theme.primary, color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                  ✓
                </div>
              )}
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>{theme.name}</div>
              <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '16px', minHeight: '40px' }}>{theme.description}</p>
              
              {/* Color Preview */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: theme.primary, border: '2px solid #e5e7eb' }} title="Primary" />
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: theme.accent, border: '2px solid #e5e7eb' }} title="Accent" />
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: theme.headerBg, border: '2px solid #e5e7eb' }} title="Header" />
              </div>
              
              {/* Button Preview */}
              <button style={{
                width: '100%',
                padding: '10px',
                background: theme.buttonStyle === 'gradient' ? `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)` : theme.primary,
                color: theme.buttonStyle === 'outlined' ? theme.primary : 'white',
                border: theme.buttonStyle === 'outlined' ? `2px solid ${theme.primary}` : 'none',
                borderRadius: `${theme.buttonRadius}px`,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}>
                Preview Button
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Customize Toggle */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', padding: '20px', borderRadius: '12px', border: '2px solid #e5e7eb' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Advanced Customization</h3>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>Fine-tune colors, typography, and styling</p>
        </div>
        <button
          onClick={() => setCustomizing(!customizing)}
          style={{
            padding: '12px 24px',
            background: customizing ? settings.primary : '#f3f4f6',
            color: customizing ? 'white' : '#374151',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {customizing ? '✓ Customizing' : '🎨 Customize'}
        </button>
      </div>

      {customizing && (
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* Colors Section */}
        <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>🎨 Colors</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {['primary', 'secondary', 'accent', 'success', 'danger'].map(colorKey => (
              <div key={colorKey}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px', textTransform: 'capitalize' }}>
                  {colorKey} Color
                </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={settings[colorKey]}
                    onChange={(e) => handleChange(colorKey, e.target.value)}
                    style={{ width: '60px', height: '40px', border: '2px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={settings[colorKey]}
                    onChange={(e) => handleChange(colorKey, e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            ))}
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
                      background: settings.layoutMode === mode ? settings.primary : 'white',
                      color: settings.layoutMode === mode ? 'white' : '#374151',
                      border: '2px solid',
                      borderColor: settings.layoutMode === mode ? settings.primary : '#e5e7eb',
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
                      background: settings.headerStyle === style ? settings.primary : 'white',
                      color: settings.headerStyle === style ? 'white' : '#374151',
                      border: '2px solid',
                      borderColor: settings.headerStyle === style ? settings.primary : '#e5e7eb',
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
              background: settings.primary,
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
              background: settings.accent,
              color: 'white',
              border: 'none',
              borderRadius: `${settings.buttonRadius}px`,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}>
              Accent Button
            </button>

            <button style={{
              padding: '12px 24px',
              background: settings.success,
              color: 'white',
              border: 'none',
              borderRadius: `${settings.buttonRadius}px`,
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}>
              Success Button
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
        </div>
      )}

      {/* Save Button - Always visible */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
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
            padding: '14px 32px',
            background: saving ? '#e5e7eb' : settings.primary,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
          }}
        >
          {saving ? '💾 Saving...' : '💾 Save & Apply Theme'}
        </button>
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
