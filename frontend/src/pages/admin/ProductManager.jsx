import React, { useState, useEffect } from 'react'
import { apiGet, apiPatch, apiPost } from '../../api'

const COUNTRY_CURRENCIES = {
  'KSA': 'SAR',
  'UAE': 'AED',
  'Oman': 'OMR',
  'Bahrain': 'BHD',
  'Kuwait': 'KWD',
  'Qatar': 'QAR',
  'India': 'INR'
}

// Currency conversion rates (base: SAR = 1)
const CURRENCY_RATES = {
  'SAR': 1.0,      // Saudi Riyal (base)
  'AED': 0.98,     // UAE Dirham (1 SAR = 0.98 AED)
  'OMR': 0.10,     // Omani Rial (1 SAR = 0.10 OMR)
  'BHD': 0.10,     // Bahraini Dinar (1 SAR = 0.10 BHD)
  'KWD': 0.082,    // Kuwaiti Dinar (1 SAR = 0.082 KWD)
  'QAR': 0.97,     // Qatari Riyal (1 SAR = 0.97 QAR)
  'INR': 22.5      // Indian Rupee (1 SAR = 22.5 INR)
}

// Convert price from base currency to target currency
function convertPrice(price, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return price
  
  // Convert to SAR first (base currency)
  const priceInSAR = price / (CURRENCY_RATES[fromCurrency] || 1)
  
  // Then convert to target currency
  const convertedPrice = priceInSAR * (CURRENCY_RATES[toCurrency] || 1)
  
  return Math.round(convertedPrice * 100) / 100 // Round to 2 decimals
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
        console.log('Products loaded:', data.products)
        console.log('Sample product data:', data.products[0])
        setProducts(data.products)
      }
    } catch (err) {
      console.error('Failed to load products:', err)
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
      const newStatus = !product.displayOnWebsite
      await apiPatch(`/api/products/${productId}`, { displayOnWebsite: newStatus })
      setProducts(prev => prev.map(p => p._id === productId ? { ...p, displayOnWebsite: newStatus } : p))
      showToast(`✓ Product ${newStatus ? 'shown' : 'hidden'} on website`)
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
          View product stock levels by country with prices automatically converted to local currencies. Toggle product visibility on the website.
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
          products.map((product) => {
            // Calculate total stock across all countries
            const totalStock = product.stockByCountry 
              ? Object.values(product.stockByCountry).reduce((sum, stock) => sum + stock, 0)
              : (product.stockQty || 0)
            
            return (
            <div key={product._id} style={{ 
              background: 'white', 
              border: product.displayOnWebsite === true ? '2px solid #10b981' : '2px solid #e5e7eb', 
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
                  
                  {/* Price Display */}
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600 }}>💰 Price: {product.price || 0} {product.baseCurrency || 'SAR'}</span>
                  </div>
                  
                  {/* Total Stock Display */}
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                    {product.stockByCountry && Object.keys(product.stockByCountry).length > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600 }}>📦 Total Stock:</span>
                        {Object.entries(product.stockByCountry)
                          .filter(([_, stock]) => stock !== null && stock !== undefined && stock > 0)
                          .map(([country, stock]) => (
                          <span key={country} style={{ 
                            padding: '3px 8px', 
                            background: stock > 0 ? '#ecfdf5' : '#fee2e2', 
                            color: stock > 0 ? '#059669' : '#dc2626',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700
                          }}>
                            {country}: {stock}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontWeight: 600 }}>📦 Stock: {product.stockQty || 0}</span>
                    )}
                  </div>

                  {/* Category & Description */}
                  {product.category && (
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
                      Category: {product.category}
                    </div>
                  )}
                </div>
                
                {/* Visibility Toggle Switch */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => handleProductVisibilityToggle(product._id)}
                    style={{
                      position: 'relative',
                      width: '56px',
                      height: '28px',
                      borderRadius: '14px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      background: product.displayOnWebsite === true ? '#10b981' : '#d1d5db',
                      padding: 0
                    }}
                    title={product.displayOnWebsite === true ? 'Click to hide from website' : 'Click to show on website'}
                  >
                    <div style={{
                      position: 'absolute',
                      top: '2px',
                      left: product.displayOnWebsite === true ? '30px' : '2px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'white',
                      transition: 'all 0.3s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </button>
                  <span style={{ 
                    fontSize: '10px', 
                    fontWeight: 600,
                    color: product.displayOnWebsite === true ? '#10b981' : '#9ca3af'
                  }}>
                    {product.displayOnWebsite === true ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
              
              {/* Stock & Visibility by Country */}
              {product.stockByCountry && Object.keys(product.stockByCountry).length > 0 && (
                <div style={{ borderTop: '2px solid #f3f4f6', paddingTop: '16px' }}>
                  <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, display: 'block', marginBottom: '12px' }}>
                    📊 Stock & Price by Country:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                    {Object.entries(product.stockByCountry)
                      .filter(([_, stock]) => stock > 0)
                      .map(([country, stock]) => {
                      // Get country's currency
                      const countryCurrency = COUNTRY_CURRENCIES[country] || 'SAR'
                      const baseCurrency = product.baseCurrency || 'SAR'
                      const basePrice = product.price || 0
                      
                      // Convert price to country's currency
                      const convertedPrice = convertPrice(basePrice, baseCurrency, countryCurrency)
                      
                      const isVisible = product.displayOnWebsite === true
                      
                      return (
                        <div key={country} style={{ 
                          background: isVisible ? '#f0fdf4' : '#f9fafb', 
                          padding: '14px', 
                          borderRadius: '10px',
                          border: isVisible ? '2px solid #10b981' : '2px solid #e5e7eb',
                          transition: 'all 0.2s'
                        }}>
                          {/* Country Header */}
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: 700, 
                            color: '#111827',
                            marginBottom: '10px'
                          }}>
                            {country}
                          </div>
                          
                          {/* Price in Local Currency */}
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#6b7280', 
                            marginBottom: '8px',
                            fontWeight: 500
                          }}>
                            💰 Price: <span style={{ fontWeight: 700, color: '#059669', fontSize: '13px' }}>{convertedPrice} {countryCurrency}</span>
                          </div>
                          
                          {/* Stock Display (Read-Only) */}
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#6b7280', 
                            fontWeight: 500,
                            padding: '10px',
                            background: 'white',
                            borderRadius: '8px',
                            border: '2px solid #e5e7eb',
                            textAlign: 'center'
                          }}>
                            📦 <span style={{ fontWeight: 700, color: '#111827', fontSize: '15px' }}>{stock}</span> <span style={{ fontSize: '11px' }}>units in stock</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}
