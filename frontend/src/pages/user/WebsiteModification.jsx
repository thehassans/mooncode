import React, { useState, useEffect } from 'react'
import { apiGet, apiUpload, API_BASE } from '../../api'

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
  const [bannerActive, setBannerActive] = useState(true)

  useEffect(() => {
    loadBanners()
  }, [])

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
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB')
      return
    }
    
    setSelectedFile(file)
    setError('')
    
    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result)
    }
    reader.readAsDataURL(file)
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
      formData.append('active', String(bannerActive))
      
      await apiUpload('/api/settings/website/banners', formData)
      
      setMessage('Banner uploaded successfully!')
      setSelectedFile(null)
      setPreviewUrl('')
      setBannerTitle('')
      setBannerLink('')
      setBannerActive(true)
      
      // Reset file input
      const fileInput = document.getElementById('banner-file-input')
      if (fileInput) fileInput.value = ''
      
      await loadBanners()
      
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
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to delete banner')
    }
  }

  async function handleToggleBanner(bannerId, currentStatus) {
    try {
      await apiGet(`/api/settings/website/banners/${bannerId}/toggle`)
      setMessage(`Banner ${currentStatus ? 'deactivated' : 'activated'} successfully!`)
      await loadBanners()
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to update banner')
    }
  }

  const websiteUrl = 'https://web.buysial.com/catalog'

  return (
    <div className="section">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
            Website Modification
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '15px' }}>
            Manage your e-commerce website banners with live preview
          </p>
        </div>
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          View Live Website
        </a>
      </div>

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

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Upload New Banner Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '24px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(37, 99, 235, 0.05))'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
                  Upload New Banner
                </h2>
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                  Add banners to display on your e-commerce homepage (Recommended: 1920x480px)
                </p>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleUploadBanner} style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gap: '20px' }}>
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
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                  Supported formats: JPG, PNG, GIF, WebP (Max 5MB)
                </div>
              </div>

              {/* Preview */}
              {previewUrl && (
                <div style={{
                  padding: '16px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                    Preview:
                  </div>
                  <img
                    src={previewUrl}
                    alt="Banner preview"
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: '300px',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      border: '1px solid var(--border)'
                    }}
                  />
                </div>
              )}

              {/* Banner Details */}
              <div className="field">
                <label className="label">Banner Title (Optional)</label>
                <input
                  type="text"
                  className="input"
                  value={bannerTitle}
                  onChange={(e) => setBannerTitle(e.target.value)}
                  placeholder="e.g., Summer Sale 2024"
                />
              </div>

              <div className="field">
                <label className="label">Link URL (Optional)</label>
                <input
                  type="url"
                  className="input"
                  value={bannerLink}
                  onChange={(e) => setBannerLink(e.target.value)}
                  placeholder="https://example.com/sale"
                />
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                  When clicked, users will be redirected to this URL
                </div>
              </div>

              <div className="field">
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={bannerActive}
                    onChange={(e) => setBannerActive(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>
                    Active (Display on website)
                  </span>
                </label>
              </div>

              <button type="submit" className="btn" disabled={uploading || !selectedFile}>
                {uploading ? 'Uploading...' : 'Upload Banner'}
              </button>
            </div>
          </form>
        </div>

        {/* Current Banners Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '24px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(139, 92, 246, 0.05))'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
                    Current Banners
                  </h2>
                  <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                    {banners.length} banner(s) • {banners.filter(b => b.active).length} active
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ padding: '24px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
                Loading banners...
              </div>
            ) : banners.length === 0 ? (
              <div style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--muted)'
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', opacity: 0.4 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p style={{ fontSize: '16px', marginBottom: '8px' }}>No banners uploaded yet</p>
                <p style={{ fontSize: '14px' }}>
                  Upload your first banner to get started
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {banners.map((banner, index) => (
                  <div
                    key={banner._id || index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      gap: '16px',
                      alignItems: 'center',
                      padding: '16px',
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px'
                    }}
                  >
                    {/* Banner Image */}
                    <img
                      src={banner.imageUrl}
                      alt={banner.title || `Banner ${index + 1}`}
                      style={{
                        width: '200px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '1px solid var(--border)'
                      }}
                    />
                    
                    {/* Banner Info */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                        {banner.title || `Banner ${index + 1}`}
                      </div>
                      {banner.link && (
                        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>
                          🔗 {banner.link}
                        </div>
                      )}
                      <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        Uploaded: {new Date(banner.createdAt).toLocaleDateString()}
                      </div>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '8px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: banner.active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                        color: banner.active ? '#10b981' : '#6b7280'
                      }}>
                        {banner.active ? '● Active' : '○ Inactive'}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleToggleBanner(banner._id, banner.active)}
                        className="btn secondary"
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                      >
                        {banner.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDeleteBanner(banner._id)}
                        style={{
                          padding: '8px 16px',
                          fontSize: '13px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 500,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
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

        {/* Info Card */}
        <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))' }}>
          <div style={{ display: 'flex', gap: '14px' }}>
            <div style={{ flexShrink: 0, marginTop: '2px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '8px' }}>
                Banner Guidelines
              </div>
              <ul style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.8', paddingLeft: '20px', margin: 0 }}>
                <li>Recommended size: 1920x480 pixels (16:4 aspect ratio)</li>
                <li>File formats: JPG, PNG, GIF, WebP</li>
                <li>Maximum file size: 5MB</li>
                <li>Active banners will automatically rotate on your website</li>
                <li>Banners appear on the e-commerce homepage</li>
                <li>Changes are reflected instantly on your live website</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
