import React, { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../api.js'
import { qsRangeBare } from '../../utils/queryString.js'

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, unread, read
  const [typeFilter, setTypeFilter] = useState('all') // all, order_cancelled, order_returned, amount_approval, etc.
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [stats, setStats] = useState({})

  async function loadNotifications(pageNum = 1, reset = false) {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pageNum,
        limit: 20,
        ...(filter !== 'all' && { unread: filter === 'unread' ? 'true' : 'false' }),
        ...(typeFilter !== 'all' && { type: typeFilter })
      })
      
      const response = await apiGet(`/api/notifications?${params}`)
      const newNotifications = response.notifications || []
      
      if (reset || pageNum === 1) {
        setNotifications(newNotifications)
      } else {
        setNotifications(prev => [...prev, ...newNotifications])
      }
      
      setHasMore(newNotifications.length === 20)
      setPage(pageNum)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadStats() {
    try {
      const response = await apiGet('/api/notifications/stats')
      setStats(response.stats || {})
    } catch (error) {
      console.error('Failed to load notification stats:', error)
    }
  }

  async function markAsRead(notificationId) {
    try {
      await apiPatch(`/api/notifications/${notificationId}/read`)
      setNotifications(prev => 
        prev.map(n => n._id === notificationId ? { ...n, read: true, readAt: new Date() } : n)
      )
      loadStats()
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  async function markAllAsRead() {
    try {
      await apiPatch('/api/notifications/read-all')
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true, readAt: new Date() }))
      )
      loadStats()
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }

  async function deleteNotification(notificationId) {
    try {
      await apiDelete(`/api/notifications/${notificationId}`)
      setNotifications(prev => prev.filter(n => n._id !== notificationId))
      loadStats()
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  async function approveNotification(notification) {
    try {
      if (!notification.relatedId) {
        alert('Cannot approve: Order ID not found')
        return
      }
      
      const confirmed = confirm(`Approve this ${notification.type === 'order_cancelled' ? 'cancellation' : 'return'} request? This will restore stock for order #${notification.message.match(/#(\w+)/)?.[1] || notification.relatedId}`)
      if (!confirmed) return

      // Call the verify endpoint
      await apiPost(`/api/orders/${notification.relatedId}/return/verify`, {})
      
      // Mark notification as read and remove from list
      await markAsRead(notification._id)
      await deleteNotification(notification._id)
      
      alert('Order verified successfully. Stock has been restored.')
      loadNotifications(1, true)
    } catch (error) {
      console.error('Failed to approve:', error)
      alert(error?.message || 'Failed to approve request')
    }
  }

  useEffect(() => {
    loadNotifications(1, true)
    loadStats()
  }, [filter, typeFilter])

  function formatDate(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  function getNotificationIcon(type) {
    switch (type) {
      case 'order_cancelled':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        )
      case 'order_returned':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
            <path d="M9 10l3-3 3 3"/>
          </svg>
        )
      case 'amount_approval':
      case 'expense_approval':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
            <path d="M16.24 7.76l1.5-1.5"/>
          </svg>
        )
      case 'driver_settlement':
      case 'manager_remittance':
      case 'agent_remittance':
      case 'investor_remittance':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        )
      default:
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        )
    }
  }

  function getTypeLabel(type) {
    switch (type) {
      case 'order_cancelled': return 'Order Cancel'
      case 'order_returned': return 'Order Return'
      case 'driver_settlement': return 'Driver Settlement'
      case 'manager_remittance': return 'Manager Remittance'
      case 'agent_remittance': return 'Agent Remittance'
      case 'investor_remittance': return 'Investor Remittance'
      case 'amount_approval': return 'Amount Approval'
      case 'expense_approval': return 'Expense Approval'
      default: return 'Notification'
    }
  }

  function getNotificationStyle(type) {
    switch (type) {
      case 'order_cancelled':
        return {
          gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          bg: 'rgba(239, 68, 68, 0.05)',
          border: '#ef4444',
          color: '#ef4444'
        }
      case 'order_returned':
        return {
          gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          bg: 'rgba(249, 115, 22, 0.05)',
          border: '#f97316',
          color: '#f97316'
        }
      case 'amount_approval':
      case 'expense_approval':
        return {
          gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          bg: 'rgba(139, 92, 246, 0.05)',
          border: '#8b5cf6',
          color: '#8b5cf6'
        }
      case 'driver_settlement':
      case 'manager_remittance':
      case 'agent_remittance':
      case 'investor_remittance':
        return {
          gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          bg: 'rgba(16, 185, 129, 0.05)',
          border: '#10b981',
          color: '#10b981'
        }
      default:
        return {
          gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          bg: 'rgba(59, 130, 246, 0.05)',
          border: '#3b82f6',
          color: '#3b82f6'
        }
    }
  }

  const unreadCount = stats.find?.(s => s._id === false)?.count || 0

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-purple">Notifications</div>
          <div className="page-subtitle">
            Stay updated with all activities and logs
            {unreadCount > 0 && (
              <span className="badge" style={{ marginLeft: 8, background: '#ef4444', color: 'white' }}>
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button className="btn secondary" onClick={markAllAsRead}>
            Mark All Read
          </button>
        )}
      </div>

      {/* Filters */}
      <div 
        className="card" 
        style={{ 
          marginBottom: 16,
          background: 'linear-gradient(135deg, var(--panel) 0%, var(--panel-2) 100%)',
          border: '2px solid var(--border)',
          borderRadius: 16,
          padding: 20
        }}
      >
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: '1 1 auto' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                flexShrink: 0
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: 'var(--text)' }}>
                Filter Notifications
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Customize your view by status and type
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Status
              </label>
              <select 
                className="input" 
                value={filter} 
                onChange={(e) => setFilter(e.target.value)}
                style={{ 
                  minWidth: 140,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '2px solid var(--border)',
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                <option value="all">📋 All Status</option>
                <option value="unread">🔵 Unread Only</option>
                <option value="read">✓ Read Only</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Category
              </label>
              <select 
                className="input" 
                value={typeFilter} 
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ 
                  minWidth: 180,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '2px solid var(--border)',
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                <option value="all">🎯 All Categories</option>
                <option value="order_cancelled">❌ Order Cancellations</option>
                <option value="order_returned">📦 Order Returns</option>
                <option value="amount_approval">⏰ Amount Approvals</option>
                <option value="driver_settlement">💵 Driver Settlements</option>
                <option value="manager_remittance">💰 Manager Remittances</option>
                <option value="agent_remittance">💸 Agent Remittances</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="card">
        {loading && notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>No notifications found</div>
            <div>You're all caught up! New activities will appear here.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16, padding: 16 }}>
            {notifications.map((notification) => {
              const style = getNotificationStyle(notification.type)
              return (
                <div
                  key={notification._id}
                  style={{
                    position: 'relative',
                    borderRadius: 16,
                    border: `2px solid ${style.border}`,
                    background: style.bg,
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: !notification.read ? 'scale(1)' : 'scale(0.98)',
                    opacity: !notification.read ? 1 : 0.7
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.02) translateY(-4px)'
                    e.currentTarget.style.boxShadow = `0 20px 25px -5px ${style.color}20, 0 10px 10px -5px ${style.color}10`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = !notification.read ? 'scale(1)' : 'scale(0.98)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {/* Gradient Header Bar */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: style.gradient
                    }}
                  />
                  
                  {/* Notification Badge */}
                  {notification.metadata?.requiresApproval && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        padding: '4px 12px',
                        background: style.gradient,
                        color: 'white',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        boxShadow: `0 4px 12px ${style.color}40`,
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                      }}
                    >
                      Action Required
                    </div>
                  )}
                  
                  <div style={{ padding: 20, paddingTop: 24 }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      {/* Icon Container */}
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 14,
                          background: style.gradient,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          color: 'white',
                          boxShadow: `0 8px 16px -4px ${style.color}40`
                        }}
                      >
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Meta Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              background: `${style.color}15`,
                              color: style.color,
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}
                          >
                            {getTypeLabel(notification.type)}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
                            {formatDate(notification.createdAt)}
                          </span>
                          {!notification.read && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                background: style.gradient,
                                color: 'white',
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 700
                              }}
                            >
                              <div
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: 'white',
                                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                                }}
                              />
                              NEW
                            </span>
                          )}
                        </div>
                        
                        {/* Title */}
                        <h3
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            marginBottom: 8,
                            color: 'var(--text)',
                            lineHeight: 1.3
                          }}
                        >
                          {notification.title}
                        </h3>
                        
                        {/* Message */}
                        <p
                          style={{
                            color: 'var(--muted)',
                            fontSize: 14,
                            lineHeight: 1.6,
                            marginBottom: 12
                          }}
                        >
                          {notification.message}
                        </p>
                        
                        {/* Triggered By */}
                        {notification.triggeredByRole && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              background: 'var(--panel)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              fontSize: 12,
                              color: 'var(--muted)',
                              marginBottom: 16
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                              <circle cx="12" cy="7" r="4"/>
                            </svg>
                            Triggered by {notification.triggeredByRole}
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {notification.metadata?.requiresApproval && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                approveNotification(notification)
                              }}
                              style={{
                                padding: '10px 20px',
                                background: style.gradient,
                                color: 'white',
                                border: 'none',
                                borderRadius: 10,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: `0 4px 12px ${style.color}30`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)'
                                e.currentTarget.style.boxShadow = `0 8px 20px ${style.color}40`
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = `0 4px 12px ${style.color}30`
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              Approve Request
                            </button>
                          )}
                          {!notification.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                markAsRead(notification._id)
                              }}
                              style={{
                                padding: '10px 16px',
                                background: 'var(--panel)',
                                color: 'var(--text)',
                                border: '1px solid var(--border)',
                                borderRadius: 10,
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--panel-2)'
                                e.currentTarget.style.borderColor = style.color
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--panel)'
                                e.currentTarget.style.borderColor = 'var(--border)'
                              }}
                            >
                              Mark as Read
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('Delete this notification?')) {
                                deleteNotification(notification._id)
                              }
                            }}
                            style={{
                              padding: '10px 16px',
                              background: 'transparent',
                              color: '#ef4444',
                              border: '1px solid #ef444420',
                              borderRadius: 10,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#ef444410'
                              e.currentTarget.style.borderColor = '#ef4444'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.borderColor = '#ef444420'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        {/* Load More Button */}
        {hasMore && notifications.length > 0 && (
          <div style={{ padding: 16, textAlign: 'center', borderTop: '1px solid var(--border)' }}>
            <button 
              className="btn secondary" 
              onClick={() => loadNotifications(page + 1)}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}