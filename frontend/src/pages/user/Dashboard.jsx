import React, { useEffect, useMemo, useState } from 'react'
import MetricCard from '../../components/MetricCard.jsx'
import Chart from '../../components/Chart.jsx'
import { API_BASE, apiGet } from '../../api.js'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'

const OrderStatusPie = ({ metrics }) => {
  const data = [
    { label: 'Pending', value: metrics.pendingOrders, color: '#F59E0B' },
    { label: 'Picked Up', value: metrics.pickedUpOrders, color: '#3B82F6' },
    { label: 'Delivered', value: metrics.deliveredOrders, color: '#10B981' },
    { label: 'Cancelled', value: metrics.cancelledOrders, color: '#EF4444' },
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
    const currencyByCountry = { KSA:'SAR', UAE:'AED', Oman:'OMR', Bahrain:'BHD', India:'INR', Kuwait:'KWD', Qatar:'QAR' }
    const countries = ['KSA','UAE','Oman','Bahrain','India','Kuwait','Qatar']
    const init = {}
    for (const c of countries){ init[c] = { country:c, currency: currencyByCountry[c], assigned:0, delivered:0, cancelled:0, collected:0, deliveredToCompany:0, pendingToCompany:0 } }
    const list = Array.isArray(drivers)? drivers: []
    for (const d of list){
      const c = canonical(d?.country)
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
    const list = ['KSA','UAE','Oman','Bahrain','India','Kuwait','Qatar']
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
  }), [])
  const COUNTRY_LIST = useMemo(() => ['KSA','UAE','Oman','Bahrain','India','Kuwait','Qatar'], [])
  function countryMetrics(c){
    const base = metrics?.countries || {}
    if (base[c]) return base[c]
    const alias = COUNTRY_INFO[c]?.alias || []
    for (const a of alias){ if (base[a]) return base[a] }
    return {}
  }
  function fmtNum(n){ try{ return Number(n||0).toLocaleString() }catch{ return String(n||0) } }
  function fmtAmt(n){ try{ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }catch{ return String(n||0) } }
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
    try{ setAnalytics(await apiGet('/api/orders/analytics/last7days')) }catch(_e){ setAnalytics({ days: [], totals:{} }) }
    try{ setMetrics(await apiGet('/api/reports/user-metrics')) }catch(_e){ console.error('Failed to fetch metrics') }
    try{ setSalesByCountry(await apiGet('/api/reports/user-metrics/sales-by-country')) }catch(_e){ setSalesByCountry({ KSA:0, Oman:0, UAE:0, Bahrain:0, India:0, Kuwait:0, Qatar:0, Other:0 }) }
    try{ const res = await apiGet('/api/orders'); setOrders(Array.isArray(res?.orders) ? res.orders : []) }catch(_e){ setOrders([]) }
    try{ const ds = await apiGet('/api/finance/drivers/summary?page=1&limit=12'); setDrivers(Array.isArray(ds?.drivers)? ds.drivers: []) }catch(_e){ setDrivers([]) }
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

      {/* Total Orders */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const totalOrdersCount = Number(metrics?.totalOrders||0)
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#0ea5e9,#0369a1)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>📦</div>
                <div style={{fontWeight:800,fontSize:16}}>Total Orders</div>
              </div>
              <div style={{fontSize:22, fontWeight:900}}>{fmtNum(totalOrdersCount)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(m.orders||0)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Amount of Total Orders */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const amountTotalOrders = COUNTRY_LIST.reduce((s,c)=> s + Number(countryMetrics(c).amountTotalOrders||0), 0)
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#10b981,#059669)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>💵</div>
                <div style={{fontWeight:800,fontSize:16}}>Amount of Total Orders</div>
              </div>
              <div style={{fontSize:18, fontWeight:800}}>{fmtAmt(amountTotalOrders)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag='', cur='' } = COUNTRY_INFO[c]||{}
                  const val = Number(m.amountTotalOrders||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{cur} {fmtAmt(val)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Orders Delivered */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const deliveredCount = Number(metrics?.deliveredOrders||0)
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#16a34a,#15803d)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>✅</div>
                <div style={{fontWeight:800,fontSize:16}}>Orders Delivered</div>
              </div>
              <div style={{fontSize:22, fontWeight:900}}>{fmtNum(deliveredCount)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(m.delivered||0)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Amount of Orders Delivered */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const amountDelivered = COUNTRY_LIST.reduce((s,c)=> s + Number(countryMetrics(c).amountDelivered||0), 0)
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#22c55e,#16a34a)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🧾</div>
                <div style={{fontWeight:800,fontSize:16}}>Amount of Orders Delivered</div>
              </div>
              <div style={{fontSize:18, fontWeight:800}}>{fmtAmt(amountDelivered)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag='', cur='' } = COUNTRY_INFO[c]||{}
                  const val = Number(m.amountDelivered||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{cur} {fmtAmt(val)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Pending Orders */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const pendingCount = Number(metrics?.pendingOrders||0)
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#f59e0b,#d97706)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>⏳</div>
                <div style={{fontWeight:800,fontSize:16}}>Pending Orders</div>
              </div>
              <div style={{fontSize:22, fontWeight:900}}>{fmtNum(pendingCount)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(m.pending||0)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Pending Amount */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const amountPending = COUNTRY_LIST.reduce((s,c)=> s + Number(countryMetrics(c).amountPending||0), 0)
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#fb923c,#f97316)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>💰</div>
                <div style={{fontWeight:800,fontSize:16}}>Pending Amount</div>
              </div>
              <div style={{fontSize:18, fontWeight:800}}>{fmtAmt(amountPending)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag='', cur='' } = COUNTRY_INFO[c]||{}
                  const val = Number(m.amountPending||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{cur} {fmtAmt(val)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Status: Total Orders */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = statusTotals || {}
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>📦</div>
                <div style={{fontWeight:800,fontSize:16}}>Total Orders</div>
              </div>
              <div style={{fontSize:22, fontWeight:900}}>{fmtNum(st.total||0)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  const val = Number(m.orders||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(val)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Status: Pending */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = statusTotals || {}
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#f59e0b,#d97706)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>⏳</div>
                <div style={{fontWeight:800,fontSize:16}}>Pending</div>
              </div>
              <div style={{fontSize:22, fontWeight:900}}>{fmtNum(st.pending||0)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  const val = Number(m.pending||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(val)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Status: Assigned */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = statusTotals || {}
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#94a3b8,#64748b)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>📌</div>
                <div style={{fontWeight:800,fontSize:16}}>Assigned</div>
              </div>
              <div style={{fontSize:22, fontWeight:900}}>{fmtNum(st.assigned||0)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  const val = Number(m.assigned||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(val)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Status: Picked Up */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = statusTotals || {}
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#60a5fa,#3b82f6)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🚚</div>
                <div style={{fontWeight:800,fontSize:16}}>Picked Up</div>
              </div>
              <div style={{fontSize:22, fontWeight:900}}>{fmtNum(st.picked_up||0)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  const val = Number(m.pickedUp||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(val)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Status: In Transit */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = statusTotals || {}
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#0ea5e9,#0369a1)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🚛</div>
                <div style={{fontWeight:800,fontSize:16}}>In Transit</div>
              </div>
              <div style={{fontSize:22, fontWeight:900}}>{fmtNum(st.in_transit||0)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  const val = Number(m.transit||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(val)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Status: Out for Delivery */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = statusTotals || {}
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#f97316,#ea580c)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🛵</div>
                <div style={{fontWeight:800,fontSize:16}}>Out for Delivery</div>
              </div>
              <div style={{fontSize:22, fontWeight:900}}>{fmtNum(st.out_for_delivery||0)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  const val = Number(m.outForDelivery||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(val)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Status: Delivered */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = statusTotals || {}
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#22c55e,#16a34a)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>✅</div>
                <div style={{fontWeight:800,fontSize:16}}>Delivered</div>
              </div>
              <div style={{fontSize:22, fontWeight:900}}>{fmtNum(st.delivered||0)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  const val = Number(m.delivered||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(val)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Status: No Response */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = statusTotals || {}
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#ef4444,#b91c1c)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>☎️🚫</div>
                <div style={{fontWeight:800,fontSize:16}}>No Response</div>
              </div>
              <div style={{fontSize:22, fontWeight:900}}>{fmtNum(st.no_response||0)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  const val = Number(m.noResponse||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(val)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Status: Returned */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = statusTotals || {}
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#a3a3a3,#737373)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🔁</div>
                <div style={{fontWeight:800,fontSize:16}}>Returned</div>
              </div>
              <div style={{fontSize:22, fontWeight:900}}>{fmtNum(st.returned||0)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  const val = Number(m.returned||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(val)}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Status: Cancelled */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = statusTotals || {}
          return (
            <div className="section" style={{display:'grid', gap:8}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#ef4444,#b91c1c)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>❌</div>
                <div style={{fontWeight:800,fontSize:16}}>Cancelled</div>
              </div>
              <div style={{fontSize:22, fontWeight:900}}>{fmtNum(st.cancelled||0)}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {COUNTRY_LIST.map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  const val = Number(m.cancelled||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(val)}</strong>
                    </span>
                  )
                })}
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
              const currency = row.country==='KSA' ? 'SAR' : row.country==='UAE' ? 'AED' : row.country==='Oman' ? 'OMR' : row.country==='Bahrain' ? 'BHD' : row.country==='India' ? 'INR' : row.country==='Kuwait' ? 'KWD' : 'QAR'
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

      {/* Orders Overview */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🧾</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Orders Overview</div>
            <div className="helper">Current status of all orders</div>
          </div>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12}}>
          <MetricCard title="Total Orders" value={metrics.totalOrders} icon="📦" to="/user/orders" />
          <MetricCard title="Pending Orders" value={metrics.pendingOrders} icon="⏳" to="/user/orders?status=pending" />
          <MetricCard title="Picked Up" value={metrics.pickedUpOrders} icon="🚚" to="/user/orders?ship=picked_up" />
          <MetricCard title="Delivered" value={metrics.deliveredOrders} icon="✅" to="/user/orders?ship=delivered" />
          <MetricCard title="Cancelled" value={metrics.cancelledOrders} icon="❌" to="/user/orders?status=cancelled" />
        </div>
      </div>

      {/* Inventory & Expenses */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#f59e0b,#d97706)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>📊</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Inventory & Operational Costs</div>
            <div className="helper">Stock levels and order-related expenses</div>
          </div>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12}}>
          <MetricCard title="Products In Stock" value={metrics.totalProductsInHouse} icon="📦" to="/user/inhouse-products" />
          <MetricCard title="Products Sold" value={metrics.totalProductsOrdered} icon="✅" to="/user/orders?ship=delivered" />
          <MetricCard title="Total Expenses" value={formatCurrency(metrics.totalExpense||0, 'UAE')} icon="💸" to="/user/finances?section=agent" />
          <MetricCard title="Agent Expense (PKR)" value={formatCurrency(metrics.totalAgentExpense||0, 'PKR')} icon="👔" to="/user/finances?section=agent" />
          <MetricCard title="Driver Expense" value={formatCurrency(metrics.totalDriverExpense||0, 'UAE')} icon="🚗" to="/user/finances?section=driver" />
        </div>
      </div>
      {/* KSA Metrics */}
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#059669,#047857)',display:'grid',placeItems:'center',color:'#fff',fontSize:20}}>🇸🇦</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Saudi Arabia (KSA)</div>
            <div className="helper">All metrics for Saudi Arabia operations</div>
          </div>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12}}>
          <MetricCard title="Sales in KSA" value={formatCurrency(metrics.countries?.KSA?.sales || metrics.countries?.['Saudi Arabia']?.sales || 0, 'KSA')} icon="💵" to="/user/orders?country=KSA&ship=delivered" />
          <MetricCard title="Orders in KSA" value={metrics.countries?.KSA?.orders || metrics.countries?.['Saudi Arabia']?.orders || 0} icon="📦" to="/user/orders?country=KSA" />
          <MetricCard title="Picked Up" value={metrics.countries?.KSA?.pickedUp || metrics.countries?.['Saudi Arabia']?.pickedUp || 0} icon="🚚" to="/user/orders?country=KSA&ship=picked_up" />
          <MetricCard title="Delivered" value={metrics.countries?.KSA?.delivered || metrics.countries?.['Saudi Arabia']?.delivered || 0} icon="✅" to="/user/orders?country=KSA&ship=delivered" />
          <MetricCard title="In Transit" value={metrics.countries?.KSA?.transit || metrics.countries?.['Saudi Arabia']?.transit || 0} icon="🚛" to="/user/orders?country=KSA&ship=in_transit" />
          <MetricCard title="Driver Expense" value={formatCurrency(metrics.countries?.KSA?.driverExpense || metrics.countries?.['Saudi Arabia']?.driverExpense || 0, 'KSA')} icon="🚗" to="/user/finances?section=driver" />
        </div>
      </div>

      {/* Oman Metrics */}
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#dc2626,#991b1b)',display:'grid',placeItems:'center',color:'#fff',fontSize:20}}>🇴🇲</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Oman</div>
            <div className="helper">All metrics for Oman operations</div>
          </div>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12}}>
          <MetricCard title="Sales in Oman" value={formatCurrency(metrics.countries?.Oman?.sales || 0, 'Oman')} icon="💵" to="/user/orders?country=Oman&ship=delivered" />
          <MetricCard title="Orders in Oman" value={metrics.countries?.Oman?.orders || 0} icon="📦" to="/user/orders?country=Oman" />
          <MetricCard title="Picked Up" value={metrics.countries?.Oman?.pickedUp || 0} icon="🚚" to="/user/orders?country=Oman&ship=picked_up" />
          <MetricCard title="Delivered" value={metrics.countries?.Oman?.delivered || 0} icon="✅" to="/user/orders?country=Oman&ship=delivered" />
          <MetricCard title="In Transit" value={metrics.countries?.Oman?.transit || 0} icon="🚛" to="/user/orders?country=Oman&ship=in_transit" />
          <MetricCard title="Driver Expense" value={formatCurrency(metrics.countries?.Oman?.driverExpense || 0, 'Oman')} icon="🚗" to="/user/finances?section=driver" />
        </div>
      </div>

      {/* UAE Metrics */}
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#0284c7,#0369a1)',display:'grid',placeItems:'center',color:'#fff',fontSize:20}}>🇦🇪</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>United Arab Emirates (UAE)</div>
            <div className="helper">All metrics for UAE operations</div>
          </div>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12}}>
          <MetricCard title="Sales in UAE" value={formatCurrency(metrics.countries?.UAE?.sales || 0, 'UAE')} icon="💵" to="/user/orders?country=UAE&ship=delivered" />
          <MetricCard title="Orders in UAE" value={metrics.countries?.UAE?.orders || 0} icon="📦" to="/user/orders?country=UAE" />
          <MetricCard title="Picked Up" value={metrics.countries?.UAE?.pickedUp || 0} icon="🚚" to="/user/orders?country=UAE&ship=picked_up" />
          <MetricCard title="Delivered" value={metrics.countries?.UAE?.delivered || 0} icon="✅" to="/user/orders?country=UAE&ship=delivered" />
          <MetricCard title="In Transit" value={metrics.countries?.UAE?.transit || 0} icon="🚛" to="/user/orders?country=UAE&ship=in_transit" />
          <MetricCard title="Driver Expense" value={formatCurrency(metrics.countries?.UAE?.driverExpense || 0, 'UAE')} icon="🚗" to="/user/finances?section=driver" />
        </div>
      </div>

      {/* Bahrain Metrics */}
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#7c3aed,#5b21b6)',display:'grid',placeItems:'center',color:'#fff',fontSize:20}}>🇧🇭</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Bahrain</div>
            <div className="helper">All metrics for Bahrain operations</div>
          </div>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12}}>
          <MetricCard title="Sales in Bahrain" value={formatCurrency(metrics.countries?.Bahrain?.sales || 0, 'Bahrain')} icon="💵" to="/user/orders?country=Bahrain&ship=delivered" />
          <MetricCard title="Orders in Bahrain" value={metrics.countries?.Bahrain?.orders || 0} icon="📦" to="/user/orders?country=Bahrain" />
          <MetricCard title="Picked Up" value={metrics.countries?.Bahrain?.pickedUp || 0} icon="🚚" to="/user/orders?country=Bahrain&ship=picked_up" />
          <MetricCard title="Delivered" value={metrics.countries?.Bahrain?.delivered || 0} icon="✅" to="/user/orders?country=Bahrain&ship=delivered" />
          <MetricCard title="In Transit" value={metrics.countries?.Bahrain?.transit || 0} icon="🚛" to="/user/orders?country=Bahrain&ship=in_transit" />
          <MetricCard title="Driver Expense" value={formatCurrency(metrics.countries?.Bahrain?.driverExpense || 0, 'Bahrain')} icon="🚗" to="/user/finances?section=driver" />
        </div>
      </div>
      
      {/* India Metrics */}
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#ef4444,#b91c1c)',display:'grid',placeItems:'center',color:'#fff',fontSize:20}}>🇮🇳</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>India</div>
            <div className="helper">All metrics for India operations</div>
          </div>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12}}>
          <MetricCard title="Sales in India" value={formatCurrency(metrics.countries?.India?.sales || 0, 'India')} icon="💵" to="/user/orders?country=India&ship=delivered" />
          <MetricCard title="Orders in India" value={metrics.countries?.India?.orders || 0} icon="📦" to="/user/orders?country=India" />
          <MetricCard title="Picked Up" value={metrics.countries?.India?.pickedUp || 0} icon="🚚" to="/user/orders?country=India&ship=picked_up" />
          <MetricCard title="Delivered" value={metrics.countries?.India?.delivered || 0} icon="✅" to="/user/orders?country=India&ship=delivered" />
          <MetricCard title="In Transit" value={metrics.countries?.India?.transit || 0} icon="🚛" to="/user/orders?country=India&ship=in_transit" />
          <MetricCard title="Driver Expense" value={formatCurrency(metrics.countries?.India?.driverExpense || 0, 'India')} icon="🚗" to="/user/finances?section=driver" />
        </div>
      </div>

      {/* Kuwait Metrics */}
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#14b8a6,#0d9488)',display:'grid',placeItems:'center',color:'#fff',fontSize:20}}>🇰🇼</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Kuwait</div>
            <div className="helper">All metrics for Kuwait operations</div>
          </div>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12}}>
          <MetricCard title="Sales in Kuwait" value={formatCurrency(metrics.countries?.Kuwait?.sales || 0, 'Kuwait')} icon="💵" to="/user/orders?country=Kuwait&ship=delivered" />
          <MetricCard title="Orders in Kuwait" value={metrics.countries?.Kuwait?.orders || 0} icon="📦" to="/user/orders?country=Kuwait" />
          <MetricCard title="Picked Up" value={metrics.countries?.Kuwait?.pickedUp || 0} icon="🚚" to="/user/orders?country=Kuwait&ship=picked_up" />
          <MetricCard title="Delivered" value={metrics.countries?.Kuwait?.delivered || 0} icon="✅" to="/user/orders?country=Kuwait&ship=delivered" />
          <MetricCard title="In Transit" value={metrics.countries?.Kuwait?.transit || 0} icon="🚛" to="/user/orders?country=Kuwait&ship=in_transit" />
          <MetricCard title="Driver Expense" value={formatCurrency(metrics.countries?.Kuwait?.driverExpense || 0, 'Kuwait')} icon="🚗" to="/user/finances?section=driver" />
        </div>
      </div>

      {/* Qatar Metrics */}
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#f97316,#c2410c)',display:'grid',placeItems:'center',color:'#fff',fontSize:20}}>🇶🇦</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Qatar</div>
            <div className="helper">All metrics for Qatar operations</div>
          </div>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12}}>
          <MetricCard title="Sales in Qatar" value={formatCurrency(metrics.countries?.Qatar?.sales || 0, 'Qatar')} icon="💵" to="/user/orders?country=Qatar&ship=delivered" />
          <MetricCard title="Orders in Qatar" value={metrics.countries?.Qatar?.orders || 0} icon="📦" to="/user/orders?country=Qatar" />
          <MetricCard title="Picked Up" value={metrics.countries?.Qatar?.pickedUp || 0} icon="🚚" to="/user/orders?country=Qatar&ship=picked_up" />
          <MetricCard title="Delivered" value={metrics.countries?.Qatar?.delivered || 0} icon="✅" to="/user/orders?country=Qatar&ship=delivered" />
          <MetricCard title="In Transit" value={metrics.countries?.Qatar?.transit || 0} icon="🚛" to="/user/orders?country=Qatar&ship=in_transit" />
          <MetricCard title="Driver Expense" value={formatCurrency(metrics.countries?.Qatar?.driverExpense || 0, 'Qatar')} icon="🚗" to="/user/finances?section=driver" />
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
        <OrderStatusPie metrics={metrics} />
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
