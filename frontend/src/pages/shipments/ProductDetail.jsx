import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiGet } from '../../api'

const COUNTRIES = [
  { code: 'UAE', flag: '🇦🇪' },
  { code: 'Oman', flag: '🇴🇲' },
  { code: 'KSA', flag: '🇸🇦' },
  { code: 'Bahrain', flag: '🇧🇭' },
  { code: 'India', flag: '🇮🇳' },
  { code: 'Kuwait', flag: '🇰🇼' },
  { code: 'Qatar', flag: '🇶🇦' }
]

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadProductDetails()
  }, [id])

  async function loadProductDetails() {
    setLoading(true)
    try {
      // Load product
      const productData = await apiGet(`/api/products/${id}`)
      setProduct(productData.product || productData)

      // Load orders for this product
      const ordersData = await apiGet(`/api/products/${id}/orders`)
      setOrders(ordersData.orders || [])
    } catch (err) {
      setError(err?.message || 'Failed to load product details')
    } finally {
      setLoading(false)
    }
  }

  function getStockForCountry(countryCode) {
    return product?.stockByCountry?.[countryCode] || 0
  }

  function getTotalStock() {
    if (!product?.stockByCountry) return 0
    return Object.values(product.stockByCountry).reduce((sum, val) => sum + Number(val || 0), 0)
  }

  function formatDate(date) {
    if (!date) return 'N/A'
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'N/A'
    }
  }

  function getStatusColor(status) {
    const s = String(status || '').toLowerCase()
    if (s === 'delivered') return { bg: '#ecfdf5', text: '#065f46', border: '#10b981' }
    if (s === 'cancelled' || s === 'returned') return { bg: '#fef2f2', text: '#991b1b', border: '#ef4444' }
    if (s === 'pending') return { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' }
    if (s === 'assigned' || s === 'picked_up' || s === 'out_for_delivery') return { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' }
    return { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' }
  }

  const filteredOrders = orders.filter(order => {
    if (selectedStatus !== 'all' && order.shipmentStatus !== selectedStatus) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        order.invoiceNumber?.toLowerCase().includes(query) ||
        order.customerName?.toLowerCase().includes(query) ||
        order.customerPhone?.toLowerCase().includes(query) ||
        order.city?.toLowerCase().includes(query)
      )
    }
    return true
  })

  const stats = {
    total: orders.length,
    delivered: orders.filter(o => o.shipmentStatus === 'delivered').length,
    pending: orders.filter(o => ['pending', 'assigned', 'picked_up', 'out_for_delivery'].includes(o.shipmentStatus)).length,
    cancelled: orders.filter(o => o.shipmentStatus === 'cancelled').length,
    returned: orders.filter(o => o.shipmentStatus === 'returned').length
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 18, opacity: 0.7 }}>Loading product details...</div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ 
          padding: 20, 
          background: '#fef2f2', 
          border: '1px solid #ef4444', 
          borderRadius: 12, 
          color: '#991b1b',
          marginBottom: 20
        }}>
          {error || 'Product not found'}
        </div>
        <button className="btn" onClick={() => navigate('/shipments')}>
          Back to Inventory
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 30 }}>
        <button 
          onClick={() => navigate('/shipments')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#667eea',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 16,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          ← Back to Inventory
        </button>

        <h1 style={{
          fontSize: 32,
          fontWeight: 800,
          margin: 0,
          color: '#111827'
        }}>
          Product Details
        </h1>
      </div>

      {/* Product Info Card */}
      <div className="card" style={{ padding: 30, marginBottom: 30 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 30 }}>
          {/* Product Image */}
          <div>
            {product.imagePath || (product.images && product.images[0]) ? (
              <img
                src={product.imagePath || product.images[0]}
                alt={product.name}
                style={{
                  width: 200,
                  height: 200,
                  objectFit: 'cover',
                  borderRadius: 12,
                  border: '2px solid var(--border)',
                  background: 'var(--panel)'
                }}
              />
            ) : (
              <div style={{
                width: 200,
                height: 200,
                borderRadius: 12,
                border: '2px solid var(--border)',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 64,
                color: 'white'
              }}>
                📦
              </div>
            )}
          </div>

          {/* Product Details */}
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px 0', color: '#111827' }}>
              {product.name}
            </h2>
            
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#667eea'
              }}>
                {product.baseCurrency} {product.price?.toFixed(2)}
              </div>

              {product.sku && (
                <div style={{
                  background: 'rgba(102, 126, 234, 0.1)',
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#667eea'
                }}>
                  SKU: {product.sku}
                </div>
              )}

              {product.category && (
                <div style={{
                  background: '#f3f4f6',
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#6b7280'
                }}>
                  {product.category}
                </div>
              )}
            </div>

            {product.description && (
              <p style={{ fontSize: 15, lineHeight: 1.6, color: '#6b7280', marginBottom: 20 }}>
                {product.description}
              </p>
            )}

            {/* Stock by Country */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#111827' }}>
                Stock Availability
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {COUNTRIES.map(country => {
                  const stock = getStockForCountry(country.code)
                  return (
                    <div key={country.code} style={{
                      background: stock > 0 ? '#ecfdf5' : '#f9fafb',
                      border: `1px solid ${stock > 0 ? '#10b981' : '#e5e7eb'}`,
                      padding: '10px 16px',
                      borderRadius: 8,
                      minWidth: 120
                    }}>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                        {country.flag} {country.code}
                      </div>
                      <div style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: stock > 0 ? '#065f46' : '#9ca3af'
                      }}>
                        {stock}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{
                marginTop: 16,
                padding: 16,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 12,
                color: 'white',
                display: 'inline-block'
              }}>
                <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>Total Stock</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{getTotalStock()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 30 }}>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Total Orders</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>{stats.total}</div>
        </div>

        <div style={{ background: '#ecfdf5', border: '1px solid #10b981', padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: '#065f46', marginBottom: 8 }}>Delivered</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#065f46' }}>{stats.delivered}</div>
        </div>

        <div style={{ background: '#dbeafe', border: '1px solid #3b82f6', padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: '#1e40af', marginBottom: 8 }}>In Progress</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1e40af' }}>{stats.pending}</div>
        </div>

        <div style={{ background: '#fef2f2', border: '1px solid #ef4444', padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: '#991b1b', marginBottom: 8 }}>Cancelled</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#991b1b' }}>{stats.cancelled}</div>
        </div>

        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', padding: 20, borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: '#92400e', marginBottom: 8 }}>Returned</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#92400e' }}>{stats.returned}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
          <input
            type="text"
            className="input"
            placeholder="Search by invoice, customer name, phone, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: 15 }}
          />

          <select
            className="input"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ minWidth: 200, fontSize: 15 }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="picked_up">Picked Up</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="returned">Returned</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#111827' }}>
          Order History ({filteredOrders.length})
        </h3>

        {filteredOrders.length === 0 ? (
          <div className="card" style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 16, color: '#9ca3af' }}>
              {searchQuery || selectedStatus !== 'all' ? 'No orders match your filters' : 'No orders found for this product'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {filteredOrders.map(order => {
              const statusColors = getStatusColor(order.shipmentStatus)
              
              return (
                <div key={order._id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Order Header */}
                  <div style={{
                    padding: 20,
                    background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 16
                  }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
                        Order #{order.invoiceNumber || String(order._id).slice(-8)}
                      </div>
                      <div style={{ fontSize: 14, color: '#6b7280' }}>
                        Created {formatDate(order.createdAt)}
                      </div>
                    </div>

                    <div style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: statusColors.bg,
                      border: `1px solid ${statusColors.border}`,
                      color: statusColors.text,
                      fontWeight: 700,
                      fontSize: 14,
                      textTransform: 'capitalize'
                    }}>
                      {order.shipmentStatus?.replace(/_/g, ' ')}
                    </div>
                  </div>

                  {/* Order Details */}
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
                      {/* Customer Info */}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>
                          Customer Information
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                          {order.customerName || 'N/A'}
                        </div>
                        <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 2 }}>
                          {order.phoneCountryCode} {order.customerPhone}
                        </div>
                        <div style={{ fontSize: 14, color: '#6b7280' }}>
                          {order.city}, {order.orderCountry}
                        </div>
                      </div>

                      {/* Created By */}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>
                          Order Submitted By
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                          {order.createdBy?.firstName} {order.createdBy?.lastName}
                        </div>
                        <div style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: '#dbeafe',
                          color: '#1e40af',
                          fontSize: 12,
                          fontWeight: 600,
                          textTransform: 'capitalize'
                        }}>
                          {order.createdByRole || order.createdBy?.role || 'N/A'}
                        </div>
                      </div>

                      {/* Delivery Info */}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>
                          Assigned Driver
                        </div>
                        {order.deliveryBoy ? (
                          <>
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                              {order.deliveryBoy?.firstName} {order.deliveryBoy?.lastName}
                            </div>
                            {order.assignedBy && (
                              <div style={{ fontSize: 13, color: '#6b7280' }}>
                                Assigned by: {order.assignedBy?.firstName} {order.assignedBy?.lastName}
                                {order.assignedBy?.role && (
                                  <span style={{
                                    marginLeft: 6,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    background: '#f3f4f6',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    textTransform: 'capitalize'
                                  }}>
                                    {order.assignedBy.role}
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ fontSize: 14, color: '#9ca3af' }}>Not assigned yet</div>
                        )}
                      </div>

                      {/* Order Value */}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>
                          Order Value
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
                          {product.baseCurrency} {order.total?.toFixed(2) || '0.00'}
                        </div>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>
                          Quantity: {order.quantity || 1}
                        </div>
                      </div>
                    </div>

                    {/* Delivery Timeline */}
                    {(order.deliveredAt || order.cancelledAt) && (
                      <div style={{
                        marginTop: 20,
                        paddingTop: 20,
                        borderTop: '1px solid var(--border)'
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 12 }}>
                          Timeline
                        </div>
                        
                        {order.deliveredAt && (
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#065f46' }}>Delivered: </span>
                            <span style={{ fontSize: 14, color: '#6b7280' }}>{formatDate(order.deliveredAt)}</span>
                            {order.collectedAmount != null && (
                              <span style={{ marginLeft: 12, fontSize: 14, color: '#6b7280' }}>
                                (Collected: {product.baseCurrency} {order.collectedAmount?.toFixed(2)})
                              </span>
                            )}
                          </div>
                        )}

                        {order.shipmentStatus === 'cancelled' && order.cancelReason && (
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#991b1b' }}>Cancelled: </span>
                            <span style={{ fontSize: 14, color: '#6b7280' }}>{order.cancelReason}</span>
                          </div>
                        )}

                        {order.shipmentStatus === 'returned' && (
                          <div>
                            <div style={{ marginBottom: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>Returned: </span>
                              <span style={{ fontSize: 14, color: '#6b7280' }}>
                                {order.returnReason || 'No reason provided'}
                              </span>
                            </div>
                            
                            {order.returnSubmittedToCompany && (
                              <div style={{ marginBottom: 8 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>Submitted for Verification: </span>
                                <span style={{ fontSize: 14, color: '#6b7280' }}>Yes</span>
                              </div>
                            )}
                            
                            {order.returnVerified && order.returnVerifiedAt && (
                              <div style={{
                                padding: 12,
                                background: '#ecfdf5',
                                border: '1px solid #10b981',
                                borderRadius: 8,
                                marginTop: 8
                              }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#065f46', marginBottom: 4 }}>
                                  Stock Refilled
                                </div>
                                <div style={{ fontSize: 13, color: '#065f46' }}>
                                  Verified {formatDate(order.returnVerifiedAt)} by {order.returnVerifiedBy?.firstName} {order.returnVerifiedBy?.lastName}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
