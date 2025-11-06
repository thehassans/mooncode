import React, { useState, useEffect } from 'react'
import { apiGet, apiPost, apiUpload } from '../../api'

export default function BannerManager() {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPage, setSelectedPage] = useState('catalog')
  const [toast, setToast] = useState(null)
  const [previewBanner, setPreviewBanner] = useState(null)

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
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Manage banners with live preview and enable/disable options</p>
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
            <p>No banners found for this page</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>Select a different page or add banners through the admin panel</p>
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
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setPreviewBanner(banner)}
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
                      color: '#667eea',
                      border: '2px solid #667eea',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#667eea'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))'}
                  >
                    👁️ Preview
                  </button>
                  <button
                    onClick={() => handleToggle(banner._id, banner.active)}
                    style={{
                      padding: '8px 16px',
                      background: banner.active ? '#10b981' : '#f3f4f6',
                      color: banner.active ? 'white' : '#374151',
                      border: '2px solid',
                      borderColor: banner.active ? '#10b981' : '#e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {banner.active ? '✓ Enabled' : '○ Enable'}
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

      {/* Live Preview Modal */}
      {previewBanner && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setPreviewBanner(null)}
        >
          <div style={{ maxWidth: '1400px', width: '100%', position: 'relative' }}>
            {/* Close Button */}
            <button
              onClick={() => setPreviewBanner(null)}
              style={{
                position: 'absolute',
                top: '-50px',
                right: '0',
                background: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              ✕ Close Preview
            </button>

            {/* Banner Preview */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}>
              <img
                src={previewBanner.imageUrl}
                alt={previewBanner.title}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                  display: 'block'
                }}
                onClick={(e) => e.stopPropagation()}
              />
              
              {/* Banner Info Overlay */}
              <div style={{
                padding: '20px',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.95), rgba(118, 75, 162, 0.95))',
                color: 'white'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>
                      {previewBanner.title || 'Banner'}
                    </h3>
                    <p style={{ fontSize: '14px', opacity: 0.9 }}>
                      {previewBanner.page} • {new Date(previewBanner.createdAt || Date.now()).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggle(previewBanner._id, previewBanner.active)
                      setPreviewBanner(prev => ({ ...prev, active: !prev.active }))
                    }}
                    style={{
                      padding: '10px 20px',
                      background: previewBanner.active ? 'white' : 'rgba(255,255,255,0.2)',
                      color: previewBanner.active ? '#10b981' : 'white',
                      border: '2px solid white',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {previewBanner.active ? '✓ Enabled' : '○ Enable'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
