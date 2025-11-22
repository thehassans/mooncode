import React, { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Chart from '../../components/Chart.jsx'
import LiveNumber from '../../components/LiveNumber.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode, convert } from '../../util/currency'

// --- Premium Tab Component ---
const TabsComponent = ({ tabs, activeTab, setActiveTab }) => (
  <div className="flex gap-2 overflow-x-auto rounded-2xl bg-slate-100/50 p-1.5 dark:bg-neutral-900/50">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`rounded-xl px-6 py-3 text-sm font-black tracking-wide whitespace-nowrap uppercase transition-all duration-300 ${
          activeTab === tab.id
            ? 'bg-gradient-to-br from-white to-slate-50 text-slate-900 shadow-lg dark:from-neutral-800 dark:to-neutral-900 dark:text-white'
            : 'text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white'
        }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
)

// --- Compact Metric Badge ---
const MetricBadge = ({ icon, label, value, prefix = '', className = '', loading = false }) => (
  <div
    className={`group relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white/20 dark:border-neutral-700/30 dark:bg-neutral-800/20 dark:hover:bg-neutral-700/30 ${className}`}
  >
    <div className="absolute -top-2 -right-2 text-4xl opacity-5 transition-transform group-hover:scale-110 group-hover:opacity-10">
      {icon}
    </div>
    <p className="text-[10px] font-black tracking-widest text-slate-600 uppercase dark:text-neutral-400">
      {label}
    </p>
    {loading ? (
      <div className="mt-2 h-6 w-20 animate-pulse rounded bg-slate-300 dark:bg-neutral-700" />
    ) : (
      <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
        {prefix && <span className="mr-1 text-sm opacity-60">{prefix}</span>}
        {value}
      </p>
    )}
  </div>
)

// --- Premium Stat Card ---
const PremiumStatCard = ({ icon: Icon, title, value, trend, to, loading }) => {
  const content = (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-black p-5 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-black dark:bg-black">
      <div className="absolute -top-2 -right-2 text-4xl opacity-5 transition-transform group-hover:scale-110 group-hover:opacity-10">
        {Icon && <Icon className="h-10 w-10" />}
      </div>
      <p className="text-[10px] font-black tracking-widest text-neutral-400 uppercase">{title}</p>
      {loading ? (
        <div className="mt-2 h-6 w-20 animate-pulse rounded bg-slate-300 dark:bg-neutral-700" />
      ) : (
        <p className="mt-1 text-lg font-black text-white">{value}</p>
      )}
      {trend && (
        <p
          className={`mt-1 text-xs font-bold ${trend.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}
        >
          {trend.isPositive ? '▲' : '▼'} {trend.value}%
        </p>
      )}
    </div>
  )

  if (to && !loading) {
    return <NavLink to={to}>{content}</NavLink>
  }
  return content
}

// --- Glass Card Container ---
const GlassCard = ({ children, className = '', title, subtitle }) => (
  <div
    className={`rounded-2xl border border-slate-200 bg-black p-5 shadow-lg dark:border-black dark:bg-black ${className}`}
  >
    {(title || subtitle) && (
      <div className="mb-4 border-b border-neutral-800 pb-3">
        {title && <h3 className="text-xl font-black tracking-tight text-white">{title}</h3>}
        {subtitle && <p className="mt-1 text-sm font-medium text-neutral-400">{subtitle}</p>}
      </div>
    )}
    {children}
  </div>
)

// --- Compact Stat Card ---
const CompactStatCard = ({
  title,
  value,
  to,
  color = 'text-slate-900 dark:text-white',
  loading,
}) => {
  const Content = (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">{title}</p>
      {loading ? (
        <div className="h-8 w-full animate-pulse rounded bg-slate-200 dark:bg-neutral-800" />
      ) : (
        <p className={`text-2xl font-black text-white`}>{value}</p>
      )}
    </div>
  )

  if (to && !loading) {
    return (
      <NavLink
        to={to}
        className="block rounded-xl border border-slate-200 bg-black p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-black dark:bg-black"
      >
        {Content}
      </NavLink>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-black p-4 dark:border-black dark:bg-black">
      {Content}
    </div>
  )
}

// --- Pie Chart Component ---
const PremiumPieChart = ({ statusTotals, loading }) => {
  if (loading || !statusTotals) {
    return (
      <div className="h-64 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-neutral-800" />
    )
  }

  const statuses = [
    { key: 'pending', label: 'Open', color: '#f59e0b' },
    { key: 'assigned', label: 'Assigned', color: '#3b82f6' },
    { key: 'picked_up', label: 'Picked Up', color: '#6366f1' },
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
    <div className="space-y-4">
      <div className="relative mx-auto aspect-square w-full max-w-[200px]">
        <svg viewBox="0 0 100 100" className="rotate-[-90deg]">
          {statuses.map((status, i) => {
            const value = statusTotals[status.key] || 0
            const percent = total > 0 ? (value / total) * 100 : 0
            const offset = cumulativePercent
            cumulativePercent += percent

            if (percent === 0) return null

            const circumference = 2 * Math.PI * 40
            const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`
            const strokeDashoffset = -(offset / 100) * circumference

            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={status.color}
                strokeWidth="20"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xs font-bold text-slate-500 uppercase dark:text-neutral-400">Total</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {total.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {statuses.map((status) => {
          const value = statusTotals[status.key] || 0
          if (value === 0) return null
          return (
            <div key={status.key} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
              <span className="text-xs font-bold text-slate-700 dark:text-neutral-300">
                {status.label}: {value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
    <div className="min-h-screen px-4 py-6">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
            filter: blur(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
        @keyframes fadeIn {
          from { 
            opacity: 0;
            filter: blur(5px);
          }
          to { 
            opacity: 1;
            filter: blur(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      <div className="mx-auto max-w-[1800px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-slate-600 dark:text-neutral-400">
              Your Business Command Center
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-black p-2 dark:border-black dark:bg-black">
            <select
              className="cursor-pointer rounded-xl border-none bg-gradient-to-br from-neutral-800 to-neutral-900 px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition-all hover:shadow-md focus:ring-2 focus:ring-violet-500 dark:from-neutral-800 dark:to-neutral-900 dark:text-white"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <div className="h-8 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent dark:via-neutral-700" />
            <select
              className="cursor-pointer rounded-xl border-none bg-gradient-to-br from-slate-50 to-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition-all hover:shadow-md focus:ring-2 focus:ring-violet-500 dark:from-neutral-800 dark:to-neutral-900 dark:text-white"
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

        {/* Compact Hero - Profit/Loss */}
        {loading ? (
          <div className="h-32 animate-pulse rounded-3xl bg-slate-200 dark:bg-neutral-800" />
        ) : metrics?.profitLoss ? (
          <div
            className={`relative overflow-hidden rounded-[2rem] p-8 shadow-2xl transition-all duration-500 ${
              metrics.profitLoss.isProfit
                ? 'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-800 shadow-emerald-500/20 dark:from-emerald-600 dark:via-teal-700 dark:to-emerald-900'
                : 'bg-gradient-to-br from-rose-500 via-red-600 to-rose-800 shadow-rose-500/20 dark:from-rose-600 dark:via-red-700 dark:to-rose-900'
            }`}
          >
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-black/10 blur-3xl" />

            <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
              <div className="flex-1">
                <div className="mb-2 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-black tracking-widest text-white uppercase backdrop-blur-md">
                  {metrics.profitLoss.isProfit ? 'Net Profit' : 'Net Loss'}
                </div>
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="text-xl font-black text-white/80">AED</span>
                  <span className="text-5xl font-black tracking-tighter text-white drop-shadow-2xl md:text-6xl">
                    <LiveNumber
                      value={Math.abs(metrics.profitLoss.profit || 0)}
                      maximumFractionDigits={2}
                    />
                  </span>
                </div>
                <p className="text-sm font-bold text-white/80">
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
          {/* Left Column - Charts */}
          <div className="space-y-6 lg:col-span-2">
            {/* Sales Trend */}
            <GlassCard title="Sales Trend" subtitle="Last 7 days performance">
              <div className="h-[400px] w-full">
                {!hydrated || loading ? (
                  <div className="h-full w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-neutral-800" />
                ) : (
                  <Chart analytics={analytics} />
                )}
              </div>
            </GlassCard>

            {/* Geographic Performance */}
            <GlassCard title="Geographic Performance" subtitle="Country-wise breakdown">
              {loading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-neutral-800"
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
                        className={`rounded-2xl border p-5 transition-all hover:-translate-y-1 hover:shadow-lg ${
                          isProfit
                            ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900/30 dark:from-emerald-950/50 dark:to-neutral-900'
                            : 'border-rose-200 bg-gradient-to-br from-rose-50 to-white dark:border-rose-900/30 dark:from-rose-950/50 dark:to-neutral-900'
                        }`}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{flag}</span>
                            <span className="font-black text-slate-900 dark:text-white">{c}</span>
                          </div>
                          <span
                            className={`text-xl font-black ${
                              isProfit
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isProfit ? '+' : '-'}
                            {fmtAmt(Math.abs(profitData.profit || 0))}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="font-bold text-slate-500 dark:text-neutral-400">
                              Revenue
                            </p>
                            <p className="font-black text-slate-900 dark:text-white">
                              {fmtAmt(profitData.revenue)}
                            </p>
                          </div>
                          <div>
                            <p className="font-bold text-slate-500 dark:text-neutral-400">Cost</p>
                            <p className="font-black text-slate-900 dark:text-white">
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

          {/* Right Column - Status & Quick Stats */}
          <div className="space-y-6">
            {/* Order Status Distribution */}
            <GlassCard title="Order Status" subtitle="Distribution overview">
              <PremiumPieChart statusTotals={statusTotals} loading={loading} />
            </GlassCard>

            {/* Quick Stats */}
            <GlassCard title="Quick Stats" subtitle="Key metrics">
              <div className="space-y-3">
                <CompactStatCard
                  title="Total Orders"
                  value={<LiveNumber value={statusTotals?.total || 0} maximumFractionDigits={0} />}
                  to="/user/orders"
                  color="text-sky-600 dark:text-sky-400"
                  loading={loading}
                />
                <CompactStatCard
                  title="Delivered"
                  value={
                    <LiveNumber value={statusTotals?.delivered || 0} maximumFractionDigits={0} />
                  }
                  to="/user/orders?ship=delivered"
                  color="text-emerald-600 dark:text-emerald-400"
                  loading={loading}
                />
                <CompactStatCard
                  title="Open Orders"
                  value={
                    <LiveNumber value={statusTotals?.pending || 0} maximumFractionDigits={0} />
                  }
                  to="/user/orders?ship=open"
                  color="text-amber-500 dark:text-amber-400"
                  loading={loading}
                />
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Tabbed Metrics Section */}
        <GlassCard>
          <TabsComponent tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

          <div key={activeTab} className="mt-6">
            {activeTab === 'orders' && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                {[
                  {
                    title: 'Total Amount',
                    value: <LiveNumber value={sumAmountAED('amountTotalOrders')} prefix="AED " />,
                    to: '/user/orders',
                    color: 'text-emerald-600 dark:text-emerald-400',
                    delay: 0,
                  },
                  {
                    title: 'Delivered Amt',
                    value: <LiveNumber value={sumAmountAED('amountDelivered')} prefix="AED " />,
                    to: '/user/orders?ship=delivered',
                    color: 'text-emerald-600 dark:text-emerald-400',
                  },
                  {
                    title: 'Open Amount',
                    value: <LiveNumber value={sumAmountAED('amountPending')} prefix="AED " />,
                    to: '/user/orders?ship=open',
                    color: 'text-orange-500 dark:text-orange-400',
                  },
                  {
                    title: 'Assigned',
                    value: (
                      <LiveNumber value={statusTotals?.assigned || 0} maximumFractionDigits={0} />
                    ),
                    to: '/user/orders?ship=assigned',
                    color: 'text-blue-600 dark:text-blue-400',
                  },
                  {
                    title: 'In Transit',
                    value: (
                      <LiveNumber value={statusTotals?.in_transit || 0} maximumFractionDigits={0} />
                    ),
                    to: '/user/orders?ship=in_transit',
                    color: 'text-cyan-600 dark:text-cyan-400',
                  },
                  {
                    title: 'Cancelled',
                    value: (
                      <LiveNumber value={statusTotals?.cancelled || 0} maximumFractionDigits={0} />
                    ),
                    to: '/user/orders?ship=cancelled',
                    color: 'text-rose-600 dark:text-rose-400',
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
                    color: 'text-violet-600 dark:text-violet-400',
                    delay: 0,
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
                    to: '/user/warehouses',
                    color: 'text-sky-600 dark:text-sky-400',
                  },
                  {
                    title: 'Delivered',
                    value: (
                      <LiveNumber
                        value={sumCurrencyMapAED(
                          metrics?.productMetrics?.global?.deliveredValueByCurrency
                        )}
                        prefix="AED "
                      />
                    ),
                    to: '/user/orders?ship=delivered',
                    color: 'text-emerald-600 dark:text-emerald-400',
                  },
                  {
                    title: 'Purchased Qty',
                    value: (
                      <LiveNumber
                        value={metrics?.productMetrics?.global?.stockPurchasedQty || 0}
                        maximumFractionDigits={0}
                      />
                    ),
                    to: '/user/inhouse-products',
                    color: 'text-sky-600 dark:text-sky-400',
                  },
                  {
                    title: 'Delivered Qty',
                    value: (
                      <LiveNumber
                        value={metrics?.productMetrics?.global?.stockDeliveredQty || 0}
                        maximumFractionDigits={0}
                      />
                    ),
                    to: '/user/orders?ship=delivered',
                    color: 'text-emerald-600 dark:text-emerald-400',
                  },
                  {
                    title: 'Stock Left',
                    value: (
                      <LiveNumber
                        value={metrics?.productMetrics?.global?.stockLeftQty || 0}
                        maximumFractionDigits={0}
                      />
                    ),
                    to: '/user/warehouses',
                    color: 'text-amber-500 dark:text-amber-400',
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
                      className="animate-fadeInUp relative overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-slate-50 p-5 transition-all hover:-translate-y-1 hover:shadow-lg dark:border-neutral-800/50 dark:from-neutral-900 dark:to-black"
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      {/* Full Background Flag with Glow */}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                        <span
                          className="text-[280px] opacity-[0.12] dark:opacity-[0.08]"
                          style={{
                            filter:
                              'drop-shadow(0 0 40px rgba(255, 255, 255, 0.3)) drop-shadow(0 0 80px rgba(255, 255, 255, 0.2))',
                            textShadow:
                              '0 0 60px rgba(255, 255, 255, 0.5), 0 0 120px rgba(255, 255, 255, 0.3)',
                          }}
                        >
                          {flag}
                        </span>
                      </div>

                      <div className="relative z-10 mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-neutral-800">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{flag}</span>
                          <span className="font-black text-slate-900 dark:text-white">
                            {c === 'KSA' ? 'Saudi Arabia' : c}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black dark:bg-neutral-800">
                            {cur}
                          </span>
                        </div>
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
                              className="rounded-lg border border-slate-200/30 bg-white/50 p-2 text-center hover:bg-white dark:border-neutral-800/30 dark:bg-neutral-900/50 dark:hover:bg-neutral-800/50"
                            >
                              <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase dark:text-neutral-400">
                                {stat.label}
                              </p>
                              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">
                                {stat.value}
                              </p>
                            </NavLink>
                          ) : (
                            <div
                              key={i}
                              className="rounded-lg border border-slate-200/30 bg-white/50 p-2 text-center dark:border-neutral-800/30 dark:bg-neutral-900/50"
                            >
                              <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase dark:text-neutral-400">
                                {stat.label}
                              </p>
                              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">
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
