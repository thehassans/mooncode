import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiGet } from '../../api'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [warehouseData, setWarehouseData] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [currencyRates, setCurrencyRates] = useState({})

  useEffect(() => {
    loadCurrencyRates()
    if (id) {
      loadProductAndOrders()
    }
  }, [id])

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

  async function loadProductAndOrders() {
    setLoading(true)
    try {
      // Load product details
      const productData = await apiGet(`/api/products/${id}`)
      const fetchedProduct = productData.product || productData
      
      if (!fetchedProduct || !fetchedProduct._id) {
        setProduct(null)
        setLoading(false)
        return
      }
      
      setProduct(fetchedProduct)

      // Load warehouse data for this product (includes available stock calculations)
      try {
        const warehouseResp = await apiGet('/api/warehouse/summary')
        const warehouseItem = warehouseResp.items?.find(item => String(item._id) === id)
        setWarehouseData(warehouseItem || null)
      } catch (warehouseErr) {
        console.error('Failed to load warehouse data:', warehouseErr)
        setWarehouseData(null)
      }

      // Load orders for this product using dedicated endpoint
      try {
        const ordersData = await apiGet(`/api/orders/by-product/${id}`)
        console.log('Orders for this product:', ordersData.orders?.length)
        setOrders((ordersData.orders || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
      } catch (ordersErr) {
        console.error('Failed to load orders:', ordersErr)
        setOrders([])
      }
    } catch (err) {
      // If product not found (404), handle silently
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        setProduct(null)
      } else {
        // Only log non-404 errors
        console.error('Failed to load data:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = useMemo(() => {
    let filtered = orders

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.shipmentStatus?.toLowerCase() === statusFilter.toLowerCase())
    }

    // Filter by country
    if (countryFilter !== 'all') {
      filtered = filtered.filter(o => o.orderCountry === countryFilter)
    }

    return filtered
  }, [orders, statusFilter, countryFilter])

  const stats = useMemo(() => {
    // Calculate stats from ALL orders, not filteredOrders
    const total = orders.length
    const delivered = orders.filter(o => o.shipmentStatus === 'delivered').length
    const cancelled = orders.filter(o => o.shipmentStatus === 'cancelled').length
    const returned = orders.filter(o => o.shipmentStatus === 'returned').length
    const pending = orders.filter(o => ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(o.shipmentStatus)).length

    let totalRevenueAED = 0
    let totalQuantity = 0
    let totalPurchasePriceAED = 0
    
    // Country-wise breakdown
    const countryStats = {}
    
    // Calculate revenue only from delivered orders (use ALL orders, not filtered)
    orders.filter(o => o.shipmentStatus === 'delivered').forEach(o => {
      // Get quantity and price for this specific product
      let quantity = 1
      let productPrice = product?.price || 0
      let productCurrency = product?.baseCurrency || 'SAR'
      
      if (Array.isArray(o.items)) {
        // Multi-item order - find this product
        const item = o.items.find(item => String(item.productId?._id || item.productId) === id)
        if (item) {
          quantity = Number(item.quantity || 1)
          productPrice = Number(item.price || product?.price || 0)
        }
      } else {
        // Single product order
        quantity = Number(o.quantity || 1)
        productPrice = Number(o.productPrice || product?.price || 0)
        productCurrency = o.currency || product?.baseCurrency || 'SAR'
      }
      
      totalQuantity += quantity
      
      // Calculate revenue for THIS PRODUCT ONLY (not full order total)
      const currency = o.currency || productCurrency
      const conversionRate = currencyRates[currency] || 1
      const productRevenue = productPrice * quantity
      totalRevenueAED += productRevenue * conversionRate
      
      // Calculate purchase price in AED
      if (product?.purchasePrice) {
        const purchaseInAED = Number(product.purchasePrice) * (currencyRates[product.baseCurrency] || 1)
        totalPurchasePriceAED += purchaseInAED * quantity
      }
      
      // Country-wise stats
      const country = o.orderCountry || 'Unknown'
      if (!countryStats[country]) {
        countryStats[country] = { quantity: 0, revenue: 0 }
      }
      countryStats[country].quantity += quantity
      countryStats[country].revenue += productRevenue * conversionRate
    })

    // Calculate product price in AED
    const priceInAED = product ? Number(product.price || 0) * (currencyRates[product.baseCurrency] || 1) : 0
    const totalSellPriceAED = priceInAED * totalQuantity // Based on delivered only
    const totalPurchased = product?.totalPurchased || 0
    const totalPotentialSellPriceAED = priceInAED * totalPurchased // Based on inventory purchased

    return { 
      total, 
      delivered, 
      cancelled, 
      returned, 
      pending, 
      totalRevenueAED,
      totalQuantity,
      totalPurchasePriceAED,
      totalSellPriceAED,
      totalPotentialSellPriceAED,
      countryStats,
      priceInAED
    }
  }, [orders, product, id, currencyRates])

  function getTotalStock() {
    // Return total purchased inventory
    return Number(product?.totalPurchased || 0)
  }
  
  function getAvailableStock() {
    // Use warehouse data for accurate available stock (totalPurchased - active orders)
    if (warehouseData?.stockLeft) {
      return Number(warehouseData.stockLeft.total || 0)
    }
    // Fallback to product.stockByCountry if warehouse data not available
    if (!product?.stockByCountry) return 0
    return Object.values(product.stockByCountry).reduce((sum, val) => sum + Number(val || 0), 0)
  }
  
  function getOrderCountryCurrency(orderCountry) {
    // Map order country to its currency
    const countryToCurrency = {
      'UAE': 'AED',
      'United Arab Emirates': 'AED',
      'KSA': 'SAR',
      'Saudi Arabia': 'SAR',
      'Oman': 'OMR',
      'Bahrain': 'BHD',
      'Kuwait': 'KWD',
      'Qatar': 'QAR',
      'India': 'INR'
    }
    return countryToCurrency[orderCountry] || 'AED'
  }

  function getStatusColor(status) {
    const s = String(status || '').toLowerCase()
    if (s === 'delivered') return '#059669'
    if (['cancelled', 'returned'].includes(s)) return '#dc2626'
    if (['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(s)) return '#ea580c'
    return '#6b7280'
  }

  function getStatusBadge(status) {
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        background: `${getStatusColor(status)}15`,
        color: getStatusColor(status),
        textTransform: 'capitalize'
      }}>
        {String(status || 'unknown').replace(/_/g, ' ')}
      </span>
    )
  }

  function formatDate(date) {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getUserName(user) {
    if (!user) return 'N/A'
    if (typeof user === 'string') return user
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown'
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 18, opacity: 0.7 }}>Loading product details...</div>
      </div>
    )
  }

  if (!product) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 18, opacity: 0.7, marginBottom: 16 }}>Product not found</div>
        <button className="btn" onClick={() => navigate('/user/products')}>
          Back to Products
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 24, padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          className="btn secondary"
          onClick={() => navigate('/user/products')}
          style={{ padding: '8px 16px' }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, marginBottom: 4 }}>
            {product.name}
          </h1>
          {product.sku && (
            <p style={{ margin: 0, opacity: 0.6, fontSize: 14, fontFamily: 'monospace' }}>
              SKU: {product.sku}
            </p>
          )}
        </div>
      </div>

      {/* Product Overview Card */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24 }}>
          {/* Product Image */}
          <div style={{
            width: 200,
            height: 200,
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--panel)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border)'
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
              />
            ) : (
              <div style={{ fontSize: 64, opacity: 0.2 }}>📦</div>
            )}
          </div>

          {/* Product Info */}
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 4 }}>Price (AED)</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  AED {stats.priceInAED.toFixed(2)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>
                  Original: {product.baseCurrency} {product.price?.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 4 }}>Category</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{product.category || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 4 }}>Total Stock</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: getAvailableStock() < 10 ? '#dc2626' : '#059669' }}>
                  {getTotalStock()}
                </div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>Available: {getAvailableStock()}</div>
              </div>
            </div>
            
            {/* Created Info */}
            <div style={{ 
              padding: 12, 
              background: 'rgba(99, 102, 241, 0.05)', 
              borderRadius: 8, 
              border: '1px solid rgba(99, 102, 241, 0.2)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12
            }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>Created By</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {product.createdByActorName || 'N/A'}
                </div>
                {product.createdByRole && (
                  <div style={{ fontSize: 11, opacity: 0.5 }}>
                    ({product.createdByRole})
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>Created Date</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {formatDate(product.createdAt)}
                </div>
              </div>
            </div>

            {/* Stock by Country */}
            {warehouseData?.stockLeft && (
              <div>
                <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>Stock by Country (Available)</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {Object.entries(warehouseData.stockLeft).filter(([country]) => country !== 'total').map(([country, stock]) => (
                    <div
                      key={country}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: 'var(--panel)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{country}:</span>
                      <span style={{
                        fontWeight: 800,
                        color: stock < 5 ? '#dc2626' : stock < 10 ? '#ea580c' : '#059669'
                      }}>
                        {stock}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 20, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
          <div style={{ fontSize: 13, color: '#0369a1', marginBottom: 4 }}>Total Orders</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#0c4a6e' }}>{stats.total}</div>
        </div>

        <div className="card" style={{ padding: 20, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 13, color: '#15803d', marginBottom: 4 }}>Total Bought</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#14532d' }}>{product?.totalPurchased || 0}</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Inventory purchased</div>
        </div>

        <div className="card" style={{ padding: 20, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
          <div style={{ fontSize: 13, color: '#047857', marginBottom: 4 }}>Products Sold</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#065f46' }}>{stats.totalQuantity}</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{stats.delivered} delivered</div>
        </div>

        <div className="card" style={{ padding: 20, background: '#fef2f2', border: '1px solid #fecaca' }}>
          <div style={{ fontSize: 13, color: '#b91c1c', marginBottom: 4 }}>Cancelled/Returned</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#7f1d1d' }}>{stats.cancelled + stats.returned}</div>
        </div>

        <div className="card" style={{ padding: 20, background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <div style={{ fontSize: 13, color: '#c2410c', marginBottom: 4 }}>Pending</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#7c2d12' }}>{stats.pending}</div>
        </div>

        <div className="card" style={{ padding: 20, background: '#faf5ff', border: '1px solid #e9d5ff' }}>
          <div style={{ fontSize: 13, color: '#7e22ce', marginBottom: 4 }}>Total Revenue (AED)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#581c87' }}>
            AED {stats.totalRevenueAED.toFixed(2)}
          </div>
        </div>

        <div className="card" style={{ padding: 20, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 13, color: '#1e40af', marginBottom: 4 }}>Total Sell Price (AED)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1e3a8a' }}>
            AED {stats.totalPotentialSellPriceAED.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{product?.totalPurchased || 0} units purchased × AED {stats.priceInAED.toFixed(2)}</div>
        </div>

        <div className="card" style={{ padding: 20, background: '#fef3c7', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: 13, color: '#92400e', marginBottom: 4 }}>Total Purchase (AED)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#78350f' }}>
            AED {stats.totalPurchasePriceAED.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Cost of goods sold</div>
        </div>

        <div className="card" style={{ padding: 20, background: '#dcfce7', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 13, color: '#166534', marginBottom: 4 }}>Gross Profit (AED)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#14532d' }}>
            AED {(stats.totalRevenueAED - stats.totalPurchasePriceAED).toFixed(2)}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
            {stats.totalRevenueAED > 0 ? ((stats.totalRevenueAED - stats.totalPurchasePriceAED) / stats.totalRevenueAED * 100).toFixed(1) : 0}% margin
          </div>
        </div>
      </div>

      {/* Country-wise Breakdown */}
      {Object.keys(stats.countryStats).length > 0 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, margin: 0 }}>Sales by Country</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
            {Object.entries(stats.countryStats).map(([country, data]) => (
              <div key={country} style={{
                padding: 16,
                background: 'var(--panel)',
                borderRadius: 8,
                border: '1px solid var(--border)'
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{country}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, opacity: 0.7 }}>Units Sold:</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{data.quantity}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, opacity: 0.7 }}>Revenue (AED):</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>AED {data.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders List */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Order History</h2>

          <div style={{ display: 'flex', gap: 12 }}>
            <select
              className="input"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              style={{ minWidth: 180 }}
            >
              <option value="all">All Countries</option>
              {Array.from(new Set(orders.map(o => o.orderCountry).filter(Boolean))).sort().map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>

            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ minWidth: 180 }}
            >
              <option value="all">All Status ({orders.length})</option>
              <option value="delivered">Delivered ({orders.filter(o => o.shipmentStatus === 'delivered').length})</option>
              <option value="cancelled">Cancelled ({orders.filter(o => o.shipmentStatus === 'cancelled').length})</option>
              <option value="returned">Returned ({orders.filter(o => o.shipmentStatus === 'returned').length})</option>
              <option value="pending">Pending ({orders.filter(o => ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(o.shipmentStatus)).length})</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>ORDER ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>DATE</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>COUNTRY</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>CUSTOMER</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>QTY</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>AMOUNT</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>STATUS</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>SUBMITTED BY</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>DRIVER</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 40, textAlign: 'center', opacity: 0.6 }}>
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  // Get quantity and price for this specific product
                  let quantity = 1
                  let productPrice = product?.price || 0
                  
                  if (Array.isArray(order.items)) {
                    // Multi-item order - find this product
                    const item = order.items.find(item => String(item.productId?._id || item.productId) === id)
                    if (item) {
                      quantity = Number(item.quantity || 1)
                      productPrice = Number(item.price || product?.price || 0)
                    }
                  } else {
                    // Single product order
                    quantity = Number(order.quantity || 1)
                    productPrice = Number(order.productPrice || product?.price || 0)
                  }
                  
                  // Calculate product-specific amount in order country's currency
                  const orderCountryCurrency = getOrderCountryCurrency(order.orderCountry)
                  const productBaseCurrency = product?.baseCurrency || 'SAR'
                  
                  // Product price is in base currency, convert to order country currency
                  const priceInOrderCurrency = productPrice * (currencyRates[productBaseCurrency] || 1) / (currencyRates[orderCountryCurrency] || 1)
                  const productAmount = priceInOrderCurrency * quantity
                  
                  const productAmountAED = productAmount * (currencyRates[orderCountryCurrency] || 1)

                  return (
                    <tr
                      key={order._id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: idx % 2 ? 'transparent' : 'var(--panel)',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 ? 'transparent' : 'var(--panel)'}
                    >
                      <td style={{ padding: '16px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          #{order.invoiceNumber || String(order._id).slice(-5)}
                        </span>
                      </td>
                      <td style={{ padding: '16px', fontSize: 14 }}>
                        {formatDate(order.createdAt)}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          background: 'var(--panel)',
                          border: '1px solid var(--border)'
                        }}>
                          {order.orderCountry || 'N/A'}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{order.customerName || 'N/A'}</div>
                        <div style={{ fontSize: 12, opacity: 0.6 }}>{order.customerPhone}</div>
                      </td>
                      <td style={{ padding: '16px', fontWeight: 700 }}>{quantity}</td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>
                          {orderCountryCurrency} {productAmount.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.6 }}>
                          AED {productAmountAED.toFixed(2)}
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        {getStatusBadge(order.shipmentStatus)}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontSize: 14 }}>{getUserName(order.createdBy)}</div>
                        <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'capitalize' }}>
                          {order.createdByRole || 'N/A'}
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        {order.deliveryBoy ? (
                          <div style={{ fontSize: 14 }}>{getUserName(order.deliveryBoy)}</div>
                        ) : (
                          <span style={{ opacity: 0.5 }}>Not assigned</span>
                        )}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <button
                          className="btn secondary"
                          onClick={() => setSelectedOrder(order)}
                          style={{ padding: '6px 12px', fontSize: 13 }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 800,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: 32
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, marginBottom: 8 }}>
                  Order #{selectedOrder.invoiceNumber || String(selectedOrder._id).slice(-5)}
                </h2>
                <div>{getStatusBadge(selectedOrder.shipmentStatus)}</div>
              </div>
              <button
                className="btn secondary"
                onClick={() => setSelectedOrder(null)}
                style={{ padding: '8px 16px' }}
              >
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gap: 20 }}>
              {/* Timeline */}
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Order Timeline</h3>
                <div style={{ position: 'relative', paddingLeft: 32 }}>
                  {/* Created */}
                  <div style={{ position: 'relative', marginBottom: 24 }}>
                    <div style={{
                      position: 'absolute',
                      left: -32,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: '#3b82f6',
                      border: '3px solid var(--bg)'
                    }} />
                    <div style={{
                      position: 'absolute',
                      left: -26.5,
                      top: 12,
                      width: 1,
                      height: 'calc(100% + 12px)',
                      background: '#e5e7eb'
                    }} />
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Order Created</div>
                    <div style={{ fontSize: 13, opacity: 0.6 }}>{formatDate(selectedOrder.createdAt)}</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      By: {getUserName(selectedOrder.createdBy)} ({selectedOrder.createdByRole})
                    </div>
                  </div>

                  {/* Assigned to Driver */}
                  {selectedOrder.deliveryBoy && (
                    <div style={{ position: 'relative', marginBottom: 24 }}>
                      <div style={{
                        position: 'absolute',
                        left: -32,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: '#8b5cf6',
                        border: '3px solid var(--bg)'
                      }} />
                      <div style={{
                        position: 'absolute',
                        left: -26.5,
                        top: 12,
                        width: 1,
                        height: 'calc(100% + 12px)',
                        background: '#e5e7eb'
                      }} />
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Assigned to Driver</div>
                      <div style={{ fontSize: 13 }}>
                        Driver: {getUserName(selectedOrder.deliveryBoy)}
                      </div>
                    </div>
                  )}

                  {/* Delivered */}
                  {selectedOrder.deliveredAt && (
                    <div style={{ position: 'relative', marginBottom: 24 }}>
                      <div style={{
                        position: 'absolute',
                        left: -32,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: '#10b981',
                        border: '3px solid var(--bg)'
                      }} />
                      {(selectedOrder.shipmentStatus === 'cancelled' || selectedOrder.shipmentStatus === 'returned') && (
                        <div style={{
                          position: 'absolute',
                          left: -26.5,
                          top: 12,
                          width: 1,
                          height: 'calc(100% + 12px)',
                          background: '#e5e7eb'
                        }} />
                      )}
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Delivered</div>
                      <div style={{ fontSize: 13, opacity: 0.6 }}>{formatDate(selectedOrder.deliveredAt)}</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        Collected: {product.baseCurrency} {(Number(selectedOrder.collectedAmount || 0)).toFixed(2)}
                      </div>
                      {selectedOrder.inventoryAdjusted && (
                        <div style={{ fontSize: 12, marginTop: 4, color: '#dc2626', fontWeight: 600 }}>
                          Stock decreased: -{selectedOrder.quantity || 1} units from {selectedOrder.orderCountry}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cancelled/Returned */}
                  {(selectedOrder.shipmentStatus === 'cancelled' || selectedOrder.shipmentStatus === 'returned') && (
                    <>
                      <div style={{ position: 'relative', marginBottom: 24 }}>
                        <div style={{
                          position: 'absolute',
                          left: -32,
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: '#ef4444',
                          border: '3px solid var(--bg)'
                        }} />
                        {selectedOrder.returnSubmittedToCompany && (
                          <div style={{
                            position: 'absolute',
                            left: -26.5,
                            top: 12,
                            width: 1,
                            height: 'calc(100% + 12px)',
                            background: '#e5e7eb'
                          }} />
                        )}
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, textTransform: 'capitalize' }}>
                          {selectedOrder.shipmentStatus}
                        </div>
                        {selectedOrder.returnReason && (
                          <div style={{ fontSize: 13, marginTop: 4 }}>
                            Reason: {selectedOrder.returnReason}
                          </div>
                        )}
                      </div>

                      {/* Submitted for Verification */}
                      {selectedOrder.returnSubmittedToCompany && (
                        <div style={{ position: 'relative', marginBottom: 24 }}>
                          <div style={{
                            position: 'absolute',
                            left: -32,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: '#f59e0b',
                            border: '3px solid var(--bg)'
                          }} />
                          {selectedOrder.returnVerified && (
                            <div style={{
                              position: 'absolute',
                              left: -26.5,
                              top: 12,
                              width: 1,
                              height: 'calc(100% + 12px)',
                              background: '#e5e7eb'
                            }} />
                          )}
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Submitted for Verification</div>
                          <div style={{ fontSize: 13, opacity: 0.6 }}>Awaiting manager approval</div>
                        </div>
                      )}

                      {/* Verified and Stock Refilled */}
                      {selectedOrder.returnVerified && (
                        <div style={{ position: 'relative' }}>
                          <div style={{
                            position: 'absolute',
                            left: -32,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: '#10b981',
                            border: '3px solid var(--bg)'
                          }} />
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Verified & Stock Refilled</div>
                          <div style={{ fontSize: 13, opacity: 0.6 }}>{formatDate(selectedOrder.returnVerifiedAt)}</div>
                          <div style={{ fontSize: 13, marginTop: 4 }}>
                            By: {getUserName(selectedOrder.returnVerifiedBy)}
                          </div>
                          {selectedOrder.inventoryAdjusted && (
                            <div style={{ fontSize: 12, marginTop: 4, color: '#059669', fontWeight: 600 }}>
                              Stock refilled: +{selectedOrder.quantity || 1} units to {selectedOrder.orderCountry}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Customer Info */}
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Customer Information</h3>
                <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                  <div><strong>Name:</strong> {selectedOrder.customerName || 'N/A'}</div>
                  <div><strong>Phone:</strong> {selectedOrder.phoneCountryCode} {selectedOrder.customerPhone}</div>
                  <div><strong>Address:</strong> {selectedOrder.customerAddress}</div>
                  <div><strong>City:</strong> {selectedOrder.city}</div>
                  <div><strong>Country:</strong> {selectedOrder.orderCountry}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
