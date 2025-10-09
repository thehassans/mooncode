import React, { useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE, apiGet, apiGetBlob } from '../../api.js'
import { useLocation, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import DateRangeChips from '../../ui/DateRangeChips.jsx'

function StatusBadge({ status }){
  const s = String(status||'').toLowerCase()
  let color = { borderColor:'#e5e7eb', color:'#374151' }
  if (s==='delivered') color = { borderColor:'#10b981', color:'#065f46' }
  else if (['in_transit','assigned','shipped','picked_up','out_for_delivery'].includes(s)) color = { borderColor:'#3b82f6', color:'#1d4ed8' }
  else if (['returned','cancelled','no_response'].includes(s)) color = { borderColor:'#ef4444', color:'#991b1b' }
  else if (s==='pending') color = { borderColor:'#f59e0b', color:'#b45309' }
  return <span className="chip" style={{ background:'transparent', ...color }}>{status||'-'}</span>
}

export default function AgentOrdersHistory(){
  const location = useLocation()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [shipFilter, setShipFilter] = useState('')
  const [countryOptions, setCountryOptions] = useState([])
  const [cityOptions, setCityOptions] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadingMoreRef = useRef(false)
  const endRef = useRef(null)
  const exportingRef = useRef(false)
  const [range, setRange] = useState('last7') // today | last7 | last30 | custom
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Support preserving range via URL (?fromDate=&toDate=) when navigated from dashboard
  const rangeFromUrl = useMemo(()=>{
    try{
      const sp = new URLSearchParams(location.search||'')
      const from = sp.get('fromDate') || ''
      const to = sp.get('toDate') || ''
      if (from && to) return { from, to }
      return null
    }catch{ return null }
  }, [location.search])
  useEffect(()=>{
    try{
      if (!rangeFromUrl) return
      const now = new Date(); now.setHours(23,59,59,999)
      const from = new Date(rangeFromUrl.from)
      const to = new Date(rangeFromUrl.to)
      const msInDay = 24*60*60*1000
      const diffDays = Math.round((to.setHours(0,0,0,0) - from.setHours(0,0,0,0))/msInDay) + 1
      const fromToday = (from.toDateString() === (new Date().toDateString()))
      if (diffDays===1 && fromToday) setRange('today')
      else if (diffDays===7) setRange('last7')
      else if (diffDays===30) setRange('last30')
    }catch{}
  }, [rangeFromUrl])

  const rangeDates = useMemo(()=>{
    try{
      if (range==='custom' && customFrom && customTo){
        const f = new Date(customFrom); f.setHours(0,0,0,0)
        const t = new Date(customTo); t.setHours(23,59,59,999)
        return { from: f.toISOString(), to: t.toISOString() }
      }
      const now = new Date()
      const end = new Date(now); end.setHours(23,59,59,999)
      let from
      if (range==='today'){
        const s = new Date(now); s.setHours(0,0,0,0); from = s
      } else if (range==='last30'){
        const s = new Date(now); s.setDate(now.getDate()-29); s.setHours(0,0,0,0); from = s
      } else { // last7
        const s = new Date(now); s.setDate(now.getDate()-6); s.setHours(0,0,0,0); from = s
      }
      return { from: from.toISOString(), to: end.toISOString() }
    }catch{ return null }
  }, [range, customFrom, customTo])

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

  const buildQuery = useMemo(()=>{
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (country.trim()) params.set('country', country.trim())
    if (city.trim()) params.set('city', city.trim())
    if (shipFilter.trim()) params.set('ship', shipFilter.trim())
    // Use explicit range passed via URL if present; else use selected chips range
    try{
      const src = rangeDates || rangeFromUrl
      if (src && src.from && src.to){
        params.set('fromDate', src.from)
        params.set('toDate', src.to)
      }
    }catch{}
    return params
  }, [query, country, city, shipFilter, rangeFromUrl, rangeDates])

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

  useEffect(()=>{ loadOrders(true) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])
  useEffect(()=>{ loadOrders(true) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [buildQuery])

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

  // First, enforce range locally so Today is strict even if server ignores TZ
  const rangeFiltered = useMemo(()=>{
    try{
      if (!rangeDates || !rangeDates.from || !rangeDates.to) return orders
      const fromTs = new Date(rangeDates.from).getTime()
      const toTs = new Date(rangeDates.to).getTime()
      return (Array.isArray(orders)? orders: []).filter(o=>{
        const dAt = o?.deliveredAt ? new Date(o.deliveredAt).getTime() : null
        const cAt = o?.createdAt ? new Date(o.createdAt).getTime() : null
        if (dAt!=null) return dAt>=fromTs && dAt<=toTs
        if (cAt!=null) return cAt>=fromTs && cAt<=toTs
        return false
      })
    }catch{ return orders }
  }, [orders, rangeDates?.from, rangeDates?.to])

  // Then apply product search (client-side) like user Orders
  const productFiltered = useMemo(()=>{
    const pq = productQuery.trim().toLowerCase()
    if (!pq) return rangeFiltered
    return rangeFiltered.filter(o=>{
      if (Array.isArray(o.items) && o.items.length){
        return o.items.some(it => String(it?.productId?.name||'').toLowerCase().includes(pq))
      }
      return String(o?.productId?.name||'').toLowerCase().includes(pq)
    })
  }, [rangeFiltered, productQuery])

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
      a.download = `agent-orders-${ts}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }catch(e){ alert(e?.message || 'Failed to export') }
    finally{ exportingRef.current = false }
  }

  // Live refresh on order changes
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

  function shortId(id){ return String(id||'').slice(-5).toUpperCase() }
  function userName(u){ if (!u) return '-'; return `${u.firstName||''} ${u.lastName||''}`.trim() || (u.email||'-') }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div>
          <div className="page-title gradient heading-purple">Order History</div>
          <div className="page-subtitle">All orders you submitted</div>
        </div>
        <button className="btn small" onClick={()=> navigate('/agent/orders')} title="Submit Order">Submit Order</button>
      </div>

      {/* Date Range */}
      <div className="section" style={{marginBottom:8, display:'grid', gap:8}}>
        <DateRangeChips value={range} onChange={setRange} options={[
          {k:'today', label:'Today'},
          {k:'last7', label:'Last 7 Days'},
          {k:'last30', label:'Last 30 Days'},
          {k:'custom', label:'Custom'}
        ]} />
        {range==='custom' && (
          <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
            <input type="date" className="input" value={customFrom} onChange={e=> setCustomFrom(e.target.value)} />
            <input type="date" className="input" value={customTo} onChange={e=> setCustomTo(e.target.value)} />
          </div>
        )}
      </div>

      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header"><div className="card-title">Filters</div></div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8}}>
          <input className="input" placeholder="Search invoice, product, customer, city, phone, details" value={query} onChange={e=> setQuery(e.target.value)} />
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
          <button className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

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
            const agentName = (o.createdBy && o.createdBy.role !== 'user') ? userName(o.createdBy) : (o.createdBy?.role==='user' ? 'Owner' : '-')

            // Product summary (supports multi-items)
            let productName = '-'
            let qty = 1
            let baseCur = 'SAR'
            if (o.items && Array.isArray(o.items) && o.items.length > 0) {
              const productNames = o.items.map(item => {
                if (item.productId && typeof item.productId === 'object' && item.productId.name) {
                  return `${item.productId.name} (${item.quantity || 1})`
                }
                return null
              }).filter(Boolean)
              productName = productNames.join(', ') || 'Multiple Products'
              qty = o.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
              baseCur = (o.items[0]?.productId?.baseCurrency) || baseCur
            } else if (o.productId) {
              if (typeof o.productId === 'object' && o.productId.name) {
                productName = o.productId.name
              } else if (typeof o.productId === 'string') {
                productName = 'Product ID: ' + o.productId.slice(-6)
              }
              qty = Math.max(1, Number(o?.quantity||1))
              baseCur = (o?.productId?.baseCurrency) || baseCur
            }
            const price = (o?.total!=null ? Number(o.total) : (o?.productId?.price ? Number(o.productId.price) * qty : 0))
            const fullAddress = [o.customerAddress, o.customerArea, o.city, o.orderCountry, o.customerLocation].filter(Boolean).filter((v,i,a)=> a.indexOf(v)===i).join(', ')
            const driverName = o?.deliveryBoy ? `${o.deliveryBoy.firstName||''} ${o.deliveryBoy.lastName||''}`.trim() : ''

            return (
              <div key={id} className="card" style={{display:'grid', gap:10}}>
                <div className="card-header" style={{alignItems:'center'}}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <div className="badge">{o.orderCountry || '-'}</div>
                    <div className="chip" style={{background:'transparent'}}>{o.city || '-'}</div>
                    <StatusBadge status={o.shipmentStatus || o.status} />
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    {o.invoiceNumber ? <div style={{fontWeight:800}}>{ordNo}</div> : null}
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
                    <div className="helper">Total: {String(baseCur||'SAR').toUpperCase()} {price.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="label">Agent</div>
                    <div className="helper">{agentName}</div>
                    <div className="label" style={{marginTop:8}}>Driver</div>
                    <div className="helper">{driverName || '-'}</div>
                  </div>
                </div>
                <div className="section" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <div className="helper">Created: {o.createdAt ? new Date(o.createdAt).toLocaleString() : ''}</div>
                  <div className="helper">Invoice: {o.invoiceNumber || '-'}</div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div ref={endRef} />
    </div>
  )
}
