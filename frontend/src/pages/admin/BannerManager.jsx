import React, { useState, useEffect } from 'react'
import { apiGet, apiPost, apiUpload } from '../../api'

export default function BannerManager() {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedPage, setSelectedPage] = useState('catalog')
  const [toast, setToast] = useState(null)

  const pages = [
    { id: 'catalog', label: 'Product Catalog' },
    { id: 'home', label: 'Home Page' },
    { id: 'checkout', label: 'Checkout' },
    { id: 'cart', label: 'Cart' }
  ]

  useEffect(() => {
    loadBanners()
  }, [selectedPage])

  async function loadBanners() {
    setLoading(true)
    try {
      const data = await apiGet(`/api/settings/website/banners?page=${selectedPage}`)
      setBanners(data.banners || [])
    } catch (err) {
      showToast('Failed to load banners', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('banner', file)
      formData.append('title', `Banner ${banners.length + 1}`)
      formData.append('page', selectedPage)
      formData.append('active', 'true')

      const result = await apiUpload('/api/settings/website/banners', formData)
      if (result.banner) {
        setBanners(prev => [...prev, result.banner])
        showToast('✓ Banner uploaded successfully!')
      }
    } catch (err) {
      showToast('Upload failed', 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleToggle(bannerId, currentStatus) {
    try {
      await apiPost(`/api/settings/website/banners/${bannerId}/toggle`, { active: !currentStatus })
      setBanners(prev => prev.map(b => b._id === bannerId ? { ...b, active: !currentStatus } : b))
      showToast(`✓ Banner ${!currentStatus ? 'activated' : 'deactivated'}`)
    } catch (err) {
      showToast('Toggle failed', 'error')
    }
  }

  async function handleDelete(bannerId) {
    if (!confirm('Delete this banner?')) return
    try {
      await apiPost(`/api/settings/website/banners/${bannerId}/delete`, {})
      setBanners(prev => prev.filter(b => b._id !== bannerId))
      showToast('✓ Banner deleted')
    } catch (err) {
      showToast('Delete failed', 'error')
    }
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>🖼️ Banner Manager</h1>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Upload and manage banners for different pages</p>
      </div>

      {/* Page Selector */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Select Page:</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {pages.map(page => (
            <button
              key={page.id}
              onClick={() => setSelectedPage(page.id)}
              style={{
                padding: '8px 16px',
                background: selectedPage === page.id ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                color: selectedPage === page.id ? 'white' : '#374151',
                border: '2px solid',
                borderColor: selectedPage === page.id ? '#667eea' : '#e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {page.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Section */}
      <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Upload New Banner</h3>
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading}
          style={{ display: 'none' }}
          id="banner-upload"
        />
        <label
          htmlFor="banner-upload"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: uploading ? '#e5e7eb' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: uploading ? 'not-allowed' : 'pointer',
            border: 'none'
          }}
        >
          {uploading ? '⏳ Uploading...' : '📸 Upload Banner'}
        </label>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
          Recommended size: 1920x600px • Max file size: 5MB
        </p>
      </div>

      {/* Banners List */}
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
          Current Banners ({banners.length})
        </h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <p>Loading banners...</p>
          </div>
        ) : banners.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', background: 'white', border: '2px dashed #e5e7eb', borderRadius: '12px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
            <p>No banners uploaded yet</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>Upload your first banner to get started</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {banners.map((banner, idx) => (
              <div key={banner._id} style={{
                background: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                gap: '16px',
                alignItems: 'center'
              }}>
                {/* Banner Image */}
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  style={{
                    width: '200px',
                    height: '100px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}
                />

                {/* Banner Info */}
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                    {banner.title || `Banner ${idx + 1}`}
                  </h4>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>
                    Uploaded: {new Date(banner.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleToggle(banner._id, banner.active)}
                    style={{
                      padding: '8px 16px',
                      background: banner.active ? '#10b981' : '#f3f4f6',
                      color: banner.active ? 'white' : '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {banner.active ? '✓ Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => handleDelete(banner._id)}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
