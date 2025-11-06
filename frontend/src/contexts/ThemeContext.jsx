import React, { createContext, useContext, useState, useEffect } from 'react'
import { apiGet } from '../api'

const ThemeContext = createContext()

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load theme from API
  useEffect(() => {
    loadTheme()
  }, [])

  // Listen for theme changes
  useEffect(() => {
    const handleThemeChange = () => {
      loadTheme()
    }
    window.addEventListener('themeChanged', handleThemeChange)
    return () => window.removeEventListener('themeChanged', handleThemeChange)
  }, [])

  // Apply theme when it changes
  useEffect(() => {
    if (theme) {
      applyTheme(theme)
    }
  }, [theme])

  const loadTheme = async () => {
    try {
      const data = await apiGet('/api/settings/theme')
      if (data.theme) {
        setTheme(data.theme)
      }
    } catch (error) {
      console.error('Failed to load theme:', error)
      // Set default theme
      setTheme(getDefaultTheme())
    } finally {
      setLoading(false)
    }
  }

  const applyTheme = (themeData) => {
    const root = document.documentElement
    
    // Apply color variables
    root.style.setProperty('--theme-primary', themeData.primary)
    root.style.setProperty('--theme-secondary', themeData.secondary)
    root.style.setProperty('--theme-accent', themeData.accent)
    root.style.setProperty('--theme-success', themeData.success)
    root.style.setProperty('--theme-danger', themeData.danger)
    root.style.setProperty('--theme-header-bg', themeData.headerBg)
    root.style.setProperty('--theme-header-text', themeData.headerText)
    root.style.setProperty('--theme-card-bg', themeData.cardBg)
    
    // Apply radius variables
    root.style.setProperty('--theme-button-radius', themeData.buttonRadius + 'px')
    root.style.setProperty('--theme-card-radius', themeData.cardRadius + 'px')
    
    // Apply typography
    root.style.setProperty('--theme-header-font', themeData.headerFont)
    root.style.setProperty('--theme-body-font', themeData.bodyFont)
    
    // Apply border and shadow
    root.style.setProperty('--theme-border', themeData.borderStyle)
    root.style.setProperty('--theme-shadow', themeData.shadow)
    
    // Apply button style
    root.style.setProperty('--theme-button-style', themeData.buttonStyle)
    
    // Store in localStorage for quick access
    try {
      localStorage.setItem('app_theme', JSON.stringify(themeData))
    } catch (e) {}
  }

  const getDefaultTheme = () => ({
    themeName: 'modern',
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
  })

  return (
    <ThemeContext.Provider value={{ theme, loading, loadTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
