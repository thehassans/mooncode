import React, { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Chart from '../../components/Chart.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode, convert } from '../../util/currency'

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
  // Month/Year selector state - initialize to current month
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
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
    },
    productMetrics: { global: { stockPurchasedQty:0, stockDeliveredQty:0, stockLeftQty:0, purchaseValueByCurrency:{}, deliveredValueByCurrency:{} }, countries: {} }
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
  function sumCurrencyMapAED(map){
    try{
      const entries = Object.entries(map||{})
      return entries.reduce((s,[code, val])=> s + toAEDByCode(Number(val||0), String(code||'AED'), currencyCfg), 0)
    }catch{ return 0 }
  }
  function sumCurrencyMapLocal(map, targetCode){
    try{
      const tgt = String(targetCode||'AED')
      const entries = Object.entries(map||{})
      return entries.reduce((s,[code, val])=> s + convert(Number(val||0), String(code||'AED'), tgt, currencyCfg), 0)
    }catch{ return 0 }
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
    // Use backend metrics or per-country fallback
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
  }, [metrics, COUNTRY_LIST])
  async function load(){
    try{ const cfg = await getCurrencyConfig(); setCurrencyCfg(cfg) }catch(_e){ setCurrencyCfg(null) }
    
    // Pass month and year to ALL endpoints for consistent filtering
    const monthParams = `?month=${selectedMonth}&year=${selectedYear}`;
    const monthParamsAmp = `&month=${selectedMonth}&year=${selectedYear}`;
    
    try{ setAnalytics(await apiGet('/api/orders/analytics/last7days')) }catch(_e){ setAnalytics({ days: [], totals:{} }) }
    try{ setMetrics(await apiGet(`/api/reports/user-metrics${monthParams}`)) }catch(_e){ console.error('Failed to fetch metrics') }
    try{ setSalesByCountry(await apiGet(`/api/reports/user-metrics/sales-by-country${monthParams}`)) }catch(_e){ setSalesByCountry({ KSA:0, Oman:0, UAE:0, Bahrain:0, India:0, Kuwait:0, Qatar:0, Other:0 }) }
    try{
      // Filter orders by selected month
      const res = await apiGet(`/api/orders${monthParams}`)
      setOrders(Array.isArray(res?.orders) ? res.orders : [])
    }catch(_e){ setOrders([]) }
    try{
      // Fetch driver summaries - filter on frontend by month
      let page = 1, limit = 100, all = []
      for(;;){
        const ds = await apiGet(`/api/finance/drivers/summary?page=${page}&limit=${limit}${monthParamsAmp}`)
        const arr = Array.isArray(ds?.drivers) ? ds.drivers : []
        all = all.concat(arr)
        if (!ds?.hasMore) break
        page += 1
        if (page > 100) break
      }
      setDrivers(all)
    }catch(_e){ setDrivers([]) }
  }
  useEffect(()=>{ load() },[selectedMonth, selectedYear])
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
  
  // Generate month options
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let i = 0; i <= 5; i++) {
    yearOptions.push(currentYear - i);
  }
  
  return (
    <div className="container">
      {/* Month/Year Selector */}
      <div className="card" style={{marginBottom:12}}>
        <div className="section" style={{display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', justifyContent:'space-between'}}>
          <div>
            <div style={{fontWeight:800, fontSize:18, marginBottom:4}}>📊 Dashboard</div>
            <div className="helper">Monthly sales and metrics overview</div>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <label style={{fontWeight:600, fontSize:14}}>Period:</label>
            <select 
              className="input" 
              value={selectedMonth} 
              onChange={(e)=> setSelectedMonth(parseInt(e.target.value))}
              style={{minWidth:140, fontSize:14}}
            >
              {monthNames.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>
            <select 
              className="input" 
              value={selectedYear} 
              onChange={(e)=> setSelectedYear(parseInt(e.target.value))}
              style={{minWidth:100, fontSize:14}}
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Profit/Loss Section */}
      {metrics?.profitLoss && (
        <div className="card" style={{marginBottom:12}}>
          <div className="section" style={{display:'grid', gap:12}}>
            <div>
              <div style={{fontWeight:800,fontSize:18}}>Profit / Loss Overview</div>
              <div className="helper">Delivered orders only</div>
            </div>
            
            {/* Global Profit/Loss */}
            <div className="panel" style={{border:'2px solid ' + (metrics.profitLoss.isProfit ? '#10b981' : '#ef4444'), borderRadius:12, padding:16, background:'var(--panel)'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12}}>
                <div>
                  <div className="helper" style={{fontSize:14, marginBottom:4}}>{metrics.profitLoss.isProfit ? 'Total Profit' : 'Total Loss'}</div>
                  <div style={{fontSize:32, fontWeight:900, color: metrics.profitLoss.isProfit ? '#10b981' : '#ef4444'}}>
                    {metrics.profitLoss.isProfit ? '+' : '-'} AED {fmtAmt(Math.abs(metrics.profitLoss.profit || 0))}
                  </div>
                </div>
                <div style={{display:'flex', gap:16, flexWrap:'wrap'}}>
                  <div style={{textAlign:'center'}}>
                    <div className="helper" style={{fontSize:12}}>Revenue</div>
                    <div style={{fontWeight:800, fontSize:18, color:'#0ea5e9'}}>AED {fmtAmt(metrics.profitLoss.revenue || 0)}</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div className="helper" style={{fontSize:12}}>Purchase Cost</div>
                    <div style={{fontWeight:800, fontSize:18, color:'#8b5cf6'}}>AED {fmtAmt(metrics.profitLoss.purchaseCost || 0)}</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div className="helper" style={{fontSize:12}}>Driver Commission</div>
                    <div style={{fontWeight:800, fontSize:18, color:'#f59e0b'}}>AED {fmtAmt(metrics.profitLoss.driverCommission || 0)}</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div className="helper" style={{fontSize:12}}>Agent Commission</div>
                    <div style={{fontWeight:800, fontSize:18, color:'#f59e0b'}}>AED {fmtAmt(metrics.profitLoss.agentCommission || 0)}</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div className="helper" style={{fontSize:12}}>Investor Commission</div>
                    <div style={{fontWeight:800, fontSize:18, color:'#f59e0b'}}>AED {fmtAmt(metrics.profitLoss.investorCommission || 0)}</div>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <div className="helper" style={{fontSize:12}}>Advertisement</div>
                    <div style={{fontWeight:800, fontSize:18, color:'#ef4444'}}>AED {fmtAmt(metrics.profitLoss.advertisementExpense || 0)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Country-wise Profit/Loss */}
            <div>
              <div style={{fontWeight:700,fontSize:16, marginBottom:12}}>Profit / Loss by Country</div>
              <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:12}}>
                {['KSA','UAE','Oman','Bahrain','India','Kuwait','Qatar'].map(c=>{
                  const profitData = metrics.profitLoss.byCountry?.[c]
                  if (!profitData) return null
                  const isProfit = (profitData.profit || 0) >= 0
                  const flag = (COUNTRY_INFO[c] && COUNTRY_INFO[c].flag) ? COUNTRY_INFO[c].flag + ' ' : ''
                  const title = flag + ((c==='KSA') ? 'Saudi Arabia (KSA)' : c)
                  const currency = profitData.currency || 'AED'
                  
                  return (
                    <div key={c} className="panel" style={{border:'1px solid ' + (isProfit ? '#10b981' : '#ef4444'), borderRadius:12, padding:12, background:'var(--panel)'}}>
                      <div style={{fontWeight:900, marginBottom:8}}>{title}</div>
                      <div style={{fontSize:24, fontWeight:900, color: isProfit ? '#10b981' : '#ef4444', marginBottom:8}}>
                        {isProfit ? '+' : '-'} {currency} {fmtAmt(Math.abs(profitData.profit || 0))}
                      </div>
                      <div style={{display:'grid', gap:6, fontSize:13}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                          <span className="helper">Delivered:</span>
                          <span style={{fontWeight:700, color:'#0ea5e9'}}>{currency} {fmtAmt(profitData.revenue || 0)}</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                          <span className="helper">Purchase Cost:</span>
                          <span style={{fontWeight:700, color:'#8b5cf6'}}>{currency} {fmtAmt(profitData.purchaseCost || 0)}</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                          <span className="helper">Driver Comm:</span>
                          <span style={{fontWeight:700, color:'#f59e0b'}}>{currency} {fmtAmt(profitData.driverCommission || 0)}</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                          <span className="helper">Agent Comm:</span>
                          <span style={{fontWeight:700, color:'#f59e0b'}}>{currency} {fmtAmt(profitData.agentCommission || 0)}</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                          <span className="helper">Investor Comm:</span>
                          <span style={{fontWeight:700, color:'#f59e0b'}}>{currency} {fmtAmt(profitData.investorCommission || 0)}</span>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                          <span className="helper">Advertisement:</span>
                          <span style={{fontWeight:700, color:'#ef4444'}}>{currency} {fmtAmt(profitData.advertisementExpense || 0)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders Summary (Counts & Amounts) */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const totalOrdersCount = Number(metrics?.totalOrders||0)
          const deliveredOrdersCount = Number(metrics?.deliveredOrders||0)
          const deliveredQty = Number(metrics?.productMetrics?.global?.stockDeliveredQty||0)
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
                <Tile title="Total Orders" valueEl={<NavLink className="link" style={{color:'#0ea5e9'}} to="/user/orders">{fmtNum(totalOrdersCount)}</NavLink>} />
                <Tile title="Amount of Total Orders (AED)" valueEl={<NavLink className="link" style={{color:'#10b981'}} to="/user/orders">{`AED ${fmtAmt(amountTotalOrdersAED)}`}</NavLink>} chipsEl={currencyChipsFor('amountTotalOrders')} />
                <Tile title="Orders Delivered (Qty)" valueEl={<NavLink className="link" style={{color:'#10b981'}} to="/user/orders?ship=delivered">{fmtNum(deliveredQty)}</NavLink>} />
                <Tile title="Amount of Orders Delivered (AED)" valueEl={<NavLink className="link" style={{color:'#10b981'}} to="/user/orders?ship=delivered">{`AED ${fmtAmt(amountDeliveredAED)}`}</NavLink>} chipsEl={currencyChipsFor('amountDelivered')} />
                <Tile title="Open Orders" valueEl={<NavLink className="link" style={{color:'#f59e0b'}} to="/user/orders?ship=open">{fmtNum(pendingCount)}</NavLink>} />
                <Tile title="Open Amount (AED)" valueEl={<NavLink className="link" style={{color:'#f97316'}} to="/user/orders?ship=open">{`AED ${fmtAmt(amountPendingAED)}`}</NavLink>} chipsEl={currencyChipsFor('amountPending')} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* Product Metrics (All Countries) */}
      <div className="card" style={{marginTop:12}}>
        {(function(){
          const pm = metrics?.productMetrics || {}
          const g = pm?.global || {}
          const totalPurchaseAED = sumCurrencyMapAED(g?.totalPurchaseValueByCurrency||{})
          const purchaseAED = sumCurrencyMapAED(g?.purchaseValueByCurrency||{})
          const deliveredAED = sumCurrencyMapAED(g?.deliveredValueByCurrency||{})
          const purchasedQty = Number(g?.stockPurchasedQty||0)
          const deliveredQty = Number(g?.stockDeliveredQty||0)
          const pendingQty = Number(g?.stockLeftQty||0)
          function Tile({ title, valueEl }){
            return (
              <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:12, padding:'12px', background:'var(--panel)'}}>
                <div className="helper">{title}</div>
                <div style={{fontSize:24, fontWeight:900}}>{valueEl}</div>
              </div>
            )
          }
          return (
            <div className="section" style={{display:'grid', gap:12}}>
              <div>
                <div style={{fontWeight:800,fontSize:16}}>Product Metrics (All Countries)</div>
                <div className="helper">Amounts in AED</div>
              </div>
              <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
                <Tile title="Total Purchase Price (AED)" valueEl={<NavLink className="link" style={{color:'#8b5cf6'}} to="/user/inhouse-products">{`AED ${fmtAmt(totalPurchaseAED)}`}</NavLink>} />
                <Tile title="Inventory Value (AED)" valueEl={<NavLink className="link" style={{color:'#0ea5e9'}} to="/user/warehouses">{`AED ${fmtAmt(purchaseAED)}`}</NavLink>} />
                <Tile title="Delivered Value (AED)" valueEl={<NavLink className="link" style={{color:'#10b981'}} to="/user/orders?ship=delivered">{`AED ${fmtAmt(deliveredAED)}`}</NavLink>} />
                <Tile title="Stock Purchased (Qty)" valueEl={<NavLink className="link" style={{color:'#0ea5e9'}} to="/user/inhouse-products">{fmtNum(purchasedQty)}</NavLink>} />
                <Tile title="Stock Delivered (Qty)" valueEl={<NavLink className="link" style={{color:'#10b981'}} to="/user/orders?ship=delivered">{fmtNum(deliveredQty)}</NavLink>} />
                <Tile title="Pending Stock (Qty)" valueEl={<NavLink className="link" style={{color:'#f59e0b'}} to="/user/warehouses">{fmtNum(pendingQty)}</NavLink>} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* Product Metrics by Country */}
      <div className="card" style={{marginTop:12}}>
        <div style={{marginBottom:12}}>
          <div style={{fontWeight:800,fontSize:16}}>Per-Country Product Metrics</div>
          <div className="helper">Amounts in local currency</div>
        </div>
        <div className="section" style={{display:'grid', gap:12}}>
          {['KSA','UAE','Oman','Bahrain','India','Kuwait','Qatar'].map(c=>{
            const pm = metrics?.productMetrics || {}
            const pc = (pm?.countries && pm.countries[c]) ? pm.countries[c] : { stockPurchasedQty:0, stockDeliveredQty:0, stockLeftQty:0, purchaseValueByCurrency:{}, totalPurchaseValueByCurrency:{}, deliveredValueByCurrency:{} }
            const code = COUNTRY_INFO[c]?.cur || 'AED'
            const totalPurchaseLocal = sumCurrencyMapLocal(pc?.totalPurchaseValueByCurrency||{}, code)
            const purchaseLocal = sumCurrencyMapLocal(pc?.purchaseValueByCurrency||{}, code)
            const deliveredLocal = sumCurrencyMapLocal(pc?.deliveredValueByCurrency||{}, code)
            const flag = (COUNTRY_INFO[c] && COUNTRY_INFO[c].flag) ? COUNTRY_INFO[c].flag + ' ' : ''
            const title = flag + ((c==='KSA') ? 'Saudi Arabia (KSA)' : c)
            return (
              <div key={c} className="panel" style={{border:'1px solid var(--border)', borderRadius:12, padding:12, background:'var(--panel)'}}>
                <div style={{fontWeight:900, marginBottom:8}}>{title}</div>
                <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10}}>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Total Purchase Price</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#8b5cf6'}} to="/user/inhouse-products">{formatCurrency(totalPurchaseLocal, c)}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Inventory Value</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#0ea5e9'}} to="/user/warehouses">{formatCurrency(purchaseLocal, c)}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Delivered Value</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#10b981'}} to="/user/orders?ship=delivered">{formatCurrency(deliveredLocal, c)}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Stock Purchased</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#0ea5e9'}} to="/user/inhouse-products">{fmtNum(pc?.stockPurchasedQty||0)}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Stock Delivered</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#10b981'}} to="/user/orders?ship=delivered">{fmtNum(pc?.stockDeliveredQty||0)}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Pending Stock</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#f59e0b'}} to="/user/warehouses">{fmtNum(pc?.stockLeftQty||0)}</NavLink></div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
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
                <div style={{fontSize:24, fontWeight:900, color:color||'inherit'}}>{to ? (<NavLink className="link" style={{color:color||'inherit'}} to={to}>{fmtNum(value||0)}</NavLink>) : fmtNum(value||0)}</div>
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
            const amtDeliveredStr = formatCurrency((m?.amountDeliveredLocal ?? m?.amountDelivered ?? 0), c)
            const amtDiscountStr = formatCurrency((m?.amountDiscountLocal ?? 0), c)
            const amtGrossStr = formatCurrency((m?.amountGrossLocal ?? ((m?.amountDeliveredLocal ?? m?.amountDelivered ?? 0) + (m?.amountDiscountLocal ?? 0))), c)
            const amtPendingStr = formatCurrency(m?.amountPending||0, c)
            return (
              <div key={c} className="panel" style={{border:'1px solid var(--border)', borderRadius:12, padding:12, background:'var(--panel)'}}>
                <div style={{fontWeight:900, marginBottom:8}}>{name}</div>
                <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10}}>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Total Orders</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#0ea5e9'}} to={`/user/orders?country=${qs}`}>{fmtNum(m?.orders||0)}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Amount of Total Orders</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#10b981'}} to={`/user/orders?country=${qs}`}>{amtTotalStr}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Delivered (Qty)</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#10b981'}} to={`/user/orders?country=${qs}&ship=delivered`}>{fmtNum((m?.deliveredQty ?? m?.delivered) || 0)}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Amount of Delivered</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#10b981'}} to={`/user/orders?country=${qs}&ship=delivered`}>{amtDeliveredStr}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Amount of Discount</div>
                    <div style={{fontWeight:900, fontSize:18}}>{amtDiscountStr}</div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Gross Before Discount</div>
                    <div style={{fontWeight:900, fontSize:18}}>{amtGrossStr}</div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Open Orders</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#f59e0b'}} to={`/user/orders?country=${qs}&ship=open`}>{fmtNum(m?.pending||0)}</NavLink></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Open Amount</div>
                    <div style={{fontWeight:900, fontSize:18}}><NavLink className="link" style={{color:'#f97316'}} to={`/user/orders?country=${qs}&ship=open`}>{amtPendingStr}</NavLink></div>
                  </div>
                </div>
                <div style={{marginTop:10}}>
                  <div className="helper" style={{marginBottom:6}}>Status Summary</div>
                  <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Assigned</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#3b82f6'}} to={`/user/orders?country=${qs}&ship=assigned`}>{fmtNum(m?.assigned||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Picked Up</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#f59e0b'}} to={`/user/orders?country=${qs}&ship=picked_up`}>{fmtNum(m?.pickedUp||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">In Transit</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#0284c7'}} to={`/user/orders?country=${qs}&ship=in_transit`}>{fmtNum(m?.transit||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Out for Delivery</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#f97316'}} to={`/user/orders?country=${qs}&ship=out_for_delivery`}>{fmtNum(m?.outForDelivery||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Delivered</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#10b981'}} to={`/user/orders?country=${qs}&ship=delivered`}>{fmtNum(m?.delivered||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">No Response</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#ef4444'}} to={`/user/orders?country=${qs}&ship=no_response`}>{fmtNum(m?.noResponse||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Returned</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#737373'}} to={`/user/orders?country=${qs}&ship=returned`}>{fmtNum(m?.returned||0)}</NavLink></div>
                    </div>
                    <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                      <div className="helper">Cancelled</div>
                      <div style={{fontWeight:900}}><NavLink className="link" style={{color:'#b91c1c'}} to={`/user/orders?country=${qs}&ship=cancelled`}>{fmtNum(m?.cancelled||0)}</NavLink></div>
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
          <div className="helper">Performance overview</div>
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
      
    </div>
  )
}
