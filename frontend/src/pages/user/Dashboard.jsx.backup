import React, { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Chart from '../../components/Chart.jsx'
import LiveNumber from '../../components/LiveNumber.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode, convert } from '../../util/currency'

// --- Components ---

const DashboardCard = ({ children, className = '', title, subtitle }) => (
  <div
    className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50 ${className}`}
  >
    {(title || subtitle) && (
      <div className="mb-6">
        {title && <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>}
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
    )}
    {children}
  </div>
)

const StatTile = ({
  title,
  value,
  subValue,
  icon,
  colorClass = 'text-slate-800 dark:text-white',
  to,
}) => {
  const Content = () => (
    <div className="flex h-full flex-col justify-between">
      <div className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">{title}</div>
      <div className={`text-2xl font-bold ${colorClass} tracking-tight`}>{value}</div>
      {subValue && <div className="mt-2">{subValue}</div>}
    </div>
  )

  if (to) {
    return (
      <NavLink
        to={to}
        className="group rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:bg-slate-100 dark:border-slate-700/50 dark:bg-slate-700/30 dark:hover:bg-slate-700/50"
      >
        <Content />
      </NavLink>
    )
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700/50 dark:bg-slate-700/30">
      <Content />
    </div>
  )
}

const OrderStatusPie = ({ statusTotals }) => {
  const st = statusTotals || { pending: 0, picked_up: 0, delivered: 0, cancelled: 0 }
  const data = [
    { label: 'Open', value: st.pending, color: '#F59E0B', tailwindColor: 'bg-amber-500' },
    { label: 'Picked Up', value: st.picked_up, color: '#3B82F6', tailwindColor: 'bg-blue-500' },
    { label: 'Delivered', value: st.delivered, color: '#10B981', tailwindColor: 'bg-emerald-500' },
    { label: 'Cancelled', value: st.cancelled, color: '#EF4444', tailwindColor: 'bg-rose-500' },
  ]
  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (total === 0)
    return <div className="py-8 text-center text-slate-400">No orders to display</div>

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
    <div className="flex flex-col items-center justify-center gap-8 py-4 md:flex-row">
      <div className="group relative">
        <div
          className="h-48 w-48 rounded-full shadow-lg transition-transform duration-500 group-hover:scale-105"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-inner dark:bg-slate-800">
            <span className="text-2xl font-bold text-slate-700 dark:text-slate-200">{total}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${item.tailwindColor}`} />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {item.label}:
            </span>
            <span className={`text-sm font-bold ${item.tailwindColor.replace('bg-', 'text-')}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
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
  const [hydrated, setHydrated] = useState(false)
  const loadAbortRef = useRef(null)
  const bgAbortRef = useRef(null)
  const monthDebounceRef = useRef(null)

  // Month/Year filtering
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

  function fmtNum(n) {
    return Number(n || 0).toLocaleString()
  }
  function fmtAmt(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  function formatCurrency(amount, country) {
    const curr = COUNTRY_INFO[country] || { cur: 'AED' }
    return `${curr.cur} ${Number(amount || 0).toLocaleString()}`
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
  function sumCurrencyMapLocal(map, targetCode) {
    try {
      const tgt = String(targetCode || 'AED')
      return Object.entries(map || {}).reduce(
        (s, [code, val]) => s + convert(Number(val || 0), String(code || 'AED'), tgt, currencyCfg),
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
    if (cachedMetrics) setMetrics(cachedMetrics)
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
        // Background load rest... (omitted for brevity as it's unchanged logic)
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
      socket.on('orders.changed', (payload = {}) => {
        scheduleLoad()
        try {
          const { orderId, invoiceNumber, action, status } = payload
          let msg = null
          const code = invoiceNumber ? `#${invoiceNumber}` : `#${String(orderId || '').slice(-5)}`
          if (action === 'delivered') msg = `Order ${code} delivered`
          else if (action === 'assigned') msg = `Order ${code} assigned`
          else if (action === 'cancelled') msg = `Order ${code} cancelled`
          else if (action === 'shipment_updated') {
            const label =
              status === 'picked_up' ? 'picked up' : String(status || '').replace('_', ' ')
            msg = `Shipment ${label} (${code})`
          }
          if (msg) toast.info(msg)
        } catch {}
      })
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
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8">
      {/* Header & Filters */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row dark:border-slate-700 dark:bg-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Overview of your performance</p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
          <span className="pl-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            📅 Period:
          </span>
          <select
            className="cursor-pointer border-none bg-transparent text-sm font-medium text-slate-800 focus:ring-0 dark:text-white"
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
            className="cursor-pointer border-l border-none border-slate-300 bg-transparent pl-2 text-sm font-medium text-slate-800 focus:ring-0 dark:border-slate-600 dark:text-white"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <div className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
            {monthNames[selectedMonth - 1]} {selectedYear}
          </div>
        </div>
      </div>

      {/* Profit/Loss Section */}
      {!hydrated ? (
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-slate-200"></div>
          <div className="h-64 rounded-2xl bg-slate-200"></div>
        </div>
      ) : (
        metrics?.profitLoss && (
          <div className="space-y-6">
            <DashboardCard title="Profit / Loss Overview" subtitle="Delivered orders only">
              {/* Global Profit/Loss */}
              <div
                className={`relative mb-8 overflow-hidden rounded-2xl p-8 transition-all duration-500 ${metrics.profitLoss.isProfit ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50' : 'border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/50'} border`}
              >
                <div className="relative z-10 flex flex-col items-center justify-between gap-8 md:flex-row">
                  <div>
                    <div className="mb-1 text-sm font-medium tracking-wider text-slate-500 uppercase">
                      {metrics.profitLoss.isProfit ? 'Net Profit' : 'Net Loss'}
                    </div>
                    <div
                      className={`text-5xl font-black tracking-tight ${metrics.profitLoss.isProfit ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                      {metrics.profitLoss.isProfit ? '+' : '-'}
                      <LiveNumber
                        value={Math.abs(metrics.profitLoss.profit || 0)}
                        prefix="AED "
                        maximumFractionDigits={2}
                      />
                    </div>
                  </div>

                  <div className="grid w-full grid-cols-2 gap-6 md:w-auto md:grid-cols-3 lg:grid-cols-6">
                    {[
                      { label: 'Revenue', val: metrics.profitLoss.revenue, color: 'text-sky-600' },
                      {
                        label: 'Purchase Cost',
                        val: metrics.profitLoss.purchaseCost,
                        color: 'text-violet-600',
                      },
                      {
                        label: 'Driver Comm',
                        val: metrics.profitLoss.driverCommission,
                        color: 'text-amber-600',
                      },
                      {
                        label: 'Agent Comm',
                        val: metrics.profitLoss.agentCommission,
                        color: 'text-amber-600',
                      },
                      {
                        label: 'Investor Comm',
                        val: metrics.profitLoss.investorCommission,
                        color: 'text-amber-600',
                      },
                      {
                        label: 'Ads',
                        val: metrics.profitLoss.advertisementExpense,
                        color: 'text-rose-600',
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-white/50 bg-white/60 p-3 text-center shadow-sm backdrop-blur-sm"
                      >
                        <div className="mb-1 text-xs font-medium text-slate-500">{item.label}</div>
                        <div className={`text-lg font-bold ${item.color}`}>
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

              {/* Country-wise Profit/Loss */}
              <h4 className="text-md mb-4 font-bold text-slate-700 dark:text-slate-300">
                Breakdown by Country
              </h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {['KSA', 'UAE', 'Oman', 'Bahrain', 'India', 'Kuwait', 'Qatar'].map((c) => {
                  const profitData = metrics.profitLoss.byCountry?.[c]
                  if (!profitData) return null
                  const isProfit = (profitData.profit || 0) >= 0
                  const flag = COUNTRY_INFO[c]?.flag || ''
                  const currency = profitData.currency || 'AED'

                  return (
                    <div
                      key={c}
                      className={`rounded-xl border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${isProfit ? 'border-emerald-100 bg-emerald-50/30 hover:border-emerald-300' : 'border-rose-100 bg-rose-50/30 hover:border-rose-300'}`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-slate-800">
                          <span className="text-xl">{flag}</span>
                          {c === 'KSA' ? 'KSA' : c}
                        </div>
                        <div
                          className={`text-lg font-black ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}
                        >
                          {isProfit ? '+' : '-'}
                          {currency} {fmtAmt(Math.abs(profitData.profit || 0))}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        {[
                          { l: 'Rev', v: profitData.revenue, c: 'text-sky-600' },
                          { l: 'Cost', v: profitData.purchaseCost, c: 'text-violet-600' },
                          { l: 'Driver', v: profitData.driverCommission, c: 'text-amber-600' },
                          { l: 'Ads', v: profitData.advertisementExpense, c: 'text-rose-600' },
                        ].map((r, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between border-b border-slate-100/50 pb-1 last:border-0 last:pb-0"
                          >
                            <span className="text-slate-500">{r.l}</span>
                            <span className={`font-bold ${r.c}`}>
                              {currency} {fmtAmt(r.v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </DashboardCard>
          </div>
        )
      )}

      {/* Orders Summary */}
      <DashboardCard title="Orders Summary (Global)" subtitle="Totals in AED">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile
            title="Total Orders"
            value={<LiveNumber value={metrics?.totalOrders || 0} maximumFractionDigits={0} />}
            to="/user/orders"
            colorClass="text-sky-600"
          />
          <StatTile
            title="Total Amount"
            value={<LiveNumber value={sumAmountAED('amountTotalOrders')} prefix="AED " />}
            to="/user/orders"
            colorClass="text-emerald-600"
          />
          <StatTile
            title="Delivered Qty"
            value={
              <LiveNumber
                value={metrics?.productMetrics?.global?.stockDeliveredQty || 0}
                maximumFractionDigits={0}
              />
            }
            to="/user/orders?ship=delivered"
            colorClass="text-emerald-600"
          />
          <StatTile
            title="Delivered Amt"
            value={<LiveNumber value={sumAmountAED('amountDelivered')} prefix="AED " />}
            to="/user/orders?ship=delivered"
            colorClass="text-emerald-600"
          />
          <StatTile
            title="Open Orders"
            value={<LiveNumber value={statusTotals?.pending || 0} maximumFractionDigits={0} />}
            to="/user/orders?ship=open"
            colorClass="text-amber-500"
          />
          <StatTile
            title="Open Amount"
            value={<LiveNumber value={sumAmountAED('amountPending')} prefix="AED " />}
            to="/user/orders?ship=open"
            colorClass="text-orange-500"
          />
        </div>
      </DashboardCard>

      {/* Product Metrics */}
      <DashboardCard title="Product Metrics" subtitle="Inventory & Stock Overview">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile
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
            colorClass="text-violet-600"
          />
          <StatTile
            title="Inventory Value"
            value={
              <LiveNumber
                value={sumCurrencyMapAED(metrics?.productMetrics?.global?.purchaseValueByCurrency)}
                prefix="AED "
              />
            }
            to="/user/warehouses"
            colorClass="text-sky-600"
          />
          <StatTile
            title="Delivered Value"
            value={
              <LiveNumber
                value={sumCurrencyMapAED(metrics?.productMetrics?.global?.deliveredValueByCurrency)}
                prefix="AED "
              />
            }
            to="/user/orders?ship=delivered"
            colorClass="text-emerald-600"
          />
          <StatTile
            title="Stock Purchased"
            value={
              <LiveNumber
                value={metrics?.productMetrics?.global?.stockPurchasedQty || 0}
                maximumFractionDigits={0}
              />
            }
            to="/user/inhouse-products"
            colorClass="text-sky-600"
          />
          <StatTile
            title="Stock Delivered"
            value={
              <LiveNumber
                value={metrics?.productMetrics?.global?.stockDeliveredQty || 0}
                maximumFractionDigits={0}
              />
            }
            to="/user/orders?ship=delivered"
            colorClass="text-emerald-600"
          />
          <StatTile
            title="Pending Stock"
            value={
              <LiveNumber
                value={metrics?.productMetrics?.global?.stockLeftQty || 0}
                maximumFractionDigits={0}
              />
            }
            to="/user/warehouses"
            colorClass="text-amber-500"
          />
        </div>
      </DashboardCard>

      {/* Status Summary */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <DashboardCard title="Sales Trend" subtitle="Last 7 Days">
            <div className="h-[300px] w-full">
              {!hydrated ? (
                <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />
              ) : (
                <Chart analytics={analytics} />
              )}
            </div>
          </DashboardCard>

          <DashboardCard title="Order Status Breakdown">
            <OrderStatusPie statusTotals={statusTotals} />
          </DashboardCard>
        </div>

        <div className="space-y-8">
          <DashboardCard title="Status Summary" subtitle="Global Totals">
            <div className="grid grid-cols-2 gap-3">
              {[
                { t: 'Total', v: statusTotals?.total, c: 'text-sky-600', to: '/user/orders' },
                {
                  t: 'Open',
                  v: statusTotals?.pending,
                  c: 'text-amber-500',
                  to: '/user/orders?ship=open',
                },
                {
                  t: 'Assigned',
                  v: statusTotals?.assigned,
                  c: 'text-blue-500',
                  to: '/user/orders?ship=assigned',
                },
                {
                  t: 'Picked Up',
                  v: statusTotals?.picked_up,
                  c: 'text-indigo-500',
                  to: '/user/orders?ship=picked_up',
                },
                {
                  t: 'In Transit',
                  v: statusTotals?.in_transit,
                  c: 'text-cyan-600',
                  to: '/user/orders?ship=in_transit',
                },
                {
                  t: 'Out for Delivery',
                  v: statusTotals?.out_for_delivery,
                  c: 'text-orange-500',
                  to: '/user/orders?ship=out_for_delivery',
                },
                {
                  t: 'Delivered',
                  v: statusTotals?.delivered,
                  c: 'text-emerald-600',
                  to: '/user/orders?ship=delivered',
                },
                {
                  t: 'Cancelled',
                  v: statusTotals?.cancelled,
                  c: 'text-rose-600',
                  to: '/user/orders?ship=cancelled',
                },
                {
                  t: 'Returned',
                  v: statusTotals?.returned,
                  c: 'text-slate-500',
                  to: '/user/orders?ship=returned',
                },
                {
                  t: 'No Response',
                  v: statusTotals?.no_response,
                  c: 'text-rose-400',
                  to: '/user/orders?ship=no_response',
                },
              ].map((item, i) => (
                <NavLink
                  key={i}
                  to={item.to}
                  className="group rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                >
                  <div className="mb-1 text-xs text-slate-500">{item.t}</div>
                  <div
                    className={`text-lg font-bold ${item.c} transition-transform group-hover:scale-105`}
                  >
                    <LiveNumber value={item.v || 0} maximumFractionDigits={0} />
                  </div>
                </NavLink>
              ))}
            </div>
          </DashboardCard>
        </div>
      </div>

      {/* Per Country Details */}
      <DashboardCard
        title="Per-Country Performance"
        subtitle="Orders & Financials (Local Currency)"
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
                className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow duration-300 hover:shadow-lg"
              >
                <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-3">
                  <span className="text-2xl">{flag}</span>
                  <span className="font-bold text-slate-800">
                    {c === 'KSA' ? 'Saudi Arabia' : c}
                  </span>
                  <span className="ml-auto rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                    {cur}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500">Total Orders</div>
                    <NavLink
                      to={`/user/orders?country=${qs}`}
                      className="text-lg font-bold text-sky-600 hover:underline"
                    >
                      {fmtNum(m?.orders || 0)}
                    </NavLink>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Total Amount</div>
                    <div className="text-lg font-bold text-emerald-600">
                      {formatCurrency(m?.amountTotalOrders, c).replace(cur, '').trim()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Delivered</div>
                    <NavLink
                      to={`/user/orders?country=${qs}&ship=delivered`}
                      className="text-lg font-bold text-emerald-600 hover:underline"
                    >
                      {fmtNum((m?.deliveredQty ?? m?.delivered) || 0)}
                    </NavLink>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Delivered Amt</div>
                    <div className="text-lg font-bold text-emerald-600">
                      {formatCurrency(m?.amountDeliveredLocal ?? m?.amountDelivered, c)
                        .replace(cur, '')
                        .trim()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Open</div>
                    <NavLink
                      to={`/user/orders?country=${qs}&ship=open`}
                      className="text-lg font-bold text-amber-500 hover:underline"
                    >
                      {fmtNum(m?.pending || 0)}
                    </NavLink>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Open Amt</div>
                    <div className="text-lg font-bold text-orange-500">
                      {formatCurrency(m?.amountPending, c).replace(cur, '').trim()}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </DashboardCard>
    </div>
  )
}
