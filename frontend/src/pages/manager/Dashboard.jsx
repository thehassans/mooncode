import React, { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { apiGet } from '../../api'

export default function ManagerDashboard(){
  const [isMobile, setIsMobile] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  const [me, setMe] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem('me')||'null') }catch{ return null }
  })
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState([])
  const [summary, setSummary] = useState({}) // { KSA:{orders,delivered,cancelled}, ... }
  const [metrics, setMetrics] = useState(null) // manager-scoped metrics from backend

  useEffect(()=>{
    function onResize(){ setIsMobile(window.innerWidth <= 768) }
    window.addEventListener('resize', onResize)
    return ()=> window.removeEventListener('resize', onResize)
  },[])

  useEffect(()=>{
    let alive = true
    ;(async ()=>{ 
      try{ 
        const { user } = await apiGet('/api/users/me'); 
        if (!alive) return
        setMe(user||null)
        try{ localStorage.setItem('me', JSON.stringify(user||{})) }catch{}
      }catch{ 
        // keep local me fallback
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return ()=>{ alive = false }
  },[])

  const canCreateAgents = !!(me && me.managerPermissions && me.managerPermissions.canCreateAgents)
  const canManageProducts = !!(me && me.managerPermissions && me.managerPermissions.canManageProducts)
  const canCreateOrders = !!(me && me.managerPermissions && me.managerPermissions.canCreateOrders)
  const canCreateDrivers = !!(me && me.managerPermissions && me.managerPermissions.canCreateDrivers)

  const assignedList = useMemo(()=>{
    const arr = Array.isArray(me?.assignedCountries) && me.assignedCountries.length ? me.assignedCountries : (me?.assignedCountry ? [me.assignedCountry] : [])
    // Default to all if none assigned
    return arr.length ? arr : ['KSA','UAE','Oman','Bahrain','India','Kuwait','Qatar']
  }, [me])

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
  const COUNTRY_LIST = useMemo(() => Array.isArray(assignedList) ? assignedList.filter(c=> ['KSA','UAE','Oman','Bahrain','India','Kuwait','Qatar','Saudi Arabia'].includes(c)) : [], [assignedList])
  function countryMetrics(c){
    const base = metrics?.countries || {}
    if (base[c]) return base[c]
    const alias = COUNTRY_INFO[c]?.alias || []
    for (const a of alias){ if (base[a]) return base[a] }
    return {}
  }
  function fmtNum(n){ try{ return Number(n||0).toLocaleString() }catch{ return String(n||0) } }
  function fmtAmt(n){ try{ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }catch{ return String(n||0) } }

  // Load drivers finance summary and compute amounts per country
  const moneyByCountry = useMemo(()=>{
    const map = {}
    for (const d of (Array.isArray(drivers)? drivers: [])){
      const c = String(d?.country||'')
      if (!c) continue
      if (!map[c]) map[c] = { collected:0, deliveredToCompany:0, pendingToCompany:0 }
      map[c].collected += Number(d?.collected||0)
      map[c].deliveredToCompany += Number(d?.deliveredToCompany||0)
      map[c].pendingToCompany += Number(d?.pendingToCompany||0)
    }
    return map
  }, [drivers])

  // Aggregate driver metrics by assigned countries (assignedAllTime + amounts)
  const driverAggByCountry = useMemo(()=>{
    const init = {}
    // Normalize list (support 'Saudi Arabia' alias)
    const list = Array.isArray(COUNTRY_LIST) ? COUNTRY_LIST : []
    for (const c of list){ init[c] = { assignedAllTime:0, collected:0, deliveredToCompany:0, pendingToCompany:0 } }
    const asKey = (name)=>{
      const canon = (name==='Saudi Arabia' ? 'KSA' : String(name||''))
      // If assigned list uses 'Saudi Arabia', output under that key for display
      if (canon==='KSA' && list.includes('Saudi Arabia')) return 'Saudi Arabia'
      return canon
    }
    for (const d of (Array.isArray(drivers)? drivers: [])){
      const key = asKey(d?.country)
      if (!init[key]) continue
      init[key].assignedAllTime += Number(d?.assigned||0)
      init[key].collected += Number(d?.collected||0)
      init[key].deliveredToCompany += Number(d?.deliveredToCompany||0)
      init[key].pendingToCompany += Number(d?.pendingToCompany||0)
    }
    return init
  }, [drivers, COUNTRY_LIST])

  useEffect(()=>{
    // Load drivers summary once (manager-scoped backend)
    (async()=>{
      try{ const ds = await apiGet('/api/finance/drivers/summary?page=1&limit=200'); setDrivers(Array.isArray(ds?.drivers)? ds.drivers: []) }catch{ setDrivers([]) }
    })()
  },[])

  // Load manager metrics (assigned-country scoped by backend)
  useEffect(()=>{
    (async()=>{
      try{ setMetrics(await apiGet('/api/reports/manager-metrics')) }catch{ setMetrics(null) }
    })()
  },[])

  useEffect(()=>{
    // Compute per-country counts via lightweight total queries
    (async()=>{
      try{
        const rows = {}
        await Promise.all(assignedList.map(async (ctry)=>{
          const qs = encodeURIComponent(ctry)
          const all = await apiGet(`/api/orders?country=${qs}&limit=1`)
          const del = await apiGet(`/api/orders?country=${qs}&ship=delivered&limit=1`)
          const can = await apiGet(`/api/orders?country=${qs}&ship=cancelled&limit=1`)
          rows[ctry] = {
            orders: Number(all?.total||0),
            delivered: Number(del?.total||0),
            cancelled: Number(can?.total||0),
          }
        }))
        setSummary(rows)
      }catch{ setSummary({}) }
    })()
  }, [assignedList.join('|')])

  return (
    <div className="section">
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Manager</div>
          <div className="page-subtitle">Quick actions and shortcuts based on your permissions</div>
        </div>

      {/* Orders Summary (Access Countries) */}
      <div className="card" style={{marginTop:12, marginBottom:12}}>
        {(function(){
          const totalOrdersCount = Number(metrics?.totalOrders||0)
          const deliveredCount = Number(metrics?.deliveredOrders||0)
          const pendingCount = Number(metrics?.pendingOrders||0)
          const sumAmount = (key)=> (COUNTRY_LIST||[]).reduce((s,c)=> s + Number(countryMetrics(c)[key]||0), 0)
          const amountTotalOrders = sumAmount('amountTotalOrders')
          const amountDelivered = sumAmount('amountDelivered')
          const amountPending = sumAmount('amountPending')
          function Chips({ keyName, isAmount }){
            return (
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {(COUNTRY_LIST||[]).map(c=>{
                  const m = countryMetrics(c)
                  const { flag='', cur='' } = COUNTRY_INFO[c]||{}
                  const val = isAmount ? Number(m[keyName]||0) : Number((keyName==='orders'?m.orders:m[keyName])||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{isAmount ? `${cur} ${fmtAmt(val)}` : fmtNum(val)}</strong>
                    </span>
                  )
                })}
              </div>
            )
          }
          function Tile({ icon, title, valueEl, chipsEl, gradient }){
            return (
              <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:12, padding:'12px', background:'var(--panel)'}}>
                <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
                  <div style={{width:32,height:32,borderRadius:8,background:gradient||'linear-gradient(135deg,#0ea5e9,#0369a1)',display:'grid',placeItems:'center',color:'#fff',fontSize:16}}>{icon}</div>
                  <div style={{fontWeight:800}}>{title}</div>
                </div>
                <div style={{fontSize:20, fontWeight:900, marginBottom:6}}>{valueEl}</div>
                {chipsEl}
              </div>
            )
          }
          return (
            <div className="section" style={{display:'grid', gap:12}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#0ea5e9,#0369a1)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🧮</div>
                <div>
                  <div style={{fontWeight:800,fontSize:16}}>Orders Summary (Access Countries)</div>
                  <div className="helper">Totals and per-country flags</div>
                </div>
              </div>
              <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
                <Tile icon="📦" title="Total Orders" valueEl={fmtNum(totalOrdersCount)} chipsEl={<Chips keyName="orders" />} gradient={'linear-gradient(135deg,#0ea5e9,#0369a1)'} />
                <Tile icon="💵" title="Amount of Total Orders" valueEl={fmtAmt(amountTotalOrders)} chipsEl={<Chips keyName="amountTotalOrders" isAmount />} gradient={'linear-gradient(135deg,#10b981,#059669)'} />
                <Tile icon="✅" title="Orders Delivered" valueEl={fmtNum(deliveredCount)} chipsEl={<Chips keyName="delivered" />} gradient={'linear-gradient(135deg,#16a34a,#15803d)'} />
                <Tile icon="🧾" title="Amount of Orders Delivered" valueEl={fmtAmt(amountDelivered)} chipsEl={<Chips keyName="amountDelivered" isAmount />} gradient={'linear-gradient(135deg,#22c55e,#16a34a)'} />
                <Tile icon="⏳" title="Pending Orders" valueEl={fmtNum(pendingCount)} chipsEl={<Chips keyName="pending" />} gradient={'linear-gradient(135deg,#f59e0b,#d97706)'} />
                <Tile icon="💰" title="Pending Amount" valueEl={fmtAmt(amountPending)} chipsEl={<Chips keyName="amountPending" isAmount />} gradient={'linear-gradient(135deg,#fb923c,#f97316)'} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* Driver Report by Country (Access Countries) */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#06b6d4,#0891b2)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🚚</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Driver Report by Country (Your Access)</div>
            <div className="helper">Counts from orders; amounts in local currency.</div>
          </div>
        </div>
        <div className="section" style={{display:'grid', gap:12}}>
          {(COUNTRY_LIST||[]).map(c=>{
            const m = countryMetrics(c)
            const d = driverAggByCountry[c] || { assignedAllTime:0, collected:0, deliveredToCompany:0, pendingToCompany:0 }
            const qs = encodeURIComponent(c)
            const name = (c==='KSA') ? 'Saudi Arabia (KSA)' : c
            const cur = (c==='KSA') ? 'SAR' : (c==='UAE' ? 'AED' : (c==='Oman' ? 'OMR' : (c==='Bahrain' ? 'BHD' : (c==='India' ? 'INR' : (c==='Kuwait' ? 'KWD' : 'QAR')))))
            return (
              <div key={c} className="panel" style={{border:'1px solid var(--border)', borderRadius:12, padding:12, background:'var(--panel)'}}>
                <div style={{fontWeight:900, marginBottom:8}}>{name}</div>
                <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10}}>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Total Orders Assigned (All Time)</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/manager/orders?country=${qs}&onlyAssigned=true`}>{fmtNum(d.assignedAllTime||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Currently Assigned</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/manager/orders?country=${qs}&ship=assigned`}>{fmtNum(m?.assigned||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Picked Up</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/manager/orders?country=${qs}&ship=picked_up`}>{fmtNum(m?.pickedUp||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">In Transit</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/manager/orders?country=${qs}&ship=in_transit`}>{fmtNum(m?.transit||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Out for Delivery</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/manager/orders?country=${qs}&ship=out_for_delivery`}>{fmtNum(m?.outForDelivery||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Delivered</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/manager/orders?country=${qs}&ship=delivered`}>{fmtNum(m?.delivered||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">No Response</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/manager/orders?country=${qs}&ship=no_response`}>{fmtNum(m?.noResponse||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Returned</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/manager/orders?country=${qs}&ship=returned`}>{fmtNum(m?.returned||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Cancelled</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/manager/orders?country=${qs}&ship=cancelled`}>{fmtNum(m?.cancelled||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Total Collected (Delivered)</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/manager/orders?country=${qs}&ship=delivered&collected=true`}>{cur} {fmtAmt(d.collected||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Delivered to Company</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/manager/finances?section=driver`}>{cur} {fmtAmt(d.deliveredToCompany||0)}</a></div>
                  </div>
                  <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                    <div className="helper">Pending Delivery to Company</div>
                    <div style={{fontWeight:900}}><a className="link" href={`/manager/finances?section=driver`}>{cur} {fmtAmt(d.pendingToCompany||0)}</a></div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Status Summary (Access Countries) */}
      <div className="card" style={{marginBottom:12}}>
        {(function(){
          const st = (metrics && metrics.statusTotals) ? metrics.statusTotals : (function(){
            // Fallback: aggregate from countries if backend older
            return (COUNTRY_LIST||[]).reduce((acc, c)=>{
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
          })()
          function Chips({ getter }){
            return (
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {(COUNTRY_LIST||[]).map(c=>{
                  const m = countryMetrics(c)
                  const { flag=''} = COUNTRY_INFO[c]||{}
                  const val = Number(getter(m)||0)
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <span aria-hidden>{flag}</span>
                      <strong style={{marginLeft:6}}>{fmtNum(val)}</strong>
                    </span>
                  )
                })}
              </div>
            )
          }
          function Tile({ icon, title, value, getter, gradient, to }){
            return (
              <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:12, padding:'12px', background:'var(--panel)'}}>
                <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
                  <div style={{width:32,height:32,borderRadius:8,background:gradient||'linear-gradient(135deg,#3b82f6,#1d4ed8)',display:'grid',placeItems:'center',color:'#fff',fontSize:16}}>{icon}</div>
                  <div style={{fontWeight:800}}>{title}</div>
                </div>
                <div style={{fontSize:20, fontWeight:900, marginBottom:6}}>{to ? (<a className="link" href={to}>{fmtNum(value||0)}</a>) : fmtNum(value||0)}</div>
                <Chips getter={getter} />
              </div>
            )
          }
          return (
            <div className="section" style={{display:'grid', gap:12}}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>📊</div>
                <div>
                  <div style={{fontWeight:800,fontSize:16}}>Status Summary (Access Countries)</div>
                  <div className="helper">Global totals and per-country flags</div>
                </div>
              </div>
              <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
                <Tile icon="📦" title="Total Orders" value={st.total} getter={(m)=> m.orders} gradient={'linear-gradient(135deg,#3b82f6,#1d4ed8)'} to={'/manager/orders'} />
                <Tile icon="⏳" title="Pending" value={st.pending} getter={(m)=> m.pending} gradient={'linear-gradient(135deg,#f59e0b,#d97706)'} to={'/manager/orders?ship=pending'} />
                <Tile icon="📌" title="Assigned" value={st.assigned} getter={(m)=> m.assigned} gradient={'linear-gradient(135deg,#94a3b8,#64748b)'} to={'/manager/orders?ship=assigned'} />
                <Tile icon="🚚" title="Picked Up" value={st.picked_up} getter={(m)=> m.pickedUp} gradient={'linear-gradient(135deg,#60a5fa,#3b82f6)'} to={'/manager/orders?ship=picked_up'} />
                <Tile icon="🚛" title="In Transit" value={st.in_transit} getter={(m)=> m.transit} gradient={'linear-gradient(135deg,#0ea5e9,#0369a1)'} to={'/manager/orders?ship=in_transit'} />
                <Tile icon="🛵" title="Out for Delivery" value={st.out_for_delivery} getter={(m)=> m.outForDelivery} gradient={'linear-gradient(135deg,#f97316,#ea580c)'} to={'/manager/orders?ship=out_for_delivery'} />
                <Tile icon="✅" title="Delivered" value={st.delivered} getter={(m)=> m.delivered} gradient={'linear-gradient(135deg,#22c55e,#16a34a)'} to={'/manager/orders?ship=delivered'} />
                <Tile icon="☎️🚫" title="No Response" value={st.no_response} getter={(m)=> m.noResponse} gradient={'linear-gradient(135deg,#ef4444,#b91c1c)'} to={'/manager/orders?ship=no_response'} />
                <Tile icon="🔁" title="Returned" value={st.returned} getter={(m)=> m.returned} gradient={'linear-gradient(135deg,#a3a3a3,#737373)'} to={'/manager/orders?ship=returned'} />
                <Tile icon="❌" title="Cancelled" value={st.cancelled} getter={(m)=> m.cancelled} gradient={'linear-gradient(135deg,#ef4444,#b91c1c)'} to={'/manager/orders?ship=cancelled'} />
              </div>
            </div>
          )
        })()}
      </div>
      {/* Professional dashboard: removed quick links and mobile quick actions for a cleaner view */}
      </div>

      {/* Quick actions moved to bottom on mobile */}

      {/* Country Summary (assigned only) */}
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#0ea5e9,#0369a1)',display:'grid',placeItems:'center',color:'#fff',fontSize:18}}>🌍</div>
          <div>
            <div style={{fontWeight:800,fontSize:16}}>Country Summary</div>
            <div className="helper">Orders, Delivered, Cancelled, and Collections for your assigned countries</div>
          </div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          <div style={{display:'flex', gap:12, minWidth:700}}>
            {assignedList.map(ctry=>{
              const label = ctry==='KSA' ? 'Saudi Arabia' : ctry
              const qs = encodeURIComponent(ctry)
              const sums = summary?.[ctry] || { orders:0, delivered:0, cancelled:0 }
              const m = moneyByCountry[ctry] || { collected:0, deliveredToCompany:0, pendingToCompany:0 }
              const cm = countryMetrics(ctry) || {}
              const currency = ctry==='KSA' ? 'SAR' : ctry==='UAE' ? 'AED' : ctry==='Oman' ? 'OMR' : ctry==='Bahrain' ? 'BHD' : ctry==='India' ? 'INR' : ctry==='Kuwait' ? 'KWD' : 'QAR'
              return (
                <div key={ctry} className="mini-card" style={{border:'1px solid var(--border)', borderRadius:12, padding:'10px 12px', background:'var(--panel)', minWidth:280}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
                    <div style={{fontWeight:800}}>{label}</div>
                    <a className="chip" style={{background:'transparent'}} href={`/manager/orders?country=${qs}`}>View</a>
                  </div>
                  <div style={{display:'grid', gap:6}}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Orders</div>
                      <a className="link" href={`/manager/orders?country=${qs}`}>{sums.orders.toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Pending</div>
                      <a className="link" href={`/manager/orders?country=${qs}&ship=pending`}>{fmtNum(cm.pending||0)}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Assigned</div>
                      <a className="link" href={`/manager/orders?country=${qs}&ship=assigned`}>{fmtNum(cm.assigned||0)}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Picked Up</div>
                      <a className="link" href={`/manager/orders?country=${qs}&ship=picked_up`}>{fmtNum(cm.pickedUp||0)}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">In Transit</div>
                      <a className="link" href={`/manager/orders?country=${qs}&ship=in_transit`}>{fmtNum(cm.transit||0)}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Out for Delivery</div>
                      <a className="link" href={`/manager/orders?country=${qs}&ship=out_for_delivery`}>{fmtNum(cm.outForDelivery||0)}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Delivered</div>
                      <a className="link" href={`/manager/orders?country=${qs}&ship=delivered`}>{sums.delivered.toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">No Response</div>
                      <a className="link" href={`/manager/orders?country=${qs}&ship=no_response`}>{fmtNum(cm.noResponse||0)}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Returned</div>
                      <a className="link" href={`/manager/orders?country=${qs}&ship=returned`}>{fmtNum(cm.returned||0)}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Cancelled</div>
                      <a className="link" href={`/manager/orders?country=${qs}&ship=cancelled`}>{sums.cancelled.toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Collected</div>
                      <a className="link" href={`/manager/orders?country=${qs}&ship=delivered&collected=true`}>{currency} {Math.round(m.collected||0).toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Delivered to Company</div>
                      <a className="link" href={`/manager/finances`}>{currency} {Math.round(m.deliveredToCompany||0).toLocaleString()}</a>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Pending to Company</div>
                      <a className="link" href={`/manager/finances`}>{currency} {Math.round(m.pendingToCompany||0).toLocaleString()}</a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
