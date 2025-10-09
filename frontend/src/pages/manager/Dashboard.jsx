import React, { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { apiGet } from '../../api'
import { getCurrencyConfig, toAEDByCode, fromAED } from '../../util/currency'
import DateRangeChips from '../../ui/DateRangeChips.jsx'

export default function ManagerDashboard(){
  const [isMobile, setIsMobile] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  const [me, setMe] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem('me')||'null') }catch{ return null }
  })
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState([])
  const [summary, setSummary] = useState({}) // { KSA:{orders,delivered,cancelled}, ... }
  const [metrics, setMetrics] = useState(null) // manager-scoped metrics from backend
  const [currencyCfg, setCurrencyCfg] = useState(null)
  const [amountFallback, setAmountFallback] = useState({ totalAED:0, deliveredAED:0, pendingAED:0 })
  const [statusExact, setStatusExact] = useState({ total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0, byCountry:{} })
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
      } else { // last7 (including today)
        const s = new Date(now); s.setDate(now.getDate()-6); s.setHours(0,0,0,0); from = s
      }
      return { from: from.toISOString(), to: end.toISOString() }
    }catch{ return null }
  }, [range])
  // Open statuses used across local filtering
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
  const qsRangeBare = useMemo(()=>{
    try{ return (rangeDates && rangeDates.from && rangeDates.to) ? `fromDate=${encodeURIComponent(rangeDates.from)}&toDate=${encodeURIComponent(rangeDates.to)}` : '' }catch{ return '' }
  }, [rangeDates])
  const appendRange = (url)=> url

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

  // Responsive sizing and shared colors (match Agent/Driver)
  const minTile = isMobile ? 200 : 240
  const tileGap = isMobile ? 8 : 12
  const valueFontSize = isMobile ? 24 : 28
  const COLORS = {
    primary: '#3b82f6', // blue
    primaryLight: '#0ea5e9',
    success: '#10b981',
    successDeep: '#16a34a',
    warning: '#f59e0b',
    secondary: '#64748b',
    transit: '#0284c7',
    ofd: '#f97316',
    danger: '#ef4444',
    dangerDeep: '#b91c1c',
    neutral: '#737373',
  }
  const STATUS_COLORS = {
    assigned_all: COLORS.primaryLight,
    assigned: COLORS.primary,
    picked: COLORS.warning,
    transit: COLORS.transit,
    ofd: COLORS.ofd,
    delivered: COLORS.success,
    no_resp: COLORS.danger,
    returned: COLORS.neutral,
    cancelled: COLORS.dangerDeep,
    collected: COLORS.success,
    deliv_co: COLORS.successDeep,
    pending_co: COLORS.warning,
  }

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
      try{ const ds = await apiGet(appendRange('/api/finance/drivers/summary?page=1&limit=200')); setDrivers(Array.isArray(ds?.drivers)? ds.drivers: []) }catch{ setDrivers([]) }
    })()
  },[qsRangeBare])

  // Load manager metrics (assigned-country scoped by backend)
  useEffect(()=>{
    (async()=>{
      try{ setMetrics(await apiGet(appendRange('/api/reports/manager-metrics'))) }catch{ setMetrics(null) }
    })()
  },[qsRangeBare])

  // Load currency config for AED conversion
  useEffect(()=>{
    (async()=>{
      try{ setCurrencyCfg(await getCurrencyConfig()) }catch{ setCurrencyCfg(null) }
    })()
  },[])

  // Fallback: if backend amounts are zero but counts exist (from summary), compute AED amounts from orders
  useEffect(()=>{
    (async()=>{
      try{
        const sumAmount = (key)=> (COUNTRY_LIST||[]).reduce((s,c)=> s + Number(countryMetrics(c)[key]||0), 0)
        const backendTotalAmt = sumAmount('amountTotalOrders')
        const totalFromSummary = Object.values(summary||{}).reduce((s,r)=> s + Number(r?.orders||0), 0)
        if (backendTotalAmt > 0 || !Array.isArray(COUNTRY_LIST) || COUNTRY_LIST.length===0 || totalFromSummary===0){
          setAmountFallback({ totalAED:0, deliveredAED:0, pendingAED:0 })
          // Also reset exact when not needed
          setStatusExact(se=>({ ...se, total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0, byCountry:{} }))
          return
        }
        let totalAED=0, deliveredAED=0, pendingAED=0
        const counts = { total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0, byCountry:{} }
        const cfg = currencyCfg || (await getCurrencyConfig().catch(()=>null))
        for (const c of COUNTRY_LIST){
          const qs = encodeURIComponent(toParam(c))
          counts.byCountry[c] = { total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0 }
          let page=1, limit=200
          for(;;){
            const r = await apiGet(appendRange(`/api/orders?country=${qs}&page=${page}&limit=${limit}`)).catch(()=>({orders:[], hasMore:false}))
            const list = Array.isArray(r?.orders) ? r.orders : []
            for (const o of list){
              // Union: open OR created in range OR delivered in range
              if (qsRangeBare && !includeByRangeOrOpen(o)) continue
              const amt = (()=>{
                try{
                  if (o && o.total != null) return Number(o.total||0)
                  if (Array.isArray(o?.items) && o.items.length){
                    return o.items.reduce((s,it)=> s + (Number(it?.productId?.price||0) * Math.max(1, Number(it?.quantity||1))), 0)
                  }
                  const unit = Number(o?.productId?.price||0)
                  return unit * Math.max(1, Number(o?.quantity||1))
                }catch{ return 0 }
              })()
              const curCode = (()=>{
                try{
                  if (Array.isArray(o?.items) && o.items.length){ return o.items[0]?.productId?.baseCurrency || currencyOf(c) }
                  return (o?.productId?.baseCurrency) || currencyOf(c)
                }catch{ return currencyOf(c) }
              })()
              const aed = toAEDByCode(amt, String(curCode||'AED').toUpperCase(), cfg)
              totalAED += aed
              const s = String(o?.shipmentStatus||'').toLowerCase()
              const key = (s==='shipped' ? 'in_transit' : s)
              // amounts
              if (key==='delivered') deliveredAED += aed
              if (['pending','assigned','picked_up','in_transit','out_for_delivery','no_response'].includes(key)) pendingAED += aed
              // counts
              counts.total += 1; counts.byCountry[c].total += 1
              if (counts[key] != null){ counts[key] += 1; counts.byCountry[c][key] += 1 }
            }
            if (!r?.hasMore) break
            page += 1
            if (page > 100) break
          }
        }
        setAmountFallback({ totalAED, deliveredAED, pendingAED })
        setStatusExact(counts)
      }catch{
        setAmountFallback({ totalAED:0, deliveredAED:0, pendingAED:0 })
        setStatusExact({ total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0, byCountry:{} })
      }
    })()
  }, [summary, COUNTRY_LIST.join('|'), currencyCfg, qsRangeBare])

  useEffect(()=>{
    // Compute per-country counts via lightweight total queries
    (async()=>{
      try{
        const rows = {}
        await Promise.all(assignedList.map(async (ctry)=>{
          const qs = encodeURIComponent(toParam(ctry))
          if (qsRangeBare){
            // Page through orders and count locally for date-range accuracy
            let page=1, limit=200
            let orders=0, delivered=0, cancelled=0, pending=0
            for(;;){
              const r = await apiGet(appendRange(`/api/orders?country=${qs}&page=${page}&limit=${limit}`)).catch(()=>({orders:[], hasMore:false}))
              const list = Array.isArray(r?.orders) ? r.orders : []
              for (const o of list){
                if (qsRangeBare && !includeByRangeOrOpen(o)) continue
                orders += 1
                const s = String(o?.shipmentStatus||'').toLowerCase()
                if (s==='delivered') delivered += 1
                else if (s==='cancelled') cancelled += 1
                else if ([...OPEN_STATUSES,'returned'].includes(s)) pending += 1
              }
              if (!r?.hasMore) break
              page += 1
              if (page > 100) break
            }
            rows[ctry] = { orders, delivered, cancelled, pending }
          } else {
            const all = await apiGet(`/api/orders?country=${qs}&limit=1`)
            const del = await apiGet(`/api/orders?country=${qs}&ship=delivered&limit=1`)
            const can = await apiGet(`/api/orders?country=${qs}&ship=cancelled&limit=1`)
            const pen = await apiGet(`/api/orders?country=${qs}&ship=pending&limit=1`)
            rows[ctry] = {
              orders: Number(all?.total||0),
              delivered: Number(del?.total||0),
              cancelled: Number(can?.total||0),
              pending: Number(pen?.total||0),
            }
          }
        }))
        setSummary(rows)
      }catch{ setSummary({}) }
    })()
  }, [assignedList.join('|'), qsRangeBare])

  // Exact status totals (per-country and overall) via orders API totals
  useEffect(()=>{
    (async()=>{
      try{
        const acc = { total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0, byCountry:{} }
        await Promise.all((assignedList||[]).map(async (ctry)=>{
          const qs = encodeURIComponent(toParam(ctry))
          const by = { total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0 }
          if (qsRangeBare){
            let page=1, limit=200
            for(;;){
              const r = await apiGet(appendRange(`/api/orders?country=${qs}&page=${page}&limit=${limit}`)).catch(()=>({orders:[], hasMore:false}))
              const list = Array.isArray(r?.orders) ? r.orders : []
              for (const o of list){
                if (qsRangeBare && !includeByRangeOrOpen(o)) continue
                by.total += 1
                const s = String(o?.shipmentStatus||'').toLowerCase()
                const key = (s==='shipped' ? 'in_transit' : s)
                if (by[key] != null) by[key] += 1; else by.pending += 1
              }
              if (!r?.hasMore) break
              page += 1
              if (page > 100) break
            }
          } else {
            const STATUS = [
              { key:'pending', ship:'pending' },
              { key:'assigned', ship:'assigned' },
              { key:'picked_up', ship:'picked_up' },
              { key:'in_transit', ship:'in_transit' },
              { key:'out_for_delivery', ship:'out_for_delivery' },
              { key:'delivered', ship:'delivered' },
              { key:'no_response', ship:'no_response' },
              { key:'returned', ship:'returned' },
              { key:'cancelled', ship:'cancelled' },
            ]
            const all = await apiGet(`/api/orders?country=${qs}&limit=1`).catch(()=>({ total:0 }))
            by.total = Number(all?.total||0)
            await Promise.all(STATUS.map(async s=>{
              const r = await apiGet(`/api/orders?country=${qs}&ship=${encodeURIComponent(s.ship)}&limit=1`).catch(()=>({ total:0 }))
              const v = Number(r?.total||0)
              by[s.key] = v
            }))
          }
          Object.keys(by).forEach(k=>{ if (k!=='byCountry') acc[k] += Number(by[k]||0) })
          acc.byCountry[ctry] = by
        }))
        setStatusExact(acc)
      }catch{
        setStatusExact({ total:0, pending:0, assigned:0, picked_up:0, in_transit:0, out_for_delivery:0, delivered:0, no_response:0, returned:0, cancelled:0, byCountry:{} })
      }
    })()
  }, [assignedList.join('|'), qsRangeBare])

  return (
    <div className="section">
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Manager</div>
          <div className="page-subtitle">Dashboard overview for your assigned countries</div>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="section" style={{marginBottom:8}}>
        <DateRangeChips value={range} onChange={setRange} />
      </div>

      <div className="grid" style={{gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap:tileGap, alignItems:'start'}}>

      {/* Orders Summary (Access Countries) */}
      <div className="card" style={{padding:16, marginBottom:12}}>
        {(function(){
          // Counts from API totals (summary/state)
          const totalOrdersCount = Object.values(summary||{}).reduce((s,r)=> s + Number(r?.orders||0), 0)
          const deliveredCount = Object.values(summary||{}).reduce((s,r)=> s + Number(r?.delivered||0), 0)
          const pendingCount = Object.values(summary||{}).reduce((s,r)=> s + Number(r?.pending||0), 0)
          // Amounts from backend metrics, with local-currency fallback if single currency
          const sumAmount = (key)=> (COUNTRY_LIST||[]).reduce((s,c)=> s + Number(countryMetrics(c)[key]||0), 0)
          const amountTotalOrdersRaw = sumAmount('amountTotalOrders')
          const amountDeliveredRaw = sumAmount('amountDelivered')
          const amountPendingRaw = sumAmount('amountPending')
          const distinctCur = Array.from(new Set((COUNTRY_LIST||[]).map(currencyOf).filter(Boolean)))
          const curLabel = distinctCur.length === 1 ? distinctCur[0] : ''
          const amountTotalOrders = amountTotalOrdersRaw>0 ? amountTotalOrdersRaw : (curLabel ? Math.round(fromAED(Number(amountFallback?.totalAED||0), curLabel, currencyCfg)) : 0)
          const amountDelivered = amountDeliveredRaw>0 ? amountDeliveredRaw : (curLabel ? Math.round(fromAED(Number(amountFallback?.deliveredAED||0), curLabel, currencyCfg)) : 0)
          const amountPending = amountPendingRaw>0 ? amountPendingRaw : (curLabel ? Math.round(fromAED(Number(amountFallback?.pendingAED||0), curLabel, currencyCfg)) : 0)
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
          function Tile({ title, valueEl, chipsEl, color }){
            return (
              <div className="tile" style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12, minHeight:100}}>
                <div className="helper">{title}</div>
                <div style={{fontSize:valueFontSize, fontWeight:800, color: color || 'inherit'}}>{valueEl}</div>
                <div>{chipsEl}</div>
              </div>
            )
          }
          return (
            <div className="section" style={{display:'grid', gap:12}}>
              <div style={{fontWeight:800,fontSize:16}}>Orders Summary (Access Countries)</div>
              <div className="grid" style={{gridTemplateColumns:`repeat(auto-fit, minmax(${minTile}px, 1fr))`, gap: tileGap}}>
                <Tile title="Total Orders" valueEl={fmtNum(totalOrdersCount)} color={COLORS.primaryLight} chipsEl={<Chips keyName="orders" />} />
                <Tile title="Amount of Total Orders" valueEl={curLabel ? `${curLabel} ${fmtAmt(amountTotalOrders)}` : '—'} color={COLORS.success} chipsEl={<Chips keyName="amountTotalOrders" isAmount />} />
                <Tile title="Orders Delivered" valueEl={fmtNum(deliveredCount)} color={COLORS.successDeep} chipsEl={<Chips keyName="delivered" />} />
                <Tile title="Amount of Orders Delivered" valueEl={curLabel ? `${curLabel} ${fmtAmt(amountDelivered)}` : '—'} color={COLORS.success} chipsEl={<Chips keyName="amountDelivered" isAmount />} />
                <Tile title="Open Orders" valueEl={fmtNum(pendingCount)} color={COLORS.warning} chipsEl={<Chips keyName="pending" />} />
                <Tile title="Pending Amount" valueEl={curLabel ? `${curLabel} ${fmtAmt(amountPending)}` : '—'} color={COLORS.warning} chipsEl={<Chips keyName="amountPending" isAmount />} />
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
                <div style={{fontWeight:900, marginBottom:8}}>{name}</div>
                {visibleTiles.length === 0 ? (
                  <div className="helper">No activity yet</div>
                ) : (
                  <div className="grid" style={{gridTemplateColumns:`repeat(auto-fit, minmax(${minTile}px, 1fr))`, gap: tileGap}}>
                    {visibleTiles.map(t => {
                      const valNum = Number(t.val||0)
                      const displayVal = t.isAmount ? `${cur} ${fmtAmt(valNum)}` : fmtNum(valNum)
                      return (
                        <NavLink key={t.key} className="tile" to={appendRange(t.to)} style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12, minHeight:100, textDecoration:'none', color:'inherit', cursor:'pointer'}}>
                          <div className="helper">{t.title}</div>
                          <div style={{fontSize:valueFontSize, fontWeight:800, color: STATUS_COLORS[t.key] || 'inherit'}}>{displayVal}</div>
                        </NavLink>
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
          const st = statusExact
          function Chips({ keyName }){
            return (
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {(COUNTRY_LIST||[]).map(c=>{
                  const m = statusExact?.byCountry?.[c] || {}
                  const val = Number(m?.[keyName]||0)
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
          function Tile({ title, value, keyName, to, color }){
            return (
              <div className="tile" style={{display:'grid', gap:6, padding:16, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12, minHeight:100}}>
                <div className="helper">{title}</div>
                <div style={{fontSize:valueFontSize, fontWeight:800, color: color || 'inherit'}}>{to ? (<NavLink className="link" to={appendRange(to)}>{fmtNum(value||0)}</NavLink>) : fmtNum(value||0)}</div>
                <Chips keyName={keyName} />
              </div>
            )
          }
          return (
            <div className="section" style={{display:'grid', gap:12}}>
              <div style={{fontWeight:800,fontSize:16}}>Status Summary (Access Countries)</div>
              <div className="grid" style={{gridTemplateColumns:`repeat(auto-fit, minmax(${minTile}px, 1fr))`, gap: tileGap}}>
                <Tile title="Total Orders" value={st.total} keyName={'total'} to={'/manager/orders'} color={COLORS.primaryLight} />
                <Tile title="Pending" value={st.pending} keyName={'pending'} to={'/manager/orders?ship=pending'} color={COLORS.warning} />
                <Tile title="Assigned" value={st.assigned} keyName={'assigned'} to={'/manager/orders?ship=assigned'} color={COLORS.primary} />
                <Tile title="Picked Up" value={st.picked_up} keyName={'picked_up'} to={'/manager/orders?ship=picked_up'} color={COLORS.warning} />
                <Tile title="In Transit" value={st.in_transit} keyName={'in_transit'} to={'/manager/orders?ship=in_transit'} color={COLORS.transit} />
                <Tile title="Out for Delivery" value={st.out_for_delivery} keyName={'out_for_delivery'} to={'/manager/orders?ship=out_for_delivery'} color={COLORS.ofd} />
                <Tile title="Delivered" value={st.delivered} keyName={'delivered'} to={'/manager/orders?ship=delivered'} color={COLORS.success} />
                <Tile title="No Response" value={st.no_response} keyName={'no_response'} to={'/manager/orders?ship=no_response'} color={COLORS.danger} />
                <Tile title="Returned" value={st.returned} keyName={'returned'} to={'/manager/orders?ship=returned'} color={COLORS.neutral} />
                <Tile title="Cancelled" value={st.cancelled} keyName={'cancelled'} to={'/manager/orders?ship=cancelled'} color={COLORS.dangerDeep} />
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
                <td style={{fontWeight:800, color: COLORS.primary}}>{fmtNum(d.assigned||0)}</td>
                <td style={{fontWeight:800, color: COLORS.success}}>{fmtNum(d.deliveredCount||0)}</td>
                <td style={{fontWeight:800, color: COLORS.danger}}>{fmtNum(d.canceled||0)}</td>
                <td style={{fontWeight:800, color: COLORS.success}}>{cur} {fmtAmt(d.collected||0)}</td>
                <td style={{fontWeight:800, color: COLORS.successDeep}}>{cur} {fmtAmt(d.deliveredToCompany||0)}</td>
                <td style={{fontWeight:800, color: COLORS.warning}}>{cur} {fmtAmt(d.pendingToCompany||0)}</td>
                <td>
                  <NavLink className="link" to={appendRange(`/manager/orders?country=${qsC}&driver=${encodeURIComponent(id)}&ship=pending`)}>Open</NavLink>
                  <span className="helper"> | </span>
                  <NavLink className="link" to={appendRange(`/manager/orders?country=${qsC}&driver=${encodeURIComponent(id)}`)}>All</NavLink>
                  <span className="helper"> | </span>
                  <NavLink className="link" to={appendRange(`/manager/orders?country=${qsC}&driver=${encodeURIComponent(id)}&ship=assigned`)}>Assigned</NavLink>
                  <span className="helper"> | </span>
                  <NavLink className="link" to={appendRange(`/manager/orders?country=${qsC}&driver=${encodeURIComponent(id)}&ship=delivered`)}>Delivered</NavLink>
                </td>
              </tr>
            )
          }
          function RowCard({ c, d }){
            const qsC = encodeURIComponent(toParam(c))
            const id = String(d.id)
            const cur = d.currency || currencyOf(c)
            return (
              <div className="tile" style={{display:'grid', gap:8, padding:12, textAlign:'left', border:'1px solid var(--border)', background:'var(--panel)', borderRadius:12}}>
                <div style={{fontWeight:800}}>{d.name||'-'}</div>
                <div className="helper">{d.phone||'-'}</div>
                <div className="grid" style={{gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:8}}>
                  <div>
                    <div className="helper">Assigned</div>
                    <div style={{fontWeight:800, color: COLORS.primary}}>{fmtNum(d.assigned||0)}</div>
                  </div>
                  <div>
                    <div className="helper">Delivered</div>
                    <div style={{fontWeight:800, color: COLORS.success}}>{fmtNum(d.deliveredCount||0)}</div>
                  </div>
                  <div>
                    <div className="helper">Cancelled</div>
                    <div style={{fontWeight:800, color: COLORS.danger}}>{fmtNum(d.canceled||0)}</div>
                  </div>
                  <div>
                    <div className="helper">Collected</div>
                    <div style={{fontWeight:800, color: COLORS.success}}>{cur} {fmtAmt(d.collected||0)}</div>
                  </div>
                  <div>
                    <div className="helper">Delivered to Company</div>
                    <div style={{fontWeight:800, color: COLORS.successDeep}}>{cur} {fmtAmt(d.deliveredToCompany||0)}</div>
                  </div>
                  <div>
                    <div className="helper">Pending to Company</div>
                    <div style={{fontWeight:800, color: COLORS.warning}}>{cur} {fmtAmt(d.pendingToCompany||0)}</div>
                  </div>
                </div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                  <NavLink className="chip" to={appendRange(`/manager/orders?country=${qsC}&driver=${encodeURIComponent(id)}&ship=pending`)}>Open</NavLink>
                  <NavLink className="chip" to={appendRange(`/manager/orders?country=${qsC}&driver=${encodeURIComponent(id)}`)}>All</NavLink>
                  <NavLink className="chip" to={appendRange(`/manager/orders?country=${qsC}&driver=${encodeURIComponent(id)}&ship=assigned`)}>Assigned</NavLink>
                  <NavLink className="chip" to={appendRange(`/manager/orders?country=${qsC}&driver=${encodeURIComponent(id)}&ship=delivered`)}>Delivered</NavLink>
                </div>
              </div>
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
                      isMobile ? (
                        <div className="grid" style={{gridTemplateColumns:`repeat(auto-fit, minmax(${minTile}px, 1fr))`, gap: tileGap}}>
                          {arr.map(d=> <RowCard key={String(d.id)} c={c} d={d} />)}
                        </div>
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
                      )
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
                    <NavLink className="chip" style={{background:'transparent'}} to={appendRange(`/manager/orders?country=${qs}`)}>View</NavLink>
                  </div>
                  <div style={{display:'grid', gap:6}}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Orders</div>
                      <NavLink className="link" to={appendRange(`/manager/orders?country=${qs}`)}>{sums.orders.toLocaleString()}</NavLink>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Pending</div>
                      <NavLink className="link" to={appendRange(`/manager/orders?country=${qs}&ship=pending`)}>{fmtNum(cm.pending||0)}</NavLink>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Assigned</div>
                      <NavLink className="link" to={appendRange(`/manager/orders?country=${qs}&ship=assigned`)}>{fmtNum(cm.assigned||0)}</NavLink>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Picked Up</div>
                      <NavLink className="link" to={appendRange(`/manager/orders?country=${qs}&ship=picked_up`)}>{fmtNum(cm.pickedUp||0)}</NavLink>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">In Transit</div>
                      <NavLink className="link" to={appendRange(`/manager/orders?country=${qs}&ship=in_transit`)}>{fmtNum(cm.transit||0)}</NavLink>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Out for Delivery</div>
                      <NavLink className="link" to={appendRange(`/manager/orders?country=${qs}&ship=out_for_delivery`)}>{fmtNum(cm.outForDelivery||0)}</NavLink>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Delivered</div>
                      <NavLink className="link" to={appendRange(`/manager/orders?country=${qs}&ship=delivered`)}>{sums.delivered.toLocaleString()}</NavLink>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">No Response</div>
                      <NavLink className="link" to={appendRange(`/manager/orders?country=${qs}&ship=no_response`)}>{fmtNum(cm.noResponse||0)}</NavLink>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Returned</div>
                      <NavLink className="link" to={appendRange(`/manager/orders?country=${qs}&ship=returned`)}>{fmtNum(cm.returned||0)}</NavLink>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Cancelled</div>
                      <NavLink className="link" to={appendRange(`/manager/orders?country=${qs}&ship=cancelled`)}>{sums.cancelled.toLocaleString()}</NavLink>
                    </div>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                      <div className="helper">Collected</div>
                      <NavLink className="link" to={appendRange(`/manager/orders?country=${qs}&ship=delivered&collected=true`)}>{currency} {Math.round(m.collected||0).toLocaleString()}</NavLink>
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
