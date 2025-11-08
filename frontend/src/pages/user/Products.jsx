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

  useEffect(() => {
    loadCurrencyRates()
    loadProducts()
    loadWarehouseData()
  }, [])

  async function loadCurrencyRates() {
    try {
      const data = await apiGet('/api/settings/currency')
      // Convert sarPerUnit to AED rates
      // Formula: To convert X currency to AED = (amount * sarPerUnit[X]) / sarPerUnit['AED']
      const sarPerUnit = data.sarPerUnit || {}
      const aedInSar = sarPerUnit.AED || 1
      
      const rates = {}
      Object.keys(sarPerUnit).forEach(currency => {
        rates[currency] = sarPerUnit[currency] / aedInSar
      })
      
      setCurrencyRates(rates)
    } catch (err) {
      console.error('Failed to load currency rates:', err)
      // Fallback to default rates
      setCurrencyRates({
        'AED': 1,
        'SAR': 1,
        'OMR': 10,
        'BHD': 10,
        'KWD': 12,
        'QAR': 1,
        'INR': 0.045,
        'USD': 3.67,
        'CNY': 0.51
      })
    }
  }

  async function loadProducts() {
    setLoading(true)
    try {
      const data = await apiGet('/api/products')
      const productsList = data.products || []
      console.log('Loaded products:', productsList.length)
      // Filter out products without valid IDs
      const validProducts = productsList.filter(p => p && p._id)
      if (validProducts.length !== productsList.length) {
        console.warn('Some products missing IDs:', productsList.length - validProducts.length)
      }
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
      console.log('Loaded warehouse data:', data.items?.length)
    } catch (err) {
      console.error('Failed to load warehouse data:', err)
      setWarehouseData([])
    }
  }


  const filteredProducts = useMemo(() => {
    let list = products

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      list = list.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query)
      )
    }

    if (categoryFilter !== 'all') {
      list = list.filter(p => p.category === categoryFilter)
    }

    return list
  }, [products, searchQuery, categoryFilter])

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [products])

  function getAvailableStock(product) {
    // Get actual available stock from warehouse data (stock left after orders)
    const warehouseItem = warehouseData.find(item => String(item._id) === String(product._id))
    if (warehouseItem?.stockLeft?.total) {
      return Number(warehouseItem.stockLeft.total || 0)
    }
    // Fallback to stockByCountry if warehouse data not available
    if (!product?.stockByCountry) return 0
    return Object.values(product.stockByCountry).reduce((sum, val) => sum + Number(val || 0), 0)
  }
  
  function getTotalBought(product) {
    return Number(product?.totalPurchased || 0)
  }
  
  function getOrderCountryCurrency(orderCountry) {
    const countryToCurrency = {
      'UAE': 'AED', 'United Arab Emirates': 'AED',
      'KSA': 'SAR', 'Saudi Arabia': 'SAR',
      'Oman': 'OMR', 'Bahrain': 'BHD',
      'Kuwait': 'KWD', 'Qatar': 'QAR', 'India': 'INR'
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
        
        // Skip if same as base currency
        if (currency === baseCurrency) return
        
        const rate = currencyRates[currency] || 1
        const baseRate = currencyRates[baseCurrency] || 1
        const priceInCurrency = (basePrice * baseRate) / rate
        
        // Avoid duplicates
        if (!prices.find(p => p.currency === currency)) {
          prices.push({ currency, price: priceInCurrency, stock: Number(stock) })
        }
      }
    })
    
    return prices
  }

  return (
    <div style={{ display: 'grid', gap: 24, padding: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, marginBottom: 8 }}>Products</h1>
        <p style={{ margin: 0, opacity: 0.7, fontSize: 15 }}>
          View product performance and order analytics
        </p>
      </div>

      {/* Search and Filters */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16 }}>
          <input
            type="text"
            className="input"
            placeholder="Search by product name, SKU, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: 15 }}
          />

          <select
            className="input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ minWidth: 200, fontSize: 15 }}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', opacity: 0.7 }}>
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', opacity: 0.7 }}>
            No products found
          </div>
        ) : (
          filteredProducts.map(product => {
            const availableStock = getAvailableStock(product)
            const isLowStock = availableStock < 10

            return (
              <div
                key={product._id}
                className="card"
                onClick={() => {
                  console.log('Navigating to product:', product._id, product.name)
                  if (product._id) {
                    navigate(`/user/products/${product._id}`)
                  } else {
                    console.error('Product missing ID:', product)
                  }
                }}
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Product Image */}
                <div style={{
                  width: '100%',
                  height: 200,
                  background: 'var(--panel)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {product.imagePath || (product.images && product.images[0]) ? (
                    <img
                      src={product.imagePath || product.images[0]}
                      alt={product.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div style={{
                      fontSize: 48,
                      opacity: 0.3
                    }}>
                      📦
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div style={{ padding: 20 }}>
                  <div style={{
                    fontSize: 16,
                    fontWeight: 700,
                    marginBottom: 8,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {product.name}
                  </div>

                  {product.sku && (
                    <div style={{
                      fontSize: 12,
                      opacity: 0.6,
                      marginBottom: 12,
                      fontFamily: 'monospace'
                    }}>
                      SKU: {product.sku}
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                        {product.baseCurrency} {product.price?.toFixed(2)}
                      </div>
                      {getPricesInStockCurrencies(product).length > 0 && (
                        <div style={{ fontSize: 10, opacity: 0.5, lineHeight: 1.5, marginTop: 4 }}>
                          {getPricesInStockCurrencies(product).map((p, idx) => (
                            <div key={idx}>{p.currency} {p.price.toFixed(2)}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{
                      fontSize: 12,
                      padding: '4px 12px',
                      borderRadius: 6,
                      background: 'var(--panel)',
                      border: '1px solid var(--border)'
                    }}>
                      {product.category || 'Other'}
                    </div>
                  </div>

                  {/* Stock Info */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    background: isLowStock ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                    borderRadius: 8,
                    border: `1px solid ${isLowStock ? '#fecaca' : '#a7f3d0'}`,
                    marginBottom: 8
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Available Stock</span>
                    <span style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: isLowStock ? '#dc2626' : '#059669'
                    }}>
                      {availableStock}
                    </span>
                  </div>

                  {/* Total Bought */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    background: 'rgba(99, 102, 241, 0.05)',
                    borderRadius: 8,
                    border: '1px solid #c7d2fe'
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Total Bought</span>
                    <span style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#4f46e5'
                    }}>
                      {getTotalBought(product)}
                    </span>
                  </div>

                  {isLowStock && (
                    <div style={{
                      fontSize: 11,
                      color: '#dc2626',
                      fontWeight: 600,
                      marginTop: 8,
                      textAlign: 'center'
                    }}>
                      Low Stock Alert
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
