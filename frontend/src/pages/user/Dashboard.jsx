import React, { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Chart from '../../components/Chart.jsx'
import LiveNumber from '../../components/LiveNumber.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode, convert } from '../../util/currency'

// ============================================
// EXTREME PREMIUM DASHBOARD COMPONENTS
// ============================================

// --- Premium Tab Component ---
const TabsComponent = ({ tabs, activeTab, setActiveTab }) => (
  <div className="flex gap-2 overflow-x-auto rounded-2xl bg-gradient-to-r from-slate-100 to-slate-50 p-1.5 shadow-inner dark:from-neutral-800/50 dark:to-neutral-900/50">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`relative rounded-xl px-6 py-3 text-sm font-semibold tracking-wide whitespace-nowrap transition-all duration-300 ${
          activeTab === tab.id
            ? 'bg-white text-violet-600 shadow-lg shadow-violet-100 dark:bg-gradient-to-br dark:from-violet-600 dark:to-purple-700 dark:text-white dark:shadow-violet-500/30'
            : 'text-slate-500 hover:bg-white/60 hover:text-slate-800 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white'
        }`}
      >
        {tab.label}
        {activeTab === tab.id && (
          <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 dark:from-violet-400 dark:to-purple-400" />
        )}
      </button>
    ))}
  </div>
)

// --- Compact Metric Badge (for hero section - always on gradient) ---
const MetricBadge = ({ icon, label, value, prefix = '', className = '', loading = false }) => (
  <div
    className={`group relative overflow-hidden rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/25 hover:shadow-xl ${className}`}
  >
    <div className="absolute -top-1 -right-1 text-3xl opacity-10 transition-transform group-hover:scale-110 group-hover:opacity-20">
      {icon}
    </div>
    <p className="text-[10px] font-semibold tracking-widest text-white/80 uppercase">{label}</p>
    {loading ? (
      <div className="mt-2 h-6 w-20 animate-pulse rounded-lg bg-white/20" />
    ) : (
      <p className="mt-1 text-lg font-bold text-white">
        {prefix && <span className="mr-1 text-sm opacity-80">{prefix}</span>}
        {value}
      </p>
    )}
  </div>
)

// --- Extreme Premium Glass Card ---
const GlassCard = ({ children, className = '', title, subtitle, gradient = false }) => (
  <div
    className={`group relative overflow-hidden rounded-3xl transition-all duration-500 ${
      gradient
        ? 'bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 p-[1px] shadow-2xl shadow-violet-500/20'
        : 'border border-slate-200/60 bg-white shadow-xl shadow-slate-200/40 dark:border-neutral-700/40 dark:bg-neutral-900 dark:shadow-neutral-950/50'
    } ${className}`}
  >
    <div className={gradient ? 'rounded-3xl bg-white p-6 dark:bg-neutral-900' : 'p-6'}>
      {(title || subtitle) && (
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-neutral-800">
          <div>
            {title && (
              <h3 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-neutral-400">{subtitle}</p>
            )}
          </div>
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      )}
      {children}
    </div>
  </div>
)

// --- Extreme Premium Stat Card ---
const CompactStatCard = ({ title, value, to, icon, loading, accent = 'violet' }) => {
  const accentColors = {
    violet: 'from-violet-500 to-purple-600',
    emerald: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-500 to-orange-600',
    rose: 'from-rose-500 to-pink-600',
    sky: 'from-sky-500 to-blue-600',
    slate: 'from-slate-500 to-slate-700',
  }

  const Content = (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 shadow-lg shadow-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-100/50 dark:border-neutral-700/40 dark:bg-neutral-800/80 dark:shadow-none dark:hover:bg-neutral-800">
      <div
        className={`absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br ${accentColors[accent]} opacity-10 blur-2xl transition-all group-hover:opacity-20`}
      />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${accentColors[accent]} text-white shadow-sm`}
          >
            {icon || (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            )}
          </div>
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-neutral-400">
            {title}
          </p>
        </div>
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-neutral-700" />
        ) : (
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
        )}
      </div>
    </div>
  )

  if (to && !loading) {
    return (
      <NavLink to={to} className="block">
        {Content}
      </NavLink>
    )
  }

  return Content
}

// --- Premium Pie Chart ---
const PremiumPieChart = ({ statusTotals, loading }) => {
  if (loading || !statusTotals) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="h-48 w-48 animate-pulse rounded-full bg-slate-100 dark:bg-neutral-800" />
        <div className="grid w-full grid-cols-2 gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-slate-100 dark:bg-neutral-800" />
          ))}
        </div>
      </div>
    )
  }

  const statuses = [
    { key: 'pending', label: 'Open', color: '#f59e0b' },
    { key: 'assigned', label: 'Assigned', color: '#3b82f6' },
    { key: 'picked_up', label: 'Picked Up', color: '#8b5cf6' },
    { key: 'in_transit', label: 'In Transit', color: '#06b6d4' },
    { key: 'out_for_delivery', label: 'Out Delivery', color: '#f97316' },
    { key: 'delivered', label: 'Delivered', color: '#10b981' },
    { key: 'cancelled', label: 'Cancelled', color: '#ef4444' },
    { key: 'returned', label: 'Returned', color: '#64748b' },
    { key: 'no_response', label: 'No Response', color: '#dc2626' },
  ]

  const total = statuses.reduce((sum, s) => sum + (statusTotals[s.key] || 0), 0)
  let cumulativePercent = 0

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative aspect-square w-full max-w-[200px]">
        <svg viewBox="0 0 100 100" className="rotate-[-90deg] drop-shadow-lg">
          {statuses.map((status, i) => {
            const value = statusTotals[status.key] || 0
            const percent = total > 0 ? (value / total) * 100 : 0
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
                stroke={status.color}
                strokeWidth="24"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700 ease-out"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase dark:text-neutral-500">
            Total
          </p>
          <p className="text-3xl font-bold text-slate-800 dark:text-white">
            {total.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2">
        {statuses.map((status) => {
          const value = statusTotals[status.key] || 0
          if (value === 0) return null
          return (
            <div
              key={status.key}
              className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800/50"
            >
              <div
                className="h-3 w-3 rounded-full shadow-sm"
                style={{ backgroundColor: status.color }}
              />
              <span className="text-xs font-medium text-slate-600 dark:text-neutral-300">
                {status.label}:
                <span className="ml-1 font-bold text-slate-800 dark:text-white">{value}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
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
  const [activeTab, setActiveTab] = useState('orders')

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

  const formatCurrency = (amount, country) => {
    const cur = COUNTRY_INFO[country]?.cur || 'AED'
    return `${cur} ${fmtAmt(amount || 0)}`
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

  const tabs = [
    { id: 'orders', label: 'Orders' },
    { id: 'products', label: 'Products' },
    { id: 'countries', label: 'Countries' },
  ]

  return (
    <div className="min-h-screen bg-white px-4 py-6 dark:bg-neutral-950">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      <div className="mx-auto max-w-[1800px] space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="animate-fadeInUp">
            <h1 className="bg-gradient-to-r from-slate-800 via-violet-700 to-purple-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:via-violet-400 dark:to-purple-400">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
              Your Business Command Center
            </p>
          </div>

          <div
            className="animate-fadeInUp flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-white p-2 shadow-lg shadow-slate-100 dark:border-neutral-700/40 dark:bg-neutral-800/80 dark:shadow-none"
            style={{ animationDelay: '100ms' }}
          >
            <select
              className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-violet-300 hover:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:hover:border-violet-500"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <div className="h-8 w-px bg-slate-200 dark:bg-neutral-600" />
            <select
              className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-violet-300 hover:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:hover:border-violet-500"
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

        {/* Hero - Profit/Loss */}
        {loading ? (
          <div className="h-40 animate-pulse rounded-3xl bg-gradient-to-r from-slate-200 to-slate-100 dark:from-neutral-800 dark:to-neutral-700" />
        ) : metrics?.profitLoss ? (
          <div
            className={`animate-fadeInUp relative overflow-hidden rounded-3xl p-8 shadow-2xl ${
              metrics.profitLoss.isProfit
                ? 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 shadow-emerald-500/25'
                : 'bg-gradient-to-br from-rose-500 via-rose-600 to-pink-600 shadow-rose-500/25'
            }`}
            style={{ animationDelay: '150ms' }}
          >
            {/* Decorative elements */}
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute top-8 right-8 h-32 w-32 rounded-full border border-white/10" />
            <div className="absolute top-12 right-12 h-24 w-24 rounded-full border border-white/10" />

            <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
              <div className="flex-1">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 backdrop-blur-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  <span className="text-xs font-semibold tracking-widest text-white uppercase">
                    {metrics.profitLoss.isProfit ? 'Net Profit' : 'Net Loss'}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-xl font-medium text-white/80">AED</span>
                  <span className="text-5xl font-bold tracking-tight text-white drop-shadow-lg md:text-6xl">
                    <LiveNumber
                      value={Math.abs(metrics.profitLoss.profit || 0)}
                      maximumFractionDigits={2}
                    />
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-white/70">
                  {monthNames[selectedMonth - 1]} {selectedYear}
                </p>
              </div>

              <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:w-auto lg:grid-cols-6">
                {[
                  { label: 'Revenue', val: metrics.profitLoss.revenue, icon: '💰' },
                  { label: 'Cost', val: metrics.profitLoss.purchaseCost, icon: '📦' },
                  { label: 'Driver', val: metrics.profitLoss.driverCommission, icon: '🚚' },
                  { label: 'Agent', val: metrics.profitLoss.agentCommission, icon: '🤝' },
                  { label: 'Investor', val: metrics.profitLoss.investorCommission, icon: '📈' },
                  { label: 'Ads', val: metrics.profitLoss.advertisementExpense, icon: '📢' },
                ].map((item) => (
                  <MetricBadge
                    key={item.label}
                    icon={item.icon}
                    label={item.label}
                    value={<LiveNumber value={item.val || 0} maximumFractionDigits={0} />}
                    prefix="AED"
                    loading={loading}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Main Grid */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Sales Trend */}
            <GlassCard
              title="Sales Trend"
              subtitle="Last 7 days performance"
              className="animate-fadeInUp"
              style={{ animationDelay: '200ms' }}
            >
              <div className="h-[400px] w-full rounded-2xl bg-white p-4 dark:bg-neutral-800/50">
                {!hydrated || loading ? (
                  <div className="h-full w-full animate-pulse rounded-xl bg-slate-100 dark:bg-neutral-700" />
                ) : (
                  <Chart analytics={analytics} />
                )}
              </div>
            </GlassCard>

            {/* Geographic Performance */}
            <GlassCard
              title="Geographic Performance"
              subtitle="Country-wise breakdown"
              className="animate-fadeInUp"
              style={{ animationDelay: '250ms' }}
            >
              {loading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-36 animate-pulse rounded-2xl bg-slate-100 dark:bg-neutral-800"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {['KSA', 'UAE', 'Oman', 'Bahrain'].map((c) => {
                    const profitData = metrics?.profitLoss?.byCountry?.[c]
                    if (!profitData) return null
                    const isProfit = (profitData.profit || 0) >= 0
                    const flag = COUNTRY_INFO[c]?.flag || ''

                    return (
                      <div
                        key={c}
                        className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                          isProfit
                            ? 'border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-white shadow-emerald-100 dark:border-emerald-800/40 dark:from-emerald-950/30 dark:to-neutral-900'
                            : 'border-rose-200/60 bg-gradient-to-br from-rose-50 to-white shadow-rose-100 dark:border-rose-800/40 dark:from-rose-950/30 dark:to-neutral-900'
                        }`}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl drop-shadow-sm">{flag}</span>
                            <span className="font-bold text-slate-800 dark:text-white">{c}</span>
                          </div>
                          <span
                            className={`text-xl font-bold ${
                              isProfit
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isProfit ? '+' : '-'}
                            {fmtAmt(Math.abs(profitData.profit || 0))}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-lg bg-white/60 p-2 dark:bg-neutral-800/60">
                            <p className="text-xs font-medium text-slate-500 dark:text-neutral-400">
                              Revenue
                            </p>
                            <p className="font-bold text-slate-800 dark:text-white">
                              {fmtAmt(profitData.revenue)}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white/60 p-2 dark:bg-neutral-800/60">
                            <p className="text-xs font-medium text-slate-500 dark:text-neutral-400">
                              Cost
                            </p>
                            <p className="font-bold text-slate-800 dark:text-white">
                              {fmtAmt(profitData.purchaseCost)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Order Status */}
            <GlassCard
              title="Order Status"
              subtitle="Distribution overview"
              className="animate-fadeInUp"
              style={{ animationDelay: '300ms' }}
            >
              <PremiumPieChart statusTotals={statusTotals} loading={loading} />
            </GlassCard>

            {/* Quick Stats */}
            <GlassCard
              title="Quick Stats"
              subtitle="Key metrics"
              className="animate-fadeInUp"
              style={{ animationDelay: '350ms' }}
            >
              <div className="space-y-3">
                <CompactStatCard
                  title="Total Orders"
                  value={<LiveNumber value={statusTotals?.total || 0} maximumFractionDigits={0} />}
                  to="/user/orders"
                  accent="violet"
                  loading={loading}
                />
                <CompactStatCard
                  title="Delivered"
                  value={
                    <LiveNumber value={statusTotals?.delivered || 0} maximumFractionDigits={0} />
                  }
                  to="/user/orders?ship=delivered"
                  accent="emerald"
                  loading={loading}
                />
                <CompactStatCard
                  title="Open Orders"
                  value={
                    <LiveNumber value={statusTotals?.pending || 0} maximumFractionDigits={0} />
                  }
                  to="/user/orders?ship=open"
                  accent="amber"
                  loading={loading}
                />
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Tabbed Metrics Section */}
        <GlassCard className="animate-fadeInUp" style={{ animationDelay: '400ms' }}>
          <TabsComponent tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

          <div key={activeTab} className="mt-6">
            {activeTab === 'orders' && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                {[
                  {
                    title: 'Total Amount',
                    value: <LiveNumber value={sumAmountAED('amountTotalOrders')} prefix="AED " />,
                    to: '/user/orders',
                    accent: 'violet',
                  },
                  {
                    title: 'Delivered Amt',
                    value: <LiveNumber value={sumAmountAED('amountDelivered')} prefix="AED " />,
                    to: '/user/orders?ship=delivered',
                    accent: 'emerald',
                  },
                  {
                    title: 'Open Amount',
                    value: <LiveNumber value={sumAmountAED('amountPending')} prefix="AED " />,
                    to: '/user/orders?ship=open',
                    accent: 'amber',
                  },
                  {
                    title: 'Assigned',
                    value: (
                      <LiveNumber value={statusTotals?.assigned || 0} maximumFractionDigits={0} />
                    ),
                    to: '/user/orders?ship=assigned',
                    accent: 'sky',
                  },
                  {
                    title: 'In Transit',
                    value: (
                      <LiveNumber value={statusTotals?.in_transit || 0} maximumFractionDigits={0} />
                    ),
                    to: '/user/orders?ship=in_transit',
                    accent: 'sky',
                  },
                  {
                    title: 'Cancelled',
                    value: (
                      <LiveNumber value={statusTotals?.cancelled || 0} maximumFractionDigits={0} />
                    ),
                    to: '/user/orders?ship=cancelled',
                    accent: 'rose',
                  },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="animate-fadeInUp"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <CompactStatCard {...stat} loading={loading} />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'products' && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                {[
                  {
                    title: 'Total Value',
                    value: (
                      <LiveNumber
                        value={sumCurrencyMapAED(
                          metrics?.productMetrics?.global?.totalPurchaseValueByCurrency
                        )}
                        prefix="AED "
                      />
                    ),
                    to: '/user/inhouse-products',
                    accent: 'violet',
                  },
                  {
                    title: 'Inventory',
                    value: (
                      <LiveNumber
                        value={sumCurrencyMapAED(
                          metrics?.productMetrics?.global?.purchaseValueByCurrency
                        )}
                        prefix="AED "
                      />
                    ),
                    to: '/user/inhouse-products',
                    accent: 'sky',
                  },
                  {
                    title: 'Sold Value',
                    value: (
                      <LiveNumber
                        value={sumCurrencyMapAED(
                          metrics?.productMetrics?.global?.soldValueByCurrency
                        )}
                        prefix="AED "
                      />
                    ),
                    to: '/user/products',
                    accent: 'emerald',
                  },
                  {
                    title: 'All SKUs',
                    value: (
                      <LiveNumber
                        value={metrics?.productMetrics?.global?.count || 0}
                        maximumFractionDigits={0}
                      />
                    ),
                    to: '/user/inhouse-products',
                    accent: 'slate',
                  },
                  {
                    title: 'In Stock',
                    value: (
                      <LiveNumber
                        value={metrics?.productMetrics?.global?.inStock || 0}
                        maximumFractionDigits={0}
                      />
                    ),
                    to: '/user/inhouse-products',
                    accent: 'emerald',
                  },
                  {
                    title: 'Out of Stock',
                    value: (
                      <LiveNumber
                        value={metrics?.productMetrics?.global?.outOfStock || 0}
                        maximumFractionDigits={0}
                      />
                    ),
                    to: '/user/inhouse-products',
                    accent: 'rose',
                  },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="animate-fadeInUp"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <CompactStatCard {...stat} loading={loading} />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'countries' && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {COUNTRY_LIST.map((c, index) => {
                  const m = countryMetrics(c)
                  const flag = COUNTRY_INFO[c]?.flag || ''
                  const qs = encodeURIComponent(c)
                  const cur = COUNTRY_INFO[c]?.cur || 'AED'

                  return (
                    <div
                      key={c}
                      className="animate-fadeInUp group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50 p-5 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-neutral-700/40 dark:from-neutral-800 dark:to-neutral-900"
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      {/* Background Flag */}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                        <span className="text-[200px] opacity-[0.04] dark:opacity-[0.06]">
                          {flag}
                        </span>
                      </div>

                      <div className="relative z-10 mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-neutral-700">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl drop-shadow-sm">{flag}</span>
                          <span className="font-bold text-slate-800 dark:text-white">
                            {c === 'KSA' ? 'Saudi Arabia' : c}
                          </span>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-neutral-700 dark:text-neutral-300">
                          {cur}
                        </span>
                      </div>

                      <div className="relative z-10 grid grid-cols-2 gap-3">
                        {[
                          {
                            label: 'Orders',
                            value: fmtNum(m?.orders || 0),
                            to: `/user/orders?country=${qs}`,
                          },
                          {
                            label: 'Amount',
                            value: formatCurrency(m?.amountTotalOrders, c).replace(cur, '').trim(),
                          },
                          {
                            label: 'Delivered',
                            value: fmtNum(m?.delivered ?? m?.deliveredOrders ?? 0),
                            to: `/user/orders?country=${qs}&ship=delivered`,
                          },
                          {
                            label: 'Del Amt',
                            value: formatCurrency(m?.amountDelivered, c).replace(cur, '').trim(),
                          },
                          {
                            label: 'Open',
                            value: fmtNum(m?.pending || 0),
                            to: `/user/orders?country=${qs}&ship=open`,
                          },
                          {
                            label: 'Open Amt',
                            value: formatCurrency(m?.amountPending, c).replace(cur, '').trim(),
                          },
                        ].map((stat, i) =>
                          stat.to ? (
                            <NavLink
                              key={i}
                              to={stat.to}
                              className="rounded-xl border border-slate-100 bg-white/80 p-3 text-center transition-all hover:border-violet-200 hover:bg-violet-50 dark:border-neutral-700 dark:bg-neutral-800/80 dark:hover:border-violet-500/30 dark:hover:bg-neutral-700"
                            >
                              <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:text-neutral-400">
                                {stat.label}
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
                                {stat.value}
                              </p>
                            </NavLink>
                          ) : (
                            <div
                              key={i}
                              className="rounded-xl border border-slate-100 bg-white/80 p-3 text-center dark:border-neutral-700 dark:bg-neutral-800/80"
                            >
                              <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:text-neutral-400">
                                {stat.label}
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
                                {stat.value}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
