import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiPost, apiPatch, API_BASE, apiGetBlob } from '../../api'
import { io } from 'socket.io-client'

export default function ManagerOrders(){
  const [me, setMe] = useState(()=>{ try{ return JSON.parse(localStorage.getItem('me')||'{}') }catch{ return {} } })
  const [orders, setOrders] = useState([])
  const [drivers, setDrivers] = useState([])
  const [driversByCountry, setDriversByCountry] = useState({}) // Cache drivers by country
  const [loading, setLoading] = useState(true)
  const exportingRef = useRef(false)
  const [assigning, setAssigning] = useState('')
  const [q, setQ] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')

  const perms = me?.managerPermissions || {}

  async function fetchMe(){ try{ const { user } = await apiGet('/api/users/me'); setMe(user||{}) }catch{} }
  async function load(){
    setLoading(true)
    try{ const res = await apiGet('/api/orders'); setOrders(Array.isArray(res?.orders)? res.orders:[]) }catch{ setOrders([]) }
    finally{ setLoading(false) }
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

  useEffect(()=>{ fetchMe(); load() },[])
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
      socket.on('orders.changed', ()=> load())
    }catch{}
    return ()=>{ try{ socket && socket.off('orders.changed') }catch{}; try{ socket && socket.disconnect() }catch{} }
  },[])

  const filtered = useMemo(()=>{
    let rows = Array.isArray(orders)? orders:[]
    if (country) rows = rows.filter(o => String(o.orderCountry||'') === country)
    if (city) rows = rows.filter(o => String(o.city||'').toLowerCase() === city.toLowerCase())
    const t = q.trim().toLowerCase()
    if (t){
      rows = rows.filter(o => {
        const invoice = String(o.invoiceNumber||'').toLowerCase()
        const custName = String(o.customerName||'').toLowerCase()
        const custPhone = String(o.customerPhone||'').toLowerCase()
        const details = String(o.details||'').toLowerCase()
        const cityName = String(o.city||'').toLowerCase()
        const productNameTop = String(o?.productId?.name||'').toLowerCase()
        const productNamesMulti = Array.isArray(o?.items) ? o.items.map(it => String(it?.productId?.name||'').toLowerCase()).filter(Boolean) : []
        const driverName = `${o?.deliveryBoy?.firstName||''} ${o?.deliveryBoy?.lastName||''}`.trim().toLowerCase()
        const agentName = `${o?.createdBy?.firstName||''} ${o?.createdBy?.lastName||''}`.trim().toLowerCase()
        const agentEmail = String(o?.createdBy?.email||'').toLowerCase()
        const productsHit = productNameTop.includes(t) || productNamesMulti.some(n => n.includes(t))
        const driverHit = driverName.includes(t)
        const agentHit = agentName.includes(t) || agentEmail.includes(t)
        return (
          invoice.includes(t) ||
          custName.includes(t) ||
          custPhone.includes(t) ||
          details.includes(t) ||
          cityName.includes(t) ||
          productsHit ||
          driverHit ||
          agentHit
        )
      })
    }
    return rows
  }, [orders, country, city, q])

  const cities = useMemo(()=>{
    const set = new Set()
    for (const o of orders){ if (o?.city) set.add(o.city) }
    return Array.from(set)
  }, [orders])

  const countries = ['UAE','Oman','KSA','Bahrain','India','Kuwait','Qatar']

  async function exportCsv(){
    if (exportingRef.current) return
    exportingRef.current = true
    try{
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (country.trim()) params.set('country', country.trim())
      if (city.trim()) params.set('city', city.trim())
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
    try{ await apiPost(`/api/orders/${orderId}/assign-driver`, { driverId }); await load() }catch(err){ alert(err?.message||'Failed to assign') }finally{ setAssigning('') }
  }

  // Save handler like user Orders page
  const [editingDriver, setEditingDriver] = useState({})
  const [editingStatus, setEditingStatus] = useState({})
  const [updating, setUpdating] = useState({})
  async function saveOrder(orderId){
    const key = `save-${orderId}`
    setUpdating(prev => ({ ...prev, [key]: true }))
    try{
      const payload = {}
      if (editingDriver[orderId] !== undefined) payload.deliveryBoy = editingDriver[orderId] || null
      if (editingStatus[orderId] !== undefined) payload.shipmentStatus = editingStatus[orderId]
      await apiPatch(`/api/orders/${orderId}`, payload)
      await load()
      // clear local edits
      setEditingDriver(prev=>{ const n={...prev}; delete n[orderId]; return n })
      setEditingStatus(prev=>{ const n={...prev}; delete n[orderId]; return n })
    }catch(err){ alert(err?.message || 'Failed to save') }
    finally{ setUpdating(prev => ({ ...prev, [key]: false })) }
  }

  function statusBadge(st){
    const s = String(st||'').toLowerCase()
    const map = { pending:'#f59e0b', assigned:'#6366f1', in_transit:'#3b82f6', delivered:'#10b981', cancelled:'#ef4444', returned:'#e11d48' }
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
                  <option value="delivered">Delivered</option>
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
          <select className="input" value={country} onChange={e=> setCountry(e.target.value)}>
            <option value=''>All Countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" value={city} onChange={e=> setCity(e.target.value)}>
            <option value=''>All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div style={{display:'grid', gap:12, marginTop:12}}>
        {loading ? (
          <div className="card"><div className="section">Loading…</div></div>
        ) : filtered.length === 0 ? (
          <div className="card"><div className="section">No orders found</div></div>
        ) : (
          filtered.map(o => <Card key={String(o._id)} o={o} />)
        )}
      </div>
    </div>
  )
}
