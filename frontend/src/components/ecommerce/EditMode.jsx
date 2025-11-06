import React, { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost, apiUpload } from '../../api'

const GOOGLE_FONTS = [
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New',
  'Comic Sans MS', 'Impact', 'Trebuchet MS', 'Open Sans', 'Roboto', 'Lato',
  'Montserrat', 'Poppins', 'Playfair Display', 'Raleway', 'Ubuntu', 'Merriweather'
]

const EDITOR_TABS = [
  { id: 'content', label: 'Content', icon: '📝' },
  { id: 'style', label: 'Style', icon: '🎨' },
  { id: 'layout', label: 'Layout', icon: '📐' },
  { id: 'advanced', label: 'Advanced', icon: '⚙️' }
]

export default function EditMode({ page, isActive, onExit }) {
  const [elements, setElements] = useState([])
  const [selectedElement, setSelectedElement] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('content')
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (isActive) {
      loadPageContent()
      document.body.style.cursor = 'crosshair'
      document.body.style.userSelect = 'none'
    } else {
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }
    return () => {
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }
  }, [isActive, page])

  async function loadPageContent() {
    try {
      const data = await apiGet(`/api/settings/website/content?page=${page}`)
      if (data.content?.elements) {
        setElements(data.content.elements)
        applyPageContent(data.content.elements)
      }
    } catch (err) {
      console.error('Failed to load page content:', err)
    }
  }

  function applyPageContent(elements) {
    elements.forEach(el => {
      const domElement = document.getElementById(el.id) || 
                        document.querySelector(`[data-editable-id="${el.id}"]`)
      if (domElement) {
        if (el.text && el.type !== 'image') domElement.innerText = el.text
        if (el.imageUrl && el.type === 'image') domElement.src = el.imageUrl
        if (el.styles) {
          Object.keys(el.styles).forEach(style => {
            domElement.style[style] = el.styles[style]
          })
        }
      }
    })
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiPost('/api/settings/website/content', { page, elements })
      showToast('✓ Changes saved successfully!')
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      showToast('✗ Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleElementClick(e) {
    if (!isActive) return
    e.preventDefault()
    e.stopPropagation()
    
    const target = e.target
    const elementId = target.getAttribute('data-editable-id') || target.id || `${target.tagName.toLowerCase()}-${Date.now()}`
    const computedStyle = window.getComputedStyle(target)
    const currentElement = elements.find(el => el.id === elementId)
    const isImage = target.tagName === 'IMG'
    
    setSelectedElement({
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
        margin: currentElement?.styles?.margin || computedStyle.margin,
        borderRadius: currentElement?.styles?.borderRadius || computedStyle.borderRadius,
        boxShadow: currentElement?.styles?.boxShadow || computedStyle.boxShadow,
        width: currentElement?.styles?.width || computedStyle.width,
        height: currentElement?.styles?.height || computedStyle.height,
        objectFit: currentElement?.styles?.objectFit || computedStyle.objectFit,
        display: currentElement?.styles?.display || computedStyle.display,
        opacity: currentElement?.styles?.opacity || computedStyle.opacity
      },
      tagName: target.tagName,
      element: target
    })
    setSidebarOpen(true)
    setActiveTab('content')
    showToast(`Selected: ${target.tagName}`, 'info')
  }

  function handleTextChange(newText) {
    if (!selectedElement) return
    setElements(prev => {
      const existing = prev.find(el => el.id === selectedElement.id)
      if (existing) {
        return prev.map(el => el.id === selectedElement.id ? { ...el, text: newText } : el)
      }
      return [...prev, { id: selectedElement.id, text: newText, type: selectedElement.type, imageUrl: selectedElement.imageUrl, styles: selectedElement.styles }]
    })
    setSelectedElement(prev => ({ ...prev, text: newText }))
    if (selectedElement.element) selectedElement.element.innerText = newText
  }

  function handleStyleChange(property, value) {
    if (!selectedElement) return
    const newStyles = { ...selectedElement.styles, [property]: value }
    setElements(prev => {
      const existing = prev.find(el => el.id === selectedElement.id)
      if (existing) {
        return prev.map(el => el.id === selectedElement.id ? { ...el, styles: newStyles } : el)
      }
      return [...prev, { id: selectedElement.id, text: selectedElement.text, type: selectedElement.type, imageUrl: selectedElement.imageUrl, styles: newStyles }]
    })
    setSelectedElement(prev => ({ ...prev, styles: newStyles }))
    if (selectedElement.element) selectedElement.element.style[property] = value
    showToast(`Updated: ${property}`, 'info')
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !selectedElement) return
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error')
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
            return prev.map(el => el.id === selectedElement.id ? { ...el, imageUrl: newImageUrl } : el)
          }
          return [...prev, { id: selectedElement.id, type: 'image', imageUrl: newImageUrl, styles: selectedElement.styles }]
        })
        setSelectedElement(prev => ({ ...prev, imageUrl: newImageUrl }))
        showToast('✓ Image uploaded!')
      }
    } catch (err) {
      showToast('Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  function handleDelete() {
    if (!selectedElement || !confirm('Delete this element?')) return
    handleStyleChange('display', 'none')
    showToast('Element hidden')
  }

  function handleDuplicate() {
    if (!selectedElement) return
    const newId = `${selectedElement.id}-copy-${Date.now()}`
    setElements(prev => [...prev, { ...selectedElement, id: newId }])
    showToast('Element duplicated')
  }

  useEffect(() => {
    if (isActive) {
      const handleClick = (e) => {
        const isEditableArea = e.target.closest('.editable-area')
        const isSidebar = e.target.closest('.edit-sidebar')
        if (isEditableArea && !isSidebar) handleElementClick(e)
      }
      document.addEventListener('click', handleClick, true)
      return () => document.removeEventListener('click', handleClick, true)
    }
  }, [isActive, elements])

  if (!isActive) return null

  const Label = ({ children }) => <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>{children}</label>

  return (<>
    <style>{`
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      @keyframes slideIn { from { transform: translateY(-100%); } to { transform: translateY(0); } }
    `}</style>
    
    {/* Top Bar */}
    <div style={{ position: 'fixed', top: 0, left: 0, right: sidebarOpen ? '380px' : 0, height: '60px', zIndex: 9998, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', fontFamily: 'system-ui', transition: 'right 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
        <div><div style={{ fontSize: '15px', fontWeight: 700 }}>🎨 Edit Mode</div><div style={{ fontSize: '11px', opacity: 0.9 }}>{elements.length} changes</div></div>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button onClick={handleSave} disabled={saving || elements.length === 0} style={{ padding: '8px 20px', background: 'white', color: '#667eea', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: (saving || elements.length === 0) ? 'not-allowed' : 'pointer', opacity: (saving || elements.length === 0) ? 0.6 : 1, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>{saving ? '💾 Saving...' : '💾 Save'}</button>
        <button onClick={onExit} style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>✕ Exit</button>
      </div>
    </div>

    {/* Toast Notification */}
    {toast && (<div style={{ position: 'fixed', top: '80px', right: '20px', zIndex: 10001, padding: '12px 20px', background: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : '#10b981', color: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontSize: '13px', fontWeight: 500, animation: 'slideIn 0.3s ease' }}>{toast.message}</div>)}

    {/* Right Sidebar */}
    <div className="edit-sidebar" style={{ position: 'fixed', top: '60px', right: 0, bottom: 0, width: '380px', background: 'white', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', zIndex: 9999, display: 'flex', flexDirection: 'column', transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease', fontFamily: 'system-ui' }}>
      
      {/* Toggle Button */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ position: 'absolute', left: '-36px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '70px', background: 'white', border: 'none', borderRadius: '6px 0 0 6px', boxShadow: '-4px 0 12px rgba(0,0,0,0.1)', cursor: 'pointer', fontSize: '18px', color: '#667eea' }}>{sidebarOpen ? '→' : '←'}</button>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))' }}>
        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{selectedElement ? '✏️ Edit Element' : '👆 Select Element'}</h2>
        {selectedElement && (<div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '11px', color: '#6b7280' }}><span style={{ padding: '3px 8px', background: '#f3f4f6', borderRadius: '4px' }}>{selectedElement.tagName}</span><span style={{ padding: '3px 8px', background: '#f3f4f6', borderRadius: '4px' }}>{selectedElement.type}</span></div>)}
      </div>

      {/* Tabs */}
      {selectedElement && (<div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
        {EDITOR_TABS.map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: '10px 6px', background: activeTab === tab.id ? 'white' : 'transparent', border: 'none', borderBottom: activeTab === tab.id ? '2px solid #667eea' : '2px solid transparent', fontSize: '10px', fontWeight: activeTab === tab.id ? 600 : 400, color: activeTab === tab.id ? '#667eea' : '#6b7280', cursor: 'pointer', transition: 'all 0.2s' }}>{tab.icon} {tab.label}</button>))}
      </div>)}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: selectedElement ? '16px' : '40px 16px' }}>
        {!selectedElement ? (<div style={{ textAlign: 'center', color: '#9ca3af' }}><div style={{ fontSize: '48px', marginBottom: '16px' }}>🖱️</div><p style={{ fontSize: '14px', margin: 0, lineHeight: 1.5 }}>Click any text or image on your website to start editing</p><p style={{ fontSize: '12px', color: '#d1d5db', marginTop: '12px' }}>All elements with data-editable-id are editable</p></div>) : (<>
          {/* CONTENT TAB */}
          {activeTab === 'content' && (<div style={{ display: 'grid', gap: '16px' }}>
            {selectedElement.type === 'text' ? (<div><Label>Text Content</Label><textarea value={selectedElement.text} onChange={(e) => handleTextChange(e.target.value)} style={{ width: '100%', minHeight: '100px', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit' }} /></div>) : (<><div><Label>Replace Image</Label><input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} /><button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ width: '100%', padding: '12px', background: uploading ? '#e5e7eb' : '#667eea', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer' }}>📸 {uploading ? 'Uploading...' : 'Upload New Image'}</button></div>{selectedElement.imageUrl && <div><Label>Current Image</Label><img src={selectedElement.imageUrl} alt="Current" style={{ width: '100%', height: 'auto', maxHeight: '180px', objectFit: 'contain', border: '2px solid #e5e7eb', borderRadius: '8px' }} /></div>}</>)}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}><button onClick={handleDuplicate} style={{ padding: '8px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>📋 Duplicate</button><button onClick={handleDelete} style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>🗑️ Hide</button></div>
          </div>)}

          {/* STYLE TAB */}
          {activeTab === 'style' && (<div style={{ display: 'grid', gap: '16px' }}>
            {selectedElement.type === 'text' && (<><div><Label>Font</Label><select value={selectedElement.styles.fontFamily.split(',')[0].replace(/['"]/g, '')} onChange={(e) => handleStyleChange('fontFamily', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>{GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}</select></div><div><Label>Size: {selectedElement.styles.fontSize}</Label><input type="range" min="10" max="72" value={parseInt(selectedElement.styles.fontSize)} onChange={(e) => handleStyleChange('fontSize', `${e.target.value}px`)} style={{ width: '100%', cursor: 'pointer' }} /></div><div><Label>Weight</Label><select value={selectedElement.styles.fontWeight} onChange={(e) => handleStyleChange('fontWeight', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}><option value="300">Light</option><option value="400">Normal</option><option value="500">Medium</option><option value="600">Semi-Bold</option><option value="700">Bold</option><option value="800">Extra-Bold</option></select></div><div><Label>Color</Label><input type="color" value={selectedElement.styles.color.startsWith('#') ? selectedElement.styles.color : '#000000'} onChange={(e) => handleStyleChange('color', e.target.value)} style={{ width: '100%', height: '42px', border: '2px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer' }} /></div><div><Label>Align</Label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px' }}>{['left', 'center', 'right', 'justify'].map(a => <button key={a} onClick={() => handleStyleChange('textAlign', a)} style={{ padding: '8px 4px', background: selectedElement.styles.textAlign === a ? '#667eea' : 'white', color: selectedElement.styles.textAlign === a ? 'white' : '#374151', border: '2px solid #e5e7eb', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>{a[0].toUpperCase()}</button>)}</div></div></>)}
            <div><Label>Background</Label><input type="color" value={selectedElement.styles.backgroundColor.startsWith('#') || selectedElement.styles.backgroundColor.startsWith('rgb') ? selectedElement.styles.backgroundColor : '#ffffff'} onChange={(e) => handleStyleChange('backgroundColor', e.target.value)} style={{ width: '100%', height: '42px', border: '2px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer' }} /></div>
            <div><Label>Corners: {selectedElement.styles.borderRadius}</Label><input type="range" min="0" max="50" value={parseInt(selectedElement.styles.borderRadius)} onChange={(e) => handleStyleChange('borderRadius', `${e.target.value}px`)} style={{ width: '100%', cursor: 'pointer' }} /></div>
            <div><Label>Shadow</Label><select value={selectedElement.styles.boxShadow || 'none'} onChange={(e) => handleStyleChange('boxShadow', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}><option value="none">None</option><option value="0 1px 3px rgba(0,0,0,0.1)">Small</option><option value="0 4px 6px rgba(0,0,0,0.1)">Medium</option><option value="0 10px 15px rgba(0,0,0,0.1)">Large</option><option value="0 20px 25px rgba(0,0,0,0.1)">X-Large</option></select></div>
          </div>)}

          {/* LAYOUT TAB */}
          {activeTab === 'layout' && (<div style={{ display: 'grid', gap: '16px' }}>
            {selectedElement.type === 'image' && (<><div><Label>Width</Label><select value={selectedElement.styles.width} onChange={(e) => handleStyleChange('width', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}><option value="auto">Auto</option><option value="100%">Full (100%)</option><option value="75%">75%</option><option value="50%">50%</option><option value="25%">25%</option><option value="300px">300px</option><option value="500px">500px</option></select></div><div><Label>Height</Label><select value={selectedElement.styles.height} onChange={(e) => handleStyleChange('height', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}><option value="auto">Auto</option><option value="150px">150px</option><option value="200px">200px</option><option value="300px">300px</option><option value="400px">400px</option></select></div><div><Label>Object Fit</Label><select value={selectedElement.styles.objectFit} onChange={(e) => handleStyleChange('objectFit', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option><option value="none">None</option></select></div></>)}
            <div><Label>Padding</Label><select value={selectedElement.styles.padding} onChange={(e) => handleStyleChange('padding', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}><option value="0">None</option><option value="4px">4px</option><option value="8px">8px</option><option value="12px">12px</option><option value="16px">16px</option><option value="24px">24px</option></select></div>
            <div><Label>Margin</Label><select value={selectedElement.styles.margin} onChange={(e) => handleStyleChange('margin', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}><option value="0">None</option><option value="4px">4px</option><option value="8px">8px</option><option value="12px">12px</option><option value="16px">16px</option><option value="24px">24px</option></select></div>
          </div>)}

          {/* ADVANCED TAB */}
          {activeTab === 'advanced' && (<div style={{ display: 'grid', gap: '16px' }}>
            <div><Label>Opacity: {parseFloat(selectedElement.styles.opacity || 1).toFixed(2)}</Label><input type="range" min="0" max="1" step="0.1" value={parseFloat(selectedElement.styles.opacity || 1)} onChange={(e) => handleStyleChange('opacity', e.target.value)} style={{ width: '100%', cursor: 'pointer' }} /></div>
            <div><Label>Display</Label><select value={selectedElement.styles.display} onChange={(e) => handleStyleChange('display', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}><option value="block">Block</option><option value="inline-block">Inline-Block</option><option value="flex">Flex</option><option value="grid">Grid</option><option value="none">None (Hidden)</option></select></div>
            <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', fontSize: '11px', color: '#6b7280' }}><div style={{ marginBottom: '4px', fontWeight: 600 }}>Element ID:</div><code style={{ padding: '4px 8px', background: 'white', borderRadius: '4px', fontSize: '10px' }}>{selectedElement.id}</code></div>
          </div>)}
        </>)}
      </div>
    </div>
  </>)
}
