import React, { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Chart from '../../components/Chart.jsx'
import LiveNumber from '../../components/LiveNumber.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode, convert } from '../../util/currency'

// ============================================
// CLEAN MODERN DASHBOARD COMPONENTS
// ============================================

// --- KPI Card (Purple Gradient) ---
const KpiCard = ({ icon, label, value, trend, loading = false }) => (
  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 p-5 text-white shadow-lg shadow-violet-500/20 transition-transform hover:-translate-y-0.5 hover:shadow-xl dark:shadow-violet-900/30">
    <div className="flex items-center gap-2 text-white/80">
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
    </div>
    {loading ? (
      <div className="mt-2 h-10 w-24 animate-pulse rounded-lg bg-white/20" />
    ) : (
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
    )}
    {trend && (
      <div
        className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
          trend.isPositive ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'
        }`}
      >
        {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%{' '}
        {trend.isPositive ? 'increase' : 'decrease'}
      </div>
    )}
  </div>
)

// --- Clean White Card ---
const Card = ({ children, className = '', title, icon }) => (
  <div
    className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 ${className}`}
  >
    {title && (
      <div className="mb-4 flex items-center gap-2 text-slate-700 dark:text-neutral-200">
        {icon && <span className="text-violet-600 dark:text-violet-400">{icon}</span>}
        <h3 className="font-semibold">{title}</h3>
      </div>
    )}
    {children}
  </div>
)

// --- Big Value Card ---
const BigValueCard = ({ icon, title, value, subtitle, loading }) => (
  <Card title={title} icon={icon}>
    {loading ? (
      <div className="h-12 w-32 animate-pulse rounded-lg bg-slate-100 dark:bg-neutral-800" />
    ) : (
      <>
        <p className="text-4xl font-bold text-slate-800 dark:text-white">{value}</p>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">{subtitle}</p>
        )}
      </>
    )}
  </Card>
)

// --- Pie Chart Component ---
const PieChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="mx-auto h-40 w-40 animate-pulse rounded-full bg-slate-100 dark:bg-neutral-800" />
    )
  }

  const total = data.reduce((sum, item) => sum + item.value, 0)
  let cumulativePercent = 0

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 100 100" className="rotate-[-90deg]">
          {data.map((item, i) => {
            const percent = total > 0 ? (item.value / total) * 100 : 0
            const offset = cumulativePercent
            cumulativePercent += percent
            if (percent === 0) return null
            const circumference = 2 * Math.PI * 38
            const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`
            const strokeDashoffset = -(offset / 100) * circumference
            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke={item.color}
                strokeWidth="24"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
              />
            )
          })}
        </svg>
      </div>
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-sm text-slate-600 dark:text-neutral-300">{item.label}</span>
            <span className="ml-auto text-sm font-semibold text-slate-800 dark:text-white">
              {total > 0 ? Math.round((item.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Status Badge ---
const StatBadge = ({ label, value, color, to }) => {
  const content = (
    <div className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800">
      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-sm text-slate-600 dark:text-neutral-400">{label}</span>
      <span className="ml-auto text-sm font-bold text-slate-800 dark:text-white">{value}</span>
    </div>
  )
  return to ? <NavLink to={to}>{content}</NavLink> : content
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [currencyCfg, setCurrencyCfg] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const toast = useToast()
  const loadSeqRef = useRef(0)
  const loadAbortRef = useRef(null)
  const monthDebounceRef = useRef(null)
  const reloadTimerRef = useRef(null)

  // Cache utilities
  const cacheKey = (type, params) => `dashboard_${type}_${params}`
  const cacheGet = (type, params) => {
    try {
      const cached = sessionStorage.getItem(cacheKey(type, params))
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  }
  const cacheSet = (type, params, data) => {
    try {
      sessionStorage.setItem(cacheKey(type, params), JSON.stringify(data))
    } catch (e) {
      console.warn('Cache storage failed:', e)
    }
  }

  // Constants
  const COUNTRY_LIST = ['KSA', 'UAE', 'Oman', 'Bahrain', 'India', 'Kuwait', 'Qatar']
  const COUNTRY_INFO = {
    KSA: { flag: '🇸🇦', cur: 'SAR' },
    UAE: { flag: '🇦🇪', cur: 'AED' },
    Oman: { flag: '🇴🇲', cur: 'OMR' },
    Bahrain: { flag: '🇧🇭', cur: 'BHD' },
    India: { flag: '🇮🇳', cur: 'INR' },
    Kuwait: { flag: '🇰🇼', cur: 'KWD' },
    Qatar: { flag: '🇶🇦', cur: 'QAR' },
  }

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const fmtNum = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })
  const fmtAmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })

  const countryMetrics = (c) => {
    if (!metrics?.countries || !metrics.countries[c]) return {}
    return metrics.countries[c]
  }

  const toAED = (amount, countryCode) => {
    try {
      return toAEDByCode(Number(amount || 0), String(countryCode || 'AED'), currencyCfg)
    } catch {
      return 0
    }
  }

  const sumCurrencyMapAED = (map) => {
    try {
      return Object.entries(map || {}).reduce(
        (s, [code, val]) => s + toAEDByCode(Number(val || 0), String(code || 'AED'), currencyCfg),
        0
      )
    } catch {
      return 0
    }
  }

  const sumAmountAED = (key) => {
    try {
      return COUNTRY_LIST.reduce((s, c) => s + toAED(countryMetrics(c)[key] || 0, c), 0)
    } catch {
      return 0
    }
  }

  const statusTotals = useMemo(() => {
    if (metrics?.statusTotals) return metrics.statusTotals
    return COUNTRY_LIST.reduce(
      (acc, c) => {
        const m = countryMetrics(c)
        acc.total += Number(m.orders || 0)
        acc.pending += Number(m.pending || 0)
        acc.assigned += Number(m.assigned || 0)
        acc.picked_up += Number(m.pickedUp || 0)
        acc.in_transit += Number(m.transit || 0)
        acc.out_for_delivery += Number(m.outForDelivery || 0)
        acc.delivered += Number(m.delivered || 0)
        acc.no_response += Number(m.noResponse || 0)
        acc.returned += Number(m.returned || 0)
        acc.cancelled += Number(m.cancelled || 0)
        return acc
      },
      {
        total: 0,
        pending: 0,
        assigned: 0,
        picked_up: 0,
        in_transit: 0,
        out_for_delivery: 0,
        delivered: 0,
        no_response: 0,
        returned: 0,
        cancelled: 0,
      }
    )
  }, [metrics, COUNTRY_LIST])

  const pieData = useMemo(
    () => [
      { label: 'Delivered', value: statusTotals.delivered || 0, color: '#10b981' },
      { label: 'Assigned', value: statusTotals.assigned || 0, color: '#3b82f6' },
      { label: 'Cancelled', value: statusTotals.cancelled || 0, color: '#ef4444' },
      { label: 'Returned', value: statusTotals.returned || 0, color: '#64748b' },
    ],
    [statusTotals]
  )

  const getMonthDateRange = () => {
    const UAE_OFFSET_HOURS = 4
    const startDate = new Date(
      Date.UTC(selectedYear, selectedMonth - 1, 1, -UAE_OFFSET_HOURS, 0, 0, 0)
    )
    const endDate = new Date(
      Date.UTC(selectedYear, selectedMonth, 0, 23 - UAE_OFFSET_HOURS, 59, 59, 999)
    )
    return { from: startDate.toISOString(), to: endDate.toISOString() }
  }

  async function load() {
    const dateRange = getMonthDateRange()
    const dateParams = `from=${encodeURIComponent(dateRange.from)}&to=${encodeURIComponent(dateRange.to)}`

    const seq = (loadSeqRef.current = loadSeqRef.current + 1)
    try {
      loadAbortRef.current?.abort()
    } catch {}
    const controller = new AbortController()
    loadAbortRef.current = controller

    const cachedMetrics = cacheGet('metrics', dateParams)
    if (cachedMetrics) {
      setMetrics(cachedMetrics)
      setLoading(false)
      setHydrated(true)
    } else {
      setLoading(true)
    }

    const cachedAnalytics = cacheGet('analytics', dateParams)
    if (cachedAnalytics) setAnalytics(cachedAnalytics)

    const cfgP = (currencyCfg ? Promise.resolve(currencyCfg) : getCurrencyConfig()).catch(
      () => null
    )
    const metricsP = apiGet(`/api/reports/user-metrics?${dateParams}`, {
      signal: controller.signal,
    }).catch(() => null)

    try {
      const [cfg, metricsRes] = await Promise.all([cfgP, metricsP])
      if (loadSeqRef.current !== seq) return
      setCurrencyCfg(cfg)
      if (metricsRes) {
        setMetrics(metricsRes)
        cacheSet('metrics', dateParams, metricsRes)
      }
      setHydrated(true)
      setLoading(false)

      apiGet(`/api/orders/analytics/last7days?${dateParams}`, { signal: controller.signal })
        .then((res) => {
          if (loadSeqRef.current !== seq) return
          if (res) {
            setAnalytics(res)
            cacheSet('analytics', dateParams, res)
          }
        })
        .catch(() => {})
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (monthDebounceRef.current) clearTimeout(monthDebounceRef.current)
    monthDebounceRef.current = setTimeout(load, 250)
    return () => clearTimeout(monthDebounceRef.current)
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    let socket
    try {
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, {
        path: '/socket.io',
        transports: ['polling'],
        upgrade: false,
        auth: { token },
        withCredentials: true,
      })
      const scheduleLoad = () => {
        if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
        reloadTimerRef.current = setTimeout(load, 450)
      }
      socket.on('orders.changed', scheduleLoad)
      socket.on('reports.userMetrics.updated', scheduleLoad)
      socket.on('orders.analytics.updated', scheduleLoad)
      socket.on('finance.drivers.updated', scheduleLoad)
    } catch {}
    return () => {
      try {
        socket?.disconnect()
      } catch {}
    }
  }, [toast])

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="min-h-screen bg-white px-6 py-6 dark:bg-neutral-950">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard</h1>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-violet-300 focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-violet-300 focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            icon="📦"
            label="Total Orders"
            value={<LiveNumber value={statusTotals.total || 0} maximumFractionDigits={0} />}
            loading={loading}
          />
          <KpiCard
            icon="💰"
            label="Revenue"
            value={
              <span className="flex items-baseline gap-1">
                <span className="text-lg opacity-70">AED</span>
                <LiveNumber value={metrics?.profitLoss?.revenue || 0} maximumFractionDigits={0} />
              </span>
            }
            loading={loading}
          />
          <KpiCard
            icon="📦"
            label="Cost"
            value={
              <span className="flex items-baseline gap-1">
                <span className="text-lg opacity-70">AED</span>
                <LiveNumber
                  value={metrics?.profitLoss?.purchaseCost || 0}
                  maximumFractionDigits={0}
                />
              </span>
            }
            loading={loading}
          />
          <KpiCard
            icon="✅"
            label="Delivered"
            value={<LiveNumber value={statusTotals.delivered || 0} maximumFractionDigits={0} />}
            trend={
              statusTotals.total > 0
                ? {
                    value: Math.round((statusTotals.delivered / statusTotals.total) * 100),
                    isPositive: true,
                  }
                : null
            }
            loading={loading}
          />
          <KpiCard
            icon="⏳"
            label="Pending"
            value={<LiveNumber value={statusTotals.pending || 0} maximumFractionDigits={0} />}
            loading={loading}
          />
          <KpiCard
            icon={metrics?.profitLoss?.isProfit ? '📈' : '📉'}
            label={metrics?.profitLoss?.isProfit ? 'Net Profit' : 'Net Loss'}
            value={
              <span className="flex items-baseline gap-1">
                <span className="text-lg opacity-70">AED</span>
                <LiveNumber
                  value={Math.abs(metrics?.profitLoss?.profit || 0)}
                  maximumFractionDigits={0}
                />
              </span>
            }
            loading={loading}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Sales Trend Chart (2 cols) */}
          <Card title="Sales Trend" icon="📊" className="lg:col-span-2">
            <div className="h-[350px]">
              {!hydrated || loading ? (
                <div className="h-full w-full animate-pulse rounded-lg bg-slate-100 dark:bg-neutral-800" />
              ) : (
                <Chart analytics={analytics} />
              )}
            </div>
          </Card>

          {/* Sales Summary */}
          <BigValueCard
            icon="💵"
            title="Sales"
            value={
              <span className="flex items-baseline gap-2">
                <LiveNumber value={sumAmountAED('amountDelivered')} maximumFractionDigits={0} />
                <span className="text-lg font-normal text-slate-500 dark:text-neutral-400">
                  AED
                </span>
              </span>
            }
            subtitle="Total delivered amount"
            loading={loading}
          />
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Order Status Pie */}
          <Card title="Order Status" icon="📋">
            <PieChart data={pieData} loading={loading} />
          </Card>

          {/* Quick Stats */}
          <Card title="Order Breakdown" icon="📊">
            <div className="space-y-1">
              <StatBadge
                label="Open"
                value={fmtNum(statusTotals.pending)}
                color="#f59e0b"
                to="/user/orders?ship=open"
              />
              <StatBadge
                label="Assigned"
                value={fmtNum(statusTotals.assigned)}
                color="#3b82f6"
                to="/user/orders?ship=assigned"
              />
              <StatBadge
                label="Picked Up"
                value={fmtNum(statusTotals.picked_up)}
                color="#8b5cf6"
                to="/user/orders?ship=picked_up"
              />
              <StatBadge
                label="Out for Delivery"
                value={fmtNum(statusTotals.out_for_delivery)}
                color="#f97316"
                to="/user/orders?ship=out_for_delivery"
              />
              <StatBadge
                label="Delivered"
                value={fmtNum(statusTotals.delivered)}
                color="#10b981"
                to="/user/orders?ship=delivered"
              />
              <StatBadge
                label="Cancelled"
                value={fmtNum(statusTotals.cancelled)}
                color="#ef4444"
                to="/user/orders?ship=cancelled"
              />
              <StatBadge
                label="Returned"
                value={fmtNum(statusTotals.returned)}
                color="#64748b"
                to="/user/orders?ship=returned"
              />
            </div>
          </Card>

          {/* Country Breakdown */}
          <Card title="Countries" icon="🌍">
            <div className="space-y-2">
              {COUNTRY_LIST.slice(0, 5).map((c) => {
                const m = countryMetrics(c)
                const flag = COUNTRY_INFO[c]?.flag
                return (
                  <NavLink
                    key={c}
                    to={`/user/orders?country=${encodeURIComponent(c)}`}
                    className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{flag}</span>
                      <span className="text-sm font-medium text-slate-700 dark:text-neutral-200">
                        {c}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-800 dark:text-white">
                      {fmtNum(m?.orders || 0)}
                    </span>
                  </NavLink>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
