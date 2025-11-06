import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import AdminLayout from './layout/AdminLayout.jsx'
import UserLayout from './layout/UserLayout.jsx'
import AgentLayout from './layout/AgentLayout.jsx'
import ManagerLayout from './layout/ManagerLayout.jsx'

import AdminDashboard from './pages/admin/Dashboard.jsx'
import AdminUsers from './pages/admin/Users.jsx'
import Branding from './pages/admin/Branding.jsx'
import BannerManager from './pages/admin/BannerManager.jsx'
import ThemeSettings from './pages/admin/ThemeSettings.jsx'
import SEOManager from './pages/admin/SEOManager.jsx'
import PageManager from './pages/admin/PageManager.jsx'
import NavigationMenu from './pages/admin/NavigationMenu.jsx'
// import AISettings from './pages/admin/AISettings.jsx'

import UserLogin from './pages/user/Login.jsx'
import UserDashboard from './pages/user/Dashboard.jsx'
import Campaign from './pages/user/Campaign.jsx'

import AgentDashboard from './pages/agent/Dashboard.jsx'
import ManagerDashboard from './pages/manager/Dashboard.jsx'
import ManagerOrders from './pages/manager/Orders.jsx'
import ManagerDriverFinances from './pages/manager/DriverFinances.jsx'
import ManagerDriverAmounts from './pages/manager/DriverAmounts.jsx'
import ManagerCreateDriver from './pages/manager/CreateDriver.jsx'
import AgentRemitHistory from './pages/manager/AgentRemitHistory.jsx'
import ManagerExpenses from './pages/manager/Expenses.jsx'
import AgentInhouseProducts from './pages/agent/AgentInhouseProducts.jsx'
import InvestorDashboard from './pages/investor/Dashboard.jsx'
import InvestorMe from './pages/investor/Me.jsx'
import InvestorLayout from './layout/InvestorLayout.jsx'
import DriverLayout from './layout/DriverLayout.jsx'
import AgentOrdersHistory from './pages/agent/OrdersHistory.jsx'
import AgentProfile from './pages/agent/Profile.jsx'
import AgentPayout from './pages/agent/Payout.jsx'
import DriverProfile from './pages/driver/Profile.jsx'

import WhatsAppConnect from './pages/inbox/WhatsAppConnect.jsx'
import WhatsAppInbox from './pages/inbox/WhatsAppInbox.jsx'

import Agents from './pages/user/Agents.jsx'
import Managers from './pages/user/Managers.jsx'
import Investors from './pages/user/Investors.jsx'
import Drivers from './pages/user/Drivers.jsx'
import Notifications from './pages/user/Notifications.jsx'
import DriverDashboard from './pages/driver/Dashboard.jsx'
import DriverPanel from './pages/driver/DriverPanel.jsx'
import DriverMe from './pages/driver/Me.jsx'
import DriverPayout from './pages/driver/Payout.jsx'
import DriverAssigned from './pages/driver/Assigned.jsx'
import DriverPicked from './pages/driver/Picked.jsx'
import DriverDelivered from './pages/driver/Delivered.jsx'
import DriverCancelled from './pages/driver/Cancelled.jsx'
import DriverHistory from './pages/driver/History.jsx'
import UserOrders from './pages/user/Orders.jsx'
import UserAPISetup from './pages/user/APISetup.jsx'
import ProfileSettings from './pages/user/ProfileSettings.jsx'
import ShopifyIntegration from './pages/user/ShopifyIntegration.jsx'
import WebsiteModification from './pages/user/WebsiteModification.jsx'
import ErrorLogs from './pages/user/ErrorLogs.jsx'
import InhouseProducts from './pages/products/InhouseProducts.jsx'
import Warehouse from './pages/warehouse/Warehouse.jsx'
import Shipments from './pages/shipments/Shipments.jsx'
import Reports from './pages/user/Reports.jsx'
import DriverReports from './pages/user/DriverReports.jsx'
import Expenses from './pages/finance/Expenses.jsx'
import Transactions from './pages/finance/Transactions.jsx'
import Support from './pages/support/Support.jsx'
import AgentMe from './pages/agent/Me.jsx'
import PrintLabel from './pages/orders/PrintLabel.jsx'
import SubmitOrder from './pages/orders/SubmitOrder.jsx'
import EditOrder from './pages/orders/EditOrder.jsx'
import ProductCatalog from './pages/ecommerce/ProductCatalog.jsx'
import ProductDetail from './pages/ecommerce/ProductDetail.jsx'
import Checkout from './pages/store/Checkout.jsx'
import OnlineOrders from './pages/user/OnlineOrders.jsx'
import SiteHome from './pages/site/Home.jsx'
import SiteAbout from './pages/site/About.jsx'
import SiteContact from './pages/site/Contact.jsx'
import SiteCategories from './pages/site/Categories.jsx'
import UserFinances from './pages/user/Finances.jsx'
import UserManagerFinances from './pages/user/ManagerFinances.jsx'
import AgentAmounts from './pages/user/AgentAmounts.jsx'
import InvestorAmounts from './pages/user/InvestorAmounts.jsx'
import DriverAmounts from './pages/user/DriverAmounts.jsx'
import CurrencySettings from './pages/user/CurrencySettings.jsx'
import UserReturnedOrders from './pages/user/ReturnedOrders.jsx'
import ManagerReturnedOrders from './pages/manager/ReturnedOrders.jsx'
import UserProducts from './pages/user/Products.jsx'
import UserProductDetail from './pages/user/ProductDetail.jsx'

import AnalyticsDashboard from './components/analytics/AnalyticsDashboard'

import { apiGet } from './api.js'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'grid', placeItems: 'center', height: '100vh', padding: 20, textAlign: 'center' }}>
          <div style={{ display: 'grid', gap: 16, maxWidth: 600 }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>Something went wrong</div>
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>{this.state.error?.message || 'An unexpected error occurred'}</div>
            <button 
              className="btn" 
              onClick={() => { 
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function RequireAuth({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

function RequireRole({ roles = [], children }) {
  const [resolvedRole, setResolvedRole] = useState(() => {
    const me = JSON.parse(localStorage.getItem('me') || '{}')
    return me?.role || null
  })
  const [checking, setChecking] = useState(() => !resolvedRole)

  useEffect(() => {
    if (resolvedRole) return
    let alive = true
    ;(async () => {
      try {
        const { user } = await apiGet('/api/users/me')
        if (!alive) return
        const role = user?.role || null
        if (role) {
          localStorage.setItem('me', JSON.stringify(user))
          setResolvedRole(role)
        } else {
          setResolvedRole(null)
        }
      } catch {
        try {
          localStorage.clear()
        } catch {}
        setResolvedRole(null)
      } finally {
        if (alive) setChecking(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [resolvedRole])

  if (checking)
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: '#9aa4b2' }}>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
          <div className="spinner" />
          <div>Loading…</div>
        </div>
      </div>
    )
  const role = resolvedRole
  if (!roles.includes(role)) {
    if (role === 'agent') return <Navigate to="/agent" replace />
    if (role === 'manager') return <Navigate to="/manager" replace />
    if (role === 'investor') return <Navigate to="/investor" replace />
    if (role === 'admin' || role === 'user') return <Navigate to="/user" replace />
    return <Navigate to="/login" replace />
  }
  return children
}

function RequireManagerPerm({ perm, children }){
  const [me, setMe] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem('me')||'{}') }catch{ return {} }
  })
  const [checking, setChecking] = useState(true)
  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{
        const { user } = await apiGet('/api/users/me')
        if (!alive) return
        setMe(user||{})
        try{ localStorage.setItem('me', JSON.stringify(user||{})) }catch{}
      }catch{
        // fallback to local me
      }finally{
        if (alive) setChecking(false)
      }
    })()
    return ()=>{ alive = false }
  },[])
  if (checking) return null
  const allowed = !!(me?.managerPermissions && me.managerPermissions[perm])
  return allowed ? children : <Navigate to="/manager" replace />
}

// Custom Domain Router - redirects to catalog if accessing from custom domain
function CustomDomainRouter({ children }) {
  const [isCustomDomain, setIsCustomDomain] = useState(null)
  const [checking, setChecking] = useState(true)
  
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const hostname = window.location.hostname.toLowerCase()
        
        // Skip check for web.buysial.com and localhost
        if (hostname === 'web.buysial.com' || hostname === 'localhost' || hostname === '127.0.0.1') {
          if (alive) {
            setIsCustomDomain(false)
            setChecking(false)
          }
          return
        }
        
        // Check if this hostname is registered as a custom domain
        try {
          const response = await apiGet(`/api/users/by-domain/${hostname}`)
          if (alive && response?.userId) {
            setIsCustomDomain(true)
            // Store the store info for later use
            sessionStorage.setItem('customDomainStore', JSON.stringify(response))
          } else {
            setIsCustomDomain(false)
          }
        } catch (err) {
          // Domain not found in database, proceed normally
          setIsCustomDomain(false)
        }
      } catch (err) {
        console.error('Custom domain check failed:', err)
        setIsCustomDomain(false)
      } finally {
        if (alive) setChecking(false)
      }
    })()
    
    return () => { alive = false }
  }, [])
  
  if (checking) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: '#9aa4b2' }}>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
          <div className="spinner" />
          <div>Loading store...</div>
        </div>
      </div>
    )
  }
  
  // If custom domain, show catalog by default
  if (isCustomDomain) {
    return <ProductCatalog />
  }
  
  return children
}

export default function App() {
  return (
    <ErrorBoundary>
      <CustomDomainRouter>
        <Routes>
        {/* Public site pages */}
        <Route path="/" element={<Navigate to="/catalog" replace />} />
      <Route path="/about" element={<SiteAbout />} />
      <Route path="/contact" element={<SiteContact />} />
      <Route path="/categories" element={<SiteCategories />} />
      
      {/* Public ecommerce routes */}
      <Route path="/catalog" element={<ProductCatalog />} />
      <Route path="/product/:id" element={<ProductDetail />} />
      <Route path="/checkout" element={<Checkout />} />
      
      {/* Staff/Admin Login */}
      <Route path="/login" element={<UserLogin />} />

      {/* Print Label (standalone, minimal UI) */}
      <Route
        path="/label/:id"
        element={
          <RequireAuth>
            <PrintLabel />
          </RequireAuth>
        }
      />
      
      {/* Edit Order (pop-out window) */}
      <Route
        path="/orders/edit/:id"
        element={
          <RequireAuth>
            <EditOrder />
          </RequireAuth>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="inbox/connect" element={<WhatsAppConnect />} />
        <Route path="inbox/whatsapp" element={<WhatsAppInbox />} />
        <Route path="branding" element={<Branding />} />
        <Route path="banners" element={<BannerManager />} />
        <Route path="theme" element={<ThemeSettings />} />
        <Route path="seo" element={<SEOManager />} />
        <Route path="pages" element={<PageManager />} />
        <Route path="navigation" element={<NavigationMenu />} />
        {/** AI Settings moved to User panel */}
      </Route>

      <Route
        path="/driver"
        element={
          <RequireAuth>
            <RequireRole roles={['driver']}>
              <DriverLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<DriverDashboard />} />
        <Route path="panel" element={<DriverPanel />} />
        <Route path="orders/assigned" element={<DriverAssigned />} />
        <Route path="orders/picked" element={<DriverPicked />} />
        <Route path="orders/delivered" element={<DriverDelivered />} />
        <Route path="orders/cancelled" element={<DriverCancelled />} />
        <Route path="orders/history" element={<DriverHistory />} />
        <Route path="me" element={<DriverMe />} />
        <Route path="profile" element={<DriverProfile />} />
        <Route path="payout" element={<DriverPayout />} />
      </Route>

      <Route
        path="/investor"
        element={
          <RequireAuth>
            <RequireRole roles={['investor']}>
              <InvestorLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<InvestorDashboard />} />
        <Route path="me" element={<InvestorMe />} />
      </Route>

      <Route
        path="/manager"
        element={
          <RequireAuth>
            <RequireRole roles={['manager']}>
              <ManagerLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<ManagerDashboard />} />
        <Route path="inbox/whatsapp" element={<WhatsAppInbox />} />
        <Route path="agents" element={<Agents />} />
        <Route path="orders" element={<ManagerOrders />} />
        <Route path="orders/returned" element={<ManagerReturnedOrders />} />
        <Route path="drivers/create" element={<ManagerCreateDriver />} />
        <Route path="finances/history/agents" element={<AgentRemitHistory />} />
        <Route path="transactions/drivers" element={<ManagerDriverFinances />} />
        <Route path="driver-amounts" element={<ManagerDriverAmounts />} />
        <Route path="warehouses" element={<Warehouse />} />
        <Route path="inhouse-products" element={<InhouseProducts />} />
        <Route path="expenses" element={<ManagerExpenses />} />
      </Route>

      <Route
        path="/user"
        element={
          <RequireAuth>
            <RequireRole roles={['admin', 'user']}>
              <UserLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        <Route index element={<UserDashboard />} />
        <Route path="inbox/connect" element={<WhatsAppConnect />} />
        <Route path="inbox/whatsapp" element={<WhatsAppInbox />} />
        <Route path="agents" element={<Agents />} />
        <Route path="managers" element={<Managers />} />
        <Route path="investors" element={<Investors />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="campaigns" element={<Campaign />} />
        <Route path="orders" element={<UserOrders />} />
        <Route path="orders/returned" element={<UserReturnedOrders />} />
        <Route path="online-orders" element={<OnlineOrders />} />
        <Route path="inhouse-products" element={<InhouseProducts />} />
        <Route path="products" element={<UserProducts />} />
        <Route path="products/:id" element={<UserProductDetail />} />
        <Route path="warehouses" element={<Warehouse />} />
        <Route path="shipments" element={<Shipments />} />
        <Route path="reports" element={<Reports />} />
        <Route path="driver-reports" element={<DriverReports />} />
        <Route path="insights" element={<AnalyticsDashboard />} />
        <Route path="expense" element={<Expenses />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="manager-finances" element={<UserManagerFinances />} />
        <Route path="agent-amounts" element={<AgentAmounts />} />
        <Route path="investor-amounts" element={<InvestorAmounts />} />
        <Route path="driver-amounts" element={<DriverAmounts />} />
        <Route path="finances" element={<UserFinances />} />
        <Route path="currency" element={<CurrencySettings />} />
        <Route path="api-setup" element={<UserAPISetup />} />
        <Route path="profile-settings" element={<ProfileSettings />} />
        <Route path="shopify" element={<ShopifyIntegration />} />
        <Route path="website-modification" element={<WebsiteModification />} />
        <Route path="error-logs" element={<ErrorLogs />} />
        <Route path="support" element={<Support />} />
      </Route>

      <Route
        path="/agent"
        element={
          <RequireAuth>
            <RequireRole roles={['agent']}>
              <AgentLayout />
            </RequireRole>
          </RequireAuth>
        }
      >
        {/* Agent dashboard */}
        <Route index element={<AgentDashboard />} />
        <Route path="inbox/whatsapp" element={<WhatsAppInbox />} />
        <Route path="orders" element={<SubmitOrder />} />
        <Route path="orders/history" element={<AgentOrdersHistory />} />
        <Route path="inhouse-products" element={<AgentInhouseProducts />} />
        <Route path="me" element={<AgentMe />} />
        <Route path="profile" element={<AgentProfile />} />
        <Route path="payout" element={<AgentPayout />} />
        <Route path="support" element={<Support />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </CustomDomainRouter>
    </ErrorBoundary>
  )
}
