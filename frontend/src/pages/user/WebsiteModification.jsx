import React, { useState, useEffect, useRef } from 'react'
import { apiGet } from '../../api'

const AVAILABLE_PAGES = [
  { value: 'catalog', label: 'Product Catalog (Homepage)', url: '/catalog' },
  { value: 'product-detail', label: 'Product Detail Page', url: '/catalog' },
  { value: 'checkout', label: 'Checkout Page', url: '/catalog' },
  { value: 'cart', label: 'Shopping Cart', url: '/catalog' }
]

export default function WebsiteModification() {
  const [loading, setLoading] = useState(false)
  
  // Banner management
  const [banners, setBanners] = useState([])
  
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

  function refreshPreview() {
    setIframeKey(prev => prev + 1)
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

      {/* Live Preview */}
      <div style={{ marginBottom: '24px' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', height: '600px' }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), rgba(139, 92, 246, 0.05))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Live Website Preview</h2>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <a
                href={`${getPreviewUrl()}?edit=true`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ 
                  fontSize: '13px', 
                  padding: '6px 14px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                🎨 Enable Edit Mode
              </a>
              <a
                href={getPreviewUrl()}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '13px', color: 'var(--primary)' }}
              >
                Open ↗
              </a>
            </div>
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
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a
                      href={`${AVAILABLE_PAGES.find(p => p.value === banner.page)?.url || '/catalog'}?edit=true`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn"
                      style={{ 
                        fontSize: '12px', 
                        padding: '6px 14px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Enable Edit
                    </a>
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
