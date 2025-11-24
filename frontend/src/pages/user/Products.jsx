import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../api'

export default function UserProducts() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [currencyRates, setCurrencyRates] = useState({})
  const [warehouseData, setWarehouseData] = useState([])
  const [imageLoaded, setImageLoaded] = useState({})

  useEffect(() => {
    loadCurrencyRates()
    loadProducts()
    loadWarehouseData()
  }, [])

  async function loadCurrencyRates() {
    try {
      const data = await apiGet('/api/settings/currency')
      const sarPerUnit = data.sarPerUnit || {}
      const aedInSar = sarPerUnit.AED || 1

      const rates = {}
      Object.keys(sarPerUnit).forEach((currency) => {
        rates[currency] = sarPerUnit[currency] / aedInSar
      })

      setCurrencyRates(rates)
    } catch (err) {
      console.error('Failed to load currency rates:', err)
      setCurrencyRates({
        AED: 1,
        SAR: 1,
        OMR: 10,
        BHD: 10,
        KWD: 12,
        QAR: 1,
        INR: 0.045,
        USD: 3.67,
        CNY: 0.51,
      })
    }
  }

  async function loadProducts() {
    setLoading(true)
    try {
      const data = await apiGet('/api/products')
      const productsList = data.products || []
      const validProducts = productsList.filter((p) => p && p._id)
      setProducts(validProducts)
    } catch (err) {
      console.error('Failed to load products:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadWarehouseData() {
    try {
      const data = await apiGet('/api/warehouse/summary')
      setWarehouseData(data.items || [])
    } catch (err) {
      console.error('Failed to load warehouse data:', err)
      setWarehouseData([])
    }
  }

  const filteredProducts = useMemo(() => {
    let list = products

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query)
      )
    }

    if (categoryFilter !== 'all') {
      list = list.filter((p) => p.category === categoryFilter)
    }

    return list
  }, [products, searchQuery, categoryFilter])

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [products])

  function getAvailableStock(product) {
    const warehouseItem = warehouseData.find((item) => String(item._id) === String(product._id))
    if (warehouseItem?.stockLeft?.total) {
      return Number(warehouseItem.stockLeft.total || 0)
    }
    if (!product?.stockByCountry) return 0
    return Object.values(product.stockByCountry).reduce((sum, val) => sum + Number(val || 0), 0)
  }

  function getTotalBought(product) {
    return Number(product?.totalPurchased || 0)
  }

  function getOrderCountryCurrency(orderCountry) {
    const countryToCurrency = {
      UAE: 'AED',
      'United Arab Emirates': 'AED',
      KSA: 'SAR',
      'Saudi Arabia': 'SAR',
      Oman: 'OMR',
      Bahrain: 'BHD',
      Kuwait: 'KWD',
      Qatar: 'QAR',
      India: 'INR',
    }
    return countryToCurrency[orderCountry] || 'AED'
  }

  function getPricesInStockCurrencies(product) {
    if (!product?.stockByCountry || !product?.price || !product?.baseCurrency) return []

    const prices = []
    const baseCurrency = product.baseCurrency
    const basePrice = product.price

    Object.entries(product.stockByCountry).forEach(([country, stock]) => {
      if (Number(stock || 0) > 0) {
        const currency = getOrderCountryCurrency(country)

        if (currency === baseCurrency) return

        const rate = currencyRates[currency] || 1
        const baseRate = currencyRates[baseCurrency] || 1
        const priceInCurrency = (basePrice * baseRate) / rate

        if (!prices.find((p) => p.currency === currency)) {
          prices.push({ currency, price: priceInCurrency, stock: Number(stock) })
        }
      }
    })

    return prices
  }

  return (
    <div style={{ display: 'grid', gap: 32, padding: '32px 24px' }}>
      {/* Premium Header */}
      <div
        style={{ position: 'relative', paddingBottom: 20, borderBottom: '2px solid var(--border)' }}
      >
        <h1
          className="gradient heading-orange"
          style={{
            fontSize: 36,
            fontWeight: 800,
            margin: 0,
            marginBottom: 12,
            letterSpacing: '-0.5px',
          }}
        >
          Products
        </h1>
        <p
          style={{
            margin: 0,
            opacity: 0.7,
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          View product performance and order analytics
        </p>
      </div>

      {/* Search and Filters */}
      <div
        className="card"
        style={{
          padding: '24px 28px',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          background: 'var(--panel-2)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20 }}>
          <input
            type="text"
            className="input"
            placeholder="Search by product name, SKU, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              fontSize: 15,
              padding: '14px 20px',
              borderRadius: 10,
              border: '2px solid var(--border)',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#ea580c'
              e.target.style.boxShadow = '0 0 0 3px rgba(234, 88, 12, 0.1)'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border)'
              e.target.style.boxShadow = 'none'
            }}
          />

          <select
            className="input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              minWidth: 220,
              fontSize: 15,
              padding: '14px 20px',
              borderRadius: 10,
              border: '2px solid var(--border)',
              fontWeight: 600,
            }}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 28,
        }}
      >
        {loading ? (
          <div
            className="card"
            style={{
              padding: 60,
              textAlign: 'center',
              gridColumn: '1 / -1',
              borderRadius: 16,
              border: '1px solid var(--border)',
            }}
          >
            <div className="spinner" style={{ marginBottom: 16 }} />
            <div style={{ opacity: 0.7, fontSize: 15, fontWeight: 500 }}>Loading products...</div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div
            className="card"
            style={{
              padding: 60,
              textAlign: 'center',
              gridColumn: '1 / -1',
              borderRadius: 16,
              border: '2px dashed var(--border)',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 16, fontWeight: 600, opacity: 0.7 }}>No products found</div>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const availableStock = getAvailableStock(product)
            const isLowStock = availableStock < 10
            const imageUrl = product.imagePath || (product.images && product.images[0])

            return (
              <div
                key={product._id}
                className="card"
                onClick={() => {
                  if (product._id) {
                    navigate(`/user/products/${product._id}`)
                  }
                }}
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                  position: 'relative',
                  background: 'var(--panel)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)'
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.15)'
                  e.currentTarget.style.borderColor = '#ea580c'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                {/* Full-Size Premium Image */}
                <div
                  style={{
                    width: '100%',
                    height: 280,
                    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {imageUrl ? (
                    <>
                      {!imageLoaded[product._id] && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, #667eea22, #764ba222)',
                          }}
                        >
                          <div className="spinner" />
                        </div>
                      )}
                      <img
                        src={imageUrl}
                        alt={product.name}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          opacity: imageLoaded[product._id] ? 1 : 0,
                          transition: 'opacity 0.4s ease-in-out',
                        }}
                        onLoad={() => {
                          setImageLoaded((prev) => ({ ...prev, [product._id]: true }))
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    </>
                  ) : (
                    <div
                      style={{
                        fontSize: 64,
                        opacity: 0.2,
                        filter: 'grayscale(1)',
                      }}
                    >
                      📦
                    </div>
                  )}

                  {/* Category Badge */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '6px 14px',
                      borderRadius: 20,
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(0,0,0,0.1)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {product.category || 'Other'}
                  </div>
                </div>

                {/* Product Info */}
                <div style={{ padding: 24 }}>
                  {/* Product Name */}
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      marginBottom: 8,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.4,
                      minHeight: 50,
                    }}
                  >
                    {product.name}
                  </div>

                  {/* SKU */}
                  {product.sku && (
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.5,
                        marginBottom: 16,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                      }}
                    >
                      SKU: {product.sku}
                    </div>
                  )}

                  {/* Price */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 16,
                      paddingBottom: 16,
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 900,
                          marginBottom: 6,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        {product.baseCurrency} {product.price?.toFixed(2)}
                      </div>
                      {getPricesInStockCurrencies(product).length > 0 && (
                        <div style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.6, marginTop: 6 }}>
                          {getPricesInStockCurrencies(product).map((p, idx) => (
                            <div key={idx}>
                              {p.currency} {p.price.toFixed(2)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stock Info Grid */}
                  <div style={{ display: 'grid', gap: 12 }}>
                    {/* Available Stock */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        background: isLowStock
                          ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.03) 100%)'
                          : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.03) 100%)',
                        borderRadius: 10,
                        border: `2px solid ${isLowStock ? '#fecaca' : '#a7f3d0'}`,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.3px' }}>
                        Available Stock
                      </span>
                      <span
                        style={{
                          fontSize: 22,
                          fontWeight: 900,
                          color: isLowStock ? '#dc2626' : '#059669',
                        }}
                      >
                        {availableStock}
                      </span>
                    </div>

                    {/* Total Bought */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        background:
                          'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.03) 100%)',
                        borderRadius: 10,
                        border: '2px solid #c7d2fe',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.3px' }}>
                        Total Bought
                      </span>
                      <span
                        style={{
                          fontSize: 22,
                          fontWeight: 900,
                          color: '#4f46e5',
                        }}
                      >
                        {getTotalBought(product)}
                      </span>
                    </div>
                  </div>

                  {/* Low Stock Alert */}
                  {isLowStock && (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#dc2626',
                        fontWeight: 700,
                        marginTop: 12,
                        textAlign: 'center',
                        padding: '8px 12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: 8,
                        border: '1px solid #fecaca',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      ⚠️ Low Stock Alert
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
