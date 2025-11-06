import React, { useState, useEffect, useRef } from 'react'
import { apiGet, apiUpload, API_BASE } from '../../api'

const AVAILABLE_PAGES = [
  { value: 'catalog', label: 'Product Catalog (Homepage)', url: '/catalog' },
  { value: 'product-detail', label: 'Product Detail Page', url: '/catalog' },
  { value: 'checkout', label: 'Checkout Page', url: '/catalog' },
  { value: 'cart', label: 'Shopping Cart', url: '/catalog' }
]

export default function WebsiteModification() {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  
  // Banner management
  const [banners, setBanners] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [bannerTitle, setBannerTitle] = useState('')
  const [bannerLink, setBannerLink] = useState('')
  const [bannerPage, setBannerPage] = useState('catalog')
  const [bannerActive, setBannerActive] = useState(true)
  
  // Live preview
  const [iframeKey, setIframeKey] = useState(0)
  const iframeRef = useRef(null)
  
  // Filter banners by selected page
  const [filterPage, setFilterPage] = useState('all')

  useEffect(() => {
    loadBanners()
  }, [])
  
  // Auto-refresh preview when banners change
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshPreview()
    }, 500)
    return () => clearTimeout(timer)
  }, [banners])

  async function loadBanners() {
    setLoading(true)
    try {
      const data = await apiGet('/api/settings/website/banners')
      setBanners(data.banners || [])
    } catch (err) {
      console.error('Failed to load banners:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB')
      return
    }
    
    setSelectedFile(file)
    setError('')
    
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }

  function refreshPreview() {
    setIframeKey(prev => prev + 1)
  }
  
  async function handleUploadBanner(e) {
    e.preventDefault()
    
    if (!selectedFile) {
      setError('Please select an image')
      return
    }
    
    setUploading(true)
    setMessage('')
    setError('')
    
    try {
      const formData = new FormData()
      formData.append('banner', selectedFile)
      formData.append('title', bannerTitle)
      formData.append('link', bannerLink)
      formData.append('page', bannerPage)
      formData.append('active', String(bannerActive))
      
      await apiUpload('/api/settings/website/banners', formData)
      
      setMessage(`Banner uploaded to ${AVAILABLE_PAGES.find(p => p.value === bannerPage)?.label}!`)
      setSelectedFile(null)
      setPreviewUrl('')
      setBannerTitle('')
      setBannerLink('')
      setBannerPage('catalog')
      setBannerActive(true)
      
      const fileInput = document.getElementById('banner-file-input')
      if (fileInput) fileInput.value = ''
      
      await loadBanners()
      refreshPreview()
      
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to upload banner')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteBanner(bannerId) {
    if (!confirm('Are you sure you want to delete this banner?')) return
    
    try {
      await apiGet(`/api/settings/website/banners/${bannerId}/delete`)
      setMessage('Banner deleted successfully!')
      await loadBanners()
      refreshPreview()
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to delete banner')
    }
  }

  async function handleToggleBanner(bannerId, currentStatus) {
    try {
      await apiGet(`/api/settings/website/banners/${bannerId}/toggle`)
      setMessage(`Banner ${currentStatus ? 'deactivated' : 'activated'}!`)
      await loadBanners()
      refreshPreview()
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update banner')
    }
  }
  
  const filteredBanners = filterPage === 'all' 
    ? banners 
    : banners.filter(b => b.page === filterPage)
  
  const getPreviewUrl = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/catalog`
  }

  return (
    <div className="section">
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
            Website Modification
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            Manage banners with live preview - WordPress style
          </p>
        </div>
        <button
          onClick={refreshPreview}
          className="btn secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh Preview
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div style={{
          padding: '16px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          color: '#10b981',
          marginBottom: '24px',
          fontSize: '14px',
          fontWeight: 500
        }}>
          ✓ {message}
        </div>
      )}
      
      {error && (
        <div style={{
          padding: '16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          color: '#ef4444',
          marginBottom: '24px',
          fontSize: '14px',
          fontWeight: 500
        }}>
          ✗ {error}
        </div>
      )}

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '500px 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Left: Forms */}
        <div style={{ display: 'grid', gap: '24px', height: 'fit-content' }}>
          {/* Upload Banner */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid var(--border)',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(37, 99, 235, 0.05))'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Upload New Banner</h2>
            </div>
            
            <form onSubmit={handleUploadBanner} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Page Selector */}
                <div className="field">
                  <label className="label">Page *</label>
                  <select
                    className="input"
                    value={bannerPage}
                    onChange={(e) => setBannerPage(e.target.value)}
                    required
                  >
                    {AVAILABLE_PAGES.map(page => (
                      <option key={page.value} value={page.value}>
                        {page.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* File Upload */}
                <div className="field">
                  <label className="label">Banner Image *</label>
                  <input
                    id="banner-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px dashed var(--border)',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                    required
                  />
                </div>

                {/* Preview */}
                {previewUrl && (
                  <div style={{
                    padding: '12px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}>
                    <img
                      src={previewUrl}
                      alt="Preview"
                      style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: '200px',
                        objectFit: 'contain',
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                )}

                {/* Title */}
                <div className="field">
                  <label className="label">Title (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    value={bannerTitle}
                    onChange={(e) => setBannerTitle(e.target.value)}
                    placeholder="e.g., Summer Sale"
                  />
                </div>

                {/* Link */}
                <div className="field">
                  <label className="label">Link URL (Optional)</label>
                  <input
                    type="url"
                    className="input"
                    value={bannerLink}
                    onChange={(e) => setBannerLink(e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                {/* Active */}
                <div className="field">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={bannerActive}
                      onChange={(e) => setBannerActive(e.target.checked)}
                    />
                    <span>Active (Display on website)</span>
                  </label>
                </div>

                <button type="submit" className="btn" disabled={uploading || !selectedFile}>
                  {uploading ? 'Uploading...' : 'Upload Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: '20px', height: 'calc(100vh - 120px)' }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(139, 92, 246, 0.05))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Live Website Preview</h2>
            <a
              href={getPreviewUrl()}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '13px', color: 'var(--primary)' }}
            >
              Open in new tab ↗
            </a>
          </div>
          
          <div style={{ width: '100%', height: 'calc(100% - 60px)', background: '#f5f5f5' }}>
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={getPreviewUrl()}
              style={{
                width: '100%',
                height: '100%',
                border: 'none'
              }}
              title="Live Website Preview"
            />
          </div>
        </div>
      </div>

      {/* Banner List */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>
            All Banners ({filteredBanners.length})
          </h2>
          
          {/* Filter by Page */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--muted)' }}>Filter:</label>
            <select
              className="input"
              value={filterPage}
              onChange={(e) => setFilterPage(e.target.value)}
              style={{ width: 'auto', padding: '6px 12px' }}
            >
              <option value="all">All Pages</option>
              {AVAILABLE_PAGES.map(page => (
                <option key={page.value} value={page.value}>
                  {page.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              Loading...
            </div>
          ) : filteredBanners.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
              <p>No banners found</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {filteredBanners.map((banner, index) => (
                <div
                  key={banner._id || index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    gap: '16px',
                    alignItems: 'center',
                    padding: '12px',
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px'
                  }}
                >
                  <img
                    src={banner.imageUrl}
                    alt={banner.title || 'Banner'}
                    style={{
                      width: '160px',
                      height: '60px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      border: '1px solid var(--border)'
                    }}
                  />
                  
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                      {banner.title || `Banner ${index + 1}`}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                      📄 {AVAILABLE_PAGES.find(p => p.value === banner.page)?.label || banner.page}
                    </div>
                    {banner.link && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        🔗 {banner.link.substring(0, 40)}...
                      </div>
                    )}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '6px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      background: banner.active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                      color: banner.active ? '#10b981' : '#6b7280'
                    }}>
                      {banner.active ? '● Active' : '○ Inactive'}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleToggleBanner(banner._id, banner.active)}
                      className="btn secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      {banner.active ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => handleDeleteBanner(banner._id)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
