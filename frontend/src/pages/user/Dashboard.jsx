import React, { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Chart from '../../components/Chart.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode } from '../../util/currency'
import DateRangeChips from '../../ui/DateRangeChips.jsx'

const OrderStatusPie = ({ statusTotals }) => {
  const st = statusTotals || { pending:0, picked_up:0, delivered:0, cancelled:0 }
  const data = [
    { label: 'Open', value: st.pending, color: '#F59E0B' },
    { label: 'Picked Up', value: st.picked_up, color: '#3B82F6' },
    { label: 'Delivered', value: st.delivered, color: '#10B981' },
    { label: 'Cancelled', value: st.cancelled, color: '#EF4444' },
  ];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <div>No orders</div>;
  let cumulative = 0;
  const gradient = data.map(item => {
    const percentage = (item.value / total) * 360;
    const start = cumulative;
    cumulative += percentage;
    return `${item.color} ${start}deg ${cumulative}deg`;
  }).join(', ');
  return (
    <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap:'wrap', gap:20}}>
      <div style={{width: 200, height: 200, borderRadius: '50%', background: `conic-gradient(${gradient})`, boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}></div>
      <div style={{display:'grid', gap:8}}>
        {data.map((item, idx) => (
          <div key={idx} style={{display: 'flex', alignItems: 'center', gap:8}}>
            <div style={{width: 14, height: 14, background: item.color, marginRight: 4, borderRadius:3}}></div>
            <span style={{fontWeight:600}}>{item.label}:</span>
            <span style={{fontWeight:800, color:item.color}}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function UserDashboard(){
  const toast = useToast()
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
    countries: {
      KSA: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      Oman: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      UAE: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      Bahrain: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      India: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      Kuwait: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      Qatar: { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
      'Saudi Arabia': { sales: 0, orders: 0, pickedUp: 0, delivered: 0, transit: 0, driverExpense: 0 },
    }
  })
  
  // Currency formatter helper
  const formatCurrency = (amount, country) => {
    const currencies = {
      'KSA': { code: 'SAR', symbol: 'SAR' },
      'Saudi Arabia': { code: 'SAR', symbol: 'SAR' },
      'Oman': { code: 'OMR', symbol: 'OMR' },
      'UAE': { code: 'AED', symbol: 'AED' },
      'Bahrain': { code: 'BHD', symbol: 'BHD' },
      'India': { code: 'INR', symbol: 'INR' },
      'Kuwait': { code: 'KWD', symbol: 'KWD' },
      'Qatar': { code: 'QAR', symbol: 'QAR' },
      'PKR': { code: 'PKR', symbol: 'PKR' },
    }
    const curr = currencies[country] || { code: 'AED', symbol: 'AED' }
    return `${curr.symbol} ${Number(amount || 0).toLocaleString()}`
  }
  const me = JSON.parse(localStorage.getItem('me')||'{}')
  const [analytics, setAnalytics] = useState(null)
  const [salesByCountry, setSalesByCountry] = useState({ KSA:0, Oman:0, UAE:0, Bahrain:0, India:0, Kuwait:0, Qatar:0, Other:0 })
  const [orders, setOrders] = useState([])
  const [drivers, setDrivers] = useState([])
  const [range, setRange] = useState('last7') // today | last7 | last30

  const rangeDates = useMemo(()=>{
    try{
      const now = new Date()
      const end = new Date(now); end.setHours(23,59,59,999)
      let from
      if (range==='today'){
        const s = new Date(now); s.setHours(0,0,0,0); from = s
      } else if (range==='last30'){
        const s = new Date(now); s.setDate(now.getDate()-29); s.setHours(0,0,0,0); from = s
      } else { // last7
        const s = new Date(now); s.setDate(now.getDate()-6); s.setHours(0,0,0,0); from = s
      }
      return { from: from.toISOString(), to: end.toISOString() }
    }catch{ return null }
  }, [range])
  const qsRangeBare = useMemo(()=>{
    try{ return (rangeDates && rangeDates.from && rangeDates.to) ? `fromDate=${encodeURIComponent(rangeDates.from)}&toDate=${encodeURIComponent(rangeDates.to)}` : '' }catch{ return '' }
  }, [rangeDates])
  const appendRange = (url)=> qsRangeBare ? (url + (url.includes('?') ? '&' : '?') + qsRangeBare) : url
  // Union filter: include all open orders (any date) OR created in range OR delivered in range
  const OPEN_STATUSES = useMemo(()=> ['pending','assigned','picked_up','in_transit','out_for_delivery','no_response'], [])
  const isOpenStatus = (s)=> OPEN_STATUSES.includes(String(s||'').toLowerCase())
  const includeByRangeOrOpen = (o)=>{
    try{
      const s = String(o?.shipmentStatus||'').toLowerCase()
      if (isOpenStatus(s)) return true
      if (!rangeDates || !rangeDates.from || !rangeDates.to) return true
      const fromTs = new Date(rangeDates.from).getTime()
      const toTs = new Date(rangeDates.to).getTime()
      const cAt = o?.createdAt ? new Date(o.createdAt).getTime() : null
      const dAt = o?.deliveredAt ? new Date(o.deliveredAt).getTime() : null
      const createdIn = (cAt!=null && cAt>=fromTs && cAt<=toTs)
      const deliveredIn = (dAt!=null && dAt>=fromTs && dAt<=toTs)
      return createdIn || deliveredIn
    }catch{ return true }
  }
  const driverCountrySummary = useMemo(()=>{
    const canonical = (c)=> (c === 'Saudi Arabia' ? 'KSA' : String(c||''))
    const currencyByCountry = { KSA:'SAR', UAE:'AED', Oman:'OMR', Bahrain:'BHD', India:'INR', Kuwait:'KWD', Qatar:'QAR', Other:'AED' }
    const countries = ['KSA','UAE','Oman','Bahrain','India','Kuwait','Qatar','Other']
    const init = {}
    for (const c of countries){ init[c] = { country:c, currency: currencyByCountry[c], assigned:0, delivered:0, cancelled:0, collected:0, deliveredToCompany:0, pendingToCompany:0 } }
    const list = Array.isArray(drivers)? drivers: []
    for (const d of list){
      const c0 = canonical(d?.country)
      const c = countries.includes(c0) ? c0 : 'Other'
      if (!init[c]) continue
      init[c].assigned += Number(d?.assigned||0)
      init[c].delivered += Number(d?.deliveredCount||0)
      init[c].cancelled += Number(d?.canceled||0)
      init[c].collected += Number(d?.collected||0)
      init[c].deliveredToCompany += Number(d?.deliveredToCompany||0)
      init[c].pendingToCompany += Number(d?.pendingToCompany||0)
    }
    return countries.map(c=> init[c])
  }, [drivers])
  const countrySummaryRows = useMemo(()=>{
    const rows = []
    const mapByCountry = Object.fromEntries(driverCountrySummary.map(r=>[r.country, r]))
    const aliasMetrics = (c)=> (metrics?.countries?.[c] || (c==='KSA' ? (metrics?.countries?.['Saudi Arabia']||{}) : {}))
    const list = ['KSA','UAE','Oman','Bahrain','India','Kuwait','Qatar','Other']
    for (const c of list){
      const m = aliasMetrics(c)
      const d = mapByCountry[c] || { collected:0, deliveredToCompany:0, pendingToCompany:0, cancelled:0 }
      rows.push({
        country:c,
        orders: Number(m?.orders||0),
        delivered: Number(m?.delivered||0),
        cancelled: Number(d?.cancelled||0),
        collected: Math.round(Number(d?.collected||0)),
        deliveredToCompany: Math.round(Number(d?.deliveredToCompany||0)),
        pendingToCompany: Math.round(Number(d?.pendingToCompany||0)),
      })
    }
    return rows
  }, [metrics, driverCountrySummary])

  // Country helpers for flags/currencies and unified metrics
  const COUNTRY_INFO = useMemo(() => ({
    KSA: { flag: '🇸🇦', cur: 'SAR', alias: ['Saudi Arabia'] },
    UAE: { flag: '🇦🇪', cur: 'AED' },
    Oman: { flag: '🇴🇲', cur: 'OMR' },
    Bahrain: { flag: '🇧🇭', cur: 'BHD' },
    India: { flag: '🇮🇳', cur: 'INR' },
    Kuwait: { flag: '🇰🇼', cur: 'KWD' },
    Qatar: { flag: '🇶🇦', cur: 'QAR' },
    Other: { cur: 'AED' },
  }), [])
  const COUNTRY_LIST = useMemo(() => ['KSA','UAE','Oman','Bahrain','India','Kuwait','Qatar','Other'], [])
  function countryMetrics(c){
    const base = metrics?.countries || {}
    if (base[c]) return base[c]
    const alias = COUNTRY_INFO[c]?.alias || []
    for (const a of alias){ if (base[a]) return base[a] }
    return {}
  }
  function fmtNum(n){ try{ return Number(n||0).toLocaleString() }catch{ return String(n||0) } }
  function fmtAmt(n){ try{ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }catch{ return String(n||0) } }
  // AED conversion helpers using dynamic config
  function toAED(amount, country){
    try{
      const code = COUNTRY_INFO[country]?.cur || 'AED'
      return toAEDByCode(Number(amount||0), code, currencyCfg)
    }catch{ return Number(amount||0) }
  }
  function toAEDByCurrency(amount, currency){
    try{
      const code = String(currency||'AED')
      return toAEDByCode(Number(amount||0), code, currencyCfg)
    }catch{ return Number(amount||0) }
  }
  function sumAmountAED(key){
    try{ return COUNTRY_LIST.reduce((s,c)=> s + toAED((countryMetrics(c)[key]||0), c), 0) }catch{ return 0 }
  }
  // Driver aggregates: global and per-country
  const driverAggGlobal = useMemo(()=>{
    const list = Array.isArray(drivers)? drivers: []
    const assignedAllTime = list.reduce((s,d)=> s + Number(d?.assigned||0), 0)
    const collectedAED = list.reduce((s,d)=> s + toAEDByCurrency((d?.collected||0), d?.currency||'AED'), 0)
    const deliveredToCompanyAED = list.reduce((s,d)=> s + toAEDByCurrency((d?.deliveredToCompany||0), d?.currency||'AED'), 0)
    const pendingToCompanyAED = list.reduce((s,d)=> s + toAEDByCurrency((d?.pendingToCompany||0), d?.currency||'AED'), 0)
    return { assignedAllTime, collectedAED, deliveredToCompanyAED, pendingToCompanyAED }
  }, [drivers])
  const driverAggByCountry = useMemo(()=>{
    const init = {}
    for (const c of COUNTRY_LIST){ init[c] = { assignedAllTime:0, collected:0, deliveredToCompany:0, pendingToCompany:0 } }
    const canon = (c)=> (c==='Saudi Arabia'?'KSA': String(c||''))
    const list = Array.isArray(drivers)? drivers: []
    for (const d of list){
      const c = canon(d?.country)
      if (!init[c]) continue
      init[c].assignedAllTime += Number(d?.assigned||0)
      init[c].collected += Number(d?.collected||0)
      init[c].deliveredToCompany += Number(d?.deliveredToCompany||0)
      init[c].pendingToCompany += Number(d?.pendingToCompany||0)
    }
    return init
  }, [drivers, COUNTRY_LIST])
  const statusTotals = useMemo(()=>{
    // If a date range is active, derive totals from the fetched orders (already range-filtered server-side when supported)
    if (qsRangeBare) {
      const list = Array.isArray(orders)? orders: []
      return list.reduce((acc,o)=>{
        const s = String(o?.shipmentStatus||'').toLowerCase()
        acc.total += 1
        const map = ['pending','assigned','picked_up','in_transit','out_for_delivery','delivered','no_response','returned','cancelled']
        if (map.includes(s)) acc[s] += 1
        else acc.pending += 1
        return acc
      }, { total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0 })
    }
    // Else use backend metrics or per-country fallback
    if (metrics && metrics.statusTotals) return metrics.statusTotals
    return COUNTRY_LIST.reduce((acc, c)=>{
      const m = countryMetrics(c)
      acc.total += Number(m.orders||0)
      acc.pending += Number(m.pending||0)
      acc.assigned += Number(m.assigned||0)
      acc.picked_up += Number(m.pickedUp||0)
      acc.in_transit += Number(m.transit||0)
      acc.out_for_delivery += Number(m.outForDelivery||0)
      acc.delivered += Number(m.delivered||0)
      acc.no_response += Number(m.noResponse||0)
      acc.returned += Number(m.returned||0)
      acc.cancelled += Number(m.cancelled||0)
      return acc
    }, { total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0 })
  }, [metrics, orders, qsRangeBare])
  async function load(){
    try{ const cfg = await getCurrencyConfig(); setCurrencyCfg(cfg) }catch(_e){ setCurrencyCfg(null) }
    if (range==='last7'){
      try{ setAnalytics(await apiGet('/api/orders/analytics/last7days')) }catch(_e){ setAnalytics({ days: [], totals:{} }) }
    } else {
      // Backend doesn't support generic analytics with from/to; skip to avoid 404
      setAnalytics({ days: [], totals:{} })
    }
    try{ setMetrics(await apiGet(appendRange('/api/reports/user-metrics'))) }catch(_e){ console.error('Failed to fetch metrics') }
    try{ setSalesByCountry(await apiGet(appendRange('/api/reports/user-metrics/sales-by-country'))) }catch(_e){ setSalesByCountry({ KSA:0, Oman:0, UAE:0, Bahrain:0, India:0, Kuwait:0, Qatar:0, Other:0 }) }
    try{
      if (qsRangeBare){
        // 1) Created in range
        let page = 1, limit = 200, createdList = []
        for(;;){
          const r = await apiGet(appendRange(`/api/orders?page=${page}&limit=${limit}`))
          const list = Array.isArray(r?.orders) ? r.orders : []
          createdList = createdList.concat(list)
          if (!r?.hasMore) break
          page += 1
          if (page > 100) break
        }
        // 2) Open orders (any date): fetch per open status and union
        const fetchOpenBy = async (ship)=>{
          let p=1, lim=200, acc=[]
          for(;;){
            const r = await apiGet(`/api/orders?ship=${encodeURIComponent(ship)}&page=${p}&limit=${lim}`)
            const list = Array.isArray(r?.orders) ? r.orders : []
            acc = acc.concat(list)
            if (!r?.hasMore) break
            p += 1
            if (p > 50) break
          }
          return acc
        }
        const openLists = await Promise.all(OPEN_STATUSES.map(s=> fetchOpenBy(s)))
        let openAll = [].concat(...openLists)
        // 3) Delivered in range: fetch delivered pages and locally filter deliveredAt within [from,to]
        let dp=1, dlim=200, deliveredList=[]
        for(;;){
          const r = await apiGet(`/api/orders?ship=delivered&page=${dp}&limit=${dlim}`)
          const list = Array.isArray(r?.orders) ? r.orders : []
          deliveredList = deliveredList.concat(list)
          if (!r?.hasMore) break
          dp += 1
          if (dp > 50) break
        }
        const deliveredInRange = deliveredList.filter(includeByRangeOrOpen)
        // Union: open OR created-in-range OR delivered-in-range
        const byId = new Map()
        const addMany = (arr)=>{ for (const o of (arr||[])){ const id=String(o?._id||o?.id||''); if (!byId.has(id)) byId.set(id, o) } }
        addMany(createdList)
        addMany(openAll)
        addMany(deliveredInRange)
        setOrders(Array.from(byId.values()))
      } else {
        const res = await apiGet('/api/orders')
        setOrders(Array.isArray(res?.orders) ? res.orders : [])
      }
    }catch(_e){ setOrders([]) }
    try{
      // Fetch all pages of driver summaries to build accurate aggregates
      let page = 1, limit = 100, all = []
      for(;;){
        const ds = await apiGet(appendRange(`/api/finance/drivers/summary?page=${page}&limit=${limit}`))
        const arr = Array.isArray(ds?.drivers) ? ds.drivers : []
        all = all.concat(arr)
        if (!ds?.hasMore) break
        page += 1
        if (page > 100) break
      }
      setDrivers(all)
    }catch(_e){ setDrivers([]) }
  }
  useEffect(()=>{ load() },[qsRangeBare])
  // Live updates via socket
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['polling'], upgrade: false, auth: { token }, withCredentials: true })
      socket.on('orders.changed', (payload={})=>{
        load()
        try{
          const { orderId, invoiceNumber, action, status } = payload
          let msg = null
          const code = invoiceNumber ? `#${invoiceNumber}` : `#${String(orderId||'').slice(-5)}`
          if (action === 'delivered') msg = `Order ${code} delivered`
          else if (action === 'assigned') msg = `Order ${code} assigned`
          else if (action === 'cancelled') msg = `Order ${code} cancelled`
          else if (action === 'shipment_updated'){
            const label = (status === 'picked_up') ? 'picked up' : (String(status||'').replace('_',' '))
            msg = `Shipment ${label} (${code})`
          }
          if (msg) toast.info(msg)
        }catch{}
      })
    }catch{}
    return ()=>{
      try{ socket && socket.off('orders.changed') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[toast])

  // Recent order history: delivered or cancelled
  const orderHistory = React.useMemo(()=>{
    const list = Array.isArray(orders) ? orders : []
    const hist = list.filter(o => ['delivered','cancelled'].includes(String(o?.shipmentStatus||'').toLowerCase()))
    hist.sort((a,b)=> new Date(b.deliveredAt || b.updatedAt || b.createdAt) - new Date(a.deliveredAt || a.updatedAt || a.createdAt))
    return hist.slice(0, 12)
  }, [orders])
  return (
    <div className="container">
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-purple">Dashboard</div>
          <div className="page-subtitle">Your business at a glance</div>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="section" style={{marginBottom:8}}>
        <DateRangeChips value={range} onChange={setRange} />
      </div>

      {/* Orders Summary (Counts & Amounts) */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const totalOrdersCount = Number(metrics?.totalOrders||0)
          const deliveredCount = Number(metrics?.deliveredOrders||0)
          const pendingCount = Number((statusTotals?.pending)||0)
          const amountTotalOrdersAED = sumAmountAED('amountTotalOrders')
          const amountDeliveredAED = sumAmountAED('amountDelivered')
          const amountPendingAED = sumAmountAED('amountPending')
          function Tile({ title, valueEl, chipsEl }){
            return (
              <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:12, padding:'12px', background:'var(--panel)'}}>
                <div className="helper">{title}</div>
                <div style={{fontSize:24, fontWeight:900}}>{valueEl}</div>
                {chipsEl ? (
                  <div style={{marginTop:8, display:'flex', flexWrap:'wrap', gap:6}}>
                    {chipsEl}
                  </div>
                ) : null}
              </div>
            )
          }
          function currencyChipsFor(key){
            try{
              const byCur = {}
              for (const c of COUNTRY_LIST){
                const m = countryMetrics(c)
                const code = (COUNTRY_INFO[c] && COUNTRY_INFO[c].cur) ? COUNTRY_INFO[c].cur : 'AED'
                const v = Number(m?.[key]||0)
                if (v>0){ byCur[code] = (byCur[code]||0) + v }
              }
              return Object.entries(byCur).filter(([,v])=> v>0).map(([cur,v])=> (
                <span key={cur} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>{cur} {fmtAmt(v)}</span>
              ))
            }catch{ return null }
          }
          return (
            <div className="section" style={{display:'grid', gap:12}}>
              <div>
                <div style={{fontWeight:800,fontSize:16}}>Orders Summary (All Countries)</div>
                <div className="helper">Totals only (amounts in AED)</div>
              </div>
              <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
                <Tile title="Total Orders" valueEl={<NavLink className="link" style={{color:'#0ea5e9'}} to={appendRange('/user/orders')}>{fmtNum(totalOrdersCount)}</NavLink>} />
                <Tile title="Amount of Total Orders (AED)" valueEl={<NavLink className="link" style={{color:'#10b981'}} to={appendRange('/user/orders')}>{`AED ${fmtAmt(amountTotalOrdersAED)}`}</NavLink>} chipsEl={currencyChipsFor('amountTotalOrders')} />
                <Tile title="Orders Delivered" valueEl={<NavLink className="link" style={{color:'#10b981'}} to={appendRange('/user/orders?ship=delivered')}>{fmtNum(deliveredCount)}</NavLink>} />
                <Tile title="Amount of Orders Delivered (AED)" valueEl={<NavLink className="link" style={{color:'#10b981'}} to={appendRange('/user/orders?ship=delivered')}>{`AED ${fmtAmt(amountDeliveredAED)}`}</NavLink>} chipsEl={currencyChipsFor('amountDelivered')} />
                <Tile title="Open Orders" valueEl={<NavLink className="link" style={{color:'#f59e0b'}} to={appendRange('/user/orders?ship=open')}>{fmtNum(pendingCount)}</NavLink>} />
                <Tile title="Open Amount (AED)" valueEl={<NavLink className="link" style={{color:'#f97316'}} to={appendRange('/user/orders?ship=open')}>{`AED ${fmtAmt(amountPendingAED)}`}</NavLink>} chipsEl={currencyChipsFor('amountPending')} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* Driver Report (All Countries) removed as requested */}
      {/* Driver Report by Country removed as requested */}

      {/* Status Summary (All Countries) */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = statusTotals || {}
          function Tile({ title, value, to, color }){
            return (
              <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:12, padding:'12px', background:'var(--panel)'}}>
                <div className="helper">{title}</div>
                <div style={{fontSize:24, fontWeight:900, color:color||'inherit'}}>{to ? (<NavLink className="link" style={{color:color||'inherit'}} to={appendRange(to)}>{fmtNum(value||0)}</NavLink>) : fmtNum(value||0)}</div>
              </div>
            )
          }
          return (
            <div className="section" style={{display:'grid', gap:12}}>
              <div>
                <div style={{fontWeight:800,fontSize:16}}>Status Summary (All Countries)</div>
                <div className="helper">Global totals</div>
              </div>
              <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
                <Tile title="Total Orders" value={st.total} to="/user/orders" color="#0ea5e9" />
                <Tile title="Open" value={st.pending} to="/user/orders?ship=open" color="#f59e0b" />
                <Tile title="Assigned" value={st.assigned} to="/user/orders?ship=assigned" color="#3b82f6" />
                <Tile title="Picked Up" value={st.picked_up} to="/user/orders?ship=picked_up" color="#f59e0b" />
                <Tile title="In Transit" value={st.in_transit} to="/user/orders?ship=in_transit" color="#0284c7" />
                <Tile title="Out for Delivery" value={st.out_for_delivery} to="/user/orders?ship=out_for_delivery" color="#f97316" />
                <Tile title="Delivered" value={st.delivered} to="/user/orders?ship=delivered" color="#10b981" />
                <Tile title="No Response" value={st.no_response} to="/user/orders?ship=no_response" color="#ef4444" />
                <Tile title="Returned" value={st.returned} to="/user/orders?ship=returned" color="#737373" />
                <Tile title="Cancelled" value={st.cancelled} to="/user/orders?ship=cancelled" color="#b91c1c" />
              </div>
            </div>
          )
        })()}
      </div>

      {/* Country Summary removed as requested */}

      {/* Drivers Summary removed as requested */}

      {/* Per-Country Orders & Status */}
      <div className="card" style={{marginTop:12}}>
        <div style={{marginBottom:12}}>
          <div style={{fontWeight:800,fontSize:16}}>Per-Country Orders & Status</div>
          <div className="helper">Numbers only; amounts in local currency</div>
        </div>
        <div className="section" style={{display:'grid', gap:12}}>
          {COUNTRY_LIST.map(c=>{
            const m = countryMetrics(c)
            const flag = (COUNTRY_INFO[c] && COUNTRY_INFO[c].flag) ? COUNTRY_INFO[c].flag + ' ' : ''
            const name = flag + ((c==='KSA') ? 'Saudi Arabia (KSA)' : c)
            const qs = encodeURIComponent(c)
            const amtTotalStr = formatCurrency(m?.amountTotalOrders||0, c)
            const amtDeliveredStr = formatCurrency(m?.amountDelivered||0, c)
            const amtPendingStr = formatCurrency(m?.amountPending||0, c)
            return (
              <div key={c} className="panel" style={{border:'1px solid var(--border)', borderRadius:12, padding:12, background:'var(--panel)'}}>
                <div style={{fontWeight:900, marginBottom:8}}>{name}</div>
                <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10}}>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Total Orders</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#0ea5e9'}} to={appendRange(`/user/orders?country=${qs}`)}>{fmtNum(m?.orders||0)}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Amount of Total Orders</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#10b981'}} to={appendRange(`/user/orders?country=${qs}`)}>{amtTotalStr}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Delivered</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#10b981'}} to={appendRange(`/user/orders?country=${qs}&ship=delivered`)}>{fmtNum(m?.delivered||0)}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Amount of Delivered</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#10b981'}} to={appendRange(`/user/orders?country=${qs}&ship=delivered`)}>{amtDeliveredStr}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Open Orders</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#f59e0b'}} to={appendRange(`/user/orders?country=${qs}&ship=open`)}>{fmtNum(m?.pending||0)}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Open Amount</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#f97316'}} to={appendRange(`/user/orders?country=${qs}&ship=open`)}>{amtPendingStr}</NavLink></div>
                  </div>
                </div>
                <div style={{marginTop:10}}>
                  <div className="helper" style={{marginBottom:6}}>Status Summary</div>
                  <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Assigned</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#3b82f6'}} to={appendRange(`/user/orders?country=${qs}&ship=assigned`)}>{fmtNum(m?.assigned||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Picked Up</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#f59e0b'}} to={appendRange(`/user/orders?country=${qs}&ship=picked_up`)}>{fmtNum(m?.pickedUp||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">In Transit</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#0284c7'}} to={appendRange(`/user/orders?country=${qs}&ship=in_transit`)}>{fmtNum(m?.transit||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Out for Delivery</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#f97316'}} to={appendRange(`/user/orders?country=${qs}&ship=out_for_delivery`)}>{fmtNum(m?.outForDelivery||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Delivered</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#10b981'}} to={appendRange(`/user/orders?country=${qs}&ship=delivered`)}>{fmtNum(m?.delivered||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">No Response</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#ef4444'}} to={appendRange(`/user/orders?country=${qs}&ship=no_response`)}>{fmtNum(m?.noResponse||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Returned</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#737373'}} to={appendRange(`/user/orders?country=${qs}&ship=returned`)}>{fmtNum(m?.returned||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Cancelled</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#b91c1c'}} to={appendRange(`/user/orders?country=${qs}&ship=cancelled`)}>{fmtNum(m?.cancelled||0)}</NavLink></div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="card" style={{marginTop:12}}>
        <div style={{marginBottom:12}}>
          <div style={{fontWeight:800,fontSize:16}}>Sales Trend</div>
          <div className="helper">Last 7 days performance</div>
        </div>
        <Chart analytics={analytics} />
      </div>
      
      {/* Order Status Distribution */}
      <div className="card" style={{marginTop:12}}>
        <div style={{marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:16}}>Order Status Distribution</div>
          <div className="helper">Visual breakdown of order statuses</div>
        </div>
        <OrderStatusPie statusTotals={statusTotals} />
      </div>

      {/* Recent Order History */}
      <div className="card" style={{marginTop:12, display:'grid', gap:12}}>
        <div>
          <div style={{fontWeight:800}}>Recent Order History</div>
          <div className="helper">Delivered or Cancelled</div>
        </div>
        {orderHistory.length === 0 ? (
          <div className="empty-state">No delivered or cancelled orders yet</div>
        ) : (
          <div style={{display:'grid', gap:8}}>
            {orderHistory.map(o => {
              const id = String(o?._id || o?.id || '')
              const code = o?.invoiceNumber ? `#${o.invoiceNumber}` : `#${id.slice(-5)}`
              const st = String(o?.shipmentStatus||'').toLowerCase()
              const when = o?.deliveredAt || o?.updatedAt || o?.createdAt
              const whenStr = when ? new Date(when).toLocaleString() : ''
              const color = st==='delivered' ? '#10b981' : (st==='cancelled' ? '#ef4444' : 'var(--fg)')
              return (
                <div key={id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8, background:'var(--panel)'}}>
                  <div style={{display:'grid'}}>
                    <div style={{fontWeight:700}}>{code} • <span style={{opacity:.9}}>{o?.customerName || 'Customer'}</span></div>
                    <div className="helper" style={{fontSize:12}}>{whenStr}</div>
                  </div>
                  <div className="chip" style={{background:'transparent', border:`1px solid ${color}`, color}}>{st.replace('_',' ')}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
