import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiPost, apiPatch, API_BASE, apiGetBlob } from '../../api'
import { useLocation, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'

export default function ManagerOrders(){
  const location = useLocation()
  const navigate = useNavigate()
  const [me, setMe] = useState(()=>{ try{ return JSON.parse(localStorage.getItem('me')||'{}') }catch{ return {} } })
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [drivers, setDrivers] = useState([])
  const [driversByCountry, setDriversByCountry] = useState({}) // Cache drivers by country
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadingMoreRef = useRef(false)
  const endRef = useRef(null)
  const exportingRef = useRef(false)
  const [assigning, setAssigning] = useState('')
  const [q, setQ] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [ship, setShip] = useState('')
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
  const [onlyAssigned, setOnlyAssigned] = useState(false)
  const [agentFilter, setAgentFilter] = useState('')
  const [driverFilter, setDriverFilter] = useState('')
  const [agentOptions, setAgentOptions] = useState([])

  const perms = me?.managerPermissions || {}

  // Preserve scroll helper
  const preserveScroll = async (fn)=>{
    const y = window.scrollY
    try{ return await fn() } finally { try{ requestAnimationFrame(()=> window.scrollTo(0, y)) }catch{ window.scrollTo(0, y) } }
  }

  async function fetchMe(){ try{ const { user } = await apiGet('/api/users/me'); setMe(user||{}) }catch{} }
  const buildQuery = useMemo(()=>{
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (country.trim()) params.set('country', country.trim())
    if (city.trim()) params.set('city', city.trim())
    if (ship.trim()) params.set('ship', ship.trim())
    if (onlyUnassigned) params.set('onlyUnassigned','true')
    else if (onlyAssigned) params.set('onlyAssigned','true')
    if (agentFilter.trim()) params.set('agent', agentFilter.trim())
    if (driverFilter.trim()) params.set('driver', driverFilter.trim())
    return params
  }, [q, country, city, ship, onlyUnassigned, agentFilter, driverFilter])
  async function loadOrders(reset=false){
    if (loadingMoreRef.current) return
    loadingMoreRef.current = true
    try{
      if (reset){ setLoading(true); setOrders([]); setPage(1); setHasMore(true) }
      const nextPage = reset ? 1 : (page + 1)
      const params = new URLSearchParams(buildQuery.toString())
      params.set('page', String(nextPage))
      params.set('limit', '20')
      const res = await apiGet(`/api/orders?${params.toString()}`)
      const list = Array.isArray(res?.orders) ? res.orders : []
      setOrders(prev => reset ? list : [...prev, ...list])
      setHasMore(!!res?.hasMore)
      setPage(nextPage)
      setError('')
    }catch(e){ setError(e?.message||'Failed to load orders'); setHasMore(false) }
    finally{ setLoading(false); loadingMoreRef.current = false }
  }

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
    const countries = [...new Set(orders.map(o => o.orderCountry).filter(Boolean))]
    countries.forEach(country => fetchDriversByCountry(country))
  }, [orders])

  useEffect(()=>{ fetchMe(); loadOrders(true) },[])
  // Load agents for workspace (owner scope handled server-side)
  useEffect(()=>{
    (async()=>{
      try{ const a = await apiGet('/api/users/agents'); setAgentOptions(Array.isArray(a?.users)? a.users: []) }catch{ setAgentOptions([]) }
    })()
  },[])
  // Load driver list for selected filter country
  useEffect(()=>{ if (country) fetchDriversByCountry(country) }, [country])
  // Apply URL params to filters
  useEffect(()=>{
    try{
      const p = new URLSearchParams(location.search || '')
      const c = p.get('country') || ''
      const ci = p.get('city') || ''
      const s = (p.get('ship')||'').toLowerCase()
      const un = String(p.get('onlyUnassigned')||'').toLowerCase() === 'true'
      const oa = String(p.get('onlyAssigned')||'').toLowerCase() === 'true'
      const qParam = p.get('q') || ''
      const ag = p.get('agent') || ''
      const dr = p.get('driver') || ''
      setQ(qParam)
      setCountry(c)
      setCity(ci)
      setShip(s)
      setOnlyUnassigned(un)
      setOnlyAssigned(oa)
      setAgentFilter(ag)
      setDriverFilter(dr)
    }catch{}
  }, [location.search])
  useEffect(()=>{
    // Default country: if exactly one assigned, set it; if multiple, show all
    const arr = Array.isArray(me?.assignedCountries) && me.assignedCountries.length ? me.assignedCountries : (me?.assignedCountry ? [me.assignedCountry] : [])
    if (arr.length === 1) setCountry(arr[0])
  }, [me])

  // live updates
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token')||''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, auth:{ token }, withCredentials:true })
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
  },[])
  // reload when filters change
  useEffect(()=>{ loadOrders(true) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [buildQuery])

  // Keep URL in sync with current filters for shareable deep links
  useEffect(()=>{
    try{
      const managed = ['q','country','city','onlyUnassigned','onlyAssigned','ship','agent','driver']
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
      if (nextQS !== currQS){
        const path = location.pathname || '/manager/orders'
        navigate(`${path}${nextQS ? `?${nextQS}` : ''}`, { replace: true })
      }
    }catch{}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildQuery, location.pathname])

  // Infinite scroll observer
  useEffect(()=>{
    const el = endRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries)=>{
      const [e] = entries
      if (e.isIntersecting && hasMore && !loadingMoreRef.current){ loadOrders(false) }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return ()=>{ try{ obs.disconnect() }catch{} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endRef.current, hasMore, page, buildQuery])

  const cities = useMemo(()=>{
    const set = new Set()
    for (const o of orders){ if (o?.city) set.add(o.city) }
    return Array.from(set)
  }, [orders])

  const countries = useMemo(()=>{
    const assigned = Array.isArray(me?.assignedCountries) && me.assignedCountries.length ? me.assignedCountries : (me?.assignedCountry ? [me.assignedCountry] : [])
    if (assigned.length) return Array.from(new Set(assigned))
    return ['UAE','Oman','KSA','Bahrain','India','Kuwait','Qatar']
  }, [me])

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
    }catch(e){ alert(e?.message || 'Failed to export') }
    finally{ exportingRef.current = false }
  }

  async function assignDriver(orderId, driverId){
    setAssigning(orderId)
    try{
      await preserveScroll(async ()=>{
        const r = await apiPost(`/api/orders/${orderId}/assign-driver`, { driverId })
        const updated = r?.order
        if (updated){
          setOrders(prev => prev.map(o => String(o._id) === String(updated._id) ? updated : o))
        } else {
          await loadOrders(false)
        }
        setError('')
      })
    }catch(err){
      alert(err?.message||'Failed to assign')
    }finally{
      setAssigning('')
    }
  }

  // Save handler like user Orders page
  const [editingDriver, setEditingDriver] = useState({})
  const [editingStatus, setEditingStatus] = useState({})
  const [updating, setUpdating] = useState({})
  async function saveOrder(orderId){
    const key = `save-${orderId}`
    setUpdating(prev => ({ ...prev, [key]: true }))
    try{
      await preserveScroll(async ()=>{
        const driverEdited = Object.prototype.hasOwnProperty.call(editingDriver, orderId)
        const statusEdited = Object.prototype.hasOwnProperty.call(editingStatus, orderId)

        if (driverEdited && !statusEdited){
          const drv = editingDriver[orderId]
          if (drv && String(drv).trim()){
            // Use dedicated endpoint which also flips pending -> assigned
            await assignDriver(orderId, drv)
          } else {
            // Unassign driver
            const r = await apiPatch(`/api/orders/${orderId}`, { deliveryBoy: null })
            const updated = r?.order
            if (updated){
              setOrders(prev => prev.map(o => String(o._id) === String(orderId) ? updated : o))
            } else {
              await loadOrders(false)
            }
          }
        } else {
          const payload = {}
          if (driverEdited) payload.deliveryBoy = editingDriver[orderId] || null
          if (statusEdited) payload.shipmentStatus = editingStatus[orderId]
          const r = await apiPatch(`/api/orders/${orderId}`, payload)
          const updated = r?.order
          if (updated){
            setOrders(prev => prev.map(o => String(o._id) === String(orderId) ? updated : o))
          } else {
            await loadOrders(false)
          }
        }
      })
      // clear local edits
      setEditingDriver(prev=>{ const n={...prev}; delete n[orderId]; return n })
      setEditingStatus(prev=>{ const n={...prev}; delete n[orderId]; return n })
    }catch(err){ alert(err?.message || 'Failed to save') }
    finally{ setUpdating(prev => ({ ...prev, [key]: false })) }
  }

  function statusBadge(st){
    const s = String(st||'').toLowerCase()
    const map = { pending:'#f59e0b', assigned:'#6366f1', picked_up:'#3b82f6', in_transit:'#3b82f6', out_for_delivery:'#3b82f6', delivered:'#10b981', no_response:'#ef4444', cancelled:'#ef4444', returned:'#e11d48' }
    const color = map[s] || 'var(--muted)'
    return <span className="chip" style={{border:`1px solid ${color}`, color, background:'transparent'}}>{s.replace('_',' ')||'-'}</span>
  }

  function Card({ o }){
    const id = String(o?._id||'')
    const driverId = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
    // Get drivers from the same country as the order
    const countryDrivers = driversByCountry[o.orderCountry] || []
    const fullAddress = [o.customerAddress, o.customerArea, o.city, o.orderCountry, o.customerLocation].filter(Boolean).filter((v,i,a)=> a.indexOf(v)===i).join(', ')
    const driverName = o?.deliveryBoy ? `${o.deliveryBoy.firstName||''} ${o.deliveryBoy.lastName||''}`.trim() : ''
    return (
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header" style={{alignItems:'center'}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div className="badge">{o.orderCountry || '-'}</div>
            <div className="chip" style={{background:'transparent'}}>{o.city || '-'}</div>
            <div>{statusBadge(o.shipmentStatus || o.status)}</div>
            {driverName && (
              <div className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)'}} title={driverName}>Driver: <strong style={{marginLeft:6}}>{driverName}</strong></div>
            )}
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            {o.invoiceNumber ? <div style={{fontWeight:800}}>#{o.invoiceNumber}</div> : null}
            <button className="btn secondary" onClick={()=> window.open(`/label/${id}`, '_blank', 'noopener,noreferrer')}>Print Label</button>
          </div>
        </div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10}}>
          <div>
            <div className="label">Customer</div>
            <div style={{fontWeight:700}}>{o.customerName || '-'}</div>
            <div className="helper" style={{whiteSpace:'nowrap'}}>{`${o.phoneCountryCode||''} ${o.customerPhone||''}`.trim()}</div>
            <div className="helper" title={fullAddress} style={{overflow:'hidden', textOverflow:'ellipsis'}}>{fullAddress || '-'}</div>
          </div>
          <div>
            <div className="label">Product</div>
            <div style={{fontWeight:700}}>{o.productId?.name || '-'}</div>
            <div className="helper">Qty: {o.quantity || 1}</div>
            <div className="helper">Total: {o.total != null ? Number(o.total).toFixed(2) : '-'}</div>
          </div>
          <div>
            <div className="label">Assign Driver</div>
            <div style={{display:'grid', gap:8}}>
              <select className="input" value={editingDriver[id] !== undefined ? editingDriver[id] : driverId} onChange={(e)=> setEditingDriver(prev => ({...prev, [id]: e.target.value}))} disabled={updating[`save-${id}`]}>
                <option value="">-- Select Driver --</option>
                {countryDrivers.map(d => (
                  <option key={String(d._id)} value={String(d._id)}>{`${d.firstName||''} ${d.lastName||''}${d.city? ' • '+d.city:''}`}</option>
                ))}
                {countryDrivers.length === 0 && <option disabled>No drivers in {o.orderCountry}</option>}
              </select>
              <div style={{display:'flex', gap:8}}>
                <select className="input" value={editingStatus[id] || (o.shipmentStatus || 'pending')} onChange={(e)=> setEditingStatus(prev => ({...prev, [id]: e.target.value}))} disabled={updating[`save-${id}`]}>
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
                {(editingDriver[id] !== undefined || editingStatus[id] !== undefined) && (
                  <button className="btn success" onClick={()=> saveOrder(id)} disabled={updating[`save-${id}`]}>💾 Save</button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="section" style={{display:'flex', gap:12, alignItems:'center', justifyContent:'space-between'}}>
          <div className="helper">Created by: {(o.createdBy?.firstName||'') + ' ' + (o.createdBy?.lastName||'')}</div>
          <div className="helper">Created: {o.createdAt ? new Date(o.createdAt).toLocaleString() : ''}</div>
        </div>
      </div>
    )
  }

  if (!perms.canCreateOrders){
    return (
      <div className="section">
        <div className="page-header"><div><div className="page-title gradient heading-purple">Orders</div><div className="page-subtitle">You do not have access to Orders.</div></div></div>
        <div className="card"><div>You don't have permission to view this page. Please contact the workspace owner.</div></div>
      </div>
    )
  }

  return (
    <div className="section">
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-purple">Orders</div>
          <div className="page-subtitle">Assign drivers and print labels</div>
        </div>
      </div>
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header">
          <div className="card-title">Filters</div>
        </div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8}}>
          <input className="input" placeholder="Search invoice, product, driver, agent, city, phone, details" value={q} onChange={e=> setQ(e.target.value)} />
          <select className="input" value={country} onChange={e=> { setCountry(e.target.value); setDriverFilter('') }}>
            <option value=''>All Countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" value={city} onChange={e=> setCity(e.target.value)}>
            <option value=''>All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" value={ship} onChange={e=> setShip(e.target.value)}>
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
            {(driversByCountry[country] || []).map(d => (
              <option key={String(d._id)} value={String(d._id)}>{`${d.firstName||''} ${d.lastName||''}${d.city? ' • '+d.city:''}`}</option>
            ))}
          </select>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div style={{display:'grid', gap:12, marginTop:12}}>
        {loading ? (
          <div className="card"><div className="section">Loading…</div></div>
        ) : error ? (
          <div className="card"><div className="section error">{error}</div></div>
        ) : orders.length === 0 ? (
          <div className="card"><div className="section">No orders found</div></div>
        ) : (
          orders.map(o => <Card key={String(o._id)} o={o} />)
        )}
        {/* Infinite Scroll Sentinel */}
        <div ref={endRef} />
      </div>
    </div>
  )
}
