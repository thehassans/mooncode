import React, { useState, useEffect, useRef } from 'react'
import { apiGet, apiPost, apiUpload } from '../../api'
import BannerManager from '../../pages/admin/BannerManager'
import ThemeSettings from '../../pages/admin/ThemeSettings'
import SEOManager from '../../pages/admin/SEOManager'
import PageManager from '../../pages/admin/PageManager'
import NavigationMenu from '../../pages/admin/NavigationMenu'

const GOOGLE_FONTS = [
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New',
  'Comic Sans MS', 'Impact', 'Trebuchet MS', 'Open Sans', 'Roboto', 'Lato',
  'Montserrat', 'Poppins', 'Playfair Display', 'Raleway', 'Ubuntu', 'Merriweather'
]

const EDITOR_TABS = [
  { id: 'content', label: 'Content', icon: '📝' },
  { id: 'style', label: 'Style', icon: '🎨' },
  { id: 'layout', label: 'Layout', icon: '📐' },
  { id: 'media', label: 'Media', icon: '🖼️' },
  { id: 'products', label: 'Products', icon: '📦' },
  { id: 'advanced', label: 'Advanced', icon: '⚙️' }
]

export default function EditMode({ page, isActive, onExit, onSave }) {
  const [elements, setElements] = useState([])
  const [selectedElement, setSelectedElement] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('content')
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState(null)
  const [cropData, setCropData] = useState({ x: 0, y: 0, width: 100, height: 100, zoom: 1 })
  const [banners, setBanners] = useState([])
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [editWebsiteMenuOpen, setEditWebsiteMenuOpen] = useState(false)
  const [activeToolModal, setActiveToolModal] = useState(null)
  const fileInputRef = useRef(null)
  const cropImageRef = useRef(null)
  const bannerInputRef = useRef(null)

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
      // Load banners
      const bannersData = await apiGet(`/api/settings/website/banners?page=${page}`)
      if (bannersData.banners) {
        setBanners(bannersData.banners)
      }
      // Load products
      loadProducts()
    } catch (err) {
      console.error('Failed to load page content:', err)
    }
  }

  async function loadProducts() {
    setLoadingProducts(true)
    try {
      const data = await apiGet('/api/products?limit=100')
      if (data.products) {
        setProducts(data.products)
      }
    } catch (err) {
      console.error('Failed to load products:', err)
    } finally {
      setLoadingProducts(false)
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
      if (onSave) onSave({ elements, count: elements.length })
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      showToast('✗ Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Expose save/state to parent via useEffect
  useEffect(() => {
    if (isActive && onSave) {
      onSave({ 
        canSave: elements.length > 0 && !saving,
        elementCount: elements.length,
        saving,
        handleSave
      })
    }
  }, [elements.length, saving, isActive])

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

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error')
      return
    }
    
    const reader = new FileReader()
    reader.onload = (evt) => {
      setImageToCrop(evt.target.result)
      setCropModalOpen(true)
    }
    reader.readAsDataURL(file)
  }

  async function handleCropComplete() {
    if (!cropImageRef.current || !selectedElement) return
    
    setUploading(true)
    setCropModalOpen(false)
    
    try {
      const canvas = document.createElement('canvas')
      const img = cropImageRef.current
      const scaleX = img.naturalWidth / img.width
      const scaleY = img.naturalHeight / img.height
      
      canvas.width = cropData.width
      canvas.height = cropData.height
      const ctx = canvas.getContext('2d')
      
      ctx.drawImage(
        img,
        cropData.x * scaleX,
        cropData.y * scaleY,
        cropData.width * scaleX,
        cropData.height * scaleY,
        0,
        0,
        cropData.width,
        cropData.height
      )
      
      canvas.toBlob(async (blob) => {
        const formData = new FormData()
        formData.append('banner', blob, 'cropped-image.jpg')
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
          showToast('✓ Image cropped & uploaded!')
        }
        setUploading(false)
      }, 'image/jpeg', 0.9)
    } catch (err) {
      showToast('Crop failed', 'error')
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

  async function handleBannerUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error')
      return
    }
    
    setUploadingBanner(true)
    try {
      const formData = new FormData()
      formData.append('banner', file)
      formData.append('title', `Banner ${banners.length + 1}`)
      formData.append('page', page)
      formData.append('active', 'true')
      
      const result = await apiUpload('/api/settings/website/banners', formData)
      if (result.banner) {
        setBanners(prev => [...prev, result.banner])
        showToast('✓ Banner uploaded successfully!')
        // Reload to show new banner
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch (err) {
      showToast('Banner upload failed', 'error')
    } finally {
      setUploadingBanner(false)
      if (bannerInputRef.current) bannerInputRef.current.value = ''
    }
  }

  async function handleBannerDelete(bannerId) {
    if (!confirm('Delete this banner?')) return
    try {
      await apiPost(`/api/settings/website/banners/${bannerId}/delete`, {})
      setBanners(prev => prev.filter(b => b._id !== bannerId))
      showToast('✓ Banner deleted')
    } catch (err) {
      showToast('Delete failed', 'error')
    }
  }

  async function handleBannerToggle(bannerId, currentStatus) {
    try {
      await apiPost(`/api/settings/website/banners/${bannerId}/toggle`, { active: !currentStatus })
      setBanners(prev => prev.map(b => b._id === bannerId ? { ...b, active: !currentStatus } : b))
      showToast(`✓ Banner ${!currentStatus ? 'activated' : 'deactivated'}`)
    } catch (err) {
      showToast('Toggle failed', 'error')
    }
  }

  async function handleProductVisibilityToggle(productId) {
    const product = products.find(p => p._id === productId)
    if (!product) return

    try {
      const newStatus = !product.isVisible
      await apiPost(`/api/products/${productId}`, { isVisible: newStatus })
      setProducts(prev => prev.map(p => p._id === productId ? { ...p, isVisible: newStatus } : p))
      showToast(`✓ Product ${newStatus ? 'shown' : 'hidden'} on website`)
    } catch (err) {
      showToast('Update failed', 'error')
    }
  }

  async function handleProductQuantityUpdate(productId, newQuantity) {
    if (newQuantity < 0) return

    try {
      await apiPost(`/api/products/${productId}`, { stock: newQuantity })
      setProducts(prev => prev.map(p => p._id === productId ? { ...p, stock: newQuantity } : p))
      showToast('✓ Quantity updated')
    } catch (err) {
      showToast('Update failed', 'error')
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

  const Label = ({ children }) => <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>{children}</label>

  return (<>
    <style>{`
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      @keyframes slideIn { from { transform: translateY(-100%); } to { transform: translateY(0); } }
    `}</style>

    {/* Toast Notification */}
    {toast && (<div style={{ position: 'fixed', top: '80px', right: sidebarOpen ? '400px' : '20px', zIndex: 10001, padding: '12px 20px', background: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : '#10b981', color: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontSize: '13px', fontWeight: 500, animation: 'slideIn 0.3s ease', transition: 'right 0.3s ease' }}>{toast.message}</div>)}

    {/* Right Sidebar */}
    <div className="edit-sidebar" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '380px', background: 'white', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', zIndex: 9999, display: 'flex', flexDirection: 'column', transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease', fontFamily: 'system-ui' }}>
      
      {/* Toggle Button */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ position: 'absolute', left: '-36px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '70px', background: 'white', border: 'none', borderRadius: '6px 0 0 6px', boxShadow: '-4px 0 12px rgba(0,0,0,0.1)', cursor: 'pointer', fontSize: '18px', color: '#667eea' }}>{sidebarOpen ? '→' : '←'}</button>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))' }}>
        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{selectedElement ? '✏️ Edit Element' : '🎨 Edit Website'}</h2>
        {selectedElement && (<div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '11px', color: '#6b7280' }}><span style={{ padding: '3px 8px', background: '#f3f4f6', borderRadius: '4px' }}>{selectedElement.tagName}</span><span style={{ padding: '3px 8px', background: '#f3f4f6', borderRadius: '4px' }}>{selectedElement.type}</span></div>)}
      </div>

      {/* Edit Website Menu */}
      {!selectedElement && (
        <div style={{ borderBottom: '1px solid #e5e7eb' }}>
          <button 
            onClick={() => setEditWebsiteMenuOpen(!editWebsiteMenuOpen)}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: editWebsiteMenuOpen ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))' : 'white',
              border: 'none',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              color: '#374151',
              transition: 'all 0.2s'
            }}
          >
            <span>📋 Website Tools</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: editWebsiteMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          
          {editWebsiteMenuOpen && (
            <div style={{ background: 'white', padding: '8px' }}>
              <button onClick={() => { setActiveTab('content'); setSelectedElement(null); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: 'transparent', border: 'none', color: '#374151', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: '8px', fontSize: '16px', flexShrink: 0 }}>🎨</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>Live Editor</div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Edit page content & styles</div>
                </div>
              </button>
              
              <button onClick={() => setActiveToolModal('banners')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: 'transparent', border: 'none', color: '#374151', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: '8px', fontSize: '16px', flexShrink: 0 }}>🖼️</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>Banner Manager</div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Upload & manage banners</div>
                </div>
              </button>
              
              <button onClick={() => setActiveToolModal('theme')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: 'transparent', border: 'none', color: '#374151', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: '8px', fontSize: '16px', flexShrink: 0 }}>🎭</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>Theme Settings</div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Colors, fonts & layout</div>
                </div>
              </button>
              
              <button onClick={() => setActiveToolModal('seo')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: 'transparent', border: 'none', color: '#374151', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: '8px', fontSize: '16px', flexShrink: 0 }}>🔍</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>SEO Manager</div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Meta tags & optimization</div>
                </div>
              </button>
              
              <div style={{ height: '1px', background: '#e5e7eb', margin: '8px 4px' }}></div>
              
              <button onClick={() => setActiveToolModal('pages')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: 'transparent', border: 'none', color: '#374151', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: '8px', fontSize: '16px', flexShrink: 0 }}>📄</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>Page Manager</div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Create & manage pages</div>
                </div>
              </button>
              
              <button onClick={() => setActiveToolModal('navigation')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: 'transparent', border: 'none', color: '#374151', transition: 'all 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: '8px', fontSize: '16px', flexShrink: 0 }}>🧭</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>Navigation Menu</div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Customize menu items</div>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      {selectedElement && (<div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
        {EDITOR_TABS.map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: '10px 6px', background: activeTab === tab.id ? 'white' : 'transparent', border: 'none', borderBottom: activeTab === tab.id ? '2px solid #667eea' : '2px solid transparent', fontSize: '10px', fontWeight: activeTab === tab.id ? 600 : 400, color: activeTab === tab.id ? '#667eea' : '#6b7280', cursor: 'pointer', transition: 'all 0.2s' }}>{tab.icon} {tab.label}</button>))}
      </div>)}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: selectedElement ? '16px' : '40px 16px' }}>
        {!selectedElement ? (<div style={{ textAlign: 'center', color: '#9ca3af' }}><div style={{ fontSize: '48px', marginBottom: '16px' }}>🖱️</div><p style={{ fontSize: '14px', margin: 0, lineHeight: 1.5 }}>Click any text or image on your website to start editing</p><p style={{ fontSize: '12px', color: '#d1d5db', marginTop: '12px' }}>All elements with data-editable-id are editable</p></div>) : (<>
          {/* CONTENT TAB */}
          {activeTab === 'content' && (<div style={{ display: 'grid', gap: '16px' }}>
            {selectedElement.type === 'text' ? (<div><Label>Text Content</Label><textarea value={selectedElement.text} onChange={(e) => handleTextChange(e.target.value)} style={{ width: '100%', minHeight: '100px', padding: '10px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit' }} /></div>) : (<><div><Label>Replace Image</Label><input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} /><button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ width: '100%', padding: '12px', background: uploading ? '#e5e7eb' : '#667eea', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer' }}>📸 {uploading ? 'Uploading...' : 'Upload & Crop Image'}</button></div>{selectedElement.imageUrl && <div><Label>Current Image</Label><img src={selectedElement.imageUrl} alt="Current" style={{ width: '100%', height: 'auto', maxHeight: '180px', objectFit: 'contain', border: '2px solid #e5e7eb', borderRadius: '8px' }} /></div>}</>)}
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

          {/* MEDIA TAB */}
          {activeTab === 'media' && (<div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ padding: '12px', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>🖼️ Banner Management</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Upload and manage page banners</div>
            </div>

            <div>
              <Label>Upload New Banner</Label>
              <input 
                ref={bannerInputRef}
                type="file" 
                accept="image/*" 
                onChange={handleBannerUpload}
                style={{ display: 'none' }}
              />
              <button 
                onClick={() => bannerInputRef.current?.click()}
                disabled={uploadingBanner}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: uploadingBanner ? '#e5e7eb' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: uploadingBanner ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {uploadingBanner ? '⏳ Uploading...' : '📸 Upload Banner'}
              </button>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              <Label>Current Banners ({banners.length})</Label>
              <div style={{ display: 'grid', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                {banners.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '12px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📁</div>
                    <div>No banners uploaded yet</div>
                  </div>
                ) : (
                  banners.map((banner, idx) => (
                    <div key={banner._id || idx} style={{ 
                      background: 'white', 
                      border: '2px solid #e5e7eb', 
                      borderRadius: '8px', 
                      padding: '12px',
                      position: 'relative'
                    }}>
                      <img 
                        src={banner.imageUrl} 
                        alt={banner.title}
                        style={{ 
                          width: '100%', 
                          height: '120px', 
                          objectFit: 'cover', 
                          borderRadius: '6px',
                          marginBottom: '8px'
                        }}
                      />
                      <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
                        {banner.title || `Banner ${idx + 1}`}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleBannerToggle(banner._id, banner.active)}
                          style={{
                            flex: 1,
                            padding: '6px',
                            background: banner.active ? '#10b981' : '#f3f4f6',
                            color: banner.active ? 'white' : '#374151',
                            border: '1px solid #e5e7eb',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {banner.active ? '✓ Active' : 'Inactive'}
                        </button>
                        <button
                          onClick={() => handleBannerDelete(banner._id)}
                          style={{
                            padding: '6px 10px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>)}

          {/* PRODUCTS TAB */}
          {activeTab === 'products' && (<div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ padding: '12px', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>📦 Product Management</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Control product visibility and stock</div>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
              <Label>All Products ({products.length})</Label>
              <div style={{ display: 'grid', gap: '12px', maxHeight: '500px', overflowY: 'auto', marginTop: '8px' }}>
                {loadingProducts ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '12px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
                    <div>Loading products...</div>
                  </div>
                ) : products.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '12px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
                    <div>No products found</div>
                  </div>
                ) : (
                  products.map((product) => (
                    <div key={product._id} style={{ 
                      background: 'white', 
                      border: product.isVisible !== false ? '2px solid #10b981' : '2px solid #e5e7eb', 
                      borderRadius: '8px', 
                      padding: '10px',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                      transition: 'all 0.2s'
                    }}>
                      {/* Product Image */}
                      <img 
                        src={product.image || '/placeholder.png'} 
                        alt={product.name}
                        style={{ 
                          width: '50px', 
                          height: '50px', 
                          objectFit: 'cover', 
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                          flexShrink: 0
                        }}
                      />
                      
                      {/* Product Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontSize: '12px', 
                          fontWeight: 600, 
                          color: '#111827',
                          marginBottom: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {product.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '6px' }}>
                          {product.price} SAR
                        </div>
                        
                        {/* Quantity Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <label style={{ fontSize: '9px', color: '#6b7280', fontWeight: 600 }}>Stock:</label>
                          <button
                            onClick={() => handleProductQuantityUpdate(product._id, (product.stock || 0) - 1)}
                            style={{
                              width: '20px',
                              height: '20px',
                              padding: 0,
                              background: '#f3f4f6',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={product.stock || 0}
                            onChange={(e) => handleProductQuantityUpdate(product._id, parseInt(e.target.value) || 0)}
                            style={{
                              width: '40px',
                              padding: '4px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px',
                              fontSize: '10px',
                              textAlign: 'center'
                            }}
                          />
                          <button
                            onClick={() => handleProductQuantityUpdate(product._id, (product.stock || 0) + 1)}
                            style={{
                              width: '20px',
                              height: '20px',
                              padding: 0,
                              background: '#f3f4f6',
                              border: '1px solid #e5e7eb',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      
                      {/* Visibility Toggle */}
                      <button
                        onClick={() => handleProductVisibilityToggle(product._id)}
                        style={{
                          width: '32px',
                          height: '32px',
                          padding: 0,
                          background: product.isVisible !== false ? '#10b981' : '#e5e7eb',
                          color: product.isVisible !== false ? 'white' : '#9ca3af',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.2s'
                        }}
                        title={product.isVisible !== false ? 'Visible on website' : 'Hidden from website'}
                      >
                        {product.isVisible !== false ? '✓' : '○'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
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

    {/* Crop Modal */}
    {cropModalOpen && imageToCrop && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
        <div style={{ background: 'white', borderRadius: '16px', maxWidth: '90vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>✂️ Crop Image</h3>
            <button onClick={() => setCropModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#6b7280' }}>×</button>
          </div>
          
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ position: 'relative', maxHeight: '60vh', overflow: 'hidden', background: '#f3f4f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img ref={cropImageRef} src={imageToCrop} alt="Crop preview" style={{ maxWidth: '100%', maxHeight: '60vh', display: 'block' }} onLoad={() => {
                const img = cropImageRef.current
                if (img) {
                  setCropData({ x: 0, y: 0, width: Math.min(400, img.width), height: Math.min(400, img.height), zoom: 1 })
                }
              }} />
              
              {/* Crop Overlay */}
              <div style={{ position: 'absolute', border: '2px dashed #667eea', boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)', left: `${cropData.x}px`, top: `${cropData.y}px`, width: `${cropData.width}px`, height: `${cropData.height}px`, pointerEvents: 'none' }} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Width</label><input type="number" value={Math.round(cropData.width)} onChange={(e) => setCropData(prev => ({ ...prev, width: parseInt(e.target.value) || 100 }))} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Height</label><input type="number" value={Math.round(cropData.height)} onChange={(e) => setCropData(prev => ({ ...prev, height: parseInt(e.target.value) || 100 }))} style={{ width: '100%', padding: '8px', border: '2px solid #e5e7eb', borderRadius: '6px' }} /></div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setCropData(prev => ({ ...prev, width: prev.width, height: prev.width }))} style={{ flex: 1, padding: '8px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Square</button>
              <button onClick={() => setCropData(prev => ({ ...prev, width: prev.height * 1.5, height: prev.height }))} style={{ flex: 1, padding: '8px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>3:2</button>
              <button onClick={() => setCropData(prev => ({ ...prev, width: prev.height * 1.777, height: prev.height }))} style={{ flex: 1, padding: '8px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>16:9</button>
            </div>
          </div>
          
          <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button onClick={() => setCropModalOpen(false)} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleCropComplete} disabled={uploading} style={{ padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>{uploading ? 'Cropping...' : '✂️ Crop & Upload'}</button>
          </div>
        </div>
      </div>
    )}

    {/* Tool Modals */}
    {activeToolModal && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10003, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', padding: '20px' }}>
        <div style={{ background: 'white', borderRadius: '16px', maxWidth: '1400px', width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
          {/* Modal Header */}
          <div style={{ padding: '20px 24px', borderBottom: '2px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08))' }}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
              {activeToolModal === 'banners' && '🖼️ Banner Manager'}
              {activeToolModal === 'theme' && '🎭 Theme Settings'}
              {activeToolModal === 'seo' && '🔍 SEO Manager'}
              {activeToolModal === 'pages' && '📄 Page Manager'}
              {activeToolModal === 'navigation' && '🧭 Navigation Menu'}
            </h3>
            <button 
              onClick={() => setActiveToolModal(null)} 
              style={{ background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: '#6b7280', padding: '0 8px', lineHeight: 1, transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#111827'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#6b7280'}
            >
              ×
            </button>
          </div>
          
          {/* Modal Content */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>
            {activeToolModal === 'banners' && <BannerManager />}
            {activeToolModal === 'theme' && <ThemeSettings />}
            {activeToolModal === 'seo' && <SEOManager />}
            {activeToolModal === 'pages' && <PageManager />}
            {activeToolModal === 'navigation' && <NavigationMenu />}
          </div>
        </div>
      </div>
    )}
  </>)
}
