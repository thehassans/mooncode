import React, { useEffect, useMemo, useRef, useState, memo } from 'react'
import { NavLink } from 'react-router-dom'
import Chart from '../../components/Chart.jsx'
import LiveNumber from '../../components/LiveNumber.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode, convert } from '../../util/currency'

// ===========================
// PREMIUM UI COMPONENTS
// ===========================

const Shimmer = () => (
  <div className="animate-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />
)

const DashboardCard = ({ children, className = '', title, subtitle, isLoading = false }) => (
  <div
    className={`group rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-slate-300/60 hover:shadow-lg dark:border-slate-700/50 dark:bg-slate-800/50 ${className}`}
  >
    {(title || subtitle) && (
      <div className="mb-6 border-b border-slate-100 pb-4 dark:border-slate-700/50">
        {title && (
          <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h3>
        )}
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
    )}
    {isLoading ? (
      <div className="space-y-4">
        <div className="relative h-32 overflow-hidden rounded-xl bg-slate-100">
          <Shimmer />
        </div>
      </div>
    ) : (
      children
    )}
  </div>
)

const StatTile = memo(
  ({
    title,
    value,
    subValue,
    colorClass = 'text-slate-900 dark:text-white',
    to,
    isLoading = false,
  }) => {
    const Content = () => (
      <div className="flex h-full flex-col justify-between">
        <div className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          {title}
        </div>
        {isLoading ? (
          <div className="relative h-8 w-20 overflow-hidden rounded bg-slate-200">
            <Shimmer />
          </div>
        ) : (
          <>
            <div className={`text-2xl font-bold ${colorClass} tracking-tight`}>{value}</div>
            {subValue && <div className="mt-2 text-sm">{subValue}</div>}
          </>
        )}
      </div>
    )

    if (to) {
      return (
        <NavLink
          to={to}
          className="group rounded-xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700/50 dark:from-slate-700/30 dark:to-slate-800/30 dark:hover:border-slate-600"
        >
          <Content />
        </NavLink>
      )
    }

    return (
      <div className="rounded-xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/50 p-4 dark:border-slate-700/50 dark:from-slate-700/30 dark:to-slate-800/30">
        <Content />
      </div>
    )
  }
)

const OrderStatusPie = memo(({ statusTotals }) => {
  const st = statusTotals || { pending: 0, picked_up: 0, delivered: 0, cancelled: 0 }
  const data = [
    { label: 'Open', value: st.pending, color: '#F59E0B', tw: 'bg-amber-500 text-amber-600' },
    { label: 'Picked Up', value: st.picked_up, color: '#3B82F6', tw: 'bg-blue-500 text-blue-600' },
    {
      label: 'Delivered',
      value: st.delivered,
      color: '#10B981',
      tw: 'bg-emerald-500 text-emerald-600',
    },
    { label: 'Cancelled', value: st.cancelled, color: '#EF4444', tw: 'bg-rose-500 text-rose-600' },
  ]
  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (total === 0)
    return <div className="py-12 text-center text-slate-400">No orders to display</div>

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
    <div className="flex flex-col items-center justify-center gap-8 py-6 md:flex-row">
      <div className="group relative">
        <div
          className="h-52 w-52 rounded-full shadow-xl transition-all duration-500 group-hover:scale-105 group-hover:shadow-2xl"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-36 w-36 items-center justify-center rounded-full bg-white shadow-2xl ring-4 ring-white/50 dark:bg-slate-800 dark:ring-slate-700/50">
            <span className="text-3xl font-black text-slate-800 dark:text-slate-100">{total}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${item.tw.split(' ')[0]} shadow-sm`} />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {item.label}
              </span>
              <span className={`text-lg font-bold ${item.tw.split(' ')[1]}`}>{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

// Skeleton Loaders
const ProfitLossSkeleton = () => (
  <DashboardCard>
    <div className="space-y-6">
      <div className="relative h-6 w-48 overflow-hidden rounded-lg bg-slate-200">
        <Shimmer />
      </div>
      <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-100/50 p-8">
        <div className="space-y-6">
          <div className="relative h-6 w-32 overflow-hidden rounded-lg bg-slate-200/80">
            <Shimmer />
          </div>
          <div className="relative h-16 w-72 overflow-hidden rounded-lg bg-slate-300/80">
            <Shimmer />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl bg-white/60 p-4 backdrop-blur-sm">
                <div className="relative mb-3 h-3 w-16 overflow-hidden rounded bg-slate-200">
                  <Shimmer />
                </div>
                <div className="relative h-6 w-20 overflow-hidden rounded bg-slate-300">
                  <Shimmer />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="relative mb-4 h-6 w-56 overflow-hidden rounded-lg bg-slate-200">
        <Shimmer />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200/60 bg-white p-5">
            <div className="relative mb-4 h-6 w-28 overflow-hidden rounded-lg bg-slate-200">
              <Shimmer />
            </div>
            <div className="space-y-3">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <div className="relative h-3 w-16 overflow-hidden rounded bg-slate-200">
                    <Shimmer />
                  </div>
                  <div className="relative h-3 w-14 overflow-hidden rounded bg-slate-300">
                    <Shimmer />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </DashboardCard>
)

const ChartSkeleton = ({ title }) => (
  <DashboardCard title={title}>
    <div className="relative h-72 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-700/30 dark:to-slate-800/20">
      <Shimmer />
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

  function formatCurrency(amount, country) {
    const cur = COUNTRY_INFO[country]?.cur || 'AED'
    return `${cur} ${fmtAmt(amount)}`
  }

  function toAED(amount, country) {
    const fromCode = COUNTRY_INFO[country]?.cur || 'AED'
    if (fromCode === 'AED') return Number(amount || 0)
    if (!currencyCfg) return Number(amount || 0)
    return toAEDByCode(Number(amount || 0), fromCode, currencyCfg)
  }

  function toAEDByCurrency(amount, currency) {
    if (currency === 'AED') return Number(amount || 0)
    if (!currencyCfg) return Number(amount || 0)
    return toAEDByCode(Number(amount || 0), currency, currencyCfg)
  }

  function sumCurrencyMapAED(map) {
    if (!map) return 0
    return Object.entries(map).reduce((sum, [code, amt]) => {
      return sum + toAEDByCurrency(Number(amt || 0), code)
    }, 0)
  }

  function sumCurrencyMapLocal(map, targetCode) {
    if (!map) return 0
    const totalAED = sumCurrencyMapAED(map)
    if (targetCode === 'AED') return totalAED
    if (!currencyCfg) return totalAED
    return convert(totalAED, 'AED', targetCode, currencyCfg)
  }

  function sumAmountAED(key) {
    let total = 0
    COUNTRY_LIST.forEach((c) => {
      const m = countryMetrics(c) || {}
      const val = Number(m[key] || 0)
      total += toAED(val, c)
    })
    return total
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

  // ===========================
  // RENDER
  // ===========================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header with Month/Year Filter */}
      <div className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/80">
        <div className="mx-auto max-w-[1920px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Overview of your performance
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-4 py-2 shadow-sm dark:border-slate-700/50 dark:bg-slate-800/50">
                <svg
                  className="h-4 w-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="border-none bg-transparent text-sm font-semibold text-slate-700 outline-none dark:text-slate-300"
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-xl border border-slate-200/60 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors outline-none hover:border-slate-300 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-300"
              >
                {[2023, 2024, 2025].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1920px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Top Stats Grid */}
        {
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <StatTile
              title="Total Orders"
              value={<LiveNumber value={statusTotals?.total || 0} maximumFractionDigits={0} />}
              colorClass="text-slate-900 dark:text-white"
              to="/user/orders"
              isLoading={isLoading}
            />
            <StatTile
              title="Open"
              value={<LiveNumber value={statusTotals?.pending || 0} maximumFractionDigits={0} />}
              colorClass="text-amber-600"
              to="/user/orders?ship=open"
              isLoading={isLoading}
            />
            <StatTile
              title="Delivered"
              value={<LiveNumber value={statusTotals?.delivered || 0} maximumFractionDigits={0} />}
              colorClass="text-emerald-600"
              to="/user/orders?ship=delivered"
              isLoading={isLoading}
            />
            <StatTile
              title="Picked Up"
              value={<LiveNumber value={statusTotals?.picked_up || 0} maximumFractionDigits={0} />}
              colorClass="text-blue-600"
              to="/user/orders?ship=picked_up"
              isLoading={isLoading}
            />
            <StatTile
              title="In Transit"
              value={<LiveNumber value={statusTotals?.in_transit || 0} maximumFractionDigits={0} />}
              colorClass="text-cyan-600"
              to="/user/orders?ship=in_transit"
              isLoading={isLoading}
            />
            <StatTile
              title="Cancelled"
              value={<LiveNumber value={statusTotals?.cancelled || 0} maximumFractionDigits={0} />}
              colorClass="text-rose-600"
              to="/user/orders?ship=cancelled"
              isLoading={isLoading}
            />
          </div>
        }

        {/* Profit/Loss Section */}
        {isLoading ? (
          <ProfitLossSkeleton />
        ) : (
          metrics?.profitLoss && (
            <DashboardCard>
              <div className="space-y-6">
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  Profit / Loss Overview
                </h4>

                {/* Main Profit Card - Enhanced with gradient */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white via-slate-50/50 to-white p-8 shadow-sm transition-all duration-300 hover:shadow-lg dark:from-slate-800/50 dark:via-slate-700/30 dark:to-slate-800/50">
                  {/* Decorative gradient overlay */}
                  <div
                    className={`absolute top-0 right-0 h-32 w-32 rounded-full opacity-20 blur-3xl ${metrics.profitLoss.isProfit ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  />

                  <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 dark:bg-slate-700/50">
                        <span className="text-xs font-bold tracking-wider text-slate-600 uppercase dark:text-slate-400">
                          {metrics.profitLoss.isProfit ? '📈 Net Profit' : '📉 Net Loss'}
                        </span>
                      </div>
                      <div
                        className={`text-5xl font-black tracking-tight lg:text-6xl ${metrics.profitLoss.isProfit ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}
                      >
                        {metrics.profitLoss.isProfit ? '+' : '-'}
                        <LiveNumber
                          value={Math.abs(metrics.profitLoss.profit || 0)}
                          prefix="AED "
                          maximumFractionDigits={2}
                        />
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-2 gap-4 md:grid-cols-3 lg:w-auto lg:grid-cols-6">
                      {[
                        {
                          label: 'Revenue',
                          val: metrics.profitLoss.revenue,
                          color: 'from-sky-500 to-blue-600',
                          text: 'text-sky-700 dark:text-sky-400',
                        },
                        {
                          label: 'Purchase Cost',
                          val: metrics.profitLoss.purchaseCost,
                          color: 'from-violet-500 to-purple-600',
                          text: 'text-violet-700 dark:text-violet-400',
                        },
                        {
                          label: 'Driver Comm',
                          val: metrics.profitLoss.driverCommission,
                          color: 'from-amber-500 to-orange-600',
                          text: 'text-amber-700 dark:text-amber-400',
                        },
                        {
                          label: 'Agent Comm',
                          val: metrics.profitLoss.agentCommission,
                          color: 'from-yellow-500 to-amber-600',
                          text: 'text-yellow-700 dark:text-yellow-400',
                        },
                        {
                          label: 'Investor Comm',
                          val: metrics.profitLoss.investorCommission,
                          color: 'from-pink-500 to-rose-600',
                          text: 'text-pink-700 dark:text-pink-400',
                        },
                        {
                          label: 'Ads',
                          val: metrics.profitLoss.advertisementExpense,
                          color: 'from-red-500 to-rose-600',
                          text: 'text-red-700 dark:text-red-400',
                        },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="group/card relative overflow-hidden rounded-xl border border-slate-200/60 bg-white/80 p-4 text-center shadow-sm backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:shadow-md dark:border-slate-700/50 dark:bg-slate-800/50"
                        >
                          <div
                            className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.color} opacity-75`}
                          />
                          <div className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {item.label}
                          </div>
                          <div className={`text-lg font-bold ${item.text}`}>
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

                {/* Country Breakdown - Enhanced grid layout */}
                <div>
                  <h4 className="mb-4 text-base font-bold text-slate-700 dark:text-slate-300">
                    Breakdown by Country
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {['KSA', 'UAE', 'Oman', 'Bahrain', 'India', 'Kuwait', 'Qatar'].map((c) => {
                      const profitData = metrics.profitLoss.byCountry?.[c]
                      if (!profitData) return null
                      const isProfit = (profitData.profit || 0) >= 0
                      const flag = COUNTRY_INFO[c]?.flag || ''
                      const currency = profitData.currency || 'AED'

                      return (
                        <div
                          key={c}
                          className={`group relative overflow-hidden rounded-xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                            isProfit
                              ? 'border-emerald-200/60 bg-gradient-to-br from-emerald-50/50 to-white hover:border-emerald-300 hover:shadow-emerald-100 dark:from-emerald-900/10 dark:to-slate-800/50'
                              : 'border-rose-200/60 bg-gradient-to-br from-rose-50/50 to-white hover:border-rose-300 hover:shadow-rose-100 dark:from-rose-900/10 dark:to-slate-800/50'
                          }`}
                        >
                          {/* Decorative corner accent */}
                          <div
                            className={`absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-30 ${
                              isProfit ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />

                          <div className="relative">
                            <div className="mb-4 flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-slate-700/50">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl drop-shadow-sm">{flag}</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {c === 'KSA' ? 'KSA' : c}
                                </span>
                              </div>
                              <div
                                className={`text-lg font-black ${isProfit ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}
                              >
                                {isProfit ? '+' : '-'}
                                {currency} {fmtAmt(Math.abs(profitData.profit || 0))}
                              </div>
                            </div>

                            <div className="space-y-2.5 text-sm">
                              {[
                                {
                                  l: 'Revenue',
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
                                  className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2 backdrop-blur-sm dark:bg-slate-800/30"
                                >
                                  <span className="font-medium text-slate-600 dark:text-slate-400">
                                    {r.l}:
                                  </span>
                                  <span className={`font-bold ${r.c}`}>
                                    {currency} {fmtAmt(r.v || 0)}
                                  </span>
                                </div>
                              ))}
                            </div>
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

        {/* Charts Section - Side by side with perfect alignment */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Sales Trend */}
          {isLoading ? (
            <ChartSkeleton title="Sales Trend" />
          ) : (
            analytics?.days && (
              <DashboardCard title="Sales Trend" subtitle="Last 7 days performance">
                <Chart
                  data={analytics.days}
                  countries={['UAE', 'Oman', 'KSA', 'Bahrain', 'India', 'Kuwait', 'Qatar']}
                  totals={analytics.totals}
                  height={280}
                />
              </DashboardCard>
            )
          )}

          {/* Status Summary */}
          <DashboardCard
            title="Order Status Summary"
            subtitle="Current order distribution"
            isLoading={isLoading}
          >
            {!isLoading && <OrderStatusPie statusTotals={statusTotals} />}
          </DashboardCard>
        </div>

        {/* Per-Country Performance - Enhanced Cards */}
        <DashboardCard
          title="Per-Country Performance"
          subtitle="Orders & Financials (Local Currency)"
          isLoading={isLoading}
        >
          {!isLoading && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {COUNTRY_LIST.map((c) => {
                const m = countryMetrics(c)
                const flag = COUNTRY_INFO[c]?.flag || ''
                const qs = encodeURIComponent(c)
                const cur = COUNTRY_INFO[c]?.cur || 'AED'

                return (
                  <div
                    key={c}
                    className="group relative overflow-hidden rounded-xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/30 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-slate-300/60 hover:shadow-xl dark:border-slate-700/50 dark:from-slate-800/50 dark:to-slate-800/30"
                  >
                    {/* Decorative gradient */}
                    <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 opacity-0 blur-2xl transition-opacity group-hover:opacity-10" />

                    <div className="relative">
                      <div className="mb-5 flex items-center gap-3 border-b border-slate-200/60 pb-4 dark:border-slate-700/50">
                        <span className="text-3xl drop-shadow-sm">{flag}</span>
                        <span className="text-lg font-bold text-slate-800 dark:text-slate-200">
                          {c === 'KSA' ? 'Saudi Arabia' : c}
                        </span>
                        <span className="ml-auto rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-700/50 dark:text-slate-300">
                          {cur}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {[
                          {
                            label: 'Total Orders',
                            value: fmtNum(m?.orders || 0),
                            link: `/user/orders?country=${qs}`,
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
                            link: `/user/orders?country=${qs}&ship=delivered`,
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
                            link: `/user/orders?country=${qs}&ship=open`,
                            color: 'text-amber-600 dark:text-amber-400',
                          },
                          {
                            label: 'Open Amt',
                            value: formatCurrency(m?.amountPending, c).replace(cur, '').trim(),
                            color: 'text-orange-600 dark:text-orange-400',
                          },
                        ].map((stat, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg bg-white/60 p-3 backdrop-blur-sm dark:bg-slate-800/30"
                          >
                            <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                              {stat.label}
                            </div>
                            {stat.link ? (
                              <NavLink
                                to={stat.link}
                                className={`text-base font-bold ${stat.color} hover:underline`}
                              >
                                {stat.value}
                              </NavLink>
                            ) : (
                              <div className={`text-base font-bold ${stat.color}`}>
                                {stat.value}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DashboardCard>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  )
}
