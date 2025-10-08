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
    // Handle common alias pairs explicitly
    if (c==='Saudi Arabia' && base['KSA']) return base['KSA']
    if (c==='KSA' && base['Saudi Arabia']) return base['Saudi Arabia']
    const alias = COUNTRY_INFO[c]?.alias || []
    for (const a of alias){ if (base[a]) return base[a] }
    return {}
  }
  function fmtNum(n){ try{ return Number(n||0).toLocaleString() }catch{ return String(n||0) } }
  function fmtAmt(n){ try{ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }catch{ return String(n||0) } }

  // Canonical helpers: unify keys and resolve currency for display
  const currencyOf = (c)=>{
    const k = String(c||'')
    if (k==='KSA' || k==='Saudi Arabia') return 'SAR'
    if (k==='UAE' || k==='United Arab Emirates') return 'AED'
    if (k==='Oman' || k==='OM') return 'OMR'
    if (k==='Bahrain' || k==='BH') return 'BHD'
    if (k==='India' || k==='IN') return 'INR'
    if (k==='Kuwait' || k==='KW') return 'KWD'
    if (k==='Qatar' || k==='QA') return 'QAR'
    return 'AED'
  }
  const keyOf = (name)=>{
    const canon = (name==='Saudi Arabia' ? 'KSA' : (name==='United Arab Emirates' ? 'UAE' : String(name||'')))
    if (canon==='KSA' && COUNTRY_LIST.includes('Saudi Arabia')) return 'Saudi Arabia'
    if (canon==='UAE' && COUNTRY_LIST.includes('United Arab Emirates')) return 'United Arab Emirates'
    return canon
  }
  // Canonicalize display country name to a URL param value expected by backend
  const toParam = (name)=>{
    return (name==='Saudi Arabia' ? 'KSA' : (name==='United Arab Emirates' ? 'UAE' : String(name||'')))
  }

  // Load drivers finance summary and compute amounts per country
  const moneyByCountry = useMemo(()=>{
    const map = {}
    const list = Array.isArray(COUNTRY_LIST) ? COUNTRY_LIST : []
    for (const d of (Array.isArray(drivers)? drivers: [])){
      const raw = String(d?.country||'')
      if (!raw) continue
      const k = keyOf(raw)
      if (!list.includes(k)) continue
      if (!map[k]) map[k] = { collected:0, deliveredToCompany:0, pendingToCompany:0 }
      map[k].collected += Number(d?.collected||0)
      map[k].deliveredToCompany += Number(d?.deliveredToCompany||0)
      map[k].pendingToCompany += Number(d?.pendingToCompany||0)
    }
    return map
  }, [drivers, COUNTRY_LIST])

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
          <div className="page-subtitle">Dashboard overview for your assigned countries</div>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap:12, alignItems:'start'}}>

      {/* Orders Summary (Access Countries) */}
      <div className="card" style={{padding:16, marginBottom:12}}>
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
                  if (!(val>0)) return null
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <strong>{c}</strong>
                      <span style={{marginLeft:6}}>{isAmount ? `${cur} ${fmtAmt(val)}` : fmtNum(val)}</span>
                    </span>
                  )
                })}
              </div>
            )
          }
          function Tile({ title, valueEl, chipsEl }){
            return (
              <div className="tile" style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12, minHeight:100}}>
                <div style={{fontSize:12, color:'var(--muted)'}}>{title}</div>
                <div style={{fontSize:28, fontWeight:800}}>{valueEl}</div>
                <div>{chipsEl}</div>
              </div>
            )
          }
          return (
            <div className="section" style={{display:'grid', gap:12}}>
              <div style={{fontWeight:800,fontSize:16}}>Orders Summary (Access Countries)</div>
              <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
                <Tile title="Total Orders" valueEl={fmtNum(totalOrdersCount)} chipsEl={<Chips keyName="orders" />} />
                <Tile title="Amount of Total Orders" valueEl={fmtAmt(amountTotalOrders)} chipsEl={<Chips keyName="amountTotalOrders" isAmount />} />
                <Tile title="Orders Delivered" valueEl={fmtNum(deliveredCount)} chipsEl={<Chips keyName="delivered" />} />
                <Tile title="Amount of Orders Delivered" valueEl={fmtAmt(amountDelivered)} chipsEl={<Chips keyName="amountDelivered" isAmount />} />
                <Tile title="Pending Orders" valueEl={fmtNum(pendingCount)} chipsEl={<Chips keyName="pending" />} />
                <Tile title="Pending Amount" valueEl={fmtAmt(amountPending)} chipsEl={<Chips keyName="amountPending" isAmount />} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* Driver Report by Country (Access Countries) */}
      <div className="card" style={{padding:16, marginBottom:12}}>
        <div style={{fontWeight:800,fontSize:16, marginBottom:6}}>Driver Report by Country (Your Access)</div>
        <div className="helper" style={{marginBottom:12}}>Counts from orders; amounts in local currency.</div>
        <div className="section" style={{display:'grid', gap:12}}>
          {(COUNTRY_LIST||[]).map(c=>{
            const m = countryMetrics(c)
            const d = driverAggByCountry[c] || { assignedAllTime:0, collected:0, deliveredToCompany:0, pendingToCompany:0 }
            const qs = encodeURIComponent(toParam(c))
            const name = (c==='KSA') ? 'Saudi Arabia' : c
            const cur = currencyOf(c)
            const infoKey = COUNTRY_INFO[c] ? c : toParam(c)
            const { flag='' } = COUNTRY_INFO[infoKey]||{}
            const tiles = [
              { key:'assigned_all', title:'Total Orders Assigned (All Time)', val: Number(d.assignedAllTime||0), to:`/manager/orders?country=${qs}&onlyAssigned=true` },
              { key:'assigned', title:'Currently Assigned', val: Number(m?.assigned||0), to:`/manager/orders?country=${qs}&ship=assigned` },
              { key:'picked', title:'Picked Up', val: Number(m?.pickedUp||0), to:`/manager/orders?country=${qs}&ship=picked_up` },
              { key:'transit', title:'In Transit', val: Number(m?.transit||0), to:`/manager/orders?country=${qs}&ship=in_transit` },
              { key:'ofd', title:'Out for Delivery', val: Number(m?.outForDelivery||0), to:`/manager/orders?country=${qs}&ship=out_for_delivery` },
              { key:'delivered', title:'Delivered', val: Number(m?.delivered||0), to:`/manager/orders?country=${qs}&ship=delivered` },
              { key:'no_resp', title:'No Response', val: Number(m?.noResponse||0), to:`/manager/orders?country=${qs}&ship=no_response` },
              { key:'returned', title:'Returned', val: Number(m?.returned||0), to:`/manager/orders?country=${qs}&ship=returned` },
              { key:'cancelled', title:'Cancelled', val: Number(m?.cancelled||0), to:`/manager/orders?country=${qs}&ship=cancelled` },
              { key:'collected', title:'Total Collected (Delivered)', val: Number(d.collected||0), isAmount: true, to:`/manager/orders?country=${qs}&ship=delivered&collected=true` },
              { key:'deliv_co', title:'Delivered to Company', val: Number(d.deliveredToCompany||0), isAmount: true, to:`/manager/finances?section=driver` },
              { key:'pending_co', title:'Pending Delivery to Company', val: Number(d.pendingToCompany||0), isAmount: true, to:`/manager/finances?section=driver` },
            ]
            const visibleTiles = tiles.filter(t=> Number(t.val||0) > 0)
            return (
              <div key={c} className="panel" style={{border:'1px solid var(--border)', borderRadius:12, padding:12, background:'var(--panel)'}}>
                <div style={{fontWeight:900, marginBottom:8, display:'flex', alignItems:'center', gap:8}}>
                  <span style={{fontSize:18}}>{flag}</span>
                  <span>{name}</span>
                </div>
                {visibleTiles.length === 0 ? (
                  <div className="helper">No activity yet</div>
                ) : (
                  <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10}}>
                    {visibleTiles.map(t => {
                      const valNum = Number(t.val||0)
                      const displayVal = t.isAmount ? `${cur} ${fmtAmt(valNum)}` : fmtNum(valNum)
                      return (
                        <a key={t.key} className="tile" href={t.to} style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12, minHeight:100, textDecoration:'none', color:'inherit', cursor:'pointer'}}>
                          <div className="helper">{t.title}</div>
                          <div style={{fontSize:28, fontWeight:800}}>{displayVal}</div>
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Status Summary (Access Countries) */}
      <div className="card" style={{padding:16, marginBottom:12}}>
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
                  const val = Number(getter(m)||0)
                  if (!(val>0)) return null
                  return (
                    <span key={c} className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}}>
                      <strong>{c}</strong>
                      <span style={{marginLeft:6}}>{fmtNum(val)}</span>
                    </span>
                  )
                })}
              </div>
            )
          }
          function Tile({ title, value, getter, to }){
            return (
              <div className="tile" style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12, minHeight:100}}>
                <div style={{fontSize:12, color:'var(--muted)'}}>{title}</div>
                <div style={{fontSize:28, fontWeight:800}}>{to ? (<a className="link" href={to}>{fmtNum(value||0)}</a>) : fmtNum(value||0)}</div>
                <Chips getter={getter} />
              </div>
            )
          }
          return (
            <div className="section" style={{display:'grid', gap:12}}>
              <div style={{fontWeight:800,fontSize:16}}>Status Summary (Access Countries)</div>
              <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12}}>
                <Tile title="Total Orders" value={st.total} getter={(m)=> m.orders} to={'/manager/orders'} />
                <Tile title="Pending" value={st.pending} getter={(m)=> m.pending} to={'/manager/orders?ship=open'} />
                <Tile title="Assigned" value={st.assigned} getter={(m)=> m.assigned} to={'/manager/orders?ship=assigned'} />
                <Tile title="Picked Up" value={st.picked_up} getter={(m)=> m.pickedUp} to={'/manager/orders?ship=picked_up'} />
                <Tile title="In Transit" value={st.in_transit} getter={(m)=> m.transit} to={'/manager/orders?ship=in_transit'} />
                <Tile title="Out for Delivery" value={st.out_for_delivery} getter={(m)=> m.outForDelivery} to={'/manager/orders?ship=out_for_delivery'} />
                <Tile title="Delivered" value={st.delivered} getter={(m)=> m.delivered} to={'/manager/orders?ship=delivered'} />
                <Tile title="No Response" value={st.no_response} getter={(m)=> m.noResponse} to={'/manager/orders?ship=no_response'} />
                <Tile title="Returned" value={st.returned} getter={(m)=> m.returned} to={'/manager/orders?ship=returned'} />
                <Tile title="Cancelled" value={st.cancelled} getter={(m)=> m.cancelled} to={'/manager/orders?ship=cancelled'} />
              </div>
            </div>
          )
        })()}
      </div>
    </div>

      {/* Quick actions moved to bottom on mobile */}

      {/* Drivers & Orders (Your Access) */}
      <div className="card" style={{padding:16, marginTop:12}}>
        {(function(){
          const byCountry = (COUNTRY_LIST||[]).reduce((acc,c)=>{ acc[c] = []; return acc }, {})
          const canon = (v)=>{
            const name = String(v||'')
            if (name === 'KSA') return COUNTRY_LIST.includes('Saudi Arabia') ? 'Saudi Arabia' : 'KSA'
            if (name === 'Saudi Arabia') return COUNTRY_LIST.includes('KSA') ? 'KSA' : 'Saudi Arabia'
            return name
          }
          for (const d of (Array.isArray(drivers)? drivers: [])){
            const k = canon(String(d?.country||''))
            if (byCountry[k]) byCountry[k].push(d)
          }
          Object.keys(byCountry).forEach(k=> byCountry[k].sort((a,b)=> (Number(b?.assigned||0) - Number(a?.assigned||0))))
          function Row({ c, d }){
            const qsC = encodeURIComponent(toParam(c))
            const id = String(d.id)
            const cur = d.currency || currencyOf(c)
            return (
              <tr>
                <td style={{fontWeight:700}}>{d.name||'-'}</td>
                <td className="helper">{d.phone||'-'}</td>
                <td>{fmtNum(d.assigned||0)}</td>
                <td>{fmtNum(d.deliveredCount||0)}</td>
                <td>{fmtNum(d.canceled||0)}</td>
                <td>{cur} {fmtAmt(d.collected||0)}</td>
                <td>{cur} {fmtAmt(d.deliveredToCompany||0)}</td>
                <td>{cur} {fmtAmt(d.pendingToCompany||0)}</td>
                <td>
                  <a className="link" href={`/manager/orders?country=${qsC}&driver=${encodeURIComponent(id)}&ship=open`}>Open</a>
                  <span className="helper"> | </span>
                  <a className="link" href={`/manager/orders?country=${qsC}&driver=${encodeURIComponent(id)}`}>All</a>
                  <span className="helper"> | </span>
                  <a className="link" href={`/manager/orders?country=${qsC}&driver=${encodeURIComponent(id)}&ship=assigned`}>Assigned</a>
                  <span className="helper"> | </span>
                  <a className="link" href={`/manager/orders?country=${qsC}&driver=${encodeURIComponent(id)}&ship=delivered`}>Delivered</a>
                </td>
              </tr>
            )
          }
          return (
            <div className="section" style={{display:'grid', gap:12}}>
              <div style={{fontWeight:800,fontSize:16}}>Drivers & Orders (Your Access)</div>
              {(COUNTRY_LIST||[]).map(c=>{
                const name = (c==='KSA') ? 'Saudi Arabia' : c
                const arr = byCountry[c] || []
                return (
                  <div key={c} className="panel" style={{border:'1px solid var(--border)', borderRadius:12, padding:12, background:'var(--panel)'}}>
                    <div style={{fontWeight:900, marginBottom:8}}>{name}</div>
                    {arr.length === 0 ? (
                      <div className="helper">No drivers</div>
                    ) : (
                      <div style={{overflowX:'auto'}}>
                        <table className="table" style={{width:'100%', borderCollapse:'collapse'}}>
                          <thead>
                            <tr>
                              <th align="left">Driver</th>
                              <th align="left">Phone</th>
                              <th align="right">Assigned</th>
                              <th align="right">Delivered</th>
                              <th align="right">Cancelled</th>
                              <th align="right">Collected</th>
                              <th align="right">Delivered to Company</th>
                              <th align="right">Pending to Company</th>
                              <th align="left">Orders</th>
                            </tr>
                          </thead>
                          <tbody>
                            {arr.map(d=> <Row key={String(d.id)} c={c} d={d} />)}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Country Summary (assigned only) */}
      <div className="card" style={{padding:16, marginTop:12}}>
        <div style={{fontWeight:800,fontSize:16, marginBottom:6}}>Country Summary</div>
        <div className="helper" style={{marginBottom:12}}>Orders, Delivered, Cancelled, and Collections for your assigned countries</div>
        <div className="section" style={{overflowX:'auto'}}>
          <div style={{display:'flex', gap:12, minWidth:700}}>
            {assignedList.map(ctry=>{
              const label = ctry==='KSA' ? 'Saudi Arabia' : ctry
              const qs = encodeURIComponent(toParam(ctry))
              const sums = summary?.[ctry] || { orders:0, delivered:0, cancelled:0 }
              const m = moneyByCountry[ctry] || { collected:0, deliveredToCompany:0, pendingToCompany:0 }
              const cm = countryMetrics(ctry) || {}
              const currency = currencyOf(ctry)
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
