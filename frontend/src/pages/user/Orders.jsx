import React, { useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE, apiGet, apiPatch } from '../../api.js'
import { useLocation, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useToast } from '../../ui/Toast.jsx'

function StatusBadge({ status, kind='status' }){
  const s = String(status||'').toLowerCase()
  let color = { borderColor:'#e5e7eb', color:'#374151' }
  if (kind==='shipment'){
    if (s==='delivered') color = { borderColor:'#10b981', color:'#065f46' }
    else if (['in_transit','assigned','shipped','picked_up'].includes(s)) color = { borderColor:'#3b82f6', color:'#1d4ed8' }
    else if (['returned','cancelled'].includes(s)) color = { borderColor:'#ef4444', color:'#991b1b' }
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
  const [productQuery, setProductQuery] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
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
  const toast = useToast()
  // Columns: Order | Customer | Product | Price | Country | Agent | Driver | Shipment | Actions
  // Made Driver column wider (from 1fr to 1.3fr)
  const colTemplate = '140px 1.2fr 1fr 110px 120px 1fr 1.3fr 140px 120px'

  // Available filters (from backend options)
  const [countryOptions, setCountryOptions] = useState([])
  const [cityOptions, setCityOptions] = useState([])
  const [agentOptions, setAgentOptions] = useState([])
  const [driverOptions, setDriverOptions] = useState([])
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

  // Client-side product name filtering (applies to loaded items)
  const productFiltered = useMemo(()=>{
    const pq = productQuery.trim().toLowerCase()
    if (!pq) return orders
    return orders.filter(o=>{
      if (Array.isArray(o.items) && o.items.length){
        return o.items.some(it => String(it?.productId?.name||'').toLowerCase().includes(pq))
      }
      return String(o?.productId?.name||'').toLowerCase().includes(pq)
    })
  }, [orders, productQuery])

  // Build query params for backend filters
  const buildQuery = useMemo(()=>{
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (country.trim()) params.set('country', country.trim())
    if (city.trim()) params.set('city', city.trim())
    if (onlyUnassigned) params.set('onlyUnassigned', 'true')
    if (statusFilter.trim()) params.set('status', statusFilter.trim())
    if (shipFilter.trim()) params.set('ship', shipFilter.trim())
    if (paymentFilter.trim()) params.set('payment', paymentFilter.trim())
    if (collectedOnly) params.set('collected', 'true')
    if (agentFilter.trim()) params.set('agent', agentFilter.trim())
    if (driverFilter.trim()) params.set('driver', driverFilter.trim())
    return params
  }, [query, country, city, onlyUnassigned, statusFilter, shipFilter, paymentFilter, collectedOnly, agentFilter, driverFilter])

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
    }catch(e){ setError(e?.message||'Failed to load orders'); setHasMore(false) }
    finally{ setLoading(false); loadingMoreRef.current = false }
  }

  // Initial load
  useEffect(()=>{ loadOrders(true) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])
  // Reload on filter changes (except productQuery which is client-side)
  useEffect(()=>{ loadOrders(true) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [buildQuery])

  // Initialize filters from URL query params and keep in sync on navigation
  useEffect(()=>{
    try{
      const sp = new URLSearchParams(location.search||'')
      const q = sp.get('q') || ''
      const ctry = sp.get('country') || ''
      const cty = sp.get('city') || ''
      const un = (sp.get('onlyUnassigned')||'').toLowerCase() === 'true'
      const st = sp.get('status') || ''
      const ship = sp.get('ship') || ''
      const pay = (sp.get('payment')||'').toUpperCase()
      const col = (sp.get('collected')||'').toLowerCase() === 'true'
      const ag = sp.get('agent') || ''
      const dr = sp.get('driver') || ''
      setQuery(q)
      setCountry(ctry)
      setCity(cty)
      setOnlyUnassigned(un)
      setStatusFilter(st)
      setShipFilter(ship)
      setPaymentFilter(pay === 'COD' || pay === 'PREPAID' ? pay : '')
      setCollectedOnly(col)
      setAgentFilter(ag)
      setDriverFilter(dr)
    }catch{}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  // Keep URL in sync with current filters for shareable deep links
  useEffect(()=>{
    try{
      const managed = ['q','country','city','onlyUnassigned','status','ship','payment','collected','agent','driver']
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
        const path = location.pathname || '/user/orders'
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
    const countries = [...new Set(orders.map(o => o.orderCountry).filter(Boolean))]
    countries.forEach(country => fetchDriversByCountry(country))
  }, [orders])

  // Live updates: refresh first page on order changes in workspace
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const reload = async ()=>{ try{ await loadOrders(true) }catch{} }
      socket.on('orders.changed', reload)
    }catch{}
    return ()=>{ try{ socket && socket.off('orders.changed') }catch{}; try{ socket && socket.disconnect() }catch{} }
  }, [API_BASE, buildQuery])

  async function saveOrder(orderId, driverId, status){
    const key = `save-${orderId}`
    setUpdating(prev => ({ ...prev, [key]: true }))
    try{
      const payload = {}
      if (driverId !== undefined) payload.deliveryBoy = driverId || null
      if (status) payload.shipmentStatus = status
      
      await apiPatch(`/api/orders/${orderId}`, payload)
      await loadOrders(true)
      toast.success('Order updated successfully')
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
          <input className="input" placeholder="Search invoice (#123), phone, customer, agent, driver, details" value={query} onChange={e=> setQuery(e.target.value)} />
          <input className="input" placeholder="Search product" value={productQuery} onChange={e=> setProductQuery(e.target.value)} />
          <select className="input" value={country} onChange={e=> setCountry(e.target.value)}>
            <option value=''>All Countries</option>
            {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" value={city} onChange={e=> setCity(e.target.value)}>
            <option value=''>All Cities</option>
            {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" value={shipFilter} onChange={e=> setShipFilter(e.target.value)}>
            <option value="">All Shipment</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="returned">Returned</option>
            <option value="cancelled">Cancelled</option>
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
        </div>
      </div>

      {/* Cards list */}
      <div style={{display:'grid', gap:12}}>
        {loading ? (
          <div className="card"><div className="section">Loading…</div></div>
        ) : error ? (
          <div className="card"><div className="section error">{error}</div></div>
        ) : productFiltered.length === 0 ? (
          <div className="card"><div className="section">No orders found</div></div>
        ) : (
          productFiltered.map((o) => {
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
                                <option value="delivered">Delivered</option>
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
                  <div style={{fontWeight:800}}>Timeline</div>
                  <OrderTimeline order={selected} />
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
