import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiGet } from '../../api'

const COUNTRIES = [
  { code: 'UAE', name: 'UAE', flag: '🇦🇪' },
  { code: 'Oman', name: 'Oman', flag: '🇴🇲' },
  { code: 'KSA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'Bahrain', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'India', name: 'India', flag: '🇮🇳' },
  { code: 'Kuwait', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'Qatar', name: 'Qatar', flag: '🇶🇦' }
]

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')

  useEffect(() => {
    loadProduct()
    loadOrders()
  }, [id])

  async function loadProduct() {
    setLoading(true)
    try {
      const data = await apiGet(`/api/products/${id}`)
      setProduct(data.product || data)
    } catch (err) {
      setError(err?.message || 'Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  async function loadOrders() {
    setOrdersLoading(true)
    try {
      const data = await apiGet(`/api/products/${id}/orders`)
      setOrders(data.orders || [])
    } catch (err) {
      console.error('Failed to load orders:', err)
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }

  function getStockForCountry(countryCode) {
    return product?.stockByCountry?.[countryCode] || 0
  }

  function getTotalStock() {
    if (!product?.stockByCountry) return 0
    return Object.values(product.stockByCountry).reduce((sum, val) => sum + Number(val || 0), 0)
  }

  function fmtDate(s) {
    try {
      return new Date(s).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch { return '' }
  }

  function getStatusColor(status) {
    const s = String(status || '').toLowerCase()
    if (s === 'delivered') return '#10b981'
    if (['cancelled', 'returned'].includes(s)) return '#ef4444'
    if (['assigned', 'picked_up', 'out_for_delivery'].includes(s)) return '#3b82f6'
    if (s === 'pending') return '#f59e0b'
    return '#6b7280'
  }

  function getStatusBadge(status) {
    const color = getStatusColor(status)
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        background: `${color}22`,
        color: color,
        textTransform: 'capitalize'
      }}>
        {String(status || 'pending').replace('_', ' ')}
      </span>
    )
  }

  const filteredOrders = orders.filter(order => {
    if (statusFilter !== 'all' && order.shipmentStatus !== statusFilter) return false
    if (countryFilter !== 'all' && order.orderCountry !== countryFilter) return false
    return true
  })

  const orderStats = {
    total: orders.length,
    pending: orders.filter(o => !o.shipmentStatus || o.shipmentStatus === 'pending').length,
    delivered: orders.filter(o => o.shipmentStatus === 'delivered').length,
    cancelled: orders.filter(o => ['cancelled', 'returned'].includes(o.shipmentStatus)).length,
    inProgress: orders.filter(o => ['assigned', 'picked_up', 'out_for_delivery'].includes(o.shipmentStatus)).length
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
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#ef4444', fontSize: 18, marginBottom: 16 }}>{error || 'Product not found'}</div>
        <button className="btn secondary" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    )
  }

  const totalStock = getTotalStock()
  const isLowStock = totalStock < 10

  return (
    <div style={{ display: 'grid', gap: 20, padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="btn secondary"
          onClick={() => navigate(-1)}
          style={{ width: 40, height: 40, padding: 0, borderRadius: 10 }}
        >
          ←
        </button>
        <div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            margin: 0,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {product.name}
          </h1>
          <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: 14 }}>Complete product overview and order history</p>
        </div>
      </div>

      {/* Product Info Card */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24 }}>
          {/* Product Image */}
          <div>
            {product.imagePath || (product.images && product.images[0]) ? (
              <img
                src={product.imagePath || product.images[0]}
                alt={product.name}
                style={{
                  width: 150,
                  height: 150,
                  objectFit: 'cover',
                  borderRadius: 12,
                  border: '2px solid var(--border)',
                  background: 'var(--panel)'
                }}
              />
            ) : (
              <div style={{
                width: 150,
                height: 150,
                borderRadius: 12,
                border: '2px solid var(--border)',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 48,
                color: 'white'
              }}>
                📦
              </div>
            )}
          </div>

          {/* Product Details */}
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, fontWeight: 600 }}>SKU</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{product.sku || 'N/A'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, fontWeight: 600 }}>PRICE</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#667eea' }}>
                  {product.baseCurrency} {product.price?.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, fontWeight: 600 }}>TOTAL STOCK</div>
                <div style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: isLowStock ? '#ef4444' : '#10b981'
                }}>
                  {totalStock} units
                  {isLowStock && <span style={{ fontSize: 12, marginLeft: 8 }}>⚠️ Low</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4, fontWeight: 600 }}>CATEGORY</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{product.category || 'Other'}</div>
              </div>
            </div>

            {/* Stock by Country */}
            <div>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8, fontWeight: 600 }}>STOCK BY COUNTRY</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {COUNTRIES.map(c => {
                  const stock = getStockForCountry(c.code)
                  return (
                    <div key={c.code} style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: stock > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                      border: `1px solid ${stock > 0 ? '#10b981' : '#6b7280'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <span style={{ fontSize: 20 }}>{c.flag}</span>
                      <span style={{ fontWeight: 700, fontSize: 16, color: stock > 0 ? '#10b981' : '#6b7280' }}>
                        {stock}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <div style={{
          padding: 20,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>TOTAL ORDERS</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{orderStats.total}</div>
        </div>

        <div style={{
          padding: 20,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white'
        }}>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>DELIVERED</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{orderStats.delivered}</div>
        </div>

        <div style={{
          padding: 20,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          color: 'white'
        }}>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>IN PROGRESS</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{orderStats.inProgress}</div>
        </div>

        <div style={{
          padding: 20,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: 'white'
        }}>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>PENDING</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{orderStats.pending}</div>
        </div>

        <div style={{
          padding: 20,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: 'white'
        }}>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>CANCELLED</div>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{orderStats.cancelled}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>Filter by Status</label>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: 14 }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="picked_up">Picked Up</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="returned">Returned</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>Filter by Country</label>
            <select
              className="input"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              style={{ fontSize: 14 }}
            >
              <option value="all">All Countries</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--panel)' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Order History ({filteredOrders.length})
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: 12 }}>INVOICE #</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: 12 }}>CUSTOMER</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, fontSize: 12 }}>QTY</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: 12 }}>COUNTRY</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: 12 }}>STATUS</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: 12 }}>SUBMITTED BY</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: 12 }}>ASSIGNED TO</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: 12 }}>ASSIGNED BY</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: 12 }}>DATE</th>
              </tr>
            </thead>
            <tbody>
              {ordersLoading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px 20px', textAlign: 'center', opacity: 0.7 }}>
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px 20px', textAlign: 'center', opacity: 0.7 }}>
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => (
                  <tr key={order._id} style={{
                    borderBottom: '1px solid var(--border)',
                    background: idx % 2 ? 'transparent' : 'rgba(102, 126, 234, 0.03)'
                  }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontWeight: 700,
                        color: '#667eea'
                      }}>
                        #{order.invoiceNumber || String(order._id).slice(-5)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{order.customerName || 'N/A'}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{order.customerPhone}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{order.quantity || 1}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 18 }}>
                          {COUNTRIES.find(c => c.code === order.orderCountry)?.flag || '🌍'}
                        </span>
                        <span style={{ fontWeight: 600 }}>{order.orderCountry}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {getStatusBadge(order.shipmentStatus)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 16 }}>
                          {order.createdByRole === 'agent' ? '🧑‍💼' : 
                           order.createdByRole === 'manager' ? '👔' : 
                           order.createdByRole === 'user' ? '👤' : '🔹'}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {order.createdBy?.firstName} {order.createdBy?.lastName}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'capitalize' }}>
                            {order.createdByRole}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {order.deliveryBoy ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16 }}>🚚</span>
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {order.deliveryBoy.firstName} {order.deliveryBoy.lastName}
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.6 }}>Driver</div>
                          </div>
                        </div>
                      ) : (
                        <span style={{ opacity: 0.5 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {order.assignedBy ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16 }}>
                            {order.assignedByRole === 'manager' ? '👔' : '👤'}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {order.assignedBy.firstName} {order.assignedBy.lastName}
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'capitalize' }}>
                              {order.assignedByRole || 'Manager'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span style={{ opacity: 0.5 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13 }}>{fmtDate(order.createdAt)}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
