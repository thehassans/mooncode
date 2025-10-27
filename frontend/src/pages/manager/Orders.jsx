import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiPost, apiPatch, API_BASE, apiGetBlob } from '../../api'
import { getCurrencyConfig, convert } from '../../util/currency'
import { useLocation, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import OrderStatusTrack from '../../ui/OrderStatusTrack.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function ManagerOrders(){
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
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
  const urlSyncRef = useRef({ raf: 0, last: '' })
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
  const [curCfg, setCurCfg] = useState(null)
  const [pendingReturns, setPendingReturns] = useState([])
  const [verifying, setVerifying] = useState(null)
  const [summary, setSummary] = useState(null)

  const perms = me?.managerPermissions || {}

  // Responsive viewport tracking
  const [vw, setVw] = useState(()=> (typeof window !== 'undefined' ? window.innerWidth : 1024))
  useEffect(()=>{
    const onResize = ()=>{ try{ setVw(window.innerWidth || 1024) }catch{} }
    try{ window.addEventListener('resize', onResize) }catch{}
    return ()=>{ try{ window.removeEventListener('resize', onResize) }catch{} }
  }, [])
  const isMobileView = vw <= 480
  const isTabletView = vw > 480 && vw <= 768

  // Preserve scroll helper - enhanced for mobile
  const preserveScroll = async (fn)=>{
    const y = (typeof window !== 'undefined' && typeof document !== 'undefined')
      ? (window.scrollY || (document.scrollingElement && document.scrollingElement.scrollTop) || (document.documentElement && document.documentElement.scrollTop) || (document.body && document.body.scrollTop) || 0)
      : 0
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
    
    try{ return await fn() }
    finally {
      // Multiple attempts to restore scroll position, especially important on mobile
      const restoreScroll = () => {
        try{ window.scrollTo(0, y) }catch{}
        try{ if (document && document.scrollingElement) document.scrollingElement.scrollTop = y }catch{}
        try{ if (document && document.documentElement) document.documentElement.scrollTop = y }catch{}
        try{ if (document && document.body) document.body.scrollTop = y }catch{}
      }
      
      // Immediate restore
      restoreScroll()
      
      // After next frame
      try{
        requestAnimationFrame(()=>{
          restoreScroll()
          // Additional delay for mobile browsers
          if (isMobile) {
            setTimeout(restoreScroll, 10)
            setTimeout(restoreScroll, 50)
            setTimeout(restoreScroll, 100)
          } else {
            setTimeout(restoreScroll, 0)
          }
        })
      }catch{ restoreScroll() }
    }
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

  function countryToCurrency(c){
    const raw = String(c||'').trim().toLowerCase()
    if (!raw) return ''
    if (raw==='ksa' || raw==='saudi arabia' || raw==='saudi' || raw==='sa') return 'SAR'
    if (raw==='uae' || raw==='united arab emirates' || raw==='ae') return 'AED'
    if (raw==='oman' || raw==='om') return 'OMR'
    if (raw==='bahrain' || raw==='bh') return 'BHD'
    if (raw==='india' || raw==='in') return 'INR'
    if (raw==='kuwait' || raw==='kw' || raw==='kwt') return 'KWD'
    if (raw==='qatar' || raw==='qa') return 'QAR'
    return ''
  }
  function formatCurrency(n, cur){
    const v = Number(n||0)
    const s = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${cur} ${s}`
  }

  async function loadSummary(){
    try{
      const params = new URLSearchParams(buildQuery.toString())
      if (String(ship||'').trim().toLowerCase() === 'delivered') params.set('includeWeb','true')
      const r = await apiGet(`/api/orders/summary?${params.toString()}`)
      setSummary(r||null)
    }catch{ setSummary(null) }
  }
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

  // Load pending returns for verification
  async function loadPendingReturns(){
    try{
      const res = await apiGet('/api/orders?ship=cancelled,returned&limit=200')
      const allOrders = res?.orders || []
      // Filter only submitted returns that need verification
      const submitted = allOrders.filter(o => 
        o.returnSubmittedToCompany && 
        !o.returnVerified &&
        ['cancelled', 'returned'].includes(String(o.shipmentStatus || '').toLowerCase())
      )
      setPendingReturns(submitted)
    }catch(e){
      console.error('Failed to load pending returns:', e)
    }
  }

  async function verifyReturn(orderId){
    setVerifying(orderId)
    try{
      // Save current scroll position
      const scrollY = window.scrollY
      
      const response = await apiPost(`/api/orders/${orderId}/return/verify`, {})
      toast.success(response?.message || 'Order verified successfully and stock refilled')
      
      // Update states locally to preserve scroll position
      setPendingReturns(prev => prev.filter(o => String(o._id) !== String(orderId)))
      setOrders(prev => prev.map(o => 
        String(o._id) === String(orderId)
          ? { ...o, returnVerified: true, returnVerifiedAt: new Date().toISOString() }
          : o
      ))
      
      // Restore scroll position after state update
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY)
      })
    }catch(e){
      toast.error(e?.message || 'Failed to verify order')
    }finally{
      setVerifying(null)
    }
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

  useEffect(()=>{ fetchMe(); loadOrders(true); loadPendingReturns() },[])
  useEffect(()=>{ let alive=true; getCurrencyConfig().then(c=>{ if(alive) setCurCfg(c) }).catch(()=>{}); return ()=>{ alive=false } },[])
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
      if (q !== qParam) setQ(qParam)
      if (country !== c) setCountry(c)
      if (city !== ci) setCity(ci)
      if (ship !== s) setShip(s)
      if (onlyUnassigned !== un) setOnlyUnassigned(un)
      if (onlyAssigned !== oa) setOnlyAssigned(oa)
      if (agentFilter !== ag) setAgentFilter(ag)
      if (driverFilter !== dr) setDriverFilter(dr)
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
  useEffect(()=>{ loadOrders(true); loadSummary() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [buildQuery])

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
      if (nextQS === currQS || urlSyncRef.current.last === nextQS){
        return
      }
      if (urlSyncRef.current.raf){
        cancelAnimationFrame(urlSyncRef.current.raf)
        urlSyncRef.current.raf = 0
      }
      urlSyncRef.current.raf = requestAnimationFrame(()=>{
        const path = location.pathname || '/manager/orders'
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
  
  // Helper to preserve scroll on dropdown changes
  const handleDriverChange = (orderId, value) => {
    const y = window.scrollY
    setEditingDriver(prev => ({...prev, [orderId]: value}))
    requestAnimationFrame(() => {
      window.scrollTo(0, y)
      setTimeout(() => window.scrollTo(0, y), 0)
    })
  }
  
  const handleStatusChange = (orderId, value) => {
    const y = window.scrollY
    setEditingStatus(prev => ({...prev, [orderId]: value}))
    requestAnimationFrame(() => {
      window.scrollTo(0, y)
      setTimeout(() => window.scrollTo(0, y), 0)
    })
  }
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
            const r = await apiPost(`/api/orders/${orderId}/assign-driver`, { driverId: drv })
            const updated = r?.order
            if (updated){
              setOrders(prev => prev.map(o => String(o._id) === String(orderId) ? updated : o))
            } else {
              await loadOrders(false)
            }
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
    function orderCountryCurrency(c){
      const raw = String(c||'').trim().toLowerCase()
      if (!raw) return 'SAR'
      if (raw==='ksa' || raw==='saudi arabia' || raw==='saudi' || raw.includes('saudi')) return 'SAR'
      if (raw==='uae' || raw==='united arab emirates' || raw==='ae' || raw.includes('united arab emirates')) return 'AED'
      if (raw==='oman' || raw==='om' || raw.includes('sultanate of oman')) return 'OMR'
      if (raw==='bahrain' || raw==='bh') return 'BHD'
      if (raw==='india' || raw==='in') return 'INR'
      if (raw==='kuwait' || raw==='kw' || raw==='kwt') return 'KWD'
      if (raw==='qatar' || raw==='qa') return 'QAR'
      return 'SAR'
    }
    function phoneCodeCurrency(code){
      const m = { '+966':'SAR', '+971':'AED', '+968':'OMR', '+973':'BHD', '+965':'KWD', '+974':'QAR', '+91':'INR' }
      return m[String(code||'').trim()] || null
    }
    function formatCurrency(n, cur){
      const v = Number(n||0)
      const s = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return `${cur} ${s}`
    }
    function countryToCurrency(c){
      const raw = String(c||'').trim().toLowerCase()
      if (!raw) return ''
      if (raw==='ksa' || raw==='saudi arabia' || raw==='saudi' || raw==='sa') return 'SAR'
      if (raw==='uae' || raw==='united arab emirates' || raw==='ae') return 'AED'
      if (raw==='oman' || raw==='om') return 'OMR'
      if (raw==='bahrain' || raw==='bh') return 'BHD'
      if (raw==='india' || raw==='in') return 'INR'
      if (raw==='kuwait' || raw==='kw' || raw==='kwt') return 'KWD'
      if (raw==='qatar' || raw==='qa') return 'QAR'
      return ''
    }
    const targetCode = orderCountryCurrency(o.orderCountry)
    const localCode = phoneCodeCurrency(o.phoneCountryCode) || targetCode
    let qty = 1
    if (o.items && Array.isArray(o.items) && o.items.length > 0){
      qty = o.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
    } else if (o.quantity != null){
      qty = Math.max(1, Number(o.quantity||1))
    }
    let itemsSubtotalConv = 0
    if (o.items && Array.isArray(o.items) && o.items.length > 0){
      for (const it of o.items){
        const q = Math.max(1, Number(it?.quantity||1))
        const unitRaw = (it?.productId?.price != null) ? Number(it.productId.price) : 0
        const fromCode = (it?.productId?.baseCurrency ? String(it.productId.baseCurrency).toUpperCase() : targetCode)
        const unitConv = convert(unitRaw, fromCode, targetCode, curCfg)
        itemsSubtotalConv += unitConv * q
      }
    } else {
      const unitRaw = (o?.productId?.price != null) ? Number(o.productId.price) : 0
      const fromCode = (o?.productId?.baseCurrency ? String(o.productId.baseCurrency).toUpperCase() : targetCode)
      const unitConv = convert(unitRaw, fromCode, targetCode, curCfg)
      itemsSubtotalConv = unitConv * qty
    }
    const shipLocal = Number(o.shippingFee||0)
    const discountLocal = Number(o.discount||0)
    const shipConv = convert(shipLocal, localCode, targetCode, curCfg)
    const discountConv = convert(discountLocal, localCode, targetCode, curCfg)
    const totalConv = Math.max(0, itemsSubtotalConv + shipConv - discountConv)
    
    // Check return submission status
    const status = String(o.shipmentStatus || '').toLowerCase()
    const isCancelledOrReturned = ['cancelled', 'returned'].includes(status)
    const isReturnSubmitted = o.returnSubmittedToCompany && !o.returnVerified
    const isReturnVerified = o.returnVerified
    
    return (
      <div className="card" style={{display:'grid', gap:12, border: isReturnSubmitted ? '2px solid #f59e0b' : undefined, background: isReturnSubmitted ? 'rgba(251, 146, 60, 0.05)' : undefined}}>
        <div className="card-header" style={{alignItems:'center', flexWrap:'wrap', gap:10}}>
          <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', flex:1}}>
            <div className="badge" style={{fontSize:14}}>{o.orderCountry || '-'}</div>
            <div className="chip" style={{background:'transparent', fontSize:14}}>{o.city || '-'}</div>
            <div>{statusBadge(o.shipmentStatus || o.status)}</div>
            {isReturnSubmitted && (
              <span className="badge" style={{background:'#fef3c7', color:'#92400e', border:'1px solid #fbbf24', fontWeight:700, animation:'pulse 2s infinite', fontSize:13}}>
                ⚠️ Awaiting Verification
              </span>
            )}
            {isReturnVerified && (
              <span className="badge" style={{background:'#d1fae5', color:'#065f46', border:'1px solid #10b981', fontWeight:700, fontSize:13}}>
                ✅ Return Verified
              </span>
            )}
            {driverName && (
              <div className="chip" style={{background:'var(--panel)', border:'1px solid var(--border)', fontSize:13}} title={driverName}>
                🚛 <strong style={{marginLeft:4}}>{driverName}</strong>
              </div>
            )}
          </div>
          <div style={{display:'flex', alignItems: isMobileView ? 'stretch' : 'center', gap:8, flexWrap:'wrap', flexDirection: isMobileView ? 'column' : 'row', width: isMobileView ? '100%' : undefined}}>
            {o.invoiceNumber ? <div style={{fontWeight:800, fontSize:16}}>#{o.invoiceNumber}</div> : null}
            <button 
              className="btn secondary" 
              onClick={()=> window.open(`/label/${id}`, '_blank', 'noopener,noreferrer')}
              style={{whiteSpace:'nowrap', padding:'8px 16px', width: isMobileView ? '100%' : 'auto'}}
            >
              🖨️ Print Label
            </button>
          </div>
        </div>
        <div className="section" style={{padding:'10px 12px 0', borderTop:'1px solid var(--border)'}}>
          <OrderStatusTrack order={o} />
        </div>
        <div className="section" style={{display:'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isMobileView ? 'min(100%, 280px)' : '250px'}, 1fr))`, gap:16}}>
          <div style={{display:'grid', gap:6}}>
            <div className="label" style={{display:'flex', alignItems:'center', gap:6}}>
              <span>👤</span> Customer
            </div>
            <div style={{fontWeight:700, fontSize:15}}>{o.customerName || '-'}</div>
            <div className="helper">{`${o.phoneCountryCode||''} ${o.customerPhone||''}`.trim()}</div>
            <div className="helper" title={fullAddress} style={{wordBreak:'break-word', lineHeight:1.4}}>
              {fullAddress || '-'}
            </div>
          </div>
          <div style={{display:'grid', gap:6}}>
            <div className="label" style={{display:'flex', alignItems:'center', gap:6}}>
              <span>📦</span> Product
            </div>
            <div style={{fontWeight:700, fontSize:15}}>
              {(() => {
                // Try productId
                if (o.productId?.name) return o.productId.name
                // Try items array
                if (o.items && Array.isArray(o.items) && o.items.length > 0) {
                  for (const item of o.items) {
                    if (item?.productId?.name) return item.productId.name
                  }
                }
                // Fallback: show ID if product data is missing
                const pid = o.productId?._id || o.productId
                if (pid) return `Product ID: ${String(pid).slice(-8)}`
                if (o.items && o.items.length > 0 && o.items[0]?.productId) {
                  const itemPid = o.items[0].productId._id || o.items[0].productId
                  if (itemPid) return `Product ID: ${String(itemPid).slice(-8)}`
                }
                return '-'
              })()}
            </div>
            <div className="helper">Qty: {qty}</div>
            <div className="helper" style={{fontSize:15, fontWeight:600, color:'var(--primary)'}}>
              Total: {targetCode} {totalConv.toFixed(2)}
            </div>
          </div>
          <div style={{display:'grid', gap:8, alignContent:'start'}}>
            <div className="label" style={{display:'flex', alignItems:'center', gap:6}}>
              <span>🚛</span> Assign Driver & Status
            </div>
            <select 
              className="input" 
              value={editingDriver[id] !== undefined ? editingDriver[id] : driverId} 
              onChange={(e)=> handleDriverChange(id, e.target.value)} 
              disabled={updating[`save-${id}`]}
              style={{fontSize:14}}
            >
              <option value="">-- Select Driver --</option>
              {countryDrivers.map(d => (
                <option key={String(d._id)} value={String(d._id)}>{`${d.firstName||''} ${d.lastName||''}${d.city? ' • '+d.city:''}`}</option>
              ))}
              {countryDrivers.length === 0 && <option disabled>No drivers in {o.orderCountry}</option>}
            </select>
            <select 
              className="input" 
              value={editingStatus[id] || (o.shipmentStatus || 'pending')} 
              onChange={(e)=> handleStatusChange(id, e.target.value)} 
              disabled={updating[`save-${id}`]}
              style={{fontSize:14}}
            >
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
              <button 
                className="btn success" 
                onClick={()=> saveOrder(id)} 
                disabled={updating[`save-${id}`]}
                style={{width:'100%', padding:'10px', fontWeight:600}}
              >
                💾 Save Changes
              </button>
            )}
          </div>
        </div>
        
        {/* Return Verification Action */}
        {isReturnSubmitted && (
          <div className="section" style={{padding:16, background:'#fef3c7', border:'1px solid #fbbf24', borderRadius:8, display:'grid', gap:12}}>
            <div>
              <div style={{fontWeight:700, color:'#92400e', marginBottom:6, fontSize:15}}>
                ⚠️ Driver has submitted this {status} order for verification
              </div>
              <div className="helper" style={{color:'#92400e'}}>
                📅 Submitted: {o.returnSubmittedAt ? new Date(o.returnSubmittedAt).toLocaleString() : '-'}
              </div>
              {o.returnReason && (
                <div className="helper" style={{color:'#92400e', marginTop:4}}>
                  ❓ Reason: {o.returnReason}
                </div>
              )}
            </div>
            <button 
              className="btn success"
              onClick={() => verifyReturn(o._id)}
              disabled={verifying === String(o._id)}
              style={{width:'100%', padding:'12px 20px', fontSize:15, fontWeight:600}}
            >
              {verifying === String(o._id) ? '⏳ Verifying...' : '✓ Accept & Verify'}
            </button>
          </div>
        )}
        
        <div className="section" style={{display:'flex', gap:12, alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', paddingTop:12, borderTop:'1px solid var(--border-light)'}}>
          <div className="helper" style={{display:'flex', alignItems:'center', gap:6}}>
            <span>👤</span> Created by: <strong>{(o.createdBy?.firstName||'') + ' ' + (o.createdBy?.lastName||'')}</strong>
          </div>
          <div className="helper" style={{display:'flex', alignItems:'center', gap:6}}>
            <span>📅</span> {o.createdAt ? new Date(o.createdAt).toLocaleString() : ''}
          </div>
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
          <div className="card-title">Filtered Summary</div>
        </div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8}}>
          <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
            <div className="helper">Total Orders</div>
            <div style={{fontWeight:900, fontSize:18}}>{summary?.totalOrders ?? '-'}</div>
          </div>
          <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
            <div className="helper">Total Qty</div>
            <div style={{fontWeight:900, fontSize:18}}>{summary?.totalQty ?? '-'}</div>
          </div>
          <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
            <div className="helper">Delivered (Orders)</div>
            <div style={{fontWeight:900, fontSize:18}}>{summary?.deliveredOrders ?? '-'}</div>
          </div>
          <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
            <div className="helper">Delivered (Qty)</div>
            <div style={{fontWeight:900, fontSize:18}}>{summary?.deliveredQty ?? '-'}</div>
          </div>
          {(()=>{
            const c = String(country||'').trim()
            const cur = c ? countryToCurrency(c) : ''
            const map = summary?.amountByCurrency || {}
            if (cur && map[cur] != null){
              return (
                <div className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                  <div className="helper">Amount ({cur})</div>
                  <div style={{fontWeight:900, fontSize:18}}>{formatCurrency(map[cur]||0, cur)}</div>
                </div>
              )
            }
            const order = ['AED','OMR','SAR','BHD','INR','KWD','QAR']
            return order.filter(k => Number((summary?.amountByCurrency||{})[k]||0) > 0).slice(0,7).map(k => (
              <div key={k} className="mini-card" style={{border:'1px solid var(--border)', borderRadius:10, padding:10}}>
                <div className="helper">Amount ({k})</div>
                <div style={{fontWeight:900, fontSize:18}}>{formatCurrency((summary?.amountByCurrency||{})[k]||0, k)}</div>
              </div>
            ))
          })()}
        </div>
      </div>
      <div className="card" style={{display:'grid', gap:12}}>
        <div className="card-header">
          <div className="card-title">🔍 Filters</div>
        </div>
        <div className="section" style={{display:'grid', gap:10}}>
          {/* Search Bar - Full Width */}
          <input 
            className="input" 
            placeholder="🔎 Search invoice, product, driver, agent, city, phone, details..." 
            value={q} 
            onChange={e=> setQ(e.target.value)}
            style={{fontSize:15, padding:'12px 16px'}}
          />
          
          {/* Location & Status Filters */}
          <div style={{display:'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isMobileView ? 140 : 180}px, 1fr))`, gap:8}}>
            <select className="input" value={country} onChange={e=> { setCountry(e.target.value); setDriverFilter('') }}>
              <option value=''>📍 All Countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input" value={city} onChange={e=> setCity(e.target.value)}>
              <option value=''>🏙️ All Cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input" value={ship} onChange={e=> setShip(e.target.value)}>
              <option value="">📦 All Statuses</option>
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
          </div>
          
          {/* Quick Filters - Checkboxes */}
          <div style={{display:'flex', gap:12, flexWrap:'wrap', padding:'8px 0'}}>
            <label className="input" style={{display:'flex', gap:8, alignItems:'center', padding:'8px 12px', minWidth:'auto', cursor:'pointer'}}>
              <input type="checkbox" checked={onlyUnassigned} onChange={e=>{ const v=e.target.checked; setOnlyUnassigned(v); if (v) setOnlyAssigned(false) }} />
              <span style={{whiteSpace:'nowrap'}}>📋 Unassigned only</span>
            </label>
            <label className="input" style={{display:'flex', gap:8, alignItems:'center', padding:'8px 12px', minWidth:'auto', cursor:'pointer'}}>
              <input type="checkbox" checked={onlyAssigned} onChange={e=>{ const v=e.target.checked; setOnlyAssigned(v); if (v) setOnlyUnassigned(false) }} />
              <span style={{whiteSpace:'nowrap'}}>✅ Assigned only</span>
            </label>
          </div>
          
          {/* Advanced Filters */}
          <div style={{display:'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isMobileView ? 160 : 200}px, 1fr))`, gap:8}}>
            <select className="input" value={agentFilter} onChange={e=> setAgentFilter(e.target.value)}>
              <option value=''>👥 All Agents</option>
              {agentOptions.map(a => (
                <option key={String(a._id)} value={String(a._id)}>{`${a.firstName||''} ${a.lastName||''} (${a.email||''})`}</option>
              ))}
            </select>
            <select className="input" value={driverFilter} onChange={e=> setDriverFilter(e.target.value)} disabled={!country}>
              <option value=''>{country? `🚛 All Drivers in ${country}` : '🚛 Select Country to filter Drivers'}</option>
              {(driversByCountry[country] || []).map(d => (
                <option key={String(d._id)} value={String(d._id)}>{`${d.firstName||''} ${d.lastName||''}${d.city? ' • '+d.city:''}`}</option>
              ))}
            </select>
            <button className="btn primary" onClick={exportCsv} style={{whiteSpace:'nowrap'}}>📥 Export CSV</button>
          </div>
        </div>
      </div>

      {/* Pending Returns Verification Section */}
      {pendingReturns.length > 0 && (
        <div className="card" style={{border:'2px solid #ef4444', background:'rgba(239, 68, 68, 0.05)', marginTop:12}}>
          <div className="card-header">
            <div className="card-title" style={{color:'#ef4444'}}>
              ⚠️ Cancelled/Returned Orders to Verify ({pendingReturns.length})
            </div>
          </div>
          <div style={{display:'grid', gap:10}}>
            {pendingReturns.map(order => {
              const isVerifying = verifying === String(order._id)
              const status = String(order.shipmentStatus || '').toLowerCase()
              const driverName = order.deliveryBoy 
                ? `${order.deliveryBoy.firstName || ''} ${order.deliveryBoy.lastName || ''}`.trim() || '-'
                : '-'
              
              return (
                <div key={order._id} className="panel" style={{display:'grid', gap:12, padding:16, border:'1px solid #fca5a5', borderRadius:8, background:'white'}}>
                  {/* Header with Invoice and Status */}
                  <div style={{display:'flex', flexWrap:'wrap', alignItems:'center', gap:8}}>
                    <div style={{fontWeight:800, fontSize:16}}>
                      #{order.invoiceNumber || String(order._id).slice(-6)}
                    </div>
                    <span className="badge" style={{background:'#fee2e2', color:'#991b1b', textTransform:'capitalize'}}>
                      {status}
                    </span>
                    {order.orderCountry && <span className="badge">{order.orderCountry}</span>}
                    {order.city && <span className="chip">{order.city}</span>}
                  </div>
                  
                  {/* Order Details */}
                  <div style={{display:'grid', gap:6, fontSize:14}}>
                    <div className="helper">
                      <strong>👤 Customer:</strong> {order.customerName || '-'} • {order.customerPhone || '-'}
                    </div>
                    <div className="helper" style={{wordBreak:'break-word'}}>
                      <strong>📍 Address:</strong> {order.customerAddress || order.customerLocation || '-'}
                    </div>
                    {order.returnReason && (
                      <div className="helper">
                        <strong>❓ Reason:</strong> {order.returnReason}
                      </div>
                    )}
                    <div className="helper">
                      <strong>🚛 Driver:</strong> {driverName}
                    </div>
                    <div className="helper" style={{color:'#f59e0b'}}>
                      <strong>📅 Submitted:</strong> {order.returnSubmittedAt ? new Date(order.returnSubmittedAt).toLocaleString() : '-'}
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <button 
                    className="btn success"
                    onClick={() => verifyReturn(order._id)}
                    disabled={isVerifying}
                    style={{width:'100%', padding:'12px 20px', fontSize:15, fontWeight:600}}
                  >
                    {isVerifying ? '⏳ Verifying...' : '✓ Accept & Verify'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
