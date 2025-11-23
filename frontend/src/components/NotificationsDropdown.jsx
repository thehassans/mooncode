import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPatch } from '../api.js'
import {
  playNotificationSound,
  isSoundEnabled,
  getSoundVolume,
} from '../utils/notificationSounds.js'
import { qsRangeBare } from '../utils/queryString.js'

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(() => isSoundEnabled())
  const dropdownRef = useRef(null)
  const previousCountRef = useRef(0)
  const navigate = useNavigate()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownRef])

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadRecentNotifications()
    }
  }, [isOpen])

  // Check for unread notifications on mount and periodically
  useEffect(() => {
    loadUnreadCount()

    // Poll for new notifications every 60 seconds
    const interval = setInterval(loadUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [])

  // Play sound when unread count increases
  useEffect(() => {
    // Skip the initial load (when previousCountRef.current is 0)
    if (previousCountRef.current > 0 && unreadCount > previousCountRef.current) {
      // Play notification sound if enabled
      if (soundEnabled) {
        playNotificationSound({
          enabled: soundEnabled,
          volume: getSoundVolume(),
        })
      }
    }

    // Update previous count reference
    previousCountRef.current = unreadCount
  }, [unreadCount, soundEnabled])

  async function loadRecentNotifications() {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: 1,
        limit: 5, // Backend now filters, so we only need 5
      })

      const response = await apiGet(`/api/notifications?${params}`)
      const notifs = response.notifications || []

      setNotifications(notifs)
      setUnreadCount(response.unreadCount || 0)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadUnreadCount() {
    try {
      const response = await apiGet('/api/notifications/stats')
      setUnreadCount(response.totalUnread || 0)
    } catch (error) {
      console.error('Failed to load notification stats:', error)
    }
  }

  async function markAsRead(notificationId) {
    try {
      await apiPatch(`/api/notifications/${notificationId}/read`)

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, read: true, readAt: new Date() } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  function handleNotificationClick(notification) {
    // Mark as read if unread
    if (!notification.read) {
      markAsRead(notification._id)
    }

    // Close dropdown
    setIsOpen(false)

    // Navigate based on notification type
    if (notification.relatedType === 'Order' && notification.relatedId) {
      navigate(`/user/orders?id=${notification.relatedId}`)
    } else {
      // For other notification types, go to notifications page
      navigate('/user/notifications')
    }
  }

  function handleViewAll() {
    setIsOpen(false)
    navigate('/user/notifications')
  }

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
      case 'order_returned':
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            <line x1="10" y1="11" x2="14" y2="15"></line>
            <line x1="14" y1="11" x2="10" y2="15"></line>
          </svg>
        )

      case 'driver_settlement':
      case 'amount_approval':
      case 'manager_remittance':
      case 'agent_remittance':
      case 'investor_remittance':
      case 'expense_approval':
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
            <path d="M12 15h2"></path>
            <path d="M12 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
          </svg>
        )

      default:
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        )
    }
  }

  return (
    <div className="notifications-dropdown" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn relative grid place-items-center p-0"
        title="Notifications"
        aria-label="Notifications"
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '14px',
          background:
            'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          border: '1px solid rgba(255,255,255,0.15)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          color: 'var(--fg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow =
            '0 12px 40px rgba(99, 102, 241, 0.25), inset 0 1px 0 rgba(255,255,255,0.2)'
          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)'
          e.currentTarget.style.color = '#818cf8'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow =
            '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
          e.currentTarget.style.color = 'var(--fg)'
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notifications-panel">
          <div className="notifications-header">
            <h3>Notifications</h3>
            <div className="notifications-controls">
              {/* Sound toggle button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSoundEnabled(!soundEnabled)
                  localStorage.setItem(
                    'notification_sound_enabled',
                    !soundEnabled ? 'true' : 'false'
                  )
                }}
                className="sound-toggle"
                title={soundEnabled ? 'Mute notifications' : 'Enable notification sounds'}
              >
                {soundEnabled ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                )}
              </button>

              {unreadCount > 0 && <span className="unread-count">{unreadCount} unread</span>}
            </div>
          </div>

          <div className="notifications-content">
            {loading ? (
              <div className="notifications-loading">
                <div className="loading-spinner"></div>
                <p>Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notifications-empty">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <p>No new notifications</p>
              </div>
            ) : (
              <ul className="notifications-list">
                {notifications.map((notification) => (
                  <li
                    key={notification._id}
                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="notification-icon">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="notification-content">
                      <p className="notification-title">
                        {notification.title}
                        {notification.metadata?.requiresApproval && (
                          <span
                            style={{
                              marginLeft: 6,
                              padding: '2px 6px',
                              background: '#10b981',
                              color: 'white',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            NEEDS APPROVAL
                          </span>
                        )}
                      </p>
                      <p className="notification-message">{notification.message}</p>
                      <span className="notification-time">
                        {formatDate(notification.createdAt)}
                      </span>
                    </div>
                    {!notification.read && <span className="notification-indicator"></span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="notifications-footer">
            <button onClick={handleViewAll} className="view-all-btn">
              See all notifications
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .notifications-dropdown {
          position: relative;
          display: inline-block;
        }

        .notification-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          background: #ef4444;
          color: white;
          border-radius: 50%;
          min-width: 18px;
          height: 18px;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          border: 2px solid var(--sidebar-bg, #1a1a1a);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .notifications-panel {
          position: absolute;
          top: calc(100% + 8px);
          right: -8px;
          width: 320px;
          max-height: 480px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .notifications-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .notifications-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sound-toggle {
          background: none;
          border: none;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: 4px;
          color: var(--muted);
          transition: all 0.2s ease;
        }

        .sound-toggle:hover {
          background: var(--panel-2);
          color: var(--text);
        }

        .notifications-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .unread-count {
          font-size: 12px;
          background: #ef4444;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 600;
        }

        .notifications-content {
          flex: 1;
          overflow-y: auto;
          max-height: 360px;
        }

        .notifications-loading,
        .notifications-empty {
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--muted);
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .notifications-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .notification-item {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          gap: 12px;
          cursor: pointer;
          transition: background 0.15s ease;
          position: relative;
        }

        .notification-item:hover {
          background: var(--panel-2);
        }

        .notification-item.unread {
          background: var(--panel-2);
        }

        .notification-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--primary-muted, rgba(59, 130, 246, 0.1));
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-title {
          margin: 0 0 4px;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .notification-message {
          margin: 0 0 6px;
          font-size: 13px;
          color: var(--muted);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .notification-time {
          font-size: 12px;
          color: var(--muted);
          display: block;
        }

        .notification-indicator {
          position: absolute;
          top: 50%;
          right: 16px;
          transform: translateY(-50%);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--primary);
        }

        .notifications-footer {
          padding: 10px 16px;
          border-top: 1px solid var(--border);
          text-align: center;
        }

        .view-all-btn {
          width: 100%;
          background: none;
          border: none;
          color: var(--primary);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 6px;
          transition: background 0.15s ease;
        }

        .view-all-btn:hover {
          background: var(--panel-2);
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}
