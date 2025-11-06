import React, { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost, apiUpload } from '../../api'

const GOOGLE_FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New', 'Open Sans', 'Roboto', 'Lato', 'Montserrat', 'Poppins', 'Playfair Display', 'Raleway', 'Ubuntu']

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
    return () => { document.body.style.cursor = 'default' }
  }, [isActive, page])

  async function loadPageContent() {
    try {
      const data = await apiGet(/api/settings/website/content?page=)
      if (data.content?.elements) setElements(data.content.elements)
    } catch (err) {
      console.error('Failed to load:', err)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await apiPost('/api/settings/website/content', { page, elements })
      setMessage(' Saved!')
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setMessage(' Failed')
    } finally {
      setSaving(false)
    }
  }

  function handleElementClick(e) {
    if (!isActive) return
    e.preventDefault()
    e.stopPropagation()
    
    const target = e.target
    const elementId = target.getAttribute('data-editable-id') || target.id || ${target.tagName.toLowerCase()}-
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
        borderRadius: currentElement?.styles?.borderRadius || computedStyle.borderRadius,
        width: currentElement?.styles?.width || computedStyle.width,
        height: currentElement?.styles?.height || computedStyle.height,
        objectFit: currentElement?.styles?.objectFit || computedStyle.objectFit
      },
      tagName: target.tagName,
      element: target
    })
    setSidebarOpen(true)
  }

  function handleTextChange(newText) {
    if (!selectedElement) return
    setElements(prev => {
      const existing = prev.find(el => el.id === selectedElement.id)
      if (existing) return prev.map(el => el.id === selectedElement.id ? { ...el, text: newText } : el)
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
      if (existing) return prev.map(el => el.id === selectedElement.id ? { ...el, styles: newStyles } : el)
      return [...prev, { id: selectedElement.id, text: selectedElement.text, type: selectedElement.type, imageUrl: selectedElement.imageUrl, styles: newStyles }]
    })
    setSelectedElement(prev => ({ ...prev, styles: newStyles }))
    if (selectedElement.element) selectedElement.element.style[property] = value
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !selectedElement) return
    if (!file.type.startsWith('image/')) { alert('Please select an image'); return }
    
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
          if (existing) return prev.map(el => el.id === selectedElement.id ? { ...el, imageUrl: newImageUrl } : el)
          return [...prev, { id: selectedElement.id, type: 'image', imageUrl: newImageUrl, styles: selectedElement.styles }]
        })
        setSelectedElement(prev => ({ ...prev, imageUrl: newImageUrl }))
        setMessage(' Image uploaded!')
      }
    } catch (err) {
      alert('Upload failed')
    } finally {
      setUploading(false)
    }
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

  return (<>
    <style>{\@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }\}</style>
    
    {/* Top Bar */}
    <div style={{ position: 'fixed', top: 0, left: 0, right: sidebarOpen ? '380px' : 0, height: '60px', zIndex: 9998, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontFamily: 'system-ui', transition: 'right 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
        <div><div style={{ fontSize: '15px', fontWeight: 700 }}> Edit Mode</div><div style={{ fontSize: '11px', opacity: 0.9 }}>{elements.length} changes</div></div>
      </div>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {message && <div style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>{message}</div>}
        <button onClick={handleSave} disabled={saving || elements.length === 0} style={{ padding: '8px 18px', background: 'white', color: '#667eea', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: (saving || elements.length === 0) ? 'not-allowed' : 'pointer', opacity: (saving || elements.length === 0) ? 0.6 : 1 }}>{saving ? ' Saving...' : ' Save'}</button>
        <button onClick={onExit} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}> Exit</button>
      </div>
    </div>

    {/* Right Sidebar */}
    <div className="edit-sidebar" style={{ position: 'fixed', top: '60px', right: 0, bottom: 0, width: '380px', background: 'white', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', zIndex: 9999, display: 'flex', flexDirection: 'column', transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s', fontFamily: 'system-ui' }}>
      
      <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ position: 'absolute', left: '-36px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '70px', background: 'white', border: 'none', borderRadius: '6px 0 0 6px', boxShadow: '-4px 0 12px rgba(0,0,0,0.1)', cursor: 'pointer', fontSize: '18px', color: '#667eea' }}>{sidebarOpen ? '' : ''}</button>

      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05))' }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{selectedElement ? ' Edit Element' : ' Select Element'}</h2>
        {selectedElement && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>{selectedElement.tagName}  {selectedElement.type}</p>}
      </div>

      {selectedElement && (<div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
        {[{id:'content',l:'Content',i:''},{id:'style',l:'Style',i:''},{id:'layout',l:'Layout',i:''}].map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: '10px', background: activeTab === tab.id ? 'white' : 'transparent', border: 'none', borderBottom: activeTab === tab.id ? '2px solid #667eea' : '2px solid transparent', fontSize: '11px', fontWeight: activeTab === tab.id ? 600 : 400, color: activeTab === tab.id ? '#667eea' : '#6b7280', cursor: 'pointer' }}>{tab.i} {tab.l}</button>))}
      </div>)}

      <div style={{ flex: 1, overflowY: 'auto', padding: selectedElement ? '16px' : '40px 16px' }}>
        {!selectedElement ? (<div style={{ textAlign: 'center', color: '#9ca3af' }}><div style={{ fontSize: '42px', marginBottom: '12px' }}></div><p style={{ fontSize: '13px', margin: 0 }}>Click any text or image to edit</p></div>) : (<>
          {activeTab === 'content' && (<div style={{ display: 'grid', gap: '16px' }}>
            {selectedElement.type === 'text' ? (<div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Text Content</label><textarea value={selectedElement.text} onChange={(e) => handleTextChange(e.target.value)} style={{ width: '100%', minHeight: '90px', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }} /></div>) : (<><div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Replace Image</label><input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} /><button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ width: '100%', padding: '10px', background: uploading ? '#e5e7eb' : '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer' }}> {uploading ? 'Uploading...' : 'Upload New'}</button></div>{selectedElement.imageUrl && <div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Current Image</label><img src={selectedElement.imageUrl} alt="Current" style={{ width: '100%', height: 'auto', maxHeight: '160px', objectFit: 'contain', border: '2px solid #e5e7eb', borderRadius: '6px' }} /></div>}</></>)}
          </div>)}

          {activeTab === 'style' && (<div style={{ display: 'grid', gap: '16px' }}>
            {selectedElement.type === 'text' && (<><div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Font</label><select value={selectedElement.styles.fontFamily.split(',')[0].replace(/['"]/g, '')} onChange={(e) => handleStyleChange('fontFamily', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>{GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}</select></div><div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Size: {selectedElement.styles.fontSize}</label><input type="range" min="10" max="72" value={parseInt(selectedElement.styles.fontSize)} onChange={(e) => handleStyleChange('fontSize', ${e.target.value}px)} style={{ width: '100%', cursor: 'pointer' }} /></div><div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Weight</label><select value={selectedElement.styles.fontWeight} onChange={(e) => handleStyleChange('fontWeight', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}><option value="300">Light</option><option value="400">Normal</option><option value="500">Medium</option><option value="600">Semi-Bold</option><option value="700">Bold</option><option value="800">Extra-Bold</option></select></div><div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Color</label><input type="color" value={selectedElement.styles.color.startsWith('#') ? selectedElement.styles.color : '#000000'} onChange={(e) => handleStyleChange('color', e.target.value)} style={{ width: '100%', height: '42px', border: '2px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer' }} /></div><div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Align</label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px' }}>{['left', 'center', 'right', 'justify'].map(a => <button key={a} onClick={() => handleStyleChange('textAlign', a)} style={{ padding: '8px', background: selectedElement.styles.textAlign === a ? '#667eea' : 'white', color: selectedElement.styles.textAlign === a ? 'white' : '#374151', border: '2px solid #e5e7eb', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{a}</button>)}</div></div></>)}
            <div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Background</label><input type="color" value={selectedElement.styles.backgroundColor.startsWith('#') ? selectedElement.styles.backgroundColor : '#ffffff'} onChange={(e) => handleStyleChange('backgroundColor', e.target.value)} style={{ width: '100%', height: '42px', border: '2px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer' }} /></div>
            <div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Corners: {selectedElement.styles.borderRadius}</label><input type="range" min="0" max="50" value={parseInt(selectedElement.styles.borderRadius)} onChange={(e) => handleStyleChange('borderRadius', ${e.target.value}px)} style={{ width: '100%', cursor: 'pointer' }} /></div>
          </div>)}

          {activeTab === 'layout' && (<div style={{ display: 'grid', gap: '16px' }}>
            {selectedElement.type === 'image' && (<><div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Width</label><select value={selectedElement.styles.width} onChange={(e) => handleStyleChange('width', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}><option value="auto">Auto</option><option value="100%">Full</option><option value="75%">75%</option><option value="50%">50%</option><option value="400px">400px</option></select></div><div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Height</label><select value={selectedElement.styles.height} onChange={(e) => handleStyleChange('height', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}><option value="auto">Auto</option><option value="200px">200px</option><option value="300px">300px</option><option value="400px">400px</option></select></div><div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Fit</label><select value={selectedElement.styles.objectFit} onChange={(e) => handleStyleChange('objectFit', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}><option value="cover">Cover</option><option value="contain">Contain</option><option value="fill">Fill</option></select></div></>)}
            <div><label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Padding: {selectedElement.styles.padding}</label><select value={selectedElement.styles.padding} onChange={(e) => handleStyleChange('padding', e.target.value)} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}><option value="0">None</option><option value="4px">Small</option><option value="8px">Medium</option><option value="16px">Large</option><option value="24px">X-Large</option></select></div>
          </div>)}
        </>)}
      </div>
    </div>
  </>)
}
