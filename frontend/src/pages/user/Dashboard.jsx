import React, { useEffect, useMemo, useRef, useState, memo } from 'react'
import { NavLink } from 'react-router-dom'
import LiveNumber from '../../components/LiveNumber.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode, convert } from '../../util/currency'

// ===========================
// PREMIUM UI COMPONENTS
// ===========================

const Shimmer = () => (
  <div className="animate-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/10" />
)

const DashboardCard = ({ children, className = '', title, subtitle, isLoading = false }) => (
  <div
    className={`group relative overflow-hidden rounded-3xl border border-white/20 bg-white/60 p-6 shadow-xl backdrop-blur-xl transition-all duration-500 hover:shadow-2xl dark:border-slate-700/30 dark:bg-slate-900/60 dark:shadow-slate-900/20 ${className}`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-slate-800/40" />
    <div className="relative z-10">
      {(title || subtitle) && (
        <div className="mb-6 flex flex-col gap-1 border-b border-slate-100/50 pb-4 dark:border-slate-700/30">
          {title && (
            <h3 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-xl font-black tracking-tight text-transparent dark:from-white dark:to-slate-400">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
      )}
      {isLoading ? (
        <div className="space-y-4">
          <div className="relative h-32 overflow-hidden rounded-2xl bg-slate-100/50 dark:bg-slate-800/50">
            <Shimmer />
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  </div>
)

const StatTile = memo(
  ({
    title,
    value,
    subValue,
    colorClass = 'text-slate-900 dark:text-white',
    gradientFrom = 'from-slate-50',
    gradientTo = 'to-slate-100',
    icon,
    to,
    isLoading = false,
  }) => {
    const Content = () => (
      <div className="relative flex h-full flex-col justify-between overflow-hidden">
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-gradient-to-br from-white/20 to-transparent blur-2xl transition-transform duration-500 group-hover:scale-150 dark:from-white/5" />

        <div className="flex items-start justify-between">
          <div className="text-xs font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
            {title}
          </div>
          {icon && <div className={`rounded-full p-2 ${colorClass} bg-opacity-10`}>{icon}</div>}
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="relative h-8 w-24 overflow-hidden rounded-lg bg-slate-200/50 dark:bg-slate-700/50">
              <Shimmer />
            </div>
          ) : (
            <>
              <div className={`text-3xl font-black ${colorClass} tracking-tighter drop-shadow-sm`}>
                {value}
              </div>
              {subValue && (
                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                  {subValue}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )

    const containerClasses = `group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br ${gradientFrom} ${gradientTo} p-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-700/30 dark:from-slate-800/80 dark:to-slate-900/80`

    if (to) {
      return (
        <NavLink to={to} className={containerClasses}>
          <Content />
        </NavLink>
      )
    }

    return (
      <div className={containerClasses}>
        <Content />
      </div>
    )
  }
)

const CustomSelect = ({ value, onChange, options, icon }) => (
  <div className="group relative">
    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 transition-colors group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-white">
      {icon}
    </div>
    <select
      value={value}
      onChange={onChange}
      className="h-10 w-full appearance-none rounded-xl border border-slate-200/60 bg-white/50 pr-8 pl-10 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-md transition-all outline-none hover:border-slate-300 hover:bg-white hover:shadow-md focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
)

// Skeleton Loaders
const ProfitLossSkeleton = () => (
  <DashboardCard>
    <div className="space-y-8">
      <div className="relative h-8 w-48 overflow-hidden rounded-lg bg-slate-200/50 dark:bg-slate-700/50">
        <Shimmer />
      </div>
      <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-8 dark:border-slate-700/30 dark:bg-slate-800/30">
        <div className="space-y-8">
          <div className="relative h-8 w-32 overflow-hidden rounded-lg bg-slate-200/50 dark:bg-slate-700/50">
            <Shimmer />
          </div>
          <div className="relative h-20 w-72 overflow-hidden rounded-xl bg-slate-300/50 dark:bg-slate-600/50">
            <Shimmer />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/40 dark:bg-slate-700/30">
                <div className="relative h-full w-full overflow-hidden rounded-2xl">
                  <Shimmer />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </DashboardCard>
)

// ===========================
// CACHE LOGIC
// ===========================

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

// ===========================
// MAIN DASHBOARD COMPONENT
// ===========================

export default function UserDashboard() {
  const toast = useToast()
  const loadSeqRef = useRef(0)
  const reloadTimerRef = useRef(null)
  const [hydrated, setHydrated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const loadAbortRef = useRef(null)
  const bgAbortRef = useRef(null)
  const monthDebounceRef = useRef(null)

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const [currencyCfg, setCurrencyCfg] = useState(null)
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalCOD: 0,
    totalPrepaid: 0,
    totalOrders: 0,
    pendingOrders: 0,
    pickedUpOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    totalProductsInHouse: 0,
    totalProductsOrdered: 0,
    totalDeposit: 0,
    totalWithdraw: 0,
    totalExpense: 0,
    totalAgentExpense: 0,
    totalDriverExpense: 0,
    totalRevenue: 0,
    countries: {},
    productMetrics: { global: {}, countries: {} },
  })

  const [analytics, setAnalytics] = useState(null)
  const [salesByCountry, setSalesByCountry] = useState({})
  const [drivers, setDrivers] = useState([])

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

  const fmtNum = (n) => (Number.isFinite(n) ? n.toLocaleString() : '0')
  const fmtAmt = (n) =>
    Number.isFinite(n)
      ? n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      : '0'

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
    setIsLoading(true)
    const dateRange = getMonthDateRange()
    const dateParams = `from=${encodeURIComponent(dateRange.from)}&to=${encodeURIComponent(dateRange.to)}`

    const seq = (loadSeqRef.current = loadSeqRef.current + 1)
    try {
      loadAbortRef.current && loadAbortRef.current.abort()
    } catch {}
    try {
      bgAbortRef.current && bgAbortRef.current.abort()
    } catch {}
    const controller = new AbortController()
    loadAbortRef.current = controller

    const cachedAnalytics = cacheGet('analytics', dateParams)
    if (cachedAnalytics) setAnalytics(cachedAnalytics)
    const cachedMetrics = cacheGet('metrics', dateParams)
    if (cachedMetrics) {
      setMetrics(cachedMetrics)
      setIsLoading(false)
    }
    const cachedSales = cacheGet('salesByCountry', dateParams)
    if (cachedSales) setSalesByCountry(cachedSales)

    const cfgP = (currencyCfg ? Promise.resolve(currencyCfg) : getCurrencyConfig()).catch(
      () => null
    )
    const analyticsP = apiGet(`/api/orders/analytics/last7days?${dateParams}`, {
      signal: controller.signal,
    }).catch(() => ({ days: [], totals: {} }))
    const metricsP = apiGet(`/api/reports/user-metrics?${dateParams}`, {
      signal: controller.signal,
    }).catch(() => null)
    const salesP = apiGet(`/api/reports/user-metrics/sales-by-country?${dateParams}`, {
      signal: controller.signal,
    }).catch(() => ({}))
    const driversFirstP = apiGet(`/api/finance/drivers/summary?page=1&limit=100&${dateParams}`, {
      signal: controller.signal,
    }).catch((e) => null)

    const [cfg, metricsRes, salesRes] = await Promise.all([cfgP, metricsP, salesP])
    if (loadSeqRef.current !== seq) return

    setCurrencyCfg(cfg)
    if (metricsRes) {
      setMetrics(metricsRes)
      cacheSet('metrics', dateParams, metricsRes)
    }
    if (salesRes) {
      setSalesByCountry(salesRes)
      cacheSet('salesByCountry', dateParams, salesRes)
    }
    setHydrated(true)
    setIsLoading(false)

    analyticsP.then((res) => {
      if (loadSeqRef.current !== seq) return
      if (res) {
        setAnalytics(res)
        cacheSet('analytics', dateParams, res)
      }
    })

    driversFirstP.then((driversFirst) => {
      if (loadSeqRef.current !== seq) return
      if (driversFirst) {
        const arr = Array.isArray(driversFirst?.drivers) ? driversFirst.drivers : []
        setDrivers(arr)
      } else {
        setDrivers([])
      }
    })
  }

  useEffect(() => {
    if (monthDebounceRef.current) clearTimeout(monthDebounceRef.current)
    monthDebounceRef.current = setTimeout(load, 250)
    return () => clearTimeout(monthDebounceRef.current)
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    let socket
    try {
      socket = io(API_BASE, { transports: ['websocket'], reconnection: true })
      socket.on('new_order', () => {
        if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
        reloadTimerRef.current = setTimeout(load, 3000)
      })
    } catch (err) {
      console.error('Socket error:', err)
    }
    return () => {
      if (socket) socket.disconnect()
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#F8FAFC] transition-colors duration-500 dark:bg-[#0F172A]">
      {/* Decorative Background Elements */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] h-[50%] w-[50%] rounded-full bg-blue-500/5 blur-[120px] dark:bg-blue-500/10" />
        <div className="absolute top-[20%] -right-[10%] h-[40%] w-[40%] rounded-full bg-purple-500/5 blur-[120px] dark:bg-purple-500/10" />
        <div className="absolute -bottom-[10%] left-[20%] h-[40%] w-[40%] rounded-full bg-emerald-500/5 blur-[120px] dark:bg-emerald-500/10" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/20 bg-white/70 backdrop-blur-2xl dark:border-slate-800/50 dark:bg-slate-900/70">
        <div className="mx-auto max-w-[1920px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Dashboard
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Performance Overview & Analytics
              </p>
            </div>
            <div className="flex items-center gap-3">
              <CustomSelect
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                options={monthNames.map((name, idx) => ({ value: idx + 1, label: name }))}
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                }
              />
              <CustomSelect
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                options={[2023, 2024, 2025].map((year) => ({ value: year, label: year }))}
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1920px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <StatTile
            title="TOTAL ORDERS"
            value={<LiveNumber value={statusTotals?.total || 0} maximumFractionDigits={0} />}
            colorClass="text-slate-800 dark:text-white"
            gradientFrom="from-white"
            gradientTo="to-slate-50"
            to="/user/orders"
            isLoading={isLoading}
          />
          <StatTile
            title="OPEN"
            value={<LiveNumber value={statusTotals?.pending || 0} maximumFractionDigits={0} />}
            colorClass="text-amber-500 dark:text-amber-400"
            gradientFrom="from-amber-50/50"
            gradientTo="to-white"
            to="/user/orders?ship=open"
            isLoading={isLoading}
          />
          <StatTile
            title="DELIVERED"
            value={<LiveNumber value={statusTotals?.delivered || 0} maximumFractionDigits={0} />}
            colorClass="text-emerald-500 dark:text-emerald-400"
            gradientFrom="from-emerald-50/50"
            gradientTo="to-white"
            to="/user/orders?ship=delivered"
            isLoading={isLoading}
          />
          <StatTile
            title="PICKED UP"
            value={<LiveNumber value={statusTotals?.picked_up || 0} maximumFractionDigits={0} />}
            colorClass="text-blue-500 dark:text-blue-400"
            gradientFrom="from-blue-50/50"
            gradientTo="to-white"
            to="/user/orders?ship=picked_up"
            isLoading={isLoading}
          />
          <StatTile
            title="IN TRANSIT"
            value={<LiveNumber value={statusTotals?.in_transit || 0} maximumFractionDigits={0} />}
            colorClass="text-cyan-500 dark:text-cyan-400"
            gradientFrom="from-cyan-50/50"
            gradientTo="to-white"
            to="/user/orders?ship=in_transit"
            isLoading={isLoading}
          />
          <StatTile
            title="CANCELLED"
            value={<LiveNumber value={statusTotals?.cancelled || 0} maximumFractionDigits={0} />}
            colorClass="text-rose-500 dark:text-rose-400"
            gradientFrom="from-rose-50/50"
            gradientTo="to-white"
            to="/user/orders?ship=cancelled"
            isLoading={isLoading}
          />
        </div>

        {/* Profit/Loss Section */}
        {isLoading ? (
          <ProfitLossSkeleton />
        ) : (
          metrics?.profitLoss && (
            <DashboardCard>
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h4 className="text-xl font-black text-slate-800 dark:text-slate-200">
                    Financial Overview
                  </h4>
                  <div
                    className={`rounded-full px-4 py-1 text-xs font-bold tracking-wider uppercase ${metrics.profitLoss.isProfit ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}
                  >
                    {metrics.profitLoss.isProfit ? 'Net Profit' : 'Net Loss'}
                  </div>
                </div>

                {/* Main Profit Card */}
                <div className="group relative overflow-hidden rounded-3xl border border-slate-200/50 bg-gradient-to-br from-slate-50 via-white to-slate-50 p-10 shadow-sm transition-all duration-500 hover:shadow-xl dark:border-slate-700/50 dark:from-slate-800/50 dark:via-slate-800/30 dark:to-slate-800/50">
                  <div
                    className={`absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-20 blur-[80px] transition-colors duration-500 ${metrics.profitLoss.isProfit ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  />

                  <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-sm font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
                        Net {metrics.profitLoss.isProfit ? 'Profit' : 'Loss'}
                      </div>
                      <div
                        className={`mt-2 text-6xl font-black tracking-tighter lg:text-7xl ${metrics.profitLoss.isProfit ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}
                      >
                        {metrics.profitLoss.isProfit ? '+' : '-'}
                        <LiveNumber
                          value={Math.abs(metrics.profitLoss.profit || 0)}
                          prefix="AED "
                          maximumFractionDigits={2}
                        />
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-4 md:grid-cols-3 lg:w-auto lg:grid-cols-3 xl:grid-cols-6">
                      {[
                        {
                          label: 'Revenue',
                          val: metrics.profitLoss.revenue,
                          color: 'text-sky-600 dark:text-sky-400',
                          bg: 'bg-sky-50 dark:bg-sky-500/10',
                        },
                        {
                          label: 'Cost',
                          val: metrics.profitLoss.purchaseCost,
                          color: 'text-violet-600 dark:text-violet-400',
                          bg: 'bg-violet-50 dark:bg-violet-500/10',
                        },
                        {
                          label: 'Driver',
                          val: metrics.profitLoss.driverCommission,
                          color: 'text-amber-600 dark:text-amber-400',
                          bg: 'bg-amber-50 dark:bg-amber-500/10',
                        },
                        {
                          label: 'Agent',
                          val: metrics.profitLoss.agentCommission,
                          color: 'text-yellow-600 dark:text-yellow-400',
                          bg: 'bg-yellow-50 dark:bg-yellow-500/10',
                        },
                        {
                          label: 'Investor',
                          val: metrics.profitLoss.investorCommission,
                          color: 'text-pink-600 dark:text-pink-400',
                          bg: 'bg-pink-50 dark:bg-pink-500/10',
                        },
                        {
                          label: 'Ads',
                          val: metrics.profitLoss.advertisementExpense,
                          color: 'text-rose-600 dark:text-rose-400',
                          bg: 'bg-rose-50 dark:bg-rose-500/10',
                        },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className={`flex flex-col items-center justify-center rounded-2xl p-4 transition-transform hover:scale-105 ${item.bg}`}
                        >
                          <div className="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                            {item.label}
                          </div>
                          <div className={`mt-1 text-lg font-bold ${item.color}`}>
                            <LiveNumber
                              value={item.val || 0}
                              prefix="AED "
                              maximumFractionDigits={0}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Country Breakdown */}
                <div>
                  <h4 className="mb-6 text-lg font-bold text-slate-700 dark:text-slate-300">
                    Regional Performance
                  </h4>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {['KSA', 'UAE', 'Oman', 'Bahrain', 'India', 'Kuwait', 'Qatar'].map((c) => {
                      const profitData = metrics.profitLoss.byCountry?.[c]
                      if (!profitData) return null
                      const isProfit = (profitData.profit || 0) >= 0
                      const flag = COUNTRY_INFO[c]?.flag || ''
                      const currency = profitData.currency || 'AED'

                      return (
                        <div
                          key={c}
                          className={`group relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                            isProfit
                              ? 'border-emerald-100 bg-gradient-to-br from-emerald-50/30 to-white hover:border-emerald-200 hover:shadow-emerald-500/10 dark:border-emerald-500/20 dark:from-emerald-900/10 dark:to-slate-800'
                              : 'border-rose-100 bg-gradient-to-br from-rose-50/30 to-white hover:border-rose-200 hover:shadow-rose-500/10 dark:border-rose-500/20 dark:from-rose-900/10 dark:to-slate-800'
                          }`}
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">{flag}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {c === 'KSA' ? 'KSA' : c}
                              </span>
                            </div>
                            <div
                              className={`text-lg font-black ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                            >
                              {isProfit ? '+' : '-'}
                              {currency} {fmtAmt(Math.abs(profitData.profit || 0))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            {[
                              {
                                l: 'Rev',
                                v: profitData.revenue,
                                c: 'text-sky-600 dark:text-sky-400',
                              },
                              {
                                l: 'Cost',
                                v: profitData.purchaseCost,
                                c: 'text-violet-600 dark:text-violet-400',
                              },
                              {
                                l: 'Driver',
                                v: profitData.driverCommission,
                                c: 'text-amber-600 dark:text-amber-400',
                              },
                              {
                                l: 'Ads',
                                v: profitData.advertisementExpense,
                                c: 'text-rose-600 dark:text-rose-400',
                              },
                            ].map((r, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-2 backdrop-blur-sm dark:bg-slate-800/40"
                              >
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                  {r.l}
                                </span>
                                <span className={`text-sm font-bold ${r.c}`}>{fmtAmt(r.v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </DashboardCard>
          )
        )}
      </div>
    </div>
  )
}
