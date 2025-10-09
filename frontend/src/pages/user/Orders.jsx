import React, { useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE, apiGet, apiPatch, apiGetBlob, apiPost } from '../../api.js'
import OrderStatusTrack from '../../ui/OrderStatusTrack.jsx'
import { useLocation, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'

function StatusBadge({ status, kind='status' }){
  const s = String(status||'').toLowerCase()
  let color = { borderColor:'#e5e7eb', color:'#374151' }
  if (kind==='shipment'){
    if (s==='delivered') color = { borderColor:'#10b981', color:'#065f46' }
    else if (['in_transit','assigned','shipped','picked_up','out_for_delivery'].includes(s)) color = { borderColor:'#3b82f6', color:'#1d4ed8' }
    else if (['returned','cancelled','no_response'].includes(s)) color = { borderColor:'#ef4444', color:'#991b1b' }
    else if (s==='pending') color = { borderColor:'#f59e0b', color:'#b45309' }
  } else {
    if (s==='shipped') color = { borderColor:'#3b82f6', color:'#1d4ed8' }
    else if (s==='pending') color = { borderColor:'#f59e0b', color:'#b45309' }
  }
  return <span className="chip" style={{ background:'transparent', ...color }}>{status||'-'}</span>
}

// Infinite scroll loader for orders

function DetailRow({ label, value }){
  return (
    <div style={{display:'grid', gridTemplateColumns:'160px 1fr', gap:8}}>
      <div className="label" style={{fontWeight:700}}>{label}</div>
      <div className="helper">{value ?? '-'}</div>
    </div>
  )
}

function OrderTimeline({ order }){
  const fmt = (d)=> d ? new Date(d).toLocaleString() : '-'
  const ship = String(order?.shipmentStatus||'').toLowerCase()
  const isReturned = ['returned','cancelled'].includes(ship)
  const isDelivered = ship==='delivered'
  const finalLabel = isReturned ? (ship.charAt(0).toUpperCase()+ship.slice(1)) : 'Delivered'
  const finalColor = isReturned ? '#ef4444' : (isDelivered ? '#10b981' : '#9ca3af')
  const finalAt = isDelivered ? order?.deliveredAt : (isReturned ? (order?.updatedAt || null) : null)

  const steps = [
    { label:'Created', at: order?.createdAt, color:'#9ca3af', done: true },
    { label:'Shipped', at: order?.shippedAt, color:'#3b82f6', done: !!order?.shippedAt },
    { label: finalLabel, at: finalAt, color: finalColor, done: isDelivered || isReturned },
  ]

  return (
    <div style={{display:'grid', gap:10}}>
      {steps.map((s, idx)=> (
        <div key={idx} style={{display:'grid', gridTemplateColumns:'18px 1fr', gap:10}}>
          <div style={{display:'grid', justifyItems:'center'}}>
            <div style={{width:12, height:12, borderRadius:999, background:s.color}} aria-hidden />
            {idx < steps.length-1 && (
              <div style={{width:2, height:28, background:'#e5e7eb', marginTop:4}} aria-hidden />
            )}
          </div>
          <div>
            <div style={{fontWeight:800, color: s.done ? 'var(--fg)' : 'var(--muted)'}}>{s.label}</div>
            <div className="helper">{fmt(s.at)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function UserOrders(){
  const location = useLocation()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
  const [onlyAssigned, setOnlyAssigned] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [shipFilter, setShipFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('') // COD | PREPAID | ''
  const [collectedOnly, setCollectedOnly] = useState(false)
  const [agentFilter, setAgentFilter] = useState('')
  const [driverFilter, setDriverFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [driversByCountry, setDriversByCountry] = useState({}) // Cache drivers by country
  const [updating, setUpdating] = useState({})
  const [editingDriver, setEditingDriver] = useState({}) // Track edited driver per order
  const [editingStatus, setEditingStatus] = useState({}) // Track edited status per order
  // Infinite scroll state
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadingMoreRef = useRef(false)
  const endRef = useRef(null)
  const exportingRef = useRef(false)
  const urlSyncRef = useRef({ raf: 0, last: '' })
  const toast = useToast()
  const fallbackTriedRef = useRef(false)
  // Preserve scroll helper to avoid jumping to top on state updates
  const preserveScroll = async (fn)=>{
    const y = window.scrollY
    try{ return await fn() } finally { try{ requestAnimationFrame(()=> window.scrollTo(0, y)) }catch{ window.scrollTo(0, y) } }
  }
  // Columns: Order | Customer | Product | Price | Country | Agent | Driver | Shipment | Actions
  // Made Driver column wider (from 1fr to 1.3fr)
  const colTemplate = '140px 1.2fr 1fr 110px 120px 1fr 1.3fr 140px 120px'

  // Available filters (from backend options)
  const [countryOptions, setCountryOptions] = useState([])
  const [cityOptions, setCityOptions] = useState([])
  const [agentOptions, setAgentOptions] = useState([])
  const [driverOptions, setDriverOptions] = useState([])
  const countryDriverOptions = useMemo(()=>{
    const c = String(country||'').trim()
    if (!c) return []
    return (driverOptions||[]).filter(d => String(d?.country||'') === c)
  }, [driverOptions, country])

  // Canonicalization + strict client-side filtering to ensure dashboard deep links (e.g., UAE + picked_up) match exactly
  const OPEN_STATUSES = useMemo(()=> ['pending','assigned','picked_up','in_transit','out_for_delivery','no_response'], [])
  function normCountryKey(s){
    const n = String(s||'').trim().toLowerCase().replace(/\(.*?\)/g,'').replace(/\./g,'').replace(/-/g,' ').replace(/\s+/g,' ')
    if (n==='ksa' || n==='saudi arabia' || n==='saudi') return 'ksa'
    if (n==='uae' || n==='united arab emirates' || n==='ae' || n==='u a e' || n.includes('united arab emirates')) return 'uae'
    if (n==='bahrain') return 'bahrain'
    if (n==='oman') return 'oman'
    if (n==='qatar') return 'qatar'
    if (n==='kuwait') return 'kuwait'
    if (n==='india') return 'india'
    return n
  }
  function normalizeShip(s){
    const n = String(s||'').toLowerCase().trim().replace(/\s+/g,'_').replace(/-/g,'_')
    if (n==='picked' || n==='pickedup' || n==='pick_up' || n==='pick-up' || n==='pickup') return 'picked_up'
    if (n==='shipped' || n==='contacted' || n==='attempted') return 'in_transit'
    if (n==='open') return 'open'
    return n
  }
  const renderedOrders = useMemo(()=>{
    try{
      let list = Array.isArray(orders)? orders: []
      const c = String(country||'').trim()
      const ship = normalizeShip(shipFilter)
      if (c){
        const key = normCountryKey(c)
        list = list.filter(o => normCountryKey(o?.orderCountry) === key)
      }
      if (ship){
        if (ship==='open'){
          list = list.filter(o => OPEN_STATUSES.includes(normalizeShip(o?.shipmentStatus ?? o?.status)))
        } else {
          list = list.filter(o => normalizeShip(o?.shipmentStatus ?? o?.status) === ship)
        }
      }
      // Apply date range from URL only for non-open filters
      if (rangeFromUrl && rangeFromUrl.from && rangeFromUrl.to){
        const fromTs = new Date(rangeFromUrl.from).getTime()
        const toTs = new Date(rangeFromUrl.to).getTime()
        if (ship && ship==='delivered'){
          list = list.filter(o=>{
            const dAt = o?.deliveredAt ? new Date(o.deliveredAt).getTime() : null
            return (dAt!=null && dAt>=fromTs && dAt<=toTs)
          })
        } else if (!ship || !OPEN_STATUSES.includes(ship)){
          list = list.filter(o=>{
            const dAt = o?.deliveredAt ? new Date(o.deliveredAt).getTime() : null
            const cAt = o?.createdAt ? new Date(o.createdAt).getTime() : null
            if (dAt!=null) return dAt>=fromTs && dAt<=toTs
            if (cAt!=null) return cAt>=fromTs && cAt<=toTs
            return false
          })
        }
      }
      return list
    }catch{ return Array.isArray(orders)? orders: [] }
  }, [orders, country, shipFilter, rangeFromUrl?.from, rangeFromUrl?.to])
  async function loadOptions(selectedCountry=''){
    try{
      const qs = selectedCountry ? `?country=${encodeURIComponent(selectedCountry)}` : ''
      const r = await apiGet(`/api/orders/options${qs}`)
      setCountryOptions(Array.isArray(r?.countries)? r.countries: [])
      setCityOptions(Array.isArray(r?.cities)? r.cities: [])
    }catch{
      setCountryOptions([]); setCityOptions([])
    }
  }
  useEffect(()=>{ loadOptions('') },[])
  useEffect(()=>{ loadOptions(country || '') }, [country])
  useEffect(()=>{ if (city && !cityOptions.includes(city)) setCity('') }, [cityOptions])

  // Load agent and driver options
  useEffect(()=>{
    (async()=>{
      try{ const a = await apiGet('/api/users/agents'); setAgentOptions(Array.isArray(a?.users)? a.users: []) }catch{ setAgentOptions([]) }
      try{ const d = await apiGet('/api/users/drivers'); setDriverOptions(Array.isArray(d?.users)? d.users: []) }catch{ setDriverOptions([]) }
    })()
  },[])

  // Single unified search via backend 'q' covers invoice (with or without '#'), product names, agent/driver names, city, phone, and details

  // Build query params for backend filters
  const buildQuery = useMemo(()=>{
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (country.trim()) params.set('country', country.trim())
    if (city.trim()) params.set('city', city.trim())
    if (onlyUnassigned) params.set('onlyUnassigned', 'true')
    if (onlyAssigned) params.set('onlyAssigned', 'true')
    if (statusFilter.trim()) params.set('status', statusFilter.trim())
    if (shipFilter.trim()) params.set('ship', shipFilter.trim())
    if (paymentFilter.trim()) params.set('payment', paymentFilter.trim())
    if (collectedOnly) params.set('collected', 'true')
    if (agentFilter.trim()) params.set('agent', agentFilter.trim())
    if (driverFilter.trim()) params.set('driver', driverFilter.trim())
    return params
  }, [query, country, city, onlyUnassigned, statusFilter, shipFilter, paymentFilter, collectedOnly, agentFilter, driverFilter])

  // Read range params from URL (from Dashboard deep links)
  const rangeFromUrl = useMemo(()=>{
    try{
      const sp = new URLSearchParams(location.search||'')
      const f = sp.get('fromDate')
      const t = sp.get('toDate')
      if (!f || !t) return null
      return { from: f, to: t }
    }catch{ return null }
  }, [location.search])

  async function loadOrders(reset=false){
    if (loadingMoreRef.current) return
    loadingMoreRef.current = true
    try{
      if (reset){ setLoading(true); setOrders([]); setPage(1); setHasMore(true) }
      const nextPage = reset ? 1 : (page + 1)
      const params = new URLSearchParams(buildQuery.toString())
      params.set('page', String(nextPage))
      params.set('limit', '20')
      const r = await apiGet(`/api/orders?${params.toString()}`)
      const list = Array.isArray(r?.orders) ? r.orders : []
      setOrders(prev => reset ? list : [...prev, ...list])
      setHasMore(!!r?.hasMore)
      setPage(nextPage)
      setError('')
      // Fallback: if user came from dashboard with specific country/ship filter but server returned none,
      // refetch without restrictive filters and rely on client-side strict filter
      if (reset && list.length === 0 && (String(country||'').trim() || String(shipFilter||'').trim())){
        try{
          const base = new URLSearchParams(buildQuery.toString())
          ;['country','ship','collected','onlyUnassigned','onlyAssigned','status','payment','agent','driver','city'].forEach(k=> base.delete(k))
          let acc = []
          let p = 1
          const lim = 200
          for(;;){
            const loop = new URLSearchParams(base.toString())
            loop.set('page', String(p))
            loop.set('limit', String(lim))
            const rr = await apiGet(`/api/orders?${loop.toString()}`)
            const arr = Array.isArray(rr?.orders) ? rr.orders : []
            acc = acc.concat(arr)
            if (!rr?.hasMore) break
            p += 1
            if (p > 10) break // safety
          }
          setOrders(acc)
          setHasMore(false)
        }catch{}
      }
    }catch(e){ setError(e?.message||'Failed to load orders'); setHasMore(false) }
    finally{ setLoading(false); loadingMoreRef.current = false }
  }

  // Initial load
  useEffect(()=>{ loadOrders(true) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])
  // Reload on filter changes (except productQuery which is client-side)
  useEffect(()=>{ loadOrders(true) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [buildQuery])

  // Reset fallback flag on filter changes
  useEffect(()=>{ fallbackTriedRef.current = false }, [buildQuery])

  // If server returns items but strict filter yields none, perform wide refetch once
  useEffect(()=>{
    if (loading) return
    const hasDashFilters = String(country||'').trim() || String(shipFilter||'').trim()
    if (!hasDashFilters) return
    if (!fallbackTriedRef.current && Array.isArray(orders) && orders.length>0 && renderedOrders.length===0){
      fallbackTriedRef.current = true
      ;(async ()=>{
        try{
          const base = new URLSearchParams(buildQuery.toString())
          ;['country','ship','collected','onlyUnassigned','onlyAssigned','status','payment','agent','driver','city'].forEach(k=> base.delete(k))
          let acc=[], p=1, lim=200
          for(;;){
            const loop = new URLSearchParams(base.toString())
            loop.set('page', String(p))
            loop.set('limit', String(lim))
            const rr = await apiGet(`/api/orders?${loop.toString()}`)
            const arr = Array.isArray(rr?.orders) ? rr.orders : []
            acc = acc.concat(arr)
            if (!rr?.hasMore) break
            p += 1
            if (p > 10) break
          }
          setOrders(acc)
          setHasMore(false)
        }catch{}
      })()
    }
  }, [loading, orders, renderedOrders.length, country, shipFilter, buildQuery])

  async function exportCsv(){
    if (exportingRef.current) return
    exportingRef.current = true
    try{
      const params = new URLSearchParams(buildQuery.toString())
      params.set('max','10000')
      const blob = await apiGetBlob(`/api/orders/export?${params.toString()}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().slice(0,10)
      a.href = url
      a.download = `orders-${ts}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Export started')
    }catch(e){ toast.error(e?.message || 'Failed to export') }
    finally{ exportingRef.current = false }
  }

  // Initialize filters from URL query params and keep in sync on navigation
  useEffect(()=>{
    try{
      const sp = new URLSearchParams(location.search||'')
      const q = sp.get('q') || ''
      const ctry = sp.get('country') || ''
      const cty = sp.get('city') || ''
      const un = (sp.get('onlyUnassigned')||'').toLowerCase() === 'true'
      const oa = (sp.get('onlyAssigned')||'').toLowerCase() === 'true'
      const st = sp.get('status') || ''
      const ship = sp.get('ship') || ''
      const pay = (sp.get('payment')||'').toUpperCase()
      const col = (sp.get('collected')||'').toLowerCase() === 'true'
      const ag = sp.get('agent') || ''
      const dr = sp.get('driver') || ''
      if (query !== q) setQuery(q)
      if (country !== ctry) setCountry(ctry)
      if (city !== cty) setCity(cty)
      if (onlyUnassigned !== un) setOnlyUnassigned(un)
      if (statusFilter !== st) setStatusFilter(st)
      if (shipFilter !== ship) setShipFilter(ship)
      const payVal = (pay === 'COD' || pay === 'PREPAID') ? pay : ''
      if (paymentFilter !== payVal) setPaymentFilter(payVal)
      if (collectedOnly !== col) setCollectedOnly(col)
      if (agentFilter !== ag) setAgentFilter(ag)
      if (driverFilter !== dr) setDriverFilter(dr)
      if (onlyAssigned !== oa) setOnlyAssigned(oa)
    }catch{}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  // Keep URL in sync with current filters for shareable deep links
  useEffect(()=>{
    try{
      const managed = ['q','country','city','onlyUnassigned','onlyAssigned','status','ship','payment','collected','agent','driver']
      const canonical = (init)=>{
        const s = new URLSearchParams(init)
        const entries = managed
          .map(k => [k, s.get(k)])
          .filter(([k,v]) => v != null && String(v).trim() !== '')
        entries.sort((a,b)=> a[0].localeCompare(b[0]))
        return entries.map(([k,v])=> `${k}=${encodeURIComponent(String(v).trim())}`).join('&')
      }
      const nextQS = canonical(buildQuery.toString())
      const currQS = canonical(location.search||'')
      if (nextQS === currQS || urlSyncRef.current.last === nextQS){
        return
      }
      if (urlSyncRef.current.raf){
        cancelAnimationFrame(urlSyncRef.current.raf)
        urlSyncRef.current.raf = 0
      }
      urlSyncRef.current.raf = requestAnimationFrame(()=>{
        const path = location.pathname || '/user/orders'
        navigate(`${path}${nextQS ? `?${nextQS}` : ''}`, { replace: true })
        urlSyncRef.current.last = nextQS
        urlSyncRef.current.raf = 0
      })
    }catch{}
    return ()=>{ if (urlSyncRef.current.raf){ cancelAnimationFrame(urlSyncRef.current.raf); urlSyncRef.current.raf = 0 } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildQuery, location.pathname, location.search])

  // Infinite scroll observer
  useEffect(()=>{
    const el = endRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries)=>{
      const [e] = entries
      if (e.isIntersecting && hasMore && !loadingMoreRef.current){ loadOrders(false) }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return ()=> { try{ obs.disconnect() }catch{} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endRef.current, hasMore, page, buildQuery])

  

  // No totals footer now; compute nothing

  function shortId(id){ return String(id||'').slice(-5).toUpperCase() }
  function userName(u){ if (!u) return '-'; return `${u.firstName||''} ${u.lastName||''}`.trim() || (u.email||'-') }

  // Drivers loaded on-demand by country

  // Fetch drivers by country (with caching)
  async function fetchDriversByCountry(country){
    if (!country) return []
    
    // Check cache first
    if (driversByCountry[country]) {
      return driversByCountry[country]
    }
    
    try{
      const r = await apiGet(`/api/users/drivers?country=${encodeURIComponent(country)}`)
      const drivers = Array.isArray(r?.users)? r.users : []
      setDriversByCountry(prev => ({ ...prev, [country]: drivers }))
      return drivers
    }catch{
      return []
    }
  }

  // Load drivers for visible orders when orders change
  useEffect(()=>{
    const countries = [...new Set(renderedOrders.map(o => o.orderCountry).filter(Boolean))]
    countries.forEach(country => fetchDriversByCountry(country))
  }, [renderedOrders])

  // Live updates: patch single order in-place and preserve scroll
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      socket.on('orders.changed', async (evt)=>{
        try{
          const id = evt?.orderId
          if (!id) return
          const r = await apiGet(`/api/orders/view/${id}`)
          const ord = r?.order
          if (ord){
            await preserveScroll(async ()=>{
              setOrders(prev => {
                const idx = prev.findIndex(o => String(o._id) === String(id))
                if (idx === -1) return prev
                const copy = [...prev]; copy[idx] = ord; return copy
              })
            })
          }
        }catch{}
      })
    }catch{}
    return ()=>{ try{ socket && socket.off('orders.changed') }catch{}; try{ socket && socket.disconnect() }catch{} }
  }, [API_BASE])

  async function saveOrder(orderId, driverId, status){
    const key = `save-${orderId}`
    setUpdating(prev => ({ ...prev, [key]: true }))
    try{
      await preserveScroll(async ()=>{
        // If only driver is provided and no explicit shipment status, use dedicated endpoint to preserve pending->assigned behavior
        if (driverId !== undefined && (status == null || String(status).trim() === '')){
          const r = await apiPost(`/api/orders/${orderId}/assign-driver`, { driverId })
          const updated = r?.order
          if (updated){
            setOrders(prev => prev.map(o => String(o._id) === String(orderId) ? updated : o))
          } else {
            await loadOrders(false)
          }
        } else {
          const payload = {}
          if (driverId !== undefined) payload.deliveryBoy = driverId || null
          if (status) payload.shipmentStatus = status
          const r = await apiPatch(`/api/orders/${orderId}`, payload)
          const updated = r?.order
          if (updated){
            setOrders(prev => prev.map(o => String(o._id) === String(orderId) ? updated : o))
          } else {
            await loadOrders(false)
          }
        }
      })
      toast.success('Order updated')
    }catch(e){
      toast.error(e?.message || 'Failed to update order')
    }finally{
      setUpdating(prev => ({ ...prev, [key]: false }))
    }
  }

  function openEditPopout(order){
    // Open edit page in new window
    const orderId = order._id || order.id
    const width = 1000
    const height = 800
    const left = (window.screen.width - width) / 2
    const top = (window.screen.height - height) / 2
    window.open(
      `/orders/edit/${orderId}`,
      '_blank',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    )
  }


  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-purple">Orders</div>
          <div className="page-subtitle">Manage drivers and track shipments</div>
        </div>
      </div>

      {/* Filters (manager-like) */}
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header"><div className="card-title">Filters</div></div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8}}>
          <input className="input" placeholder="Search invoice, product, driver, agent, city, phone, details" value={query} onChange={e=> setQuery(e.target.value)} />
          <select className="input" value={country} onChange={e=> setCountry(e.target.value)}>
            <option value=''>All Countries</option>
            {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" value={city} onChange={e=> setCity(e.target.value)}>
            <option value=''>All Cities</option>
            {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" value={shipFilter} onChange={e=> setShipFilter(e.target.value)}>
            <option value="">Total Orders</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="picked_up">Picked Up</option>
            <option value="in_transit">In Transit</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="no_response">No Response</option>
            <option value="returned">Returned</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className="input" value={agentFilter} onChange={e=> setAgentFilter(e.target.value)}>
            <option value=''>All Agents</option>
            {agentOptions.map(a => (
              <option key={String(a._id)} value={String(a._id)}>{`${a.firstName||''} ${a.lastName||''} (${a.email||''})`}</option>
            ))}
          </select>
          <select className="input" value={driverFilter} onChange={e=> setDriverFilter(e.target.value)} disabled={!country}>
            <option value=''>{country? `All Drivers in ${country}` : 'Select Country to filter Drivers'}</option>
            {countryDriverOptions.map(d => (
              <option key={String(d._id)} value={String(d._id)}>{`${d.firstName||''} ${d.lastName||''}${d.city? ' • '+d.city:''}`}</option>
            ))}
          </select>
          <label className="input" style={{display:'flex', alignItems:'center', gap:8}}>
            <input type="checkbox" checked={onlyUnassigned} onChange={e=> setOnlyUnassigned(e.target.checked)} /> Unassigned only
          </label>
          <select className="input" value={paymentFilter} onChange={e=> setPaymentFilter(e.target.value)}>
            <option value="">All Payments</option>
            <option value="COD">COD</option>
            <option value="PREPAID">Prepaid</option>
          </select>
          <label className="input" style={{display:'flex', alignItems:'center', gap:8}}>
            <input type="checkbox" checked={collectedOnly} onChange={e=> setCollectedOnly(e.target.checked)} /> Collected only
          </label>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      {/* Cards list */}
      <div style={{display:'grid', gap:12}}>
        {loading ? (
          <div className="card"><div className="section">Loading…</div></div>
        ) : error ? (
          <div className="card"><div className="section error">{error}</div></div>
        ) : renderedOrders.length === 0 ? (
          <div className="card"><div className="section">No orders found</div></div>
        ) : (
          renderedOrders.map((o) => {
                  const id = String(o._id||o.id)
                  const ordNo = o.invoiceNumber ? `#${o.invoiceNumber}` : shortId(id)
                  const fromWebsite = (o.websiteOrder === true) || (String(o.source||'').toLowerCase() === 'website')
                  const agentName = fromWebsite ? 'Website' : ((o.createdBy && o.createdBy.role !== 'user') ? userName(o.createdBy) : (o.createdBy?.role==='user' ? 'Owner' : '-'))
                  
                  // Product summary (supports multi-items)
                  let productName = '-'
                  let qty = 1
                  if (o.items && Array.isArray(o.items) && o.items.length > 0) {
                    const productNames = o.items.map(item => {
                      if (item.productId && typeof item.productId === 'object' && item.productId.name) {
                        return `${item.productId.name} (${item.quantity || 1})`
                      }
                      return null
                    }).filter(Boolean)
                    productName = productNames.join(', ') || 'Multiple Products'
                    qty = o.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
                  } else if (o.productId) {
                    if (typeof o.productId === 'object' && o.productId.name) {
                      productName = o.productId.name
                    } else if (typeof o.productId === 'string') {
                      productName = 'Product ID: ' + o.productId.slice(-6)
                    }
                    qty = Math.max(1, Number(o?.quantity||1))
                  }
                  
                  const price = (o?.total!=null ? Number(o.total) : (o?.productId?.price ? Number(o.productId.price) * qty : 0))
                  
                  // Driver and status
                  const currentDriver = editingDriver[id] !== undefined ? editingDriver[id] : (o.deliveryBoy?._id || o.deliveryBoy || '')
                  const currentStatus = editingStatus[id] || o.shipmentStatus || 'pending'
                  
                  const saveKey = `save-${id}`
                  const hasChanges = editingDriver[id] !== undefined || editingStatus[id] !== undefined
                  const countryDrivers = driversByCountry[o.orderCountry] || []
                  const fullAddress = [o.customerAddress, o.customerArea, o.city, o.orderCountry, o.customerLocation].filter(Boolean).filter((v,i,a)=> a.indexOf(v)===i).join(', ')
                  
                  return (
                    <div key={id} className="card" style={{display:'grid', gap:10}}>
                      <div className="card-header" style={{alignItems:'center'}}>
                        <div style={{display:'flex', alignItems:'center', gap:8}}>
                          <div className="badge">{o.orderCountry || '-'}</div>
                          <div className="chip" style={{background:'transparent'}}>{o.city || '-'}</div>
                          <StatusBadge kind="shipment" status={o.shipmentStatus || o.status} />
                        </div>
                        <div style={{display:'flex', alignItems:'center', gap:8}}>
                          {o.invoiceNumber ? <div style={{fontWeight:800}}>{ordNo}</div> : null}
                          <button className="btn primary" onClick={()=> openEditPopout(o)}>✏️ Edit</button>
                          <button className="btn secondary" onClick={()=> window.open(`/label/${id}`, '_blank', 'noopener,noreferrer')}>Print Label</button>
                        </div>
                      </div>
                      <div className="section" style={{padding:'10px 12px 0', borderTop:'1px solid var(--border)'}}>
                        <OrderStatusTrack order={o} />
                      </div>
                      <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10}}>
                        <div>
                          <div className="label">Customer</div>
                          <div style={{fontWeight:700}}>{o.customerName || '-'}</div>
                          <div className="helper">{`${o.phoneCountryCode||''} ${o.customerPhone||''}`.trim()}</div>
                          <div className="helper" title={fullAddress} style={{overflow:'hidden', textOverflow:'ellipsis'}}>{fullAddress || '-'}</div>
                        </div>
                        <div>
                          <div className="label">Product</div>
                          <div style={{fontWeight:700}}>{productName}</div>
                          <div className="helper">Qty: {qty}</div>
                          <div className="helper">Total: {price.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="label">Assign Driver</div>
                          <div style={{display:'grid', gap:8}}>
                            <select className="input" value={currentDriver} onChange={(e)=> setEditingDriver(prev => ({...prev, [id]: e.target.value}))} disabled={updating[saveKey]}>
                              <option value="">-- Select Driver --</option>
                              {countryDrivers.map(d => (
                                <option key={String(d._id)} value={String(d._id)}>{`${d.firstName||''} ${d.lastName||''}${d.city? ' • '+d.city:''}`}</option>
                              ))}
                            </select>
                            <div style={{display:'flex', gap:8}}>
                              <select className="input" value={currentStatus} onChange={(e)=> setEditingStatus(prev => ({...prev, [id]: e.target.value}))} disabled={updating[saveKey]}>
                                <option value="pending">Pending</option>
                                <option value="assigned">Assigned</option>
                                <option value="picked_up">Picked Up</option>
                                <option value="in_transit">In Transit</option>
                                <option value="out_for_delivery">Out for Delivery</option>
                                <option value="delivered">Delivered</option>
                                <option value="no_response">No Response</option>
                                <option value="returned">Returned</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                              {hasChanges && (
                                <button className="btn success" onClick={()=> { saveOrder(id, editingDriver[id], editingStatus[id]); setEditingDriver(prev=>{const n={...prev}; delete n[id]; return n}); setEditingStatus(prev=>{const n={...prev}; delete n[id]; return n}) }} disabled={updating[saveKey]}>💾 Save</button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="section" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                        <div className="helper">Created by: {agentName}</div>
                        <div className="helper">Created: {o.createdAt ? new Date(o.createdAt).toLocaleString() : ''}</div>
                      </div>
                    </div>
                  )
                })
        )}
      </div>

      {/* Infinite Scroll Sentinel */}
      <div ref={endRef} />

      {/* Drawer Modal */}
      {selected && (() => {
        // Prepare product display for modal
        let productDisplay = '-'
        if (selected.items && Array.isArray(selected.items) && selected.items.length > 0) {
          productDisplay = selected.items.map(item => {
            const name = item.productId?.name || 'Product'
            const qty = item.quantity || 1
            return `${name} (Qty: ${qty})`
          }).join(', ')
        } else if (selected.productId?.name) {
          productDisplay = `${selected.productId.name} • Qty ${Math.max(1, Number(selected.quantity||1))}`
        }
        
        return (
          <div className="modal" role="dialog" aria-modal="true" onClick={()=> setSelected(null)}>
            <div className="modal-card" style={{maxWidth:860}} onClick={e=> e.stopPropagation()}>
              <div className="card-header" style={{alignItems:'center', justifyContent:'space-between'}}>
                <div className="card-title">Order {selected.invoiceNumber? ('#'+selected.invoiceNumber) : shortId(selected._id)}</div>
                <button className="btn light" onClick={()=> setSelected(null)}>Close</button>
              </div>
              <div className="section" style={{display:'grid', gap:12}}>
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:12}}>
                  <DetailRow label="Customer" value={`${selected.customerName||'-'} (${selected.customerPhone||''})`} />
                  <DetailRow label="Location" value={`${selected.orderCountry||''} • ${selected.city||''} • ${selected.customerArea||''}`} />
                  <DetailRow label="Address" value={selected.customerAddress||'-'} />
                  <DetailRow label="Product(s)" value={productDisplay} />
                <DetailRow label="Agent" value={(selected.createdBy && selected.createdBy.role!=='user') ? `${selected.createdBy.firstName||''} ${selected.createdBy.lastName||''}`.trim() : 'Owner'} />
                <DetailRow label="Driver" value={selected.deliveryBoy ? `${selected.deliveryBoy.firstName||''} ${selected.deliveryBoy.lastName||''}`.trim() : '-'} />
                <DetailRow label="Status" value={selected.status||'-'} />
                <DetailRow label="Shipment" value={selected.shipmentStatus||'-'} />
                <DetailRow label="Courier" value={`${selected.courierName||'-'} • ${selected.trackingNumber||''}`} />
                <DetailRow label="COD" value={`${Number(selected.codAmount||0).toFixed(2)} • Collected ${Number(selected.collectedAmount||0).toFixed(2)}`} />
                <DetailRow label="Shipping Fee" value={Number(selected.shippingFee||0).toFixed(2)} />
                <DetailRow label="Balance Due" value={Number(selected.balanceDue||0).toFixed(2)} />
                <DetailRow label="Notes" value={selected.details||'-'} />
                  <DetailRow label="Delivery Notes" value={selected.deliveryNotes||'-'} />
                  <DetailRow label="Return Reason" value={selected.returnReason||'-'} />
                  <DetailRow label="Created" value={selected.createdAt? new Date(selected.createdAt).toLocaleString(): ''} />
                  <DetailRow label="Shipped" value={selected.shippedAt? new Date(selected.shippedAt).toLocaleString(): '-'} />
                  <DetailRow label="Delivered" value={selected.deliveredAt? new Date(selected.deliveredAt).toLocaleString(): '-'} />
                  <DetailRow label="Invoice" value={selected.invoiceNumber || '-'} />
                </div>
                <div style={{display:'grid', gap:8}}>
                  <div style={{fontWeight:800}}>Shipment Progress</div>
                  <OrderStatusTrack order={selected} />
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
