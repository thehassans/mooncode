import React, { useEffect, useMemo, useState } from 'react'
import Chart from '../../components/Chart.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode } from '../../util/currency'

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
    if (metrics && metrics.statusTotals) return metrics.statusTotals
    // Fallback: aggregate from countries if backend older
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
  }, [metrics])
  async function load(){
    try{ const cfg = await getCurrencyConfig(); setCurrencyCfg(cfg) }catch(_e){ setCurrencyCfg(null) }
    try{ setAnalytics(await apiGet('/api/orders/analytics/last7days')) }catch(_e){ setAnalytics({ days: [], totals:{} }) }
    try{ setMetrics(await apiGet('/api/reports/user-metrics')) }catch(_e){ console.error('Failed to fetch metrics') }
    try{ setSalesByCountry(await apiGet('/api/reports/user-metrics/sales-by-country')) }catch(_e){ setSalesByCountry({ KSA:0, Oman:0, UAE:0, Bahrain:0, India:0, Kuwait:0, Qatar:0, Other:0 }) }
    try{ const res = await apiGet('/api/orders'); setOrders(Array.isArray(res?.orders) ? res.orders : []) }catch(_e){ setOrders([]) }
    try{
      // Fetch all pages of driver summaries to build accurate aggregates
      let page = 1, limit = 100, all = []
      for(;;){
        const ds = await apiGet(`/api/finance/drivers/summary?page=${page}&limit=${limit}`)
        const arr = Array.isArray(ds?.drivers) ? ds.drivers : []
        all = all.concat(arr)
        if (!ds?.hasMore) break
        page += 1
        if (page > 100) break
      }
      setDrivers(all)
    }catch(_e){ setDrivers([]) }
  }
  useEffect(()=>{ load() },[])
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

      {/* Orders Summary (Counts & Amounts) */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const totalOrdersCount = Number(metrics?.totalOrders||0)
          const deliveredCount = Number(metrics?.deliveredOrders||0)
          const pendingCount = Number((statusTotals?.pending)||0)
          const amountTotalOrdersAED = sumAmountAED('amountTotalOrders')
          const amountDeliveredAED = sumAmountAED('amountDelivered')
          const amountPendingAED = sumAmountAED('amountPending')
          function Tile({ icon, title, valueEl, chipsEl, gradient }){
            return (
              <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:12, padding:'12px', background:'var(--panel)'}}>
                <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
                  <div style={{width:32,height:32,borderRadius:8,background:gradient||'linear-gradient(135deg,#0ea5e9,#0369a1)',display:'grid',placeItems:'center',color:'#fff',fontSize:16}}>{icon}</div>
                  <div style={{fontWeight:800}}>{title}</div>
                </div>
                <div style={{fontSize:20, fontWeight:900, marginBottom:6}}>{valueEl}</div>
                {/* chips removed for All Countries */}
              </div>
            )
          }
          return (
            <div className="section" style={{display:'grid', gap:12}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#0ea5e9,#0369a1)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🧮</div>
                <div>
                  <div style={{fontWeight:800,fontSize:16}}>Orders Summary (All Countries)</div>
                  <div className="helper">Totals only (amounts in AED)</div>
                </div>
              </div>
              <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
                <Tile icon="📦" title="Total Orders" valueEl={<a className="link" href="/user/orders">{fmtNum(totalOrdersCount)}</a>} gradient={'linear-gradient(135deg,#0ea5e9,#0369a1)'} />
                <Tile icon="💵" title="Amount of Total Orders (AED)" valueEl={<a className="link" href="/user/orders">{`AED ${fmtAmt(amountTotalOrdersAED)}`}</a>} gradient={'linear-gradient(135deg,#10b981,#059669)'} />
                <Tile icon="✅" title="Orders Delivered" valueEl={<a className="link" href="/user/orders?ship=delivered">{fmtNum(deliveredCount)}</a>} gradient={'linear-gradient(135deg,#16a34a,#15803d)'} />
                <Tile icon="🧾" title="Amount of Orders Delivered (AED)" valueEl={<a className="link" href="/user/orders?ship=delivered">{`AED ${fmtAmt(amountDeliveredAED)}`}</a>} gradient={'linear-gradient(135deg,#22c55e,#16a34a)'} />
                <Tile icon="⏳" title="Open Orders" valueEl={<a className="link" href="/user/orders?ship=open">{fmtNum(pendingCount)}</a>} gradient={'linear-gradient(135deg,#f59e0b,#d97706)'} />
                <Tile icon="💰" title="Open Amount (AED)" valueEl={<a className="link" href="/user/orders?ship=open">{`AED ${fmtAmt(amountPendingAED)}`}</a>} gradient={'linear-gradient(135deg,#fb923c,#f97316)'} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* Driver Report (All Countries) */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = statusTotals || {}
          const dAgg = driverAggGlobal || { assignedAllTime:0, collectedAED:0, deliveredToCompanyAED:0, pendingToCompanyAED:0 }
          function Tile({ icon, title, value, gradient, to }){
            return (
              <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:12, padding:'12px', background:'var(--panel)'}}>
                <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
                  <div style={{width:32,height:32,borderRadius:8,background:gradient||'linear-gradient(135deg,#0ea5e9,#0369a1)',display:'grid',placeItems:'center',color:'#fff',fontSize:16}}>{icon}</div>
                  <div style={{fontWeight:800}}>{title}</div>
                </div>
                <div style={{fontSize:20, fontWeight:900, marginBottom:6}}>{to ? (<a className="link" href={to}>{value}</a>) : value}</div>
              </div>
            )
          }
          return (
            <div className="section" style={{display:'grid', gap:12}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#06b6d4,#0891b2)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🧑‍🦰</div>
                <div>
                  <div style={{fontWeight:800,fontSize:16}}>Driver Report (All Countries)</div>
                  <div className="helper">Totals across all drivers. Amounts in AED.</div>
                </div>
              </div>
              <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
                <Tile icon="🧾" title="Total Orders Assigned (All Time)" value={fmtNum(dAgg.assignedAllTime)} to="/user/orders?onlyAssigned=true" gradient={'linear-gradient(135deg,#334155,#0f172a)'} />
                <Tile icon="📌" title="Currently Assigned" value={fmtNum(st.assigned||0)} to="/user/orders?ship=assigned" gradient={'linear-gradient(135deg,#94a3b8,#64748b)'} />
                <Tile icon="🚚" title="Picked Up" value={fmtNum(st.picked_up||0)} to="/user/orders?ship=picked_up" gradient={'linear-gradient(135deg,#60a5fa,#3b82f6)'} />
                <Tile icon="🚛" title="In Transit" value={fmtNum(st.in_transit||0)} to="/user/orders?ship=in_transit" gradient={'linear-gradient(135deg,#0ea5e9,#0369a1)'} />
                <Tile icon="🛵" title="Out for Delivery" value={fmtNum(st.out_for_delivery||0)} to="/user/orders?ship=out_for_delivery" gradient={'linear-gradient(135deg,#f97316,#ea580c)'} />
                <Tile icon="✅" title="Delivered" value={fmtNum(st.delivered||0)} to="/user/orders?ship=delivered" gradient={'linear-gradient(135deg,#22c55e,#16a34a)'} />
                <Tile icon="☎️🚫" title="No Response" value={fmtNum(st.no_response||0)} to="/user/orders?ship=no_response" gradient={'linear-gradient(135deg,#ef4444,#b91c1c)'} />
                <Tile icon="🔁" title="Returned" value={fmtNum(st.returned||0)} to="/user/orders?ship=returned" gradient={'linear-gradient(135deg,#a3a3a3,#737373)'} />
                <Tile icon="❌" title="Cancelled" value={fmtNum(st.cancelled||0)} to="/user/orders?ship=cancelled" gradient={'linear-gradient(135deg,#ef4444,#b91c1c)'} />
                <Tile icon="💵" title="Total Collected (Delivered)" value={`AED ${fmtAmt(dAgg.collectedAED)}`} to="/user/orders?ship=delivered&collected=true" gradient={'linear-gradient(135deg,#10b981,#059669)'} />
                <Tile icon="🏦" title="Delivered to Company" value={`AED ${fmtAmt(dAgg.deliveredToCompanyAED)}`} to="/user/finances?section=driver" gradient={'linear-gradient(135deg,#84cc16,#4d7c0f)'} />
                <Tile icon="⏳" title="Pending Delivery to Company" value={`AED ${fmtAmt(dAgg.pendingToCompanyAED)}`} to="/user/finances?section=driver" gradient={'linear-gradient(135deg,#f59e0b,#d97706)'} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* Driver Report by Country */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#06b6d4,#0891b2)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🚚</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Driver Report by Country</div>
            <div className="helper">Counts from orders; amounts in local currency.</div>
          </div>
        </div>
        <div className="section" style={{display:'grid', gap:12}}>
          {COUNTRY_LIST.map(c=>{
            const m = countryMetrics(c)
            const d = driverAggByCountry[c] || { assignedAllTime:0, collected:0, deliveredToCompany:0, pendingToCompany:0 }
            const qs = encodeURIComponent(c)
            const amtCollectedStr = formatCurrency(d.collected||0, c)
            const amtDeliveredToCoStr = formatCurrency(d.deliveredToCompany||0, c)
            const amtPendingToCoStr = formatCurrency(d.pendingToCompany||0, c)
            const name = (c==='KSA') ? 'Saudi Arabia (KSA)' : c
            return (
              <div key={c} className="panel" style={{border:'1px solid var(--border)', borderRadius:12, padding:12, background:'var(--panel)'}}>
                <div style={{fontWeight:900, marginBottom:8}}>{name}</div>
                <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10}}>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Total Orders Assigned (All Time)</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&onlyAssigned=true`}>{fmtNum(d.assignedAllTime||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Currently Assigned</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=assigned`}>{fmtNum(m?.assigned||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Picked Up</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=picked_up`}>{fmtNum(m?.pickedUp||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">In Transit</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=in_transit`}>{fmtNum(m?.transit||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Out for Delivery</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=out_for_delivery`}>{fmtNum(m?.outForDelivery||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Delivered</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=delivered`}>{fmtNum(m?.delivered||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">No Response</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=no_response`}>{fmtNum(m?.noResponse||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Returned</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=returned`}>{fmtNum(m?.returned||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Cancelled</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=cancelled`}>{fmtNum(m?.cancelled||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Total Collected (Delivered)</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=delivered&collected=true`}>{amtCollectedStr}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Delivered to Company</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/user/finances?section=driver`}>{amtDeliveredToCoStr}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Pending Delivery to Company</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/user/finances?section=driver`}>{amtPendingToCoStr}</a></div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Status Summary (All Countries) */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = statusTotals || {}
          function Tile({ icon, title, value, gradient, to }){
            return (
              <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:12, padding:'12px', background:'var(--panel)'}}>
                <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
                  <div style={{width:32,height:32,borderRadius:8,background:gradient||'linear-gradient(135deg,#3b82f6,#1d4ed8)',display:'grid',placeItems:'center',color:'#fff',fontSize:16}}>{icon}</div>
                  <div style={{fontWeight:800}}>{title}</div>
                </div>
                <div style={{fontSize:20, fontWeight:900, marginBottom:6}}>{to ? (<a className="link" href={to}>{fmtNum(value||0)}</a>) : fmtNum(value||0)}</div>
                {/* chips removed for All Countries */}
              </div>
            )
          }
          return (
            <div className="section" style={{display:'grid', gap:12}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>📊</div>
                <div>
                  <div style={{fontWeight:800,fontSize:16}}>Status Summary (All Countries)</div>
                  <div className="helper">Global totals</div>
                </div>
              </div>
              <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
                <Tile icon="📦" title="Total Orders" value={st.total} to="/user/orders" gradient={'linear-gradient(135deg,#3b82f6,#1d4ed8)'} />
                <Tile icon="⏳" title="Open" value={st.pending} to="/user/orders?ship=open" gradient={'linear-gradient(135deg,#f59e0b,#d97706)'} />
                <Tile icon="📌" title="Assigned" value={st.assigned} to="/user/orders?ship=assigned" gradient={'linear-gradient(135deg,#94a3b8,#64748b)'} />
                <Tile icon="🚚" title="Picked Up" value={st.picked_up} to="/user/orders?ship=picked_up" gradient={'linear-gradient(135deg,#60a5fa,#3b82f6)'} />
                <Tile icon="🚛" title="In Transit" value={st.in_transit} to="/user/orders?ship=in_transit" gradient={'linear-gradient(135deg,#0ea5e9,#0369a1)'} />
                <Tile icon="🛵" title="Out for Delivery" value={st.out_for_delivery} to="/user/orders?ship=out_for_delivery" gradient={'linear-gradient(135deg,#f97316,#ea580c)'} />
                <Tile icon="✅" title="Delivered" value={st.delivered} to="/user/orders?ship=delivered" gradient={'linear-gradient(135deg,#22c55e,#16a34a)'} />
                <Tile icon="☎️🚫" title="No Response" value={st.no_response} to="/user/orders?ship=no_response" gradient={'linear-gradient(135deg,#ef4444,#b91c1c)'} />
                <Tile icon="🔁" title="Returned" value={st.returned} to="/user/orders?ship=returned" gradient={'linear-gradient(135deg,#a3a3a3,#737373)'} />
                <Tile icon="❌" title="Cancelled" value={st.cancelled} to="/user/orders?ship=cancelled" gradient={'linear-gradient(135deg,#ef4444,#b91c1c)'} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* Country Summary */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#0ea5e9,#0369a1)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🌍</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Country Summary</div>
            <div className="helper">Orders, Delivered, Cancelled, and Collections per country</div>
          </div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          <div style={{display:'flex', gap:12, minWidth:700}}>
            {countrySummaryRows.map(row=>{
              const qsCountry = encodeURIComponent(row.country)
              const currency = row.country==='KSA' ? 'SAR'
                : row.country==='UAE' ? 'AED'
                : row.country==='Oman' ? 'OMR'
                : row.country==='Bahrain' ? 'BHD'
                : row.country==='India' ? 'INR'
                : row.country==='Kuwait' ? 'KWD'
                : row.country==='Qatar' ? 'QAR'
                : 'AED'
              return (
                <div key={row.country} className="mini-card" style={{border:'1px solid var(--border)', borderRadius:12, padding:'10px 12px', background:'var(--panel)', minWidth:280}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
                    <div style={{fontWeight:800}}>{row.country==='KSA' ? 'Saudi Arabia' : row.country}</div>
                    <a className="chip" style={{background:'transparent'}} href={`/user/orders?country=${qsCountry}`}>View</a>
                  </div>
                  <div style={{display:'grid', gap:6}}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Orders</div>
                      <a className="link" href={`/user/orders?country=${qsCountry}`}>{row.orders.toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Delivered</div>
                      <a className="link" href={`/user/orders?country=${qsCountry}&ship=delivered`}>{row.delivered.toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Cancelled</div>
                      <a className="link" href={`/user/orders?country=${qsCountry}&ship=cancelled`}>{row.cancelled.toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Collected</div>
                      <a className="link" href={`/user/orders?country=${qsCountry}&ship=delivered&collected=true`}>{currency} {row.collected.toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Delivered to Company</div>
                      <a className="link" href={`/user/finances?section=driver`}>{currency} {row.deliveredToCompany.toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Pending to Company</div>
                      <a className="link" href={`/user/finances?section=driver`}>{currency} {row.pendingToCompany.toLocaleString()}</a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Drivers Summary */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#06b6d4,#0891b2)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🚚</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Drivers Summary</div>
            <div className="helper">Per-country totals with quick links</div>
          </div>
        </div>
        <div className="section" style={{ overflowX:'auto' }}>
          {(!Array.isArray(drivers) || drivers.length===0) ? (
            <div className="empty-state">No driver data</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
              <thead>
                <tr>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Country</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Orders</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Delivered</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Cancelled</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Collected</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Delivered to Company</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Pending to Company</th>
                </tr>
              </thead>
              <tbody>
                {driverCountrySummary.map(row => {
                  const label = row.country === 'KSA' ? 'Saudi Arabia' : row.country
                  const qsCountry = encodeURIComponent(row.country)
                  return (
                    <tr key={row.country} style={{ borderTop:'1px solid var(--border)' }}>
                      <td style={{ padding:'8px 10px', fontWeight:700 }}>{label}</td>
                      <td style={{ padding:'8px 10px' }}>
                        <a className="link" href={`/user/orders?country=${qsCountry}`}>{Number(row.assigned||0).toLocaleString()}</a>
                      </td>
                      <td style={{ padding:'8px 10px' }}>
                        <a className="link" href={`/user/orders?country=${qsCountry}&ship=delivered`}>{Number(row.delivered||0).toLocaleString()}</a>
                      </td>
                      <td style={{ padding:'8px 10px' }}>
                        <a className="link" href={`/user/orders?country=${qsCountry}&ship=cancelled`}>{Number(row.cancelled||0).toLocaleString()}</a>
                      </td>
                      <td style={{ padding:'8px 10px', whiteSpace:'nowrap' }}>
                        <a className="link" href={`/user/orders?country=${qsCountry}&ship=delivered&collected=true`}>{row.currency} {Math.round(row.collected||0).toLocaleString()}</a>
                      </td>
                      <td style={{ padding:'8px 10px', whiteSpace:'nowrap' }}>
                        <a className="link" href="/user/finances?section=driver">{row.currency} {Math.round(row.deliveredToCompany||0).toLocaleString()}</a>
                      </td>
                      <td style={{ padding:'8px 10px', whiteSpace:'nowrap', fontWeight:700, color:'var(--warning)' }}>
                        <a className="link" href="/user/finances?section=driver">{row.currency} {Math.round(row.pendingToCompany||0).toLocaleString()}</a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Per-Country Orders & Status */}
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#0ea5e9,#0369a1)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🌐</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Per-Country Orders & Status</div>
            <div className="helper">Numbers only; amounts in local currency</div>
          </div>
        </div>
        <div className="section" style={{display:'grid', gap:12}}>
          {COUNTRY_LIST.map(c=>{
            const m = countryMetrics(c)
            const name = (c==='KSA') ? 'Saudi Arabia (KSA)' : c
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
                    <div style={{fontWeight:900, fontSize:18}}><a className="link" href={`/user/orders?country=${qs}`}>{fmtNum(m?.orders||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Amount of Total Orders</div>
                    <div style={{fontWeight:900, fontSize:18}}><a className="link" href={`/user/orders?country=${qs}`}>{amtTotalStr}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Delivered</div>
                    <div style={{fontWeight:900, fontSize:18}}><a className="link" href={`/user/orders?country=${qs}&ship=delivered`}>{fmtNum(m?.delivered||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Amount of Delivered</div>
                    <div style={{fontWeight:900, fontSize:18}}><a className="link" href={`/user/orders?country=${qs}&ship=delivered`}>{amtDeliveredStr}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Open Orders</div>
                    <div style={{fontWeight:900, fontSize:18}}><a className="link" href={`/user/orders?country=${qs}&ship=open`}>{fmtNum(m?.pending||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Open Amount</div>
                    <div style={{fontWeight:900, fontSize:18}}><a className="link" href={`/user/orders?country=${qs}&ship=open`}>{amtPendingStr}</a></div>
                  </div>
                </div>
                <div style={{marginTop:10}}>
                  <div className="helper" style={{marginBottom:6}}>Status Summary</div>
                  <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Assigned</div>
                      <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=assigned`}>{fmtNum(m?.assigned||0)}</a></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Picked Up</div>
                      <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=picked_up`}>{fmtNum(m?.pickedUp||0)}</a></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">In Transit</div>
                      <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=in_transit`}>{fmtNum(m?.transit||0)}</a></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Out for Delivery</div>
                      <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=out_for_delivery`}>{fmtNum(m?.outForDelivery||0)}</a></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Delivered</div>
                      <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=delivered`}>{fmtNum(m?.delivered||0)}</a></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">No Response</div>
                      <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=no_response`}>{fmtNum(m?.noResponse||0)}</a></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Returned</div>
                      <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=returned`}>{fmtNum(m?.returned||0)}</a></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Cancelled</div>
                      <div style={{fontWeight:900}}><a className="link" href={`/user/orders?country=${qs}&ship=cancelled`}>{fmtNum(m?.cancelled||0)}</a></div>
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
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#8b5cf6,#6d28d9)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>📈</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Sales Trend</div>
            <div className="helper">Last 7 days performance</div>
          </div>
        </div>
        <Chart analytics={analytics} />
      </div>
      
      {/* Order Status Distribution */}
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:16}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#ec4899,#be185d)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🥧</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Order Status Distribution</div>
            <div className="helper">Visual breakdown of order statuses</div>
          </div>
        </div>
        <OrderStatusPie statusTotals={statusTotals} />
      </div>

      {/* Recent Order History */}
      <div className="card" style={{marginTop:12, display:'grid', gap:12}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#10b981,#059669)',display:'grid',placeItems:'center',color:'#fff',fontWeight:800}}>📜</div>
            <div>
              <div style={{fontWeight:800}}>Recent Order History</div>
              <div className="helper">Delivered or Cancelled</div>
            </div>
          </div>
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
