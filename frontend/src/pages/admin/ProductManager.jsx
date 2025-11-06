import React, { useState, useEffect } from 'react'
import { apiGet, apiPatch, apiPost } from '../../api'

const COUNTRY_CURRENCIES = {
  'KSA': 'SAR',
  'UAE': 'AED',
  'EGY': 'EGP',
  'BHR': 'BHD',
  'OMN': 'OMR',
  'KWT': 'KWD',
  'QAT': 'QAR',
  'JOR': 'JOD',
  'LBN': 'LBP',
  'IRQ': 'IQD'
}

export default function ProductManager() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    setLoading(true)
    try {
      const data = await apiGet('/api/products?limit=100')
      if (data.products) {
        setProducts(data.products)
      }
    } catch (err) {
      showToast('Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleProductVisibilityToggle(productId) {
    const product = products.find(p => p._id === productId)
    if (!product) return

    try {
      const newStatus = !product.isVisible
      await apiPatch(`/api/products/${productId}`, { isVisible: newStatus })
      setProducts(prev => prev.map(p => p._id === productId ? { ...p, isVisible: newStatus } : p))
      showToast(`✓ Product ${newStatus ? 'shown' : 'hidden'} on website`)
    } catch (err) {
      showToast('Update failed', 'error')
    }
  }

  async function handleCountryVisibilityToggle(productId, country) {
    const product = products.find(p => p._id === productId)
    if (!product) return

    try {
      const currentVisibility = product.countryVisibility || {}
      const newVisibility = {
        ...currentVisibility,
        [country]: !currentVisibility[country]
      }
      
      await apiPatch(`/api/products/${productId}`, { countryVisibility: newVisibility })
      setProducts(prev => prev.map(p => 
        p._id === productId 
          ? { ...p, countryVisibility: newVisibility } 
          : p
      ))
      showToast(`✓ ${country}: ${newVisibility[country] ? 'Visible' : 'Hidden'}`)
    } catch (err) {
      showToast('Update failed', 'error')
    }
  }

  async function handleProductQuantityUpdate(productId, newQuantity, country = null) {
    if (newQuantity < 0) return

    try {
      if (country) {
        // Update country-specific stock
        const product = products.find(p => p._id === productId)
        const updatedCountryStock = { ...product.countryStock, [country]: newQuantity }
        
        await apiPatch(`/api/products/${productId}`, { 
          countryStock: updatedCountryStock
        })
        setProducts(prev => prev.map(p => 
          p._id === productId 
            ? { ...p, countryStock: updatedCountryStock } 
            : p
        ))
        showToast(`✓ ${country} stock updated`)
      } else {
        // Update general stock
        await apiPatch(`/api/products/${productId}`, { stock: newQuantity })
        setProducts(prev => prev.map(p => p._id === productId ? { ...p, stock: newQuantity } : p))
        showToast('✓ Quantity updated')
      }
    } catch (err) {
      showToast('Update failed', 'error')
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        @keyframes slideIn { from { transform: translateY(-100%); } to { transform: translateY(0); } }
      `}</style>

      {/* Toast Notification */}
      {toast && (
        <div style={{ 
          position: 'fixed', 
          top: '20px', 
          right: '20px', 
          zIndex: 10001, 
          padding: '12px 20px', 
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : '#10b981', 
          color: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', 
          fontSize: '13px', 
          fontWeight: 500, 
          animation: 'slideIn 0.3s ease'
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
          📦 Product Management
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          Control product visibility, prices, and stock levels for each country. Toggle country-specific visibility to show products only where they're in stock.
        </p>
      </div>

      {/* Products List */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9ca3af', fontSize: '14px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <div>Loading products...</div>
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9ca3af', fontSize: '14px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
            <div>No products found</div>
          </div>
        ) : (
          products.map((product) => (
            <div key={product._id} style={{ 
              background: 'white', 
              border: product.isVisible !== false ? '2px solid #10b981' : '2px solid #e5e7eb', 
              borderRadius: '12px', 
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              transition: 'all 0.2s'
            }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                {/* Product Image */}
                <img 
                  src={product.images?.[0] || product.image || product.imageUrl || '/placeholder.png'} 
                  alt={product.name}
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    objectFit: 'cover', 
                    borderRadius: '8px',
                    border: '2px solid #e5e7eb',
                    flexShrink: 0
                  }}
                />
                
                {/* Product Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: 600, 
                    color: '#111827',
                    marginBottom: '8px'
                  }}>
                    {product.name}
                  </div>
                  
                  {/* Prices by Country */}
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                    {product.countryPrices && Object.keys(product.countryPrices).length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {Object.entries(product.countryPrices).map(([country, price]) => (
                          <span key={country} style={{ 
                            padding: '4px 10px', 
                            background: '#f3f4f6', 
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600
                          }}>
                            {country}: {price} {COUNTRY_CURRENCIES[country] || ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span>Price: {product.price || 'N/A'}</span>
                    )}
                  </div>

                  {/* Category & Description */}
                  {product.category && (
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
                      Category: {product.category}
                    </div>
                  )}
                </div>
                
                {/* Visibility Toggle */}
                <button
                  onClick={() => handleProductVisibilityToggle(product._id)}
                  style={{
                    width: '48px',
                    height: '48px',
                    padding: 0,
                    background: product.isVisible !== false ? '#10b981' : '#e5e7eb',
                    color: product.isVisible !== false ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s'
                  }}
                  title={product.isVisible !== false ? 'Visible on website' : 'Hidden from website'}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {product.isVisible !== false ? '✓' : '○'}
                </button>
              </div>
              
              {/* Stock & Visibility by Country */}
              {product.countryStock && Object.keys(product.countryStock).length > 0 && (
                <div style={{ borderTop: '2px solid #f3f4f6', paddingTop: '16px' }}>
                  <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: '12px' }}>
                    📊 Stock & Visibility by Country:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                    {Object.entries(product.countryStock).map(([country, stock]) => {
                      const price = product.countryPrices?.[country] || 0
                      const currency = COUNTRY_CURRENCIES[country] || ''
                      const isVisible = product.countryVisibility?.[country] !== false
                      
                      return (
                        <div key={country} style={{ 
                          background: isVisible ? '#f0fdf4' : '#f9fafb', 
                          padding: '14px', 
                          borderRadius: '10px',
                          border: isVisible ? '2px solid #10b981' : '2px solid #e5e7eb',
                          transition: 'all 0.2s'
                        }}>
                          {/* Country Header with Toggle */}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            marginBottom: '10px'
                          }}>
                            <div style={{ 
                              fontSize: '14px', 
                              fontWeight: 700, 
                              color: '#111827'
                            }}>
                              {country}
                            </div>
                            
                            {/* Visibility Toggle Switch */}
                            <button
                              onClick={() => handleCountryVisibilityToggle(product._id, country)}
                              style={{
                                position: 'relative',
                                width: '44px',
                                height: '24px',
                                borderRadius: '12px',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: isVisible ? '#10b981' : '#d1d5db',
                                padding: 0
                              }}
                              title={isVisible ? 'Hide in this country' : 'Show in this country'}
                            >
                              <div style={{
                                position: 'absolute',
                                top: '2px',
                                left: isVisible ? '22px' : '2px',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: 'white',
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }} />
                            </button>
                          </div>
                          
                          {/* Price */}
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#6b7280', 
                            marginBottom: '6px',
                            fontWeight: 500
                          }}>
                            💰 Price: <span style={{ fontWeight: 700, color: '#059669' }}>{price} {currency}</span>
                          </div>
                          
                          {/* Stock Controls */}
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#6b7280', 
                            marginBottom: '6px',
                            fontWeight: 500
                          }}>
                            📦 Stock: {stock > 0 ? stock : <span style={{ color: '#ef4444' }}>Out of Stock</span>}
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                            <button
                              onClick={() => handleProductQuantityUpdate(product._id, Math.max(0, stock - 1), country)}
                              style={{
                                width: '28px',
                                height: '28px',
                                padding: 0,
                                background: 'white',
                                border: '2px solid #e5e7eb',
                                borderRadius: '6px',
                                fontSize: '14px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                color: '#6b7280'
                              }}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              value={stock || 0}
                              onChange={(e) => handleProductQuantityUpdate(product._id, parseInt(e.target.value) || 0, country)}
                              style={{
                                flex: 1,
                                padding: '6px',
                                border: '2px solid #e5e7eb',
                                borderRadius: '6px',
                                fontSize: '13px',
                                textAlign: 'center',
                                fontWeight: 600
                              }}
                            />
                            <button
                              onClick={() => handleProductQuantityUpdate(product._id, stock + 1, country)}
                              style={{
                                width: '28px',
                                height: '28px',
                                padding: 0,
                                background: 'white',
                                border: '2px solid #e5e7eb',
                                borderRadius: '6px',
                                fontSize: '14px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                color: '#6b7280'
                              }}
                            >
                              +
                            </button>
                          </div>
                          
                          {/* Visibility Status */}
                          <div style={{ 
                            marginTop: '8px',
                            fontSize: '10px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            textAlign: 'center',
                            fontWeight: 600,
                            background: isVisible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                            color: isVisible ? '#059669' : '#6b7280'
                          }}>
                            {isVisible ? '● Visible in ' + country : '○ Hidden in ' + country}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
