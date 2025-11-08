import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE, apiGet } from '../../api'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'
import { getCurrencyConfig, toAEDByCode, aedToPKR } from '../../util/currency'
import { qsRangeBare } from '../../utils/queryString.js'

export default function AgentDashboard(){
  const navigate = useNavigate()
  const toast = useToast()
  const me = useMemo(()=>{
    try{ return JSON.parse(localStorage.getItem('me')||'{}') }catch{ return {} }
  },[])
  
  // Month/Year filtering - default to current month
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1) // 1-12
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  
  // Month names for display
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  
  // Helper to get date range for selected month
  const getMonthDateRange = () => {
    const startDate = new Date(selectedYear, selectedMonth - 1, 1)
    const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999)
    return {
      from: startDate.toISOString(),
      to: endDate.toISOString()
    }
  }
  const [isMobile, setIsMobile] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  useEffect(()=>{
    function onResize(){ try{ setIsMobile(window.innerWidth <= 768) }catch{} }
    window.addEventListener('resize', onResize)
    return ()=> window.removeEventListener('resize', onResize)
  }, [])
  const [theme, setTheme] = useState(()=>{ try{ return localStorage.getItem('theme') || 'dark' }catch{ return 'dark' } })
  useEffect(()=>{
    try{ localStorage.setItem('theme', theme) }catch{}
    try{
      const root = document.documentElement
      if (theme === 'light') root.setAttribute('data-theme','light')
      else root.removeAttribute('data-theme')
    }catch{}
  }, [theme])
  // Keep local theme state in sync with global DOM/localStorage changes (integration with Me page)
  useEffect(()=>{
    function sync(){
      try{ const attr = document.documentElement.getAttribute('data-theme'); setTheme(attr==='light' ? 'light' : 'dark') }catch{}
    }
    const mo = new MutationObserver(sync)
    try{ mo.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] }) }catch{}
    const onStorage = (e)=>{ if (e && e.key === 'theme') sync() }
    window.addEventListener('storage', onStorage)
    sync()
    return ()=>{ try{ mo.disconnect() }catch{}; window.removeEventListener('storage', onStorage) }
  }, [])
  const [loading, setLoading] = useState(true)
  const [assignedCount, setAssignedCount] = useState(0)
  // Orders for metrics
  const [orders, setOrders] = useState([])
  const [avgResponseSeconds, setAvgResponseSeconds] = useState(null)
  const [ordersSubmittedOverride, setOrdersSubmittedOverride] = useState(null)
  // Agent-submitted status counts
  const [statusCounts, setStatusCounts] = useState({ total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0 })
  const [countryStats, setCountryStats] = useState([]) // country-wise submitted & delivered
  const [currencyCfg, setCurrencyCfg] = useState(null) // normalized { anchor:'AED', perAED, enabled }
  const [walletAED, setWalletAED] = useState(0)
  const [walletPKR, setWalletPKR] = useState(0)

  // Load metrics for the signed-in agent
  async function load(){
    setLoading(true)
    try{
      const [meRes, chats, perf, cfg] = await Promise.all([
        apiGet('/api/users/me').catch(()=>({})),
        apiGet('/api/wa/chats').catch(()=>[]),
        apiGet('/api/users/agents/me/performance').catch(()=>({})),
        getCurrencyConfig().catch(()=>null),
      ])
      // meRes.user available for id checks below
      const chatList = Array.isArray(chats) ? chats : []
      setAssignedCount(chatList.length)
      // Fetch ALL orders (paged) so status totals match the submitted total
      const dateRange = getMonthDateRange()
      const dateParams = `from=${encodeURIComponent(dateRange.from)}&to=${encodeURIComponent(dateRange.to)}`
      
      async function fetchAllOrders(){
        let page = 1, limit = 200, out = []
        for(;;){
          const r = await apiGet(`/api/orders?${dateParams}&page=${page}&limit=${limit}`).catch(()=>({ orders: [], hasMore:false }))
          const list = Array.isArray(r?.orders) ? r.orders : []
          out = out.concat(list)
          if (!r?.hasMore) break
          page += 1
          if (page > 100) break
        }
        return out
      }
      const allOrders = await fetchAllOrders()
      setOrders(allOrders)
      if (typeof perf?.avgResponseSeconds === 'number') setAvgResponseSeconds(perf.avgResponseSeconds)
      if (typeof perf?.ordersSubmitted === 'number') setOrdersSubmittedOverride(perf.ordersSubmitted)
      if (cfg) setCurrencyCfg(cfg)
      // compute status counts for orders submitted by this agent
      try{
        const meId = String((meRes?.user?._id) || (me?._id) || '')
        const mine = (Array.isArray(allOrders)? allOrders: []).filter(o => {
          const createdBy = String(o?.createdBy?._id || o?.createdBy || '')
          return createdBy && createdBy === meId
        })
        const init = { total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0 }
        const next = mine.reduce((acc, o)=>{
          acc.total += 1
          const s = String(o?.shipmentStatus||'').toLowerCase()
          if (acc[s] != null){ acc[s] += 1 }
          else { acc.pending += 1 }
          return acc
        }, init)
        setStatusCounts(next)
        // compute wallet from agent-submitted orders -> convert each to AED then sum, then convert total to PKR
        function orderTotal(o){
          try{
            if (o && o.total != null) return Number(o.total||0)
            if (Array.isArray(o?.items) && o.items.length){
              return o.items.reduce((s,it)=> s + (Number(it?.productId?.price||0) * Math.max(1, Number(it?.quantity||1))), 0)
            }
            const unit = Number(o?.productId?.price||0)
            return unit * Math.max(1, Number(o?.quantity||1))
          }catch{ return 0 }
        }
        function baseCur(o){
          if (Array.isArray(o?.items) && o.items.length){ return o.items[0]?.productId?.baseCurrency || 'SAR' }
          return (o?.productId?.baseCurrency) || 'SAR'
        }
        // Wallet: 12% commission on DELIVERED orders only
        let deliveredAED = 0
        for (const o of mine){
          const st = String(o?.shipmentStatus||'').toLowerCase()
          if (st !== 'delivered') continue
          const amt = orderTotal(o)
          const curCode = String(baseCur(o) || 'SAR').toUpperCase()
          const amtAED = toAEDByCode(amt, curCode, cfg)
          deliveredAED += amtAED
        }
        const commissionAED = deliveredAED * 0.12
        setWalletAED(commissionAED)
        setWalletPKR(aedToPKR(commissionAED, cfg))
        
        // Compute country-wise stats (submitted & delivered)
        try{
          const countryMap = {}
          for (const o of mine){
            const country = String(o?.orderCountry || o?.country || 'Unknown').trim() || 'Unknown'
            if (!countryMap[country]){
              countryMap[country] = { country, submitted: 0, delivered: 0 }
            }
            countryMap[country].submitted += 1
            const st = String(o?.shipmentStatus||'').toLowerCase()
            if (st === 'delivered'){
              countryMap[country].delivered += 1
            }
          }
          const statsArray = Object.values(countryMap).sort((a, b) => b.submitted - a.submitted)
          setCountryStats(statsArray)
        }catch{}
      }catch{}
    }finally{ setLoading(false) }
  }

  useEffect(()=>{ load() },[selectedMonth, selectedYear])
  // Removed recent orders infinite scroll and related fetches from dashboard

  // Fallback: periodic polling to keep data fresh even if socket misses an event
  useEffect(()=>{
    const id = setInterval(()=>{ load() }, 20000) // 20s
    function onVis(){ if (document.visibilityState === 'visible') load() }
    window.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return ()=>{ clearInterval(id); window.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis) }
  },[])

  // Live refresh on order changes across the workspace
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

  // Derived metrics
  const ordersSubmitted = ordersSubmittedOverride != null ? ordersSubmittedOverride : statusCounts.total
  const levelThresholds = useMemo(()=> [0,5,50,100,250,500], [])
  const levelIdx = useMemo(()=>{
    try{
      const n = Number(ordersSubmitted||0)
      let idx = 0
      for (let i=0;i<levelThresholds.length;i++){ if (n>=levelThresholds[i]) idx=i; else break }
      return idx
    }catch{ return 0 }
  }, [ordersSubmitted, levelThresholds])

  // Build driver-like tiles for status counts (agent submitted)
  const statusTiles = [
    { key:'total', title:'Total Orders (Submitted)', value: ordersSubmitted, color:'#0ea5e9', to:'/agent/orders/history' },
    { key:'pending', title:'Pending', value: statusCounts.pending, color:'#64748b', to:'/agent/orders/history?ship=pending' },
    { key:'assigned', title:'Assigned', value: statusCounts.assigned, color:'#3b82f6', to:'/agent/orders/history?ship=assigned' },
    { key:'picked_up', title:'Picked Up', value: statusCounts.picked_up, color:'#f59e0b', to:'/agent/orders/history?ship=picked_up' },
    { key:'in_transit', title:'In Transit', value: statusCounts.in_transit, color:'#0284c7', to:'/agent/orders/history?ship=in_transit' },
    { key:'out_for_delivery', title:'Out for Delivery', value: statusCounts.out_for_delivery, color:'#f97316', to:'/agent/orders/history?ship=out_for_delivery' },
    { key:'delivered', title:'Delivered', value: statusCounts.delivered, color:'#10b981', to:'/agent/orders/history?ship=delivered' },
    { key:'no_response', title:'No Response', value: statusCounts.no_response, color:'#ef4444', to:'/agent/orders/history?ship=no_response' },
    { key:'returned', title:'Returned', value: statusCounts.returned, color:'#737373', to:'/agent/orders/history?ship=returned' },
    { key:'cancelled', title:'Cancelled', value: statusCounts.cancelled, color:'#b91c1c', to:'/agent/orders/history?ship=cancelled' },
  ]

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      {/* Month/Year Filter */}
      <div className="card" style={{padding:16}}>
        <div className="section" style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
          <div style={{fontWeight:700, fontSize:16}}>📅 Period:</div>
          <select 
            className="input" 
            value={selectedMonth} 
            onChange={(e)=> setSelectedMonth(Number(e.target.value))}
            style={{fontSize:14, maxWidth:150}}
          >
            {monthNames.map((name, idx) => (
              <option key={idx} value={idx + 1}>{name}</option>
            ))}
          </select>
          <select 
            className="input" 
            value={selectedYear} 
            onChange={(e)=> setSelectedYear(Number(e.target.value))}
            style={{fontSize:14, maxWidth:120}}
          >
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <div className="chip" style={{background:'var(--primary)', color:'white', fontWeight:600}}>
            {monthNames[selectedMonth - 1]} {selectedYear}
          </div>
        </div>
      </div>
      
      {/* Top metrics (like driver tiles) */}
      <div className="card" style={{padding:16}}>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px,1fr))', gap:12}}>
          <div className="tile" style={{display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:8, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div>
              <div style={{fontSize:12, color:'var(--muted)'}}>Assigned Chats</div>
              <div style={{fontSize:28, fontWeight:800, color:'#3b82f6'}}>{loading? '…' : assignedCount}</div>
            </div>
            <button className="btn" onClick={()=> navigate('/agent/inbox/whatsapp')}>Go to Chats</button>
          </div>
          <div className="tile" style={{display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:8, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div>
              <div style={{fontSize:12, color:'var(--muted)'}}>Orders Submitted</div>
              <div style={{fontSize:28, fontWeight:800, color:'#10b981'}}>{loading? '…' : ordersSubmitted}</div>
            </div>
            <button className="btn secondary" onClick={()=> navigate('/agent/orders/history')}>Order History</button>
          </div>
          <div className="tile" style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div style={{fontSize:12, color:'var(--muted)'}}>Avg. Response Time</div>
            <div style={{fontSize:28, fontWeight:800, color:'#f59e0b'}}>{avgResponseSeconds!=null? formatDuration(avgResponseSeconds) : '—'}</div>
          </div>
        </div>
      </div>

      {/* Wallet amount */}
      <div className="card" style={{padding:16}}>
        <div className="card-title" style={{marginBottom:8}}>Wallet Amount</div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:12}}>
          <div className="tile" style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div className="helper">Total (AED)</div>
            <div style={{fontSize:28, fontWeight:800, color:'#2563eb'}}>{Math.round(walletAED).toLocaleString()}</div>
          </div>
          <div className="tile" style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
            <div className="helper">Total (PKR)</div>
            <div style={{fontSize:28, fontWeight:800, color:'#0ea5e9'}}>{Math.round(walletPKR).toLocaleString()}</div>
          </div>
        </div>
        <div className="helper" style={{marginTop:8}}>12% commission on delivered orders only. We convert each delivered order to AED using User Panel rates, sum, take 12%, then convert that commission to PKR. Order History shows amounts in original currencies.</div>
      </div>

      {/* Order status metrics for agent-submitted orders */}
      <div className="card" style={{padding:16}}>
        <div className="card-title" style={{marginBottom:8}}>Your Orders by Status</div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:12}}>
          {statusTiles.map(c => (
            <button key={c.key} className="tile" onClick={()=> c.to ? navigate(c.to) : null} style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
              <div style={{fontSize:12, color:'var(--muted)'}}>{c.title}</div>
              <div style={{fontSize:28, fontWeight:800, color:c.color}}>{loading? '…' : c.value}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Country-wise Orders Card */}
      <div className="card" style={{padding:16, border:'1px solid var(--border)'}}>
        <div className="card-header" style={{padding:0, marginBottom:16, borderBottom:'2px solid var(--border)', paddingBottom:12}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              <path d="M2 12h20"/>
            </svg>
            <div>
              <div className="card-title" style={{marginBottom:2}}>Orders by Country</div>
              <div className="helper" style={{fontSize:12}}>Track submitted and delivered orders across countries</div>
            </div>
          </div>
        </div>
        {loading ? (
          <div style={{padding:40, textAlign:'center'}}>
            <div style={{width:40, height:40, border:'3px solid var(--border)', borderTopColor:'#8b5cf6', borderRadius:'50%', margin:'0 auto 16px', animation:'spin 0.8s linear infinite'}} />
            <div style={{opacity:0.6}}>Loading country stats...</div>
          </div>
        ) : countryStats.length === 0 ? (
          <div style={{padding:40, textAlign:'center', opacity:0.6}}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{margin:'0 auto 16px', opacity:0.3}}>
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <div>No country data available</div>
          </div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap:16}}>
            {countryStats.map((stat, idx) => {
              const deliveryRate = stat.submitted > 0 ? ((stat.delivered / stat.submitted) * 100).toFixed(1) : 0
              const isHighPerformer = deliveryRate >= 70
              return (
                <div 
                  key={stat.country} 
                  className="card" 
                  style={{
                    padding:16, 
                    background:`linear-gradient(135deg, var(--panel) 0%, var(--panel-2) 100%)`,
                    border:`2px solid ${isHighPerformer ? '#10b981' : 'var(--border)'}`,
                    borderRadius:12,
                    transition:'transform 0.2s, box-shadow 0.2s',
                    cursor:'default'
                  }}
                  onMouseEnter={(e)=> e.currentTarget.style.transform='translateY(-2px)'}
                  onMouseLeave={(e)=> e.currentTarget.style.transform='translateY(0)'}
                >
                  {/* Country Name with Flag Icon */}
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16}}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <div style={{
                        width:36, 
                        height:36, 
                        borderRadius:8, 
                        background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        fontSize:18,
                        fontWeight:700,
                        color:'#fff',
                        boxShadow:'0 2px 8px rgba(102, 126, 234, 0.3)'
                      }}>
                        {stat.country.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontSize:16, fontWeight:700, lineHeight:1.2}}>{stat.country}</div>
                        <div style={{fontSize:11, opacity:0.6}}>#{idx + 1} by orders</div>
                      </div>
                    </div>
                    {isHighPerformer && (
                      <div style={{
                        padding:'4px 10px',
                        background:'rgba(16, 185, 129, 0.1)',
                        border:'1px solid #10b981',
                        borderRadius:20,
                        fontSize:10,
                        fontWeight:700,
                        color:'#10b981'
                      }}>
                        HIGH
                      </div>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
                    <div style={{padding:12, background:'var(--panel)', borderRadius:8, border:'1px solid var(--border)'}}>
                      <div className="helper" style={{fontSize:10, marginBottom:4, color:'#3b82f6'}}>SUBMITTED</div>
                      <div style={{fontSize:24, fontWeight:800, color:'#3b82f6'}}>{stat.submitted}</div>
                    </div>
                    <div style={{padding:12, background:'var(--panel)', borderRadius:8, border:'1px solid var(--border)'}}>
                      <div className="helper" style={{fontSize:10, marginBottom:4, color:'#10b981'}}>DELIVERED</div>
                      <div style={{fontSize:24, fontWeight:800, color:'#10b981'}}>{stat.delivered}</div>
                    </div>
                  </div>

                  {/* Delivery Rate Progress Bar */}
                  <div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                      <span style={{fontSize:11, fontWeight:600, opacity:0.7}}>Delivery Rate</span>
                      <span style={{fontSize:13, fontWeight:800, color: isHighPerformer ? '#10b981' : '#f59e0b'}}>{deliveryRate}%</span>
                    </div>
                    <div style={{width:'100%', height:8, background:'var(--panel)', borderRadius:20, overflow:'hidden', border:'1px solid var(--border)'}}>
                      <div 
                        style={{
                          width:`${deliveryRate}%`, 
                          height:'100%', 
                          background: isHighPerformer 
                            ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                            : 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
                          transition:'width 0.5s ease',
                          borderRadius:20
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function formatDuration(seconds){
  const s = Math.max(0, Math.round(seconds||0))
  const m = Math.floor(s/60), r = s%60
  if (m>0) return `${m}m ${r}s`
  return `${r}s`
}

// removed currency breakdown and formatting helpers (no longer used)
