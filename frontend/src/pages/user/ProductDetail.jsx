import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiGet } from '../../api'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState(null)

  useEffect(() => {
    if (id) {
      loadProductAndOrders()
    }
  }, [id])

  async function loadProductAndOrders() {
    setLoading(true)
    try {
      // Load product details
      const productData = await apiGet(`/api/products/${id}`)
      setProduct(productData.product || productData)

      // Load all orders for this product
      const ordersData = await apiGet('/api/orders')
      const productOrders = (ordersData.orders || []).filter(order => {
        // Check if order contains this product (single or multi-item)
        if (String(order.productId?._id || order.productId) === id) return true
        if (Array.isArray(order.items)) {
          return order.items.some(item =>
            String(item.productId?._id || item.productId) === id
          )
        }
        return false
      })

      // Populate additional info
      const enrichedOrders = await Promise.all(
        productOrders.map(async (order) => {
          try {
            // Get full order details with populated fields
            const fullOrder = await apiGet(`/api/orders/${order._id}`)
            return fullOrder.order || fullOrder
          } catch {
            return order
          }
        })
      )

      setOrders(enrichedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders
    return orders.filter(o => o.shipmentStatus?.toLowerCase() === statusFilter.toLowerCase())
  }, [orders, statusFilter])

  const stats = useMemo(() => {
    const total = orders.length
    const delivered = orders.filter(o => o.shipmentStatus === 'delivered').length
    const cancelled = orders.filter(o => o.shipmentStatus === 'cancelled').length
    const returned = orders.filter(o => o.shipmentStatus === 'returned').length
    const pending = orders.filter(o => ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(o.shipmentStatus)).length

    let totalRevenue = 0
    orders.filter(o => o.shipmentStatus === 'delivered').forEach(o => {
      totalRevenue += Number(o.total || 0)
    })

    return { total, delivered, cancelled, returned, pending, totalRevenue }
  }, [orders])

  function getTotalStock(product) {
    if (!product?.stockByCountry) return 0
    return Object.values(product.stockByCountry).reduce((sum, val) => sum + Number(val || 0), 0)
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
                <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 4 }}>Price</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  {product.baseCurrency} {product.price?.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 4 }}>Category</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{product.category || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 4 }}>Total Stock</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: getTotalStock(product) < 10 ? '#dc2626' : '#059669' }}>
                  {getTotalStock(product)}
                </div>
              </div>
            </div>

            {/* Stock by Country */}
            {product.stockByCountry && (
              <div>
                <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>Stock by Country</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {Object.entries(product.stockByCountry).map(([country, stock]) => (
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
          <div style={{ fontSize: 13, color: '#15803d', marginBottom: 4 }}>Delivered</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#14532d' }}>{stats.delivered}</div>
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
          <div style={{ fontSize: 13, color: '#7e22ce', marginBottom: 4 }}>Total Revenue</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#581c87' }}>
            {product.baseCurrency} {stats.totalRevenue.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Order History</h2>

          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: 200 }}
          >
            <option value="all">All Status ({orders.length})</option>
            <option value="delivered">Delivered ({stats.delivered})</option>
            <option value="cancelled">Cancelled ({stats.cancelled})</option>
            <option value="returned">Returned ({stats.returned})</option>
            <option value="pending">Pending ({stats.pending})</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>ORDER ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, opacity: 0.7 }}>DATE</th>
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
                  <td colSpan={9} style={{ padding: 40, textAlign: 'center', opacity: 0.6 }}>
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  const quantity = Array.isArray(order.items)
                    ? order.items.find(item => String(item.productId?._id || item.productId) === id)?.quantity || 1
                    : order.quantity || 1

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
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{order.customerName || 'N/A'}</div>
                        <div style={{ fontSize: 12, opacity: 0.6 }}>{order.customerPhone}</div>
                      </td>
                      <td style={{ padding: '16px', fontWeight: 700 }}>{quantity}</td>
                      <td style={{ padding: '16px', fontWeight: 700 }}>
                        {product.baseCurrency} {(Number(order.total || 0)).toFixed(2)}
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
