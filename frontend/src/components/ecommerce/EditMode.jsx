import React, { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost, apiUpload } from '../../api'

const GOOGLE_FONTS = [
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana',
  'Courier New', 'Comic Sans MS', 'Impact', 'Trebuchet MS',
  'Open Sans', 'Roboto', 'Lato', 'Montserrat', 'Poppins',
  'Playfair Display', 'Raleway', 'Ubuntu', 'Merriweather'
]

export default function EditMode({ page, isActive, onExit }) {
  const [elements, setElements] = useState([])
  const [selectedElement, setSelectedElement] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('content')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (isActive) {
      loadPageContent()
      document.body.style.cursor = 'crosshair'
    } else {
      document.body.style.cursor = 'default'
    }
    
    return () => {
      document.body.style.cursor = 'default'
    }
  }, [isActive, page])

  async function loadPageContent() {
    try {
      const data = await apiGet(`/api/settings/website/content?page=${page}`)
      if (data.content && data.content.elements) {
        setElements(data.content.elements)
      }
    } catch (err) {
      console.error('Failed to load page content:', err)
    }
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    
    try {
      await apiPost('/api/settings/website/content', {
        page,
        elements
      })
      
      setMessage('✓ Changes saved successfully!')
      setTimeout(() => setMessage(''), 3000)
      
      // Reload page to apply changes
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      setMessage('✗ Failed to save changes')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  function handleElementClick(e) {
    if (!isActive) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const target = e.target
    
    // Get element identifier
    const elementId = target.getAttribute('data-editable-id') || 
                      target.id || 
                      `${target.tagName.toLowerCase()}-${Date.now()}`
    
    // Get current styles
    const computedStyle = window.getComputedStyle(target)
    const currentElement = elements.find(el => el.id === elementId)
    
    const isImage = target.tagName === 'IMG'
    
    const elementData = {
      id: elementId,
      text: isImage ? '' : (target.innerText || target.textContent),
      type: isImage ? 'image' : 'text',
      imageUrl: isImage ? target.src : '',
      styles: {
        fontFamily: currentElement?.styles?.fontFamily || computedStyle.fontFamily,
        fontSize: currentElement?.styles?.fontSize || computedStyle.fontSize,
        fontWeight: currentElement?.styles?.fontWeight || computedStyle.fontWeight,
        color: currentElement?.styles?.color || computedStyle.color,
        textAlign: currentElement?.styles?.textAlign || computedStyle.textAlign,
        backgroundColor: currentElement?.styles?.backgroundColor || computedStyle.backgroundColor,
        padding: currentElement?.styles?.padding || computedStyle.padding,
        borderRadius: currentElement?.styles?.borderRadius || computedStyle.borderRadius,
        width: currentElement?.styles?.width || computedStyle.width,
        height: currentElement?.styles?.height || computedStyle.height,
        objectFit: currentElement?.styles?.objectFit || computedStyle.objectFit
      },
      tagName: target.tagName,
      element: target
    }
    
    setSelectedElement(elementData)
    setSidebarOpen(true)
    setActiveTab('content')
  }

  function handleTextChange(newText) {
    if (!selectedElement) return
    
    setElements(prev => {
      const existing = prev.find(el => el.id === selectedElement.id)
      if (existing) {
        return prev.map(el => 
          el.id === selectedElement.id 
            ? { ...el, text: newText }
            : el
        )
      } else {
        return [...prev, { 
          id: selectedElement.id, 
          text: newText, 
          type: selectedElement.type,
          imageUrl: selectedElement.imageUrl,
          styles: selectedElement.styles 
        }]
      }
    })
    
    setSelectedElement(prev => ({ ...prev, text: newText }))
    
    // Update DOM element
    if (selectedElement.element) {
      selectedElement.element.innerText = newText
    }
  }

  function handleStyleChange(property, value) {
    if (!selectedElement) return
    
    const newStyles = { ...selectedElement.styles, [property]: value }
    
    setElements(prev => {
      const existing = prev.find(el => el.id === selectedElement.id)
      if (existing) {
        return prev.map(el => 
          el.id === selectedElement.id 
            ? { ...el, styles: newStyles }
            : el
        )
      } else {
        return [...prev, { 
          id: selectedElement.id, 
          text: selectedElement.text, 
          type: selectedElement.type,
          imageUrl: selectedElement.imageUrl,
          styles: newStyles 
        }]
      }
    })
    
    setSelectedElement(prev => ({ ...prev, styles: newStyles }))
    
    // Update DOM element
    if (selectedElement.element) {
      selectedElement.element.style[property] = value
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !selectedElement) return
    
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }
    
    setUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('banner', file)
      formData.append('title', selectedElement.id)
      formData.append('page', page)
      formData.append('active', 'true')
      
      const result = await apiUpload('/api/settings/website/banners', formData)
      const newImageUrl = result.banner?.imageUrl || result.imageUrl
      
      if (selectedElement.element && newImageUrl) {
        selectedElement.element.src = newImageUrl
        
        setElements(prev => {
          const existing = prev.find(el => el.id === selectedElement.id)
          if (existing) {
            return prev.map(el => 
              el.id === selectedElement.id 
                ? { ...el, imageUrl: newImageUrl }
                : el
            )
          } else {
            return [...prev, { 
              id: selectedElement.id, 
              type: 'image',
              imageUrl: newImageUrl,
              styles: selectedElement.styles 
            }]
          }
        })
        
        setSelectedElement(prev => ({ ...prev, imageUrl: newImageUrl }))
        setMessage('✓ Image uploaded successfully!')
        setTimeout(() => setMessage(''), 2000)
      }
    } catch (err) {
      alert('Failed to upload image: ' + (err.message || 'Unknown error'))
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    if (isActive) {
      const handleClick = (e) => {
        // Check if click is on editable content area
        const isEditableArea = e.target.closest('.editable-area')
        if (isEditableArea) {
          handleElementClick(e)
        }
      }
      
      document.addEventListener('click', handleClick, true)
      return () => document.removeEventListener('click', handleClick, true)
    }
  }, [isActive, elements])

  if (!isActive) return null

  return (
    <>
      {/* Edit Mode Overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: '#10b981',
            animation: 'pulse 2s infinite'
          }} />
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>
              🎨 Edit Mode Active
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              Click any text to edit • {elements.length} element{elements.length !== 1 ? 's' : ''} modified
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {message && (
            <div style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500
            }}>
              {message}
            </div>
          )}
          
          <button
            onClick={handleSave}
            disabled={saving || elements.length === 0}
            style={{
              padding: '10px 24px',
              background: 'white',
              color: '#667eea',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: (saving || elements.length === 0) ? 0.6 : 1,
              transition: 'all 0.2s'
            }}
          >
            {saving ? '💾 Saving...' : `💾 Save Changes (${elements.length})`}
          </button>
          
          <button
            onClick={onExit}
            style={{
              padding: '10px 24px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            ✕ Exit
          </button>
        </div>
      </div>

      {/* Element Editor Panel */}
      {selectedElement && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '400px',
          maxHeight: '60vh',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          zIndex: 10000,
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          {/* Panel Header */}
          <div style={{
            padding: '20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
                ✏️ Edit Element
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                {selectedElement.tagName}
              </div>
            </div>
            <button
              onClick={() => setSelectedElement(null)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              ✕
            </button>
          </div>

          {/* Panel Content */}
          <div style={{ padding: '20px', maxHeight: 'calc(60vh - 80px)', overflowY: 'auto' }}>
            {/* Text Editor */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '8px'
              }}>
                Text Content
              </label>
              <textarea
                value={selectedElement.text}
                onChange={(e) => handleTextChange(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Font Family */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '8px'
              }}>
                Font Family
              </label>
              <select
                value={selectedElement.styles.fontFamily.split(',')[0].replace(/['"]/g, '')}
                onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {GOOGLE_FONTS.map(font => (
                  <option key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Size */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '8px'
              }}>
                Font Size: {selectedElement.styles.fontSize}
              </label>
              <input
                type="range"
                min="10"
                max="72"
                value={parseInt(selectedElement.styles.fontSize)}
                onChange={(e) => handleStyleChange('fontSize', `${e.target.value}px`)}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>

            {/* Font Weight */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '8px'
              }}>
                Font Weight
              </label>
              <select
                value={selectedElement.styles.fontWeight}
                onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="300">Light (300)</option>
                <option value="400">Normal (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">Semi-Bold (600)</option>
                <option value="700">Bold (700)</option>
                <option value="800">Extra-Bold (800)</option>
              </select>
            </div>

            {/* Color */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '8px'
              }}>
                Text Color
              </label>
              <input
                type="color"
                value={selectedElement.styles.color.startsWith('#') ? selectedElement.styles.color : '#000000'}
                onChange={(e) => handleStyleChange('color', e.target.value)}
                style={{
                  width: '100%',
                  height: '48px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              />
            </div>

            {/* Text Align */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '8px'
              }}>
                Text Alignment
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['left', 'center', 'right', 'justify'].map(align => (
                  <button
                    key={align}
                    onClick={() => handleStyleChange('textAlign', align)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: selectedElement.styles.textAlign === align ? '#667eea' : 'white',
                      color: selectedElement.styles.textAlign === align ? 'white' : '#374151',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.2s'
                    }}
                  >
                    {align}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  )
}
