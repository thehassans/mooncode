import React, { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Chart from '../../components/Chart.jsx'
import LiveNumber from '../../components/LiveNumber.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode, convert } from '../../util/currency'

// --- Premium UI Components ---

const GlassCard = ({ children, className = '', title, subtitle, loading = false, delay = 0 }) => (
  <div
    className={`group overflow-hidden rounded-3xl border border-white/20 bg-white/80 p-8 shadow-xl backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl dark:border-slate-700/50 dark:bg-slate-900/80 ${className}`}
    style={{ animationDelay: `${delay}ms` }}
  >
    {(title || subtitle) && (
      <div className="mb-8 border-b border-slate-100 pb-4 dark:border-slate-700">
        {loading ? (
          <>
            <div className="mb-2 h-7 w-56 animate-pulse rounded-lg bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800" />
            {subtitle && (
              <div className="h-4 w-40 animate-pulse rounded-lg bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800" />
            )}
          </>
        ) : (
          <>
            {title && (
              <h3 className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-2xl font-black tracking-tight text-transparent dark:from-white dark:to-slate-300">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </>
        )}
      </div>
    )}
    {children}
  </div>
)

const PremiumStatCard = ({
  title,
  value,
  to,
  colorClass = 'text-slate-900 dark:text-white',
  icon,
  loading = false,
  delay = 0,
}) => {
  const Content = () => (
    <div className="relative flex h-full flex-col justify-between">
      <div className="absolute -top-3 -right-3 opacity-10 transition-all duration-500 group-hover:scale-110 group-hover:opacity-20">
        {icon && React.createElement(icon, { className: 'w-24 h-24' })}
      </div>
      <p className="relative z-10 mb-3 text-sm font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
        {title}
      </p>
      {loading ? (
        <div
          className="h-10 w-32 animate-pulse rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] dark:from-slate-700 dark:via-slate-800 dark:to-slate-700"
          style={{ animation: 'shimmer 2s infinite' }}
        />
      ) : (
        <h3
          className={`relative z-10 text-4xl font-black tracking-tighter transition-all duration-300 group-hover:scale-105 ${colorClass}`}
        >
          {value}
        </h3>
      )}
    </div>
  )

  if (to && !loading) {
    return (
      <NavLink to={to} className="group block h-full" style={{ animationDelay: `${delay}ms` }}>
        <div className="h-full rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-slate-50 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:border-slate-300 hover:shadow-2xl dark:border-slate-700/50 dark:from-slate-800 dark:to-slate-900 dark:hover:border-slate-600">
          <Content />
        </div>
      </NavLink>
    )
  }

  return (
    <div
      className="h-full rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-slate-50 p-6 shadow-lg dark:border-slate-700/50 dark:from-slate-800 dark:to-slate-900"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Content />
    </div>
  )
}

const PremiumPieChart = ({ statusTotals, loading }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-10 py-8 md:flex-row">
        <div className="h-64 w-64 animate-pulse rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-800 dark:to-slate-700" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 w-40 animate-pulse rounded-lg bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800"
            />
          ))}
        </div>
      </div>
    )
  }

  const st = statusTotals || { pending: 0, picked_up: 0, delivered: 0, cancelled: 0 }
  const data = [
    {
      label: 'Open',
      value: st.pending,
      color: '#F59E0B',
      bg: 'from-amber-400 to-amber-600',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-500/20',
    },
    {
      label: 'Picked Up',
      value: st.picked_up,
      color: '#3B82F6',
      bg: 'from-blue-400 to-blue-600',
      text: 'text-blue-600 dark:text-blue-400',
      ring: 'ring-blue-500/20',
    },
    {
      label: 'Delivered',
      value: st.delivered,
      color: '#10B981',
      bg: 'from-emerald-400 to-emerald-600',
      text: 'text-emerald-600 dark:text-emerald-400',
      ring: 'ring-emerald-500/20',
    },
    {
      label: 'Cancelled',
      value: st.cancelled,
      color: '#EF4444',
      bg: 'from-rose-400 to-rose-600',
      text: 'text-rose-600 dark:text-rose-400',
      ring: 'ring-rose-500/20',
    },
  ]
  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (total === 0)
    return <div className="py-16 text-center text-slate-400">No orders to display</div>

  let cumulative = 0
  const gradient = data
    .map((item) => {
      const percentage = (item.value / total) * 360
      const start = cumulative
      cumulative += percentage
      return `${item.color} ${start}deg ${cumulative}deg`
    })
    .join(', ')

  return (
    <div className="flex flex-col items-center justify-center gap-12 py-8 md:flex-row">
      <div className="group relative">
        <div className="absolute -inset-4 animate-pulse rounded-full bg-gradient-to-r from-violet-600/20 to-indigo-600/20 opacity-0 blur-2xl transition-opacity duration-1000 group-hover:opacity-100" />
        <div
          className="relative h-64 w-64 rounded-full shadow-2xl transition-transform duration-700 group-hover:scale-105"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-44 w-44 flex-col items-center justify-center rounded-full bg-white shadow-inner backdrop-blur-xl dark:bg-slate-900">
            <span className="bg-gradient-to-br from-slate-900 to-slate-700 bg-clip-text text-5xl font-black text-transparent dark:from-white dark:to-slate-300">
              {total}
            </span>
            <span className="mt-1 text-xs font-bold tracking-widest text-slate-400 uppercase">
              Total
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.map((item, idx) => (
          <div
            key={idx}
            className={`group flex items-center gap-4 rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-slate-50 px-5 py-3 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-700/50 dark:from-slate-800 dark:to-slate-900 ${item.ring}`}
          >
            <div className={`h-4 w-4 rounded-full bg-gradient-to-br shadow-lg ${item.bg}`} />
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {item.label}
              </span>
              <span className={`text-2xl font-black ${item.text}`}>{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Cache Logic ---
const __dashCache = new Map()
const DASH_TTL = 60 * 1000
function cacheKey(name, params) {
  return `${name}:${params}`
}
function cacheSet(name, params, data) {
  try {
    __dashCache.set(cacheKey(name, params), { ts: Date.now(), data })
  } catch {}
}
function cacheGet(name, params) {
  try {
    const it = __dashCache.get(cacheKey(name, params))
    if (!it) return null
    if (Date.now() - (it.ts || 0) > DASH_TTL) return null
    return it.data
  } catch {
    return null
  }
}

export default function UserDashboard() {
  const toast = useToast()
  const loadSeqRef = useRef(0)
  const reloadTimerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const loadAbortRef = useRef(null)
  const monthDebounceRef = useRef(null)

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const [currencyCfg, setCurrencyCfg] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [analytics, setAnalytics] = useState(null)

  const COUNTRY_INFO = useMemo(
    () => ({
      KSA: { flag: '🇸🇦', cur: 'SAR', alias: ['Saudi Arabia'] },
      UAE: { flag: '🇦🇪', cur: 'AED' },
      Oman: { flag: '🇴🇲', cur: 'OMR' },
      Bahrain: { flag: '🇧🇭', cur: 'BHD' },
      India: { flag: '🇮🇳', cur: 'INR' },
      Kuwait: { flag: '🇰🇼', cur: 'KWD' },
      Qatar: { flag: '🇶🇦', cur: 'QAR' },
      Other: { cur: 'AED' },
    }),
    []
  )

  const COUNTRY_LIST = useMemo(
    () => ['KSA', 'UAE', 'Oman', 'Bahrain', 'India', 'Kuwait', 'Qatar', 'Other'],
    []
  )

  function countryMetrics(c) {
    const base = metrics?.countries || {}
    if (base[c]) return base[c]
    const alias = COUNTRY_INFO[c]?.alias || []
    for (const a of alias) {
      if (base[a]) return base[a]
    }
    return {}
  }

  function fmtAmt(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  function fmtNum(n) {
    return Number(n || 0).toLocaleString()
  }

  function toAED(amount, country) {
    try {
      const code = COUNTRY_INFO[country]?.cur || 'AED'
      return toAEDByCode(Number(amount || 0), code, currencyCfg)
    } catch {
      return Number(amount || 0)
    }
  }

  function toAEDByCurrency(amount, currency) {
    try {
      const code = String(currency || 'AED')
      return toAEDByCode(Number(amount || 0), code, currencyCfg)
    } catch {
      return Number(amount || 0)
    }
  }

  function sumCurrencyMapAED(map) {
    try {
      return Object.entries(map || {}).reduce(
        (s, [code, val]) => s + toAEDByCode(Number(val || 0), String(code || 'AED'), currencyCfg),
        0
      )
    } catch {
      return 0
    }
  }

  function sumAmountAED(key) {
    try {
      return COUNTRY_LIST.reduce((s, c) => s + toAED(countryMetrics(c)[key] || 0, c), 0)
    } catch {
      return 0
    }
  }

  function formatCurrency(amount, country) {
    const cur = COUNTRY_INFO[country]?.cur || 'AED'
    return `${cur} ${fmtAmt(amount || 0)}`
  }

  const statusTotals = useMemo(() => {
    if (metrics && metrics.statusTotals) return metrics.statusTotals
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
      loadAbortRef.current && loadAbortRef.current.abort()
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
      socket.on('orders.changed', () => scheduleLoad())
      socket.on('reports.userMetrics.updated', scheduleLoad)
      socket.on('orders.analytics.updated', scheduleLoad)
      socket.on('finance.drivers.updated', scheduleLoad)
    } catch {}
    return () => {
      try {
        socket && socket.disconnect()
      } catch {}
    }
  }, [toast])

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-8 font-sans sm:px-6 lg:px-8 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div className="mx-auto max-w-[1600px] space-y-8">
        {/* Premium Header */}
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-5xl font-black tracking-tighter text-transparent dark:from-white dark:via-slate-100 dark:to-slate-300">
              Dashboard
            </h1>
            <p className="mt-2 text-base font-bold text-slate-500 dark:text-slate-400">
              Your Business Command Center
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/50 bg-white/80 p-2 shadow-lg backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/80">
            <select
              className="cursor-pointer rounded-xl border-none bg-gradient-to-br from-slate-50 to-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition-all hover:shadow-md focus:ring-2 focus:ring-violet-500 dark:from-slate-800 dark:to-slate-900 dark:text-white"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <div className="h-8 w-px bg-gradient-to-b from-transparent via-slate-300 to-transparent dark:via-slate-700" />
            <select
              className="cursor-pointer rounded-xl border-none bg-gradient-to-br from-slate-50 to-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition-all hover:shadow-md focus:ring-2 focus:ring-violet-500 dark:from-slate-800 dark:to-slate-900 dark:text-white"
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

        {/* Profit/Loss Hero */}
        <GlassCard
          title="Profit / Loss Overview"
          subtitle="Delivered orders performance analysis"
          loading={loading}
        >
          {loading ? (
            <div className="space-y-10">
              <div className="h-32 animate-pulse rounded-2xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-800 dark:to-slate-700" />
              <div className="grid grid-cols-2 gap-6 md:grid-cols-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-xl bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800"
                  />
                ))}
              </div>
            </div>
          ) : metrics?.profitLoss ? (
            <div className="space-y-10">
              {/* Main Profit Display */}
              <div
                className={`relative overflow-hidden rounded-3xl p-10 shadow-2xl ${
                  metrics.profitLoss.isProfit
                    ? 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 dark:from-emerald-600 dark:via-emerald-700 dark:to-emerald-900'
                    : 'bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 dark:from-rose-600 dark:via-rose-700 dark:to-rose-900'
                }`}
              >
                <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-black/10 blur-3xl" />

                <div className="relative flex flex-col items-center justify-between gap-8 lg:flex-row">
                  <div className="text-center lg:text-left">
                    <div className="mb-3 text-sm font-black tracking-widest text-white/80 uppercase">
                      {metrics.profitLoss.isProfit ? 'Net Profit' : 'Net Loss'}
                    </div>
                    <div className="text-7xl font-black tracking-tighter text-white drop-shadow-2xl">
                      {metrics.profitLoss.isProfit ? '+' : '-'}
                      <LiveNumber
                        value={Math.abs(metrics.profitLoss.profit || 0)}
                        prefix="AED "
                        maximumFractionDigits={2}
                      />
                    </div>
                    <p className="mt-3 text-base font-bold text-white/90">
                      {monthNames[selectedMonth - 1]} {selectedYear}
                    </p>
                  </div>

                  <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:w-auto lg:grid-cols-6">
                    {[
                      { label: 'Revenue', val: metrics.profitLoss.revenue },
                      { label: 'Cost', val: metrics.profitLoss.purchaseCost },
                      { label: 'Driver', val: metrics.profitLoss.driverCommission },
                      { label: 'Agent', val: metrics.profitLoss.agentCommission },
                      { label: 'Investor', val: metrics.profitLoss.investorCommission },
                      { label: 'Ads', val: metrics.profitLoss.advertisementExpense },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-lg transition-all duration-300 hover:scale-105 hover:bg-white/20"
                      >
                        <p className="text-xs font-black tracking-wide text-white/70 uppercase">
                          {item.label}
                        </p>
                        <p className="mt-2 text-lg font-black text-white">
                          <LiveNumber
                            value={item.val || 0}
                            prefix="AED "
                            maximumFractionDigits={0}
                          />
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Geographic Breakdown */}
              <div>
                <h4 className="mb-6 text-xl font-black text-slate-900 dark:text-white">
                  Geographic Performance
                </h4>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {['KSA', 'UAE', 'Oman', 'Bahrain', 'India', 'Kuwait', 'Qatar'].map((c, idx) => {
                    const profitData = metrics.profitLoss.byCountry?.[c]
                    if (!profitData) return null
                    const isProfit = (profitData.profit || 0) >= 0
                    const flag = COUNTRY_INFO[c]?.flag || ''
                    const currency = profitData.currency || 'AED'

                    return (
                      <div
                        key={c}
                        className={`group relative overflow-hidden rounded-2xl border p-6 shadow-lg transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl ${
                          isProfit
                            ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:border-emerald-900/30 dark:from-emerald-950/50 dark:to-emerald-900/20'
                            : 'border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/50 dark:border-rose-900/30 dark:from-rose-950/50 dark:to-rose-900/20'
                        }`}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="absolute -top-6 -right-6 text-6xl opacity-10">{flag}</div>

                        <div className="relative mb-6 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl drop-shadow-lg">{flag}</span>
                            <span className="font-black text-slate-900 dark:text-white">
                              {c === 'KSA' ? 'KSA' : c}
                            </span>
                          </div>
                          <div
                            className={`text-2xl font-black ${
                              isProfit
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isProfit ? '+' : '-'}
                            {fmtAmt(Math.abs(profitData.profit || 0))}
                          </div>
                        </div>

                        <div className="relative space-y-3 text-sm">
                          {[
                            { l: 'Revenue', v: profitData.revenue, icon: '💰' },
                            { l: 'Cost', v: profitData.purchaseCost, icon: '📦' },
                            { l: 'Driver', v: profitData.driverCommission, icon: '🚚' },
                            { l: 'Ads', v: profitData.advertisementExpense, icon: '📢' },
                          ].map((r, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between rounded-xl border border-slate-200/50 bg-white/50 px-4 py-2 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/30"
                            >
                              <span className="flex items-center gap-2 font-bold text-slate-600 dark:text-slate-300">
                                <span>{r.icon}</span>
                                {r.l}
                              </span>
                              <span className="font-black text-slate-900 dark:text-white">
                                {currency} {fmtAmt(r.v)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </GlassCard>

        {/* Orders Summary */}
        <GlassCard title="Orders Summary" subtitle="Global metrics in AED" loading={loading}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              {
                title: 'Total Orders',
                value: <LiveNumber value={metrics?.totalOrders || 0} maximumFractionDigits={0} />,
                to: '/user/orders',
                color: 'text-sky-600 dark:text-sky-400',
                delay: 0,
              },
              {
                title: 'Total Amount',
                value: <LiveNumber value={sumAmountAED('amountTotalOrders')} prefix="AED " />,
                to: '/user/orders',
                color: 'text-emerald-600 dark:text-emerald-400',
                delay: 50,
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
                delay: 100,
              },
              {
                title: 'Delivered Amt',
                value: <LiveNumber value={sumAmountAED('amountDelivered')} prefix="AED " />,
                to: '/user/orders?ship=delivered',
                color: 'text-emerald-600 dark:text-emerald-400',
                delay: 150,
              },
              {
                title: 'Open Orders',
                value: <LiveNumber value={statusTotals?.pending || 0} maximumFractionDigits={0} />,
                to: '/user/orders?ship=open',
                color: 'text-amber-500 dark:text-amber-400',
                delay: 200,
              },
              {
                title: 'Open Amount',
                value: <LiveNumber value={sumAmountAED('amountPending')} prefix="AED " />,
                to: '/user/orders?ship=open',
                color: 'text-orange-500 dark:text-orange-400',
                delay: 250,
              },
            ].map((stat, i) => (
              <PremiumStatCard key={i} {...stat} loading={loading} />
            ))}
          </div>
        </GlassCard>

        {/* Product Metrics */}
        <GlassCard title="Product Metrics" subtitle="Inventory & stock analytics" loading={loading}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              {
                title: 'Total Purchase',
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
                title: 'Inventory Value',
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
                delay: 50,
              },
              {
                title: 'Delivered Value',
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
                delay: 100,
              },
              {
                title: 'Stock Purchased',
                value: (
                  <LiveNumber
                    value={metrics?.productMetrics?.global?.stockPurchasedQty || 0}
                    maximumFractionDigits={0}
                  />
                ),
                to: '/user/inhouse-products',
                color: 'text-sky-600 dark:text-sky-400',
                delay: 150,
              },
              {
                title: 'Stock Delivered',
                value: (
                  <LiveNumber
                    value={metrics?.productMetrics?.global?.stockDeliveredQty || 0}
                    maximumFractionDigits={0}
                  />
                ),
                to: '/user/orders?ship=delivered',
                color: 'text-emerald-600 dark:text-emerald-400',
                delay: 200,
              },
              {
                title: 'Pending Stock',
                value: (
                  <LiveNumber
                    value={metrics?.productMetrics?.global?.stockLeftQty || 0}
                    maximumFractionDigits={0}
                  />
                ),
                to: '/user/warehouses',
                color: 'text-amber-500 dark:text-amber-400',
                delay: 250,
              },
            ].map((stat, i) => (
              <PremiumStatCard key={i} {...stat} loading={loading} />
            ))}
          </div>
        </GlassCard>

        {/* Charts & Status */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <GlassCard title="Sales Trend" subtitle="Last 7 days performance" loading={loading}>
              <div className="h-[320px] w-full">
                {!hydrated || loading ? (
                  <div className="h-full w-full animate-pulse rounded-2xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-800 dark:to-slate-700" />
                ) : (
                  <Chart analytics={analytics} />
                )}
              </div>
            </GlassCard>

            <GlassCard title="Order Status Distribution" loading={loading}>
              <PremiumPieChart statusTotals={statusTotals} loading={loading} />
            </GlassCard>
          </div>

          <div>
            <GlassCard title="Status Summary" subtitle="All order statuses" loading={loading}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    t: 'Total',
                    v: statusTotals?.total,
                    c: 'from-sky-400 to-sky-600',
                    tc: 'text-sky-600 dark:text-sky-400',
                    to: '/user/orders',
                  },
                  {
                    t: 'Open',
                    v: statusTotals?.pending,
                    c: 'from-amber-400 to-amber-600',
                    tc: 'text-amber-600 dark:text-amber-400',
                    to: '/user/orders?ship=open',
                  },
                  {
                    t: 'Assigned',
                    v: statusTotals?.assigned,
                    c: 'from-blue-400 to-blue-600',
                    tc: 'text-blue-600 dark:text-blue-400',
                    to: '/user/orders?ship=assigned',
                  },
                  {
                    t: 'Picked Up',
                    v: statusTotals?.picked_up,
                    c: 'from-indigo-400 to-indigo-600',
                    tc: 'text-indigo-600 dark:text-indigo-400',
                    to: '/user/orders?ship=picked_up',
                  },
                  {
                    t: 'In Transit',
                    v: statusTotals?.in_transit,
                    c: 'from-cyan-400 to-cyan-600',
                    tc: 'text-cyan-600 dark:text-cyan-400',
                    to: '/user/orders?ship=in_transit',
                  },
                  {
                    t: 'Out Delivery',
                    v: statusTotals?.out_for_delivery,
                    c: 'from-orange-400 to-orange-600',
                    tc: 'text-orange-600 dark:text-orange-400',
                    to: '/user/orders?ship=out_for_delivery',
                  },
                  {
                    t: 'Delivered',
                    v: statusTotals?.delivered,
                    c: 'from-emerald-400 to-emerald-600',
                    tc: 'text-emerald-600 dark:text-emerald-400',
                    to: '/user/orders?ship=delivered',
                  },
                  {
                    t: 'Cancelled',
                    v: statusTotals?.cancelled,
                    c: 'from-rose-400 to-rose-600',
                    tc: 'text-rose-600 dark:text-rose-400',
                    to: '/user/orders?ship=cancelled',
                  },
                  {
                    t: 'Returned',
                    v: statusTotals?.returned,
                    c: 'from-slate-400 to-slate-600',
                    tc: 'text-slate-600 dark:text-slate-400',
                    to: '/user/orders?ship=returned',
                  },
                  {
                    t: 'No Response',
                    v: statusTotals?.no_response,
                    c: 'from-rose-300 to-rose-500',
                    tc: 'text-rose-500 dark:text-rose-300',
                    to: '/user/orders?ship=no_response',
                  },
                ].map((item, i) => (
                  <NavLink
                    key={i}
                    to={item.to}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-700/50 dark:from-slate-800 dark:to-slate-900"
                  >
                    {loading ? (
                      <div className="h-16 animate-pulse rounded-lg bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800" />
                    ) : (
                      <>
                        <div
                          className={`absolute -top-2 -right-2 h-16 w-16 rounded-full bg-gradient-to-br opacity-10 blur-xl ${item.c}`}
                        />
                        <div className="relative">
                          <div className="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                            {item.t}
                          </div>
                          <div
                            className={`text-2xl font-black transition-transform group-hover:scale-110 ${item.tc}`}
                          >
                            <LiveNumber value={item.v || 0} maximumFractionDigits={0} />
                          </div>
                        </div>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Per-Country Performance */}
        <GlassCard
          title="Per-Country Performance"
          subtitle="Detailed metrics in local currency"
          loading={loading}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {COUNTRY_LIST.map((c, idx) => {
              const m = countryMetrics(c)
              const flag = COUNTRY_INFO[c]?.flag || ''
              const qs = encodeURIComponent(c)
              const cur = COUNTRY_INFO[c]?.cur || 'AED'

              return (
                <div
                  key={c}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-slate-50 p-6 shadow-lg backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl dark:border-slate-700/50 dark:from-slate-800 dark:to-slate-900"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="absolute -top-10 -right-10 text-8xl opacity-5">{flag}</div>

                  <div className="relative mb-6 flex items-center gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
                    <span className="text-3xl drop-shadow-lg">{flag}</span>
                    <span className="flex-1 text-xl font-black text-slate-900 dark:text-white">
                      {c === 'KSA' ? 'Saudi Arabia' : c}
                    </span>
                    <span className="rounded-full bg-gradient-to-br from-slate-100 to-slate-200 px-3 py-1 text-xs font-black text-slate-700 shadow-inner dark:from-slate-700 dark:to-slate-800 dark:text-slate-300">
                      {cur}
                    </span>
                  </div>

                  {loading ? (
                    <div className="grid grid-cols-2 gap-4">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                          key={i}
                          className="h-14 animate-pulse rounded-xl bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="relative grid grid-cols-2 gap-4">
                      {[
                        {
                          label: 'Total Orders',
                          value: fmtNum(m?.orders || 0),
                          to: `/user/orders?country=${qs}`,
                          color: 'text-sky-600 dark:text-sky-400',
                        },
                        {
                          label: 'Total Amount',
                          value: formatCurrency(m?.amountTotalOrders, c).replace(cur, '').trim(),
                          color: 'text-emerald-600 dark:text-emerald-400',
                        },
                        {
                          label: 'Delivered',
                          value: fmtNum((m?.deliveredQty ?? m?.delivered) || 0),
                          to: `/user/orders?country=${qs}&ship=delivered`,
                          color: 'text-emerald-600 dark:text-emerald-400',
                        },
                        {
                          label: 'Delivered Amt',
                          value: formatCurrency(m?.amountDeliveredLocal ?? m?.amountDelivered, c)
                            .replace(cur, '')
                            .trim(),
                          color: 'text-emerald-600 dark:text-emerald-400',
                        },
                        {
                          label: 'Open',
                          value: fmtNum(m?.pending || 0),
                          to: `/user/orders?country=${qs}&ship=open`,
                          color: 'text-amber-500 dark:text-amber-400',
                        },
                        {
                          label: 'Open Amt',
                          value: formatCurrency(m?.amountPending, c).replace(cur, '').trim(),
                          color: 'text-orange-500 dark:text-orange-400',
                        },
                      ].map((stat, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-slate-200/30 bg-white/30 p-3 backdrop-blur-sm transition-all hover:bg-white/50 dark:border-slate-700/30 dark:bg-slate-800/30 dark:hover:bg-slate-700/50"
                        >
                          <div className="text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                            {stat.label}
                          </div>
                          {stat.to ? (
                            <NavLink
                              to={stat.to}
                              className={`mt-1 block text-lg font-black hover:underline ${stat.color}`}
                            >
                              {stat.value}
                            </NavLink>
                          ) : (
                            <div className={`mt-1 text-lg font-black ${stat.color}`}>
                              {stat.value}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
