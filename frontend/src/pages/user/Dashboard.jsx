import React, { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Chart from '../../components/Chart.jsx'
import LiveNumber from '../../components/LiveNumber.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode } from '../../util/currency'

// --- UI Components ---

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`} />
)

const Card = ({ children, className = '', title, subtitle, loading = false }) => (
  <div
    className={`overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-[#1E293B] ${className}`}
  >
    <div className="p-6">
      {(title || subtitle) && (
        <div className="mb-6">
          {loading ? (
            <>
              <Skeleton className="mb-2 h-6 w-48" />
              {subtitle && <Skeleton className="h-4 w-32" />}
            </>
          ) : (
            <>
              {title && (
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
              )}
              {subtitle && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
              )}
            </>
          )}
        </div>
      )}
      {children}
    </div>
  </div>
)

const StatCard = ({
  title,
  value,
  to,
  colorClass = 'text-slate-900 dark:text-white',
  loading = false,
}) => {
  const Content = () => (
    <div className="flex h-full flex-col justify-between">
      <p className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <h3 className={`text-3xl font-black tracking-tight ${colorClass}`}>{value}</h3>
      )}
    </div>
  )

  if (to && !loading) {
    return (
      <NavLink to={to} className="group block h-full transition-transform hover:-translate-y-1">
        <div className="h-full rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow group-hover:shadow-md dark:border-slate-800 dark:bg-[#1E293B]">
          <Content />
        </div>
      </NavLink>
    )
  }

  return (
    <div className="h-full rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#1E293B]">
      <Content />
    </div>
  )
}

const OrderStatusPie = ({ statusTotals, loading }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-8 py-4 md:flex-row">
        <Skeleton className="h-48 w-48 rounded-full" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-6 w-32" />
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
      bg: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Picked Up',
      value: st.picked_up,
      color: '#3B82F6',
      bg: 'bg-blue-500',
      text: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Delivered',
      value: st.delivered,
      color: '#10B981',
      bg: 'bg-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Cancelled',
      value: st.cancelled,
      color: '#EF4444',
      bg: 'bg-rose-500',
      text: 'text-rose-600 dark:text-rose-400',
    },
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
    <div className="flex flex-col items-center justify-center gap-10 py-6 md:flex-row">
      <div className="relative">
        <div
          className="h-56 w-56 rounded-full shadow-lg"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full bg-white dark:bg-[#1E293B]">
            <span className="text-4xl font-black text-slate-900 dark:text-white">{total}</span>
            <span className="text-xs font-bold text-slate-400 uppercase">Total Orders</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${item.bg}`} />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {item.label}
            </span>
            <span className={`text-sm font-bold ${item.text}`}>{item.value}</span>
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
  const [salesByCountry, setSalesByCountry] = useState({})

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

    // Show cached data immediately
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
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 font-sans sm:px-6 lg:px-8 dark:bg-[#020617]">
      <div className="mx-auto max-w-[1600px] space-y-8">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Performance Overview & Analytics
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

        {/* Profit/Loss */}
        <Card title="Profit / Loss Overview" subtitle="Delivered orders only" loading={loading}>
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
            <div className="space-y-8">
              <div
                className={`rounded-3xl p-8 ${
                  metrics.profitLoss.isProfit
                    ? 'bg-emerald-50 dark:bg-emerald-900/10'
                    : 'bg-rose-50 dark:bg-rose-900/10'
                }`}
              >
                <div className="flex flex-col items-center justify-between gap-10 lg:flex-row">
                  <div className="text-center lg:text-left">
                    <div className="mb-2 text-sm font-bold tracking-widest text-slate-500 uppercase dark:text-slate-400">
                      {metrics.profitLoss.isProfit ? 'Net Profit' : 'Net Loss'}
                    </div>
                    <div
                      className={`text-6xl font-black tracking-tighter ${
                        metrics.profitLoss.isProfit
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {metrics.profitLoss.isProfit ? '+' : '-'}
                      <LiveNumber
                        value={Math.abs(metrics.profitLoss.profit || 0)}
                        prefix="AED "
                        maximumFractionDigits={2}
                      />
                    </div>
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
                      <div key={i} className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800">
                        <p className="text-xs font-bold text-slate-500 uppercase dark:text-slate-400">
                          {item.label}
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
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

              {/* Country Breakdown */}
              <div>
                <h4 className="mb-6 text-lg font-bold text-slate-900 dark:text-white">
                  Geographic Breakdown
                </h4>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {['KSA', 'UAE', 'Oman', 'Bahrain', 'India', 'Kuwait', 'Qatar'].map((c) => {
                    const profitData = metrics.profitLoss.byCountry?.[c]
                    if (!profitData) return null
                    const isProfit = (profitData.profit || 0) >= 0
                    const flag = COUNTRY_INFO[c]?.flag || ''
                    const currency = profitData.currency || 'AED'

                    return (
                      <div
                        key={c}
                        className={`rounded-2xl border p-6 transition-shadow hover:shadow-lg ${
                          isProfit
                            ? 'border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-900/10'
                            : 'border-rose-100 bg-rose-50/30 dark:border-rose-900/30 dark:bg-rose-900/10'
                        }`}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3 font-bold text-slate-900 dark:text-white">
                            <span className="text-2xl">{flag}</span>
                            {c === 'KSA' ? 'KSA' : c}
                          </div>
                          <div
                            className={`text-xl font-black ${
                              isProfit
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isProfit ? '+' : '-'}
                            {currency} {fmtAmt(Math.abs(profitData.profit || 0))}
                          </div>
                        </div>

                        <div className="space-y-3 text-sm">
                          {[
                            { l: 'Revenue', v: profitData.revenue },
                            { l: 'Cost', v: profitData.purchaseCost },
                            { l: 'Driver', v: profitData.driverCommission },
                            { l: 'Ads', v: profitData.advertisementExpense },
                          ].map((r, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0 dark:border-slate-700"
                            >
                              <span className="font-medium text-slate-500 dark:text-slate-400">
                                {r.l}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-white">
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
        </Card>

        {/* Orders Summary */}
        <Card title="Orders Summary (Global)" subtitle="Totals in AED" loading={loading}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              title="Total Orders"
              value={<LiveNumber value={metrics?.totalOrders || 0} maximumFractionDigits={0} />}
              to="/user/orders"
              loading={loading}
              colorClass="text-sky-600 dark:text-sky-400"
            />
            <StatCard
              title="Total Amount"
              value={<LiveNumber value={sumAmountAED('amountTotalOrders')} prefix="AED " />}
              to="/user/orders"
              loading={loading}
              colorClass="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              title="Delivered Qty"
              value={
                <LiveNumber
                  value={metrics?.productMetrics?.global?.stockDeliveredQty || 0}
                  maximumFractionDigits={0}
                />
              }
              to="/user/orders?ship=delivered"
              loading={loading}
              colorClass="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              title="Delivered Amt"
              value={<LiveNumber value={sumAmountAED('amountDelivered')} prefix="AED " />}
              to="/user/orders?ship=delivered"
              loading={loading}
              colorClass="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              title="Open Orders"
              value={<LiveNumber value={statusTotals?.pending || 0} maximumFractionDigits={0} />}
              to="/user/orders?ship=open"
              loading={loading}
              colorClass="text-amber-500 dark:text-amber-400"
            />
            <StatCard
              title="Open Amount"
              value={<LiveNumber value={sumAmountAED('amountPending')} prefix="AED " />}
              to="/user/orders?ship=open"
              loading={loading}
              colorClass="text-orange-500 dark:text-orange-400"
            />
          </div>
        </Card>

        {/* Product Metrics */}
        <Card title="Product Metrics" subtitle="Inventory & Stock Overview" loading={loading}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              title="Total Purchase"
              value={
                <LiveNumber
                  value={sumCurrencyMapAED(
                    metrics?.productMetrics?.global?.totalPurchaseValueByCurrency
                  )}
                  prefix="AED "
                />
              }
              to="/user/inhouse-products"
              loading={loading}
              colorClass="text-violet-600 dark:text-violet-400"
            />
            <StatCard
              title="Inventory Value"
              value={
                <LiveNumber
                  value={sumCurrencyMapAED(
                    metrics?.productMetrics?.global?.purchaseValueByCurrency
                  )}
                  prefix="AED "
                />
              }
              to="/user/warehouses"
              loading={loading}
              colorClass="text-sky-600 dark:text-sky-400"
            />
            <StatCard
              title="Delivered Value"
              value={
                <LiveNumber
                  value={sumCurrencyMapAED(
                    metrics?.productMetrics?.global?.deliveredValueByCurrency
                  )}
                  prefix="AED "
                />
              }
              to="/user/orders?ship=delivered"
              loading={loading}
              colorClass="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              title="Stock Purchased"
              value={
                <LiveNumber
                  value={metrics?.productMetrics?.global?.stockPurchasedQty || 0}
                  maximumFractionDigits={0}
                />
              }
              to="/user/inhouse-products"
              loading={loading}
              colorClass="text-sky-600 dark:text-sky-400"
            />
            <StatCard
              title="Stock Delivered"
              value={
                <LiveNumber
                  value={metrics?.productMetrics?.global?.stockDeliveredQty || 0}
                  maximumFractionDigits={0}
                />
              }
              to="/user/orders?ship=delivered"
              loading={loading}
              colorClass="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              title="Pending Stock"
              value={
                <LiveNumber
                  value={metrics?.productMetrics?.global?.stockLeftQty || 0}
                  maximumFractionDigits={0}
                />
              }
              to="/user/warehouses"
              loading={loading}
              colorClass="text-amber-500 dark:text-amber-400"
            />
          </div>
        </Card>

        {/* Charts & Status */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <Card title="Sales Trend" subtitle="Last 7 Days" loading={loading}>
              <div className="h-[300px] w-full">
                {!hydrated || loading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <Chart analytics={analytics} />
                )}
              </div>
            </Card>

            <Card title="Order Status Breakdown" loading={loading}>
              <OrderStatusPie statusTotals={statusTotals} loading={loading} />
            </Card>
          </div>

          <div>
            <Card title="Status Summary" subtitle="Global Totals" loading={loading}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    t: 'Total',
                    v: statusTotals?.total,
                    c: 'text-sky-600 dark:text-sky-400',
                    to: '/user/orders',
                  },
                  {
                    t: 'Open',
                    v: statusTotals?.pending,
                    c: 'text-amber-500 dark:text-amber-400',
                    to: '/user/orders?ship=open',
                  },
                  {
                    t: 'Assigned',
                    v: statusTotals?.assigned,
                    c: 'text-blue-500 dark:text-blue-400',
                    to: '/user/orders?ship=assigned',
                  },
                  {
                    t: 'Picked Up',
                    v: statusTotals?.picked_up,
                    c: 'text-indigo-500 dark:text-indigo-400',
                    to: '/user/orders?ship=picked_up',
                  },
                  {
                    t: 'In Transit',
                    v: statusTotals?.in_transit,
                    c: 'text-cyan-600 dark:text-cyan-400',
                    to: '/user/orders?ship=in_transit',
                  },
                  {
                    t: 'Out for Delivery',
                    v: statusTotals?.out_for_delivery,
                    c: 'text-orange-500 dark:text-orange-400',
                    to: '/user/orders?ship=out_for_delivery',
                  },
                  {
                    t: 'Delivered',
                    v: statusTotals?.delivered,
                    c: 'text-emerald-600 dark:text-emerald-400',
                    to: '/user/orders?ship=delivered',
                  },
                  {
                    t: 'Cancelled',
                    v: statusTotals?.cancelled,
                    c: 'text-rose-600 dark:text-rose-400',
                    to: '/user/orders?ship=cancelled',
                  },
                  {
                    t: 'Returned',
                    v: statusTotals?.returned,
                    c: 'text-slate-500 dark:text-slate-400',
                    to: '/user/orders?ship=returned',
                  },
                  {
                    t: 'No Response',
                    v: statusTotals?.no_response,
                    c: 'text-rose-400 dark:text-rose-300',
                    to: '/user/orders?ship=no_response',
                  },
                ].map((item, i) => (
                  <NavLink
                    key={i}
                    to={item.to}
                    className="group rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
                  >
                    {loading ? (
                      <Skeleton className="h-14 w-full" />
                    ) : (
                      <>
                        <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">
                          {item.t}
                        </div>
                        <div
                          className={`text-lg font-bold transition-transform group-hover:scale-105 ${item.c}`}
                        >
                          <LiveNumber value={item.v || 0} maximumFractionDigits={0} />
                        </div>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Per-Country Performance */}
        <Card
          title="Per-Country Performance"
          subtitle="Orders & Financials (Local Currency)"
          loading={loading}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {COUNTRY_LIST.map((c) => {
              const m = countryMetrics(c)
              const flag = COUNTRY_INFO[c]?.flag || ''
              const qs = encodeURIComponent(c)
              const cur = COUNTRY_INFO[c]?.cur || 'AED'

              return (
                <div
                  key={c}
                  className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-lg dark:border-slate-700 dark:bg-[#1E293B]"
                >
                  <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3 dark:border-slate-700">
                    <span className="text-2xl">{flag}</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {c === 'KSA' ? 'Saudi Arabia' : c}
                    </span>
                    <span className="ml-auto rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {cur}
                    </span>
                  </div>

                  {loading ? (
                    <div className="grid grid-cols-2 gap-4">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Total Orders
                        </div>
                        <NavLink
                          to={`/user/orders?country=${qs}`}
                          className="text-lg font-bold text-sky-600 hover:underline dark:text-sky-400"
                        >
                          {fmtNum(m?.orders || 0)}
                        </NavLink>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Total Amount
                        </div>
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(m?.amountTotalOrders, c).replace(cur, '').trim()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Delivered</div>
                        <NavLink
                          to={`/user/orders?country=${qs}&ship=delivered`}
                          className="text-lg font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                        >
                          {fmtNum((m?.deliveredQty ?? m?.delivered) || 0)}
                        </NavLink>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Delivered Amt
                        </div>
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(m?.amountDeliveredLocal ?? m?.amountDelivered, c)
                            .replace(cur, '')
                            .trim()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Open</div>
                        <NavLink
                          to={`/user/orders?country=${qs}&ship=open`}
                          className="text-lg font-bold text-amber-500 hover:underline dark:text-amber-400"
                        >
                          {fmtNum(m?.pending || 0)}
                        </NavLink>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Open Amt</div>
                        <div className="text-lg font-bold text-orange-500 dark:text-orange-400">
                          {formatCurrency(m?.amountPending, c).replace(cur, '').trim()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
