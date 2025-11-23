import React, { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { API_BASE, apiGet } from '../api.js'
import Sidebar from '../components/Sidebar.jsx'
import Modal from '../components/Modal.jsx'
import NotificationsDropdown from '../components/NotificationsDropdown.jsx'
import { io } from 'socket.io-client'

export default function UserLayout() {
  const navigate = useNavigate()
  const [closed, setClosed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  )
  const [theme, setTheme] = useState('dark')
  const location = useLocation()
  const me = JSON.parse(localStorage.getItem('me') || '{}')
  const [pendingManagerRemits, setPendingManagerRemits] = useState(0)

  // Load pending manager remittances count
  useEffect(() => {
    let alive = true
    const loadPending = async () => {
      try {
        const r = await apiGet('/api/finance/manager-remittances')
        if (alive) {
          const pending = Array.isArray(r?.remittances)
            ? r.remittances.filter((rem) => rem.status === 'pending').length
            : 0
          setPendingManagerRemits(pending)
        }
      } catch {}
    }
    loadPending()

    // Live updates for manager remittances
    let socket
    try {
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, {
        path: '/socket.io',
        transports: ['polling'],
        upgrade: false,
        withCredentials: true,
        auth: { token },
      })
      socket.on('manager-remittance.created', loadPending)
      socket.on('manager-remittance.accepted', loadPending)
      socket.on('manager-remittance.rejected', loadPending)
    } catch {}

    return () => {
      alive = false
      try {
        socket && socket.off('manager-remittance.created')
      } catch {}
      try {
        socket && socket.off('manager-remittance.accepted')
      } catch {}
      try {
        socket && socket.off('manager-remittance.rejected')
      } catch {}
      try {
        socket && socket.disconnect()
      } catch {}
    }
  }, [])

  // Navigation visibility state
  const [hiddenNavItems, setHiddenNavItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('hiddenNavItems') || '[]')
    } catch {
      return []
    }
  })

  const toggleNavItem = (label) => {
    setHiddenNavItems((prev) => {
      const next = prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
      localStorage.setItem('hiddenNavItems', JSON.stringify(next))
      return next
    })
  }

  const links = [
    {
      to: '/user',
      label: 'Dashboard',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="10" width="7" height="11" />
          <rect x="3" y="13" width="7" height="8" />
        </svg>
      ),
    },
    {
      label: 'Inbox',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      children: [
        {
          to: '/user/inbox/whatsapp',
          label: 'Whatsapp Inbox',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          ),
        },
        {
          to: '/user/inbox/connect',
          label: 'Whatsapp Connect',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Create',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      ),
      children: [
        {
          to: '/user/agents',
          label: 'Agents',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
        {
          to: '/user/managers',
          label: 'Managers',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          ),
        },
        {
          to: '/user/investors',
          label: 'Investors',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
          ),
        },
        {
          to: '/user/drivers',
          label: 'Drivers',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Commerce',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      ),
      children: [
        {
          to: '/user/orders',
          label: 'Orders',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          ),
        },
        {
          to: '/user/online-orders',
          label: 'Online Orders',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          ),
        },
        {
          to: '/user/products',
          label: 'Product Detail',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          ),
        },
        {
          to: '/user/inhouse-products',
          label: 'Inhouse Products',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          ),
        },
        {
          to: '/user/investor-products',
          label: 'Investor Products',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
          ),
        },
        {
          to: '/user/investor-requests',
          label: 'Investor Requests',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          ),
        },
        {
          to: '/user/referral-details',
          label: 'Referral Details',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          ),
        },
        {
          to: '/user/warehouses',
          label: 'Warehouses',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 21v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8" />
              <path d="M5 21v-8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8" />
              <path d="M3 10V3a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v7" />
            </svg>
          ),
        },
        {
          to: '/user/shipments',
          label: 'Shipments',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          ),
        },
        {
          to: '/user/expense',
          label: 'Expense Management',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          ),
        },
        {
          to: '/user/currency',
          label: 'Currency Conversion',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12M16 10H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H8" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Amount Office',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      children: [
        {
          to: '/user/transactions',
          label: 'Driver Settlement',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          ),
        },
        {
          to: '/user/manager-finances',
          label: 'Manager Finances',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="20" x2="12" y2="10" />
              <line x1="18" y1="20" x2="18" y2="4" />
              <line x1="6" y1="20" x2="6" y2="16" />
            </svg>
          ),
          badge: pendingManagerRemits,
        },
        {
          to: '/user/agent-amounts',
          label: 'Agent Amounts',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          ),
        },
        {
          to: '/user/investor-amounts',
          label: 'Investor Amounts',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
          ),
        },
        {
          to: '/user/investor-daily',
          label: 'Investor Daily',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          ),
        },
        {
          to: '/user/referral-amounts',
          label: 'Referral Amount',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect x="2" y="7" width="20" height="5" />
              <line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>
          ),
        },
        {
          to: '/user/driver-amounts',
          label: 'Driver Amounts',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          ),
        },
      ],
    },
    {
      label: 'Insights',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      children: [
        {
          to: '/user/reports',
          label: 'Business Reports',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          ),
        },
        {
          to: '/user/driver-reports',
          label: 'Driver Reports',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1" y="3" width="15" height="13" rx="2" ry="2" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          ),
        },
        {
          to: '/user/campaigns',
          label: 'Campaigns',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          ),
        },
        {
          to: '/user/finances',
          label: 'Finances',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          ),
        },
        {
          to: '/user/website-modification',
          label: 'Website Modification',
          icon: (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
          ),
        },
      ],
    },
    {
      to: '/user/support',
      label: 'Support',
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
  ]

  // Recursive filter for visible links
  const getVisibleLinks = (items) => {
    return items
      .filter((item) => !hiddenNavItems.includes(item.label))
      .map((item) => {
        if (item.children) {
          return { ...item, children: getVisibleLinks(item.children) }
        }
        return item
      })
  }

  const visibleLinks = getVisibleLinks(links)

  // Recursive renderer for settings
  const renderToggleItem = (link, depth = 0) => (
    <div key={link.label}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          paddingLeft: 16 + depth * 20,
          borderRadius: '12px',
          marginBottom: '4px',
          background: 'var(--panel-2)',
          border: '1px solid transparent',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px', display: 'flex', alignItems: 'center' }}>
            {link.icon}
          </span>
          <span style={{ fontWeight: 500, fontSize: '14px' }}>{link.label}</span>
        </div>
        <button
          onClick={() => toggleNavItem(link.label)}
          title={
            hiddenNavItems.includes(link.label) ? 'Show in navigation' : 'Hide from navigation'
          }
          aria-label={`Toggle visibility for ${link.label}`}
          aria-pressed={!hiddenNavItems.includes(link.label)}
          style={{
            width: '44px',
            height: '24px',
            borderRadius: '12px',
            background: hiddenNavItems.includes(link.label) ? 'var(--border)' : '#10b981',
            position: 'relative',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#fff',
              position: 'absolute',
              top: '2px',
              left: hiddenNavItems.includes(link.label) ? '2px' : '22px',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          />
        </button>
      </div>
      {link.children && link.children.map((child) => renderToggleItem(child, depth + 1))}
    </div>
  )

  // Branding (header logo)
  const [branding, setBranding] = useState({ headerLogo: null })
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const j = await apiGet('/api/settings/branding')
        if (!cancelled) setBranding({ headerLogo: j.headerLogo || null })
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      if (mobile) setClosed(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    let t =
      saved ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark')
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark')
  }, [])

  // Restore saved nav colors from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('navColors')
      if (saved) {
        const colors = JSON.parse(saved)
        Object.entries(colors).forEach(([k, v]) => {
          document.documentElement.style.setProperty(`--${k}`, v)
        })
      }
    } catch {}
  }, [])

  // Mobile swipe gestures to open/close sidebar
  useEffect(() => {
    let startX = 0,
      startY = 0,
      startTime = 0,
      tracking = false
    function onTouchStart(e) {
      if (!e.touches || e.touches.length !== 1) return
      const t = e.touches[0]
      const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : ''
      if (['input', 'textarea', 'button', 'select'].includes(tag)) return
      startX = t.clientX
      startY = t.clientY
      startTime = Date.now()
      tracking = true
    }
    function onTouchEnd(e) {
      if (!tracking) return
      tracking = false
      const t = (e.changedTouches && e.changedTouches[0]) || null
      if (!t) return
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      const dt = Date.now() - startTime
      const isHorizontal = Math.abs(dx) > 40 && Math.abs(dy) < 50
      const isQuick = dt < 500
      const fromEdge = startX <= 40
      const isMobile = window.innerWidth <= 768
      if (!isMobile || !isHorizontal || !isQuick) return
      if (dx > 40 && fromEdge) {
        setClosed(false)
      } else if (dx < -40) {
        setClosed(true)
      }
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // Swatch helpers: apply sidebar/header colors and persist
  function applyNavColors(cfg) {
    if (!cfg) return
    const RESET_KEYS = ['sidebar-bg', 'sidebar-border', 'nav-active-bg', 'nav-active-fg']
    const { __theme, __reset, ...vars } = cfg
    if (__reset || Object.keys(vars).length === 0) {
      RESET_KEYS.forEach((k) => document.documentElement.style.removeProperty(`--${k}`))
      try {
        localStorage.removeItem('navColors')
      } catch {}
    } else {
      Object.entries(vars).forEach(([k, v]) => {
        document.documentElement.style.setProperty(`--${k}`, v)
      })
      localStorage.setItem('navColors', JSON.stringify(vars))
    }
    if (__theme) {
      localStorage.setItem('theme', __theme)
      document.documentElement.setAttribute('data-theme', __theme === 'light' ? 'light' : 'dark')
      setTheme(__theme)
    }
  }

  const navPresets = [
    {
      title: 'Default',
      cfg: { __reset: true },
      sample: 'linear-gradient(135deg,var(--panel-2),var(--panel))',
    },
    {
      title: 'Purple',
      cfg: {
        'sidebar-bg': '#1a1036',
        'sidebar-border': '#2b1856',
        'nav-active-bg': '#3f1d67',
        'nav-active-fg': '#f5f3ff',
      },
      sample: '#7c3aed',
    },
    {
      title: 'Green',
      cfg: {
        'sidebar-bg': '#06251f',
        'sidebar-border': '#0b3b31',
        'nav-active-bg': '#0f3f33',
        'nav-active-fg': '#c7f9ec',
      },
      sample: '#10b981',
    },
    {
      title: 'Blue',
      cfg: {
        'sidebar-bg': '#0b1220',
        'sidebar-border': '#223',
        'nav-active-bg': '#1e293b',
        'nav-active-fg': '#e2e8f0',
      },
      sample: '#2563eb',
    },
    {
      title: 'Slate',
      cfg: {
        'sidebar-bg': '#0f172a',
        'sidebar-border': '#1e293b',
        'nav-active-bg': '#1f2937',
        'nav-active-fg': '#e5e7eb',
      },
      sample: '#334155',
    },
    {
      title: 'Orange',
      cfg: {
        'sidebar-bg': '#2a1304',
        'sidebar-border': '#3b1d08',
        'nav-active-bg': '#4a1f0a',
        'nav-active-fg': '#ffedd5',
      },
      sample: '#f97316',
    },
    {
      title: 'Pink',
      cfg: {
        'sidebar-bg': '#2a0b17',
        'sidebar-border': '#3a0f20',
        'nav-active-bg': '#4b1026',
        'nav-active-fg': '#ffe4e6',
      },
      sample: '#ec4899',
    },
    {
      title: 'Light Pink',
      cfg: {
        'sidebar-bg': '#2b1020',
        'sidebar-border': '#3a152b',
        'nav-active-bg': '#4b1a36',
        'nav-active-fg': '#ffd7ef',
      },
      sample: '#f9a8d4',
    },
    {
      title: 'Blush',
      cfg: {
        __theme: 'light',
        'sidebar-bg': '#FFB5C0',
        'sidebar-border': '#f39bab',
        'nav-active-bg': '#ffdfe6',
        'nav-active-fg': '#111827',
      },
      sample: '#FFB5C0',
    },
    {
      title: 'White',
      cfg: {
        __theme: 'light',
        'sidebar-bg': '#ffffff',
        'sidebar-border': '#e5e7eb',
        'nav-active-bg': '#f1f5f9',
        'nav-active-fg': '#111827',
      },
      sample: '#ffffff',
    },
  ]

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [errorLogs, setErrorLogs] = useState([])

  // Settings dropdown state
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showSettingsDropdown) return
    function handleClick(e) {
      const dropdown = document.getElementById('settings-dropdown')
      const button = document.getElementById('settings-button')
      if (dropdown && !dropdown.contains(e.target) && button && !button.contains(e.target)) {
        setShowSettingsDropdown(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [showSettingsDropdown])

  function loadErrorLogs() {
    try {
      setErrorLogs(JSON.parse(localStorage.getItem('error_logs') || '[]'))
    } catch {
      setErrorLogs([])
    }
  }
  function clearErrorLogs() {
    try {
      localStorage.setItem('error_logs', '[]')
    } catch {}
    setErrorLogs([])
  }
  function downloadErrorLogs() {
    try {
      const blob = new Blob([JSON.stringify(errorLogs, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `error-logs-${new Date().toISOString().slice(0, 19)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {}
  }
  function fmtTime(ts) {
    try {
      return new Date(Number(ts || 0)).toLocaleString()
    } catch {
      return ''
    }
  }

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next === 'light' ? 'light' : 'dark')
  }

  function doLogout() {
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('me')
      localStorage.removeItem('navColors')
    } catch {}
    try {
      navigate('/login', { replace: true })
    } catch {}
    setTimeout(() => {
      try {
        window.location.assign('/login')
      } catch {}
    }, 30)
  }

  // Settings view state
  const [settingsView, setSettingsView] = useState('main') // 'main' | 'nav'

  return (
    <div>
      <Sidebar closed={closed} links={visibleLinks} onToggle={() => setClosed((c) => !c)} />
      <div className={`main ${closed ? 'full' : ''}`}>
        <div
          className="topbar"
          style={{
            background: 'var(--sidebar-bg)',
            borderBottom: '1px solid var(--sidebar-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'nowrap',
            minHeight: '60px',
            padding: '0 1rem',
          }}
        >
          <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
            {!isMobile && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 20px',
                  borderRadius: '12px',
                  background:
                    'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  boxShadow:
                    '0 4px 12px rgba(139, 92, 246, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {/* Premium Crown Icon */}
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)',
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 20h20v-8L18 4l-4 6-4-6-4 8z" />
                    <path d="M6 20v-8" />
                    <path d="M10 20v-8" />
                    <path d="M14 20v-8" />
                    <path d="M18 20v-8" />
                  </svg>
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    Owner
                  </span>
                  <span
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {`Welcome ${me.firstName || ''} ${me.lastName || ''}`.trim()}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
            {/* Premium Theme Toggle Switch */}
            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-label={theme === 'light' ? 'Dark mode' : 'Light mode'}
              style={{
                position: 'relative',
                width: '70px',
                height: '34px',
                background:
                  theme === 'dark'
                    ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                    : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                borderRadius: '17px',
                border: theme === 'dark' ? '2px solid #334155' : '2px solid #cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow:
                  theme === 'dark'
                    ? 'inset 0 2px 4px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)'
                    : 'inset 0 2px 4px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.1)',
                padding: 0,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {/* Background Icons */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 8px',
                }}
              >
                {/* Sun Icon (left) */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={theme === 'light' ? '#0f172a' : '#64748b'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: 'all 0.3s ease',
                    opacity: theme === 'light' ? 0.3 : 0.5,
                  }}
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                {/* Moon Icon (right) */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={theme === 'dark' ? '#f1f5f9' : '#94a3b8'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: 'all 0.3s ease',
                    opacity: theme === 'dark' ? 0.3 : 0.5,
                  }}
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </div>
              {/* Sliding Circle */}
              <div
                style={{
                  position: 'absolute',
                  top: '3px',
                  left: theme === 'dark' ? 'calc(100% - 31px)' : '3px',
                  width: '28px',
                  height: '28px',
                  background:
                    theme === 'dark'
                      ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                      : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  borderRadius: '50%',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow:
                    theme === 'dark'
                      ? '0 2px 8px rgba(59, 130, 246, 0.4), 0 0 16px rgba(59, 130, 246, 0.2)'
                      : '0 2px 8px rgba(251, 191, 36, 0.4), 0 0 16px rgba(251, 191, 36, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Active Icon */}
                {theme === 'dark' ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                )}
              </div>
            </button>
            {/* Notifications dropdown component */}
            <NotificationsDropdown />
            {/* Settings dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                id="settings-button"
                className="btn grid place-items-center p-0"
                title="Settings"
                aria-label="Settings"
                onClick={() => {
                  setShowSettingsDropdown((prev) => !prev)
                  setSettingsView('main')
                }}
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
                  cursor: 'pointer',
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
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
              {showSettingsDropdown && (
                <div
                  id="settings-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    right: 0,
                    width: '320px',
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: '24px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    backdropFilter: 'blur(20px)',
                    animation: 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                  }}
                >
                  {settingsView === 'main' ? (
                    <>
                      {/* User info header */}
                      <div
                        style={{
                          padding: '24px',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          background:
                            'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08))',
                        }}
                      >
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '16px',
                            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '24px',
                            fontWeight: 600,
                            color: '#fff',
                            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)',
                          }}
                        >
                          {((me.firstName || '')[0] || (me.lastName || '')[0] || 'U').toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '4px' }}>
                            {`${me.firstName || ''} ${me.lastName || ''}`.trim() || 'User'}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--muted)', opacity: 0.8 }}>
                            {me.email || ''}
                          </div>
                        </div>
                      </div>

                      {/* Menu items */}
                      <div style={{ padding: '12px', display: 'grid', gap: '4px' }}>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setSettingsView('nav')
                          }}
                          className="menu-item-btn"
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            color: 'var(--fg)',
                            borderRadius: '16px',
                            transition: 'all 0.2s ease',
                            fontSize: '14px',
                            fontWeight: 500,
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = 'var(--panel-2)')
                          }
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 10,
                              background: 'rgba(59, 130, 246, 0.1)',
                              color: '#3b82f6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
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
                              <line x1="3" y1="12" x2="21" y2="12"></line>
                              <line x1="3" y1="6" x2="21" y2="6"></line>
                              <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>Navigation</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              Customize menu
                            </div>
                          </div>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ opacity: 0.5 }}
                          >
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        </button>

                        <button
                          onClick={() => {
                            setShowSettingsDropdown(false)
                            navigate('/user/profile-settings')
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            color: 'var(--fg)',
                            borderRadius: '16px',
                            transition: 'all 0.2s ease',
                            fontSize: '14px',
                            fontWeight: 500,
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = 'var(--panel-2)')
                          }
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 10,
                              background: 'rgba(168, 85, 247, 0.1)',
                              color: '#a855f7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
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
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                              <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>Profile</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              Account settings
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            setShowSettingsDropdown(false)
                            navigate('/user/change-password')
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            color: 'var(--fg)',
                            borderRadius: '16px',
                            transition: 'all 0.2s ease',
                            fontSize: '14px',
                            fontWeight: 500,
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = 'var(--panel-2)')
                          }
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 10,
                              background: 'rgba(16, 185, 129, 0.1)',
                              color: '#10b981',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
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
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          </span>
                          <span>Change Password</span>
                        </button>

                        <button
                          onClick={() => {
                            setShowSettingsDropdown(false)
                            navigate('/user/api-setup')
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            color: 'var(--fg)',
                            borderRadius: '16px',
                            transition: 'all 0.2s ease',
                            fontSize: '14px',
                            fontWeight: 500,
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = 'var(--panel-2)')
                          }
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 10,
                              background: 'rgba(245, 158, 11, 0.1)',
                              color: '#f59e0b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
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
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="2" x2="12" y2="6" />
                              <line x1="12" y1="18" x2="12" y2="22" />
                              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                            </svg>
                          </span>
                          <span>API Setup</span>
                        </button>

                        <div
                          style={{
                            padding: '16px',
                            margin: '8px 0',
                            borderTop: '1px solid var(--border)',
                            borderBottom: '1px solid var(--border)',
                            background: 'rgba(99, 102, 241, 0.02)',
                            borderRadius: '12px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              marginBottom: '12px',
                              color: 'var(--muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Theme
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(6, 1fr)',
                              gap: '8px',
                            }}
                          >
                            {navPresets.map((p) => (
                              <button
                                key={p.title}
                                type="button"
                                title={p.title}
                                aria-label={p.title}
                                onClick={() => applyNavColors(p.cfg)}
                                style={{
                                  width: '100%',
                                  aspectRatio: '1',
                                  borderRadius: '8px',
                                  border: '2px solid rgba(255,255,255,0.1)',
                                  cursor: 'pointer',
                                  background: p.sample,
                                  padding: 0,
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.1)'
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)'
                                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setShowSettingsDropdown(false)
                            doLogout()
                          }}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '14px',
                            fontWeight: 500,
                            borderRadius: '16px',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 10,
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
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
                              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                              <polyline points="16 17 21 12 16 7" />
                              <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                          </span>
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Navigation Settings Header */}
                      <div
                        style={{
                          padding: '20px',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          background: 'var(--panel-2)',
                        }}
                      >
                        <button
                          onClick={() => setSettingsView('main')}
                          title="Back to Settings"
                          aria-label="Back to Settings"
                          style={{
                            background: 'var(--panel)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                            padding: '8px',
                            borderRadius: '10px',
                            color: 'var(--fg)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
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
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                          </svg>
                        </button>
                        <div style={{ fontWeight: 600, fontSize: '16px' }}>
                          Navigation Visibility
                        </div>
                      </div>

                      {/* Navigation Items List */}
                      <div style={{ padding: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                        {links.map((link) => renderToggleItem(link))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div
          className={`container ${location.pathname.includes('/inbox/whatsapp') ? 'edge-to-edge' : ''}`}
        >
          <Outlet />
        </div>
        {/* Mobile bottom tabs removed for user panel */}
      </div>
      {/* Settings Modal */}
      <Modal
        title="Settings"
        open={showSettings}
        onClose={() => {
          setShowSettings(false)
          setTestMsg('')
        }}
        footer={
          <>
            <button type="button" className="btn secondary" onClick={doLogout}>
              Logout
            </button>
            <button
              className="btn"
              onClick={() => {
                setTestMsg('Settings saved')
                setTimeout(() => setTestMsg(''), 1500)
              }}
            >
              Done
            </button>
          </>
        }
      >
        <div className="section" style={{ display: 'grid', gap: 16 }}>
          <div className="card" style={{ display: 'grid', gap: 8 }}>
            <div
              className="card-title"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span>API Setup</span>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setShowSettings(false)
                  navigate('/user/api-setup')
                }}
                title="Open API Setup"
              >
                Open
              </button>
            </div>
            <div className="card-subtitle">
              Configure AI and Maps API keys for product generation and geocoding.
            </div>
          </div>

          <div className="card" style={{ display: 'grid', gap: 8 }}>
            <div
              className="card-title"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span>Error Logs</span>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setShowSettings(false)
                  navigate('/user/error-logs')
                }}
                title="View Error Logs"
              >
                Open
              </button>
            </div>
            <div className="card-subtitle">
              View and manage system error logs and debugging information.
            </div>
          </div>

          {testMsg && (
            <div className="helper" style={{ fontWeight: 600 }}>
              {testMsg}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
