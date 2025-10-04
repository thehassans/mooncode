import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import AdminLayout from './layout/AdminLayout.jsx'
import UserLayout from './layout/UserLayout.jsx'
import AgentLayout from './layout/AgentLayout.jsx'
import ManagerLayout from './layout/ManagerLayout.jsx'

import AdminDashboard from './pages/admin/Dashboard.jsx'
import AdminUsers from './pages/admin/Users.jsx'
import Branding from './pages/admin/Branding.jsx'
// import AISettings from './pages/admin/AISettings.jsx'

import UserLogin from './pages/user/Login.jsx'
import UserDashboard from './pages/user/Dashboard.jsx'
import Campaign from './pages/user/Campaign.jsx'

import AgentDashboard from './pages/agent/Dashboard.jsx'
import ManagerDashboard from './pages/manager/Dashboard.jsx'
import ManagerOrders from './pages/manager/Orders.jsx'
import ManagerFinances from './pages/manager/Finances.jsx'
import ManagerCreateDriver from './pages/manager/CreateDriver.jsx'
import DriverRemitHistory from './pages/manager/DriverRemitHistory.jsx'
import AgentRemitHistory from './pages/manager/AgentRemitHistory.jsx'
import ManagerTransactions from './pages/manager/Transactions.jsx'
import AgentInhouseProducts from './pages/agent/AgentInhouseProducts.jsx'
import InvestorDashboard from './pages/investor/Dashboard.jsx'
import InvestorLayout from './layout/InvestorLayout.jsx'
import DriverLayout from './layout/DriverLayout.jsx'

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
import DriverOrdersList from './pages/driver/OrdersList.jsx'
import UserOrders from './pages/user/Orders.jsx'
import UserAPISetup from './pages/user/APISetup.jsx'
import ErrorLogs from './pages/user/ErrorLogs.jsx'
import InhouseProducts from './pages/products/InhouseProducts.jsx'
import Warehouse from './pages/warehouse/Warehouse.jsx'
import Shipments from './pages/shipments/Shipments.jsx'
import Reports from './pages/user/Reports.jsx'
import Expenses from './pages/finance/Expenses.jsx'
import Transactions from './pages/finance/Transactions.jsx'
import Support from './pages/support/Support.jsx'
import AgentMe from './pages/agent/Me.jsx'
import PrintLabel from './pages/orders/PrintLabel.jsx'
import SubmitOrder from './pages/orders/SubmitOrder.jsx'
import EditOrder from './pages/orders/EditOrder.jsx'
import Catalog from './pages/store/Catalog.jsx'
import Checkout from './pages/store/Checkout.jsx'
import UserFinances from './pages/user/Finances.jsx'

import AnalyticsDashboard from './components/analytics/AnalyticsDashboard'

import { apiGet } from './api.js'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }

function RequireManagerPerm({ perm, children }){
  const [me, setMe] = React.useState(()=>{
    try{ return JSON.parse(localStorage.getItem('me')||'{}') }catch{ return {} }
  })
  const [checking, setChecking] = React.useState(false)
  React.useEffect(()=>{
    if (!me || !me.role){
      setChecking(true)
      ;(async()=>{
        try{ const { user } = await apiGet('/api/users/me'); setMe(user||{}) }
        catch{}
        finally{ setChecking(false) }
      })()
    }
  },[])
  if (checking) return null
  const allowed = !!(me?.managerPermissions && me.managerPermissions[perm])
  return allowed ? children : <Navigate to="/manager" replace />
}
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

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
      {/* Root redirect to login */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* Public routes */}
      <Route path="/catalog" element={<Catalog />} />
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
        <Route path="orders" element={<DriverOrdersList />} />
        <Route path="panel" element={<DriverPanel />} />
        <Route path="me" element={<DriverMe />} />
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
        <Route path="agents" element={<RequireManagerPerm perm="canCreateAgents"><Agents /></RequireManagerPerm>} />
        <Route path="orders" element={<RequireManagerPerm perm="canCreateOrders"><ManagerOrders /></RequireManagerPerm>} />
        <Route path="finances" element={<ManagerFinances />} />
        <Route path="drivers/create" element={<RequireManagerPerm perm="canCreateDrivers"><ManagerCreateDriver /></RequireManagerPerm>} />
        <Route path="finances/history/drivers" element={<DriverRemitHistory />} />
        <Route path="finances/history/agents" element={<AgentRemitHistory />} />
        <Route path="transactions" element={<ManagerTransactions />} />
        <Route path="inhouse-products" element={<RequireManagerPerm perm="canManageProducts"><InhouseProducts /></RequireManagerPerm>} />
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
        <Route path="inhouse-products" element={<InhouseProducts />} />
        <Route path="warehouses" element={<Warehouse />} />
        <Route path="shipments" element={<Shipments />} />
        <Route path="reports" element={<Reports />} />
        <Route path="insights" element={<AnalyticsDashboard />} />
        <Route path="expense" element={<Expenses />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="finances" element={<UserFinances />} />
        <Route path="api-setup" element={<UserAPISetup />} />
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
        <Route path="inhouse-products" element={<AgentInhouseProducts />} />
        <Route path="me" element={<AgentMe />} />
        <Route path="support" element={<Support />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </ErrorBoundary>
  )
}
