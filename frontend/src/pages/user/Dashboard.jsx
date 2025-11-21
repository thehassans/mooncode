import React, { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Chart from '../../components/Chart.jsx'
import LiveNumber from '../../components/LiveNumber.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode } from '../../util/currency'
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  ShoppingBagIcon,
  TruckIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline'

// --- UI Components ---

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`} />
)

const Card = ({ children, className = '', noPadding = false }) => (
  <div
    className={`overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] dark:border-slate-800 dark:bg-[#1E293B] dark:shadow-none dark:hover:bg-[#253045] ${className}`}
  >
    <div className={noPadding ? '' : 'p-6'}>{children}</div>
  </div>
)

const StatCard = ({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  trendValue,
  loading,
  to,
  delay = 0,
}) => {
  const Content = () => (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <h3 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {value}
              </h3>
            )}
          </div>
        </div>
        {Icon && (
          <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>

      {(subValue || trend) && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          {loading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <>
              {trend && (
                <span
                  className={`flex items-center font-bold ${trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                >
                  {trend === 'up' ? (
                    <ArrowTrendingUpIcon className="mr-1 h-4 w-4" />
                  ) : (
                    <ArrowTrendingDownIcon className="mr-1 h-4 w-4" />
                  )}
                  {trendValue}
                </span>
              )}
              <span className="text-slate-400 dark:text-slate-500">{subValue}</span>
            </>
          )}
        </div>
      )}
    </div>
  )

  const wrapperClass = 'relative h-full transition-transform duration-300 hover:-translate-y-1'

  if (to) {
    return (
      <NavLink to={to} className={wrapperClass}>
        <Card className="h-full" noPadding={false}>
          <Content />
        </Card>
      </NavLink>
    )
  }

  return (
    <div className={wrapperClass}>
      <Card className="h-full" noPadding={false}>
        <Content />
      </Card>
    </div>
  )
}

// --- Cache Logic ---
const __dashCache = new Map()
const DASH_TTL = 60 * 1000 // 60s
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
  const loadAbortRef = useRef(null)
  const monthDebounceRef = useRef(null)

  // Month/Year filtering
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const [currencyCfg, setCurrencyCfg] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [salesByCountry, setSalesByCountry] = useState({})

  // --- Helpers ---
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

  // AED conversion helpers
  function toAED(amount, country) {
    try {
      const code = COUNTRY_INFO[country]?.cur || 'AED'
      return toAEDByCode(Number(amount || 0), code, currencyCfg)
    } catch {
      return Number(amount || 0)
    }
  }
  function toAEDByCodeHelper(amount, code) {
    try {
      return toAEDByCode(Number(amount || 0), String(code || 'AED'), currencyCfg)
    } catch {
      return Number(amount || 0)
    }
  }
  function sumCurrencyMapAED(map) {
    try {
      return Object.entries(map || {}).reduce(
        (s, [code, val]) => s + toAEDByCodeHelper(Number(val || 0), code),
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
    setLoading(true)
    const dateRange = getMonthDateRange()
    const dateParams = `from=${encodeURIComponent(dateRange.from)}&to=${encodeURIComponent(dateRange.to)}`

    const seq = (loadSeqRef.current = loadSeqRef.current + 1)
    try {
      loadAbortRef.current && loadAbortRef.current.abort()
    } catch {}
    const controller = new AbortController()
    loadAbortRef.current = controller

    // Check cache
    const cachedAnalytics = cacheGet('analytics', dateParams)
    if (cachedAnalytics) setAnalytics(cachedAnalytics)
    const cachedMetrics = cacheGet('metrics', dateParams)
    if (cachedMetrics) setMetrics(cachedMetrics)
    const cachedSales = cacheGet('salesByCountry', dateParams)
    if (cachedSales) setSalesByCountry(cachedSales)

    if (cachedMetrics) setLoading(false)

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
      setLoading(false)

      // Background fetch
      apiGet(`/api/orders/analytics/last7days?${dateParams}`, { signal: controller.signal })
        .then((res) => {
          if (loadSeqRef.current !== seq) return
          if (res) {
            setAnalytics(res)
            cacheSet('analytics', dateParams, res)
          }
        })
        .catch(() => {})

      apiGet(`/api/reports/user-metrics/sales-by-country?${dateParams}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (loadSeqRef.current !== seq) return
          if (res) {
            setSalesByCountry(res)
            cacheSet('salesByCountry', dateParams, res)
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

  // Socket listener
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
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 font-sans text-slate-900 sm:px-6 lg:px-8 dark:bg-[#020617] dark:text-white">
      <div className="mx-auto max-w-[1600px] space-y-8">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Overview of your business performance
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            <select
              className="cursor-pointer rounded-full border-none bg-transparent py-2 pr-8 pl-4 text-sm font-bold text-slate-700 focus:ring-0 dark:text-white"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <select
              className="cursor-pointer rounded-full border-none bg-transparent py-2 pr-8 pl-4 text-sm font-bold text-slate-700 focus:ring-0 dark:text-white"
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

        {/* Profit / Loss Section */}
        <Card className="relative overflow-hidden">
          {loading ? (
            <div className="space-y-8">
              <Skeleton className="h-24 w-full rounded-xl" />
              <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            </div>
          ) : metrics?.profitLoss ? (
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase ${
                      metrics.profitLoss.isProfit
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                    }`}
                  >
                    {metrics.profitLoss.isProfit ? 'Net Profit' : 'Net Loss'}
                  </span>
                </div>
                <div
                  className={`text-6xl font-black tracking-tighter ${
                    metrics.profitLoss.isProfit
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {metrics.profitLoss.isProfit ? '+' : '-'}
                  <LiveNumber value={Math.abs(metrics.profitLoss.profit || 0)} prefix="AED " />
                </div>
                <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total earnings for {monthNames[selectedMonth - 1]} {selectedYear}
                </p>
              </div>

              <div className="grid flex-[2] grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  {
                    label: 'Revenue',
                    val: metrics.profitLoss.revenue,
                    color: 'text-slate-900 dark:text-white',
                  },
                  {
                    label: 'Cost',
                    val: metrics.profitLoss.purchaseCost,
                    color: 'text-slate-600 dark:text-slate-400',
                  },
                  {
                    label: 'Driver',
                    val: metrics.profitLoss.driverCommission,
                    color: 'text-slate-600 dark:text-slate-400',
                  },
                  {
                    label: 'Agent',
                    val: metrics.profitLoss.agentCommission,
                    color: 'text-slate-600 dark:text-slate-400',
                  },
                  {
                    label: 'Investor',
                    val: metrics.profitLoss.investorCommission,
                    color: 'text-slate-600 dark:text-slate-400',
                  },
                  {
                    label: 'Ads',
                    val: metrics.profitLoss.advertisementExpense,
                    color: 'text-slate-600 dark:text-slate-400',
                  },
                ].map((item, i) => (
                  <div key={i} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
                    <p className="text-xs font-bold text-slate-500 uppercase dark:text-slate-500">
                      {item.label}
                    </p>
                    <p className={`mt-1 text-lg font-bold ${item.color}`}>
                      <LiveNumber value={item.val || 0} prefix="AED " maximumFractionDigits={0} />
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Orders"
            value={<LiveNumber value={metrics?.totalOrders || 0} maximumFractionDigits={0} />}
            icon={ShoppingBagIcon}
            loading={loading}
            to="/user/orders"
          />
          <StatCard
            title="Total Revenue"
            value={<LiveNumber value={sumAmountAED('amountTotalOrders')} prefix="AED " />}
            icon={CurrencyDollarIcon}
            loading={loading}
            to="/user/orders"
          />
          <StatCard
            title="Delivered"
            value={
              <LiveNumber
                value={metrics?.productMetrics?.global?.stockDeliveredQty || 0}
                maximumFractionDigits={0}
              />
            }
            subValue="Items"
            icon={TruckIcon}
            loading={loading}
            to="/user/orders?ship=delivered"
          />
          <StatCard
            title="Inventory Value"
            value={
              <LiveNumber
                value={sumCurrencyMapAED(metrics?.productMetrics?.global?.purchaseValueByCurrency)}
                prefix="AED "
              />
            }
            icon={ArchiveBoxIcon}
            loading={loading}
            to="/user/warehouses"
          />
        </div>

        {/* Charts & Breakdown */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="h-full">
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <Chart analytics={analytics} />
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Geographic Profit</h3>
            <div className="space-y-4">
              {['KSA', 'UAE', 'Oman', 'Bahrain', 'India', 'Kuwait', 'Qatar'].map((c) => {
                const profitData = metrics?.profitLoss?.byCountry?.[c]
                if (!profitData) return null
                const isProfit = (profitData.profit || 0) >= 0
                const flag = COUNTRY_INFO[c]?.flag || ''

                return (
                  <div
                    key={c}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#1E293B]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{flag}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {c === 'KSA' ? 'Saudi Arabia' : c}
                      </span>
                    </div>
                    <div
                      className={`font-black ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                    >
                      {isProfit ? '+' : '-'}
                      {profitData.currency || 'AED'} {fmtAmt(Math.abs(profitData.profit || 0))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
