import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { apiGet, apiPost, API_BASE } from '../../api'
import { io } from 'socket.io-client'

export default function SubmitOrder(){
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(()=> (typeof window!=='undefined' ? window.innerWidth <= 768 : false))
  const COUNTRY_OPTS = [
    { key:'UAE', name:'UAE', code:'+971', flag:'🇦🇪' },
    { key:'OM', name:'Oman', code:'+968', flag:'🇴🇲' },
    { key:'KSA', name:'KSA', code:'+966', flag:'🇸🇦' },
    { key:'BH', name:'Bahrain', code:'+973', flag:'🇧🇭' },
    { key:'IN', name:'India', code:'+91', flag:'🇮🇳' },
    { key:'KW', name:'Kuwait', code:'+965', flag:'🇰🇼' },
    { key:'QA', name:'Qatar', code:'+974', flag:'🇶🇦' },
  ]
  const DEFAULT_COUNTRY = COUNTRY_OPTS[2] // KSA
  const [form, setForm] = useState({ 
    customerName:'', 
    customerPhone:'', 
    phoneCountryCode: DEFAULT_COUNTRY.code, 
    orderCountry: DEFAULT_COUNTRY.name, 
    city:'', 
    customerArea:'',
    customerAddress:'', 
    locationLat:'', 
    locationLng:'', 
    customerLocation:'', 
    details:'', 
    productId:'', 
    quantity: 1, 
    total: '', 
    discount:'', 
    shipping:'', 
    preferredTiming: '', // New field for timing
    // Additional phone (optional)
    additionalPhoneEnabled: false,
    additionalPhone: '',
    additionalPhonePref: 'both' // whatsapp|calling|both
  })
  const [customerInfo, setCustomerInfo] = useState({ name:'', fullPhone:'' })
  const [originMsisdn, setOriginMsisdn] = useState(null) // digits including country code, from jid
  const [coordsInput, setCoordsInput] = useState('')
  const [locationValidation, setLocationValidation] = useState({ isValid: true, message: '' }) // New validation state
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')
  const [addrLocked, setAddrLocked] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [me, setMe] = useState(null)
  const [meLoaded, setMeLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [rows, setRows] = useState([])
  const [statusFilter, setStatusFilter] = useState('all') // all|pending|shipped|delivered|returned
  const [loadingList, setLoadingList] = useState(false)
  const [products, setProducts] = useState([])
  // Multi-item order support (at least one product is required)
  const [items, setItems] = useState([{ productId:'', quantity: 1, searchText: '', showDropdown: false }]) // [{ productId, quantity, searchText, showDropdown }]

  const COUNTRY_CITIES = useMemo(()=>({
    UAE: ['Abu Dhabi','Dubai','Sharjah','Ajman','Umm Al Quwain','Ras Al Khaimah','Fujairah','Al Ain','Madinat Zayed','Ruways','Liwa','Kalba','Khor Fakkan','Dibba Al-Fujairah','Dibba Al-Hisn'],
    OM: ['Muscat','Muttrah','Bawshar','Aseeb','Seeb','Qurayyat','Nizwa','Sohar','Sur','Ibri','Rustaq','Buraimi','Salalah','Khasab','Ibra','Sinaw','Jalan Bani Bu Ali','Jalan Bani Bu Hasan'],
    KSA: ['Riyadh','Jeddah','Makkah','Madinah','Dammam','Khobar','Dhahran','Taif','Tabuk','Abha','Khamis Mushait','Jizan','Najran','Hail','Buraydah','Unaizah','Qatif','Al Ahsa','Jubail','Yanbu','Al Bahah','Arar','Sakaka','Hafar Al Batin','Al Majmaah','Al Kharj','Al Qurayyat','Rafha'],
    BH: ['Manama','Riffa','Muharraq','Hamad Town','Aali','Isa Town','Sitra','Budaiya','Jidhafs','Sanad','Tubli','Zallaq'],
    IN: [],
    KW: [],
    QA: [],
  }),[])
  // City aliases per country (lowercase -> canonical name)
  const CITY_ALIASES = useMemo(()=>({
    UAE: {
      'zayed city': 'Madinat Zayed',
      'madinat zayed': 'Madinat Zayed',
      'ar ruways': 'Ruways',
      'ruwais': 'Ruways',
      'al ain city': 'Al Ain',
      'abu dhabi city': 'Abu Dhabi',
    },
  }),[])
  const canonicalizeCity = (countryKey, name) => {
    try{
      const map = CITY_ALIASES[countryKey] || {}
      const key = String(name||'').trim().toLowerCase()
      return map[key] || name
    }catch{ return name }
  }
  const currentCountryKey = useMemo(()=>{
    const byName = COUNTRY_OPTS.find(c=>c.name===form.orderCountry)
    if (byName) return byName.key
    // fallback from code
    const byCode = COUNTRY_OPTS.find(c=>c.code===form.phoneCountryCode)
    return byCode?.key || 'KSA'
  },[form.orderCountry, form.phoneCountryCode])
  const cities = COUNTRY_CITIES[currentCountryKey] || []

  useEffect(()=>{
    function onResize(){ setIsMobile(window.innerWidth <= 768) }
    window.addEventListener('resize', onResize)
    return ()=> window.removeEventListener('resize', onResize)
  },[])

  function onChange(e){
    const { name, value } = e.target
    if (name === 'orderCountry'){
      const opt = COUNTRY_OPTS.find(o=>o.name===value)
      // Keep phone code in sync with selected country name. Reset city/area when country changes.
      setForm(f => ({
        ...f,
        orderCountry: value,
        phoneCountryCode: opt?.code || f.phoneCountryCode,
        // Clear address-related fields but keep coordinates for auto re-resolve
        city: '',
        customerArea:'',
        customerAddress:'',
        locationLat:'',
        locationLng:'',
        customerLocation:'',
        productId:'',
        quantity: 1,
        total: '',
        discount:'',
        shipping:'',
        customerName: ''
      }))
      // Reset product items list
      try{ setItems([]) }catch{}
      // Clear any previous location validation tied to old country
      setLocationValidation({ isValid: true, message: '' })
      // Clear typed coordinate input to require a fresh Resolve for the new country
      setCoordsInput('')
      return
    }
    if (name === 'city'){
      setLocationValidation({ isValid: true, message: '' })
    }
    if (['city','customerArea','customerAddress'].includes(name)){
      setFieldErrors(prev => ({ ...prev, [name]: false }))
    }
    setForm(f => ({ ...f, [name]: value }))
  }

  // Keep combined coordinates input in sync when form coordinates change elsewhere
  useEffect(()=>{
    if (form.locationLat && form.locationLng){
      setCoordsInput(`${form.locationLat}, ${form.locationLng}`)
    } else {
      setCoordsInput('')
    }
  }, [form.locationLat, form.locationLng])

  // Decode Plus Code (Open Location Code) to coordinates
  function decodePlusCode(code) {
    const ALPHABET = '23456789CFGHJMPQRVWX'
    const PAIR_CODE_LENGTH = 10
    const SEPARATOR = '+'
    const SEPARATOR_POSITION = 8
    const GRID_COLUMNS = 4
    const GRID_ROWS = 5
    
    try {
      code = code.toUpperCase().replace(/\s/g, '')
      
      // Remove separator
      const sepIndex = code.indexOf(SEPARATOR)
      if (sepIndex === -1 || sepIndex > SEPARATOR_POSITION) return null
      
      const cleanCode = code.replace(SEPARATOR, '')
      
      // Decode pair section
      let lat = 0, lng = 0
      let latPlaceValue = 400, lngPlaceValue = 400 // Starting from 20 degrees per pair (400 = 20 * 20)
      
      for (let i = 0; i < Math.min(PAIR_CODE_LENGTH, cleanCode.length); i += 2) {
        if (i >= cleanCode.length) break
        
        const latChar = cleanCode[i]
        const lngChar = cleanCode[i + 1]
        
        const latValue = ALPHABET.indexOf(latChar)
        const lngValue = ALPHABET.indexOf(lngChar)
        
        if (latValue === -1 || lngValue === -1) return null
        
        latPlaceValue /= 20
        lngPlaceValue /= 20
        
        lat += latValue * latPlaceValue
        lng += lngValue * lngPlaceValue
      }
      
      // Adjust to center of grid
      lat = lat - 90 + latPlaceValue / 2
      lng = lng - 180 + lngPlaceValue / 2
      
      return { lat, lng }
    } catch {
      return null
    }
  }

  async function parseAndSetCoords(raw){
    const s = String(raw||'').trim()
    setCoordsInput(s)
    if (!s) return

    try {
      setResolveError('')
      setResolving(true)
      // Call backend geocoding service to decode; defer filling address until validated
      const result = await apiPost('/api/geocode/whatsapp', { locationCode: s })
      
      if (result.success) {
        // Only set coordinates, then run reverse/validation flow
        setForm(f => ({ ...f, locationLat: result.lat, locationLng: result.lng }))
        await resolveFromCoords(result.lat, result.lng)
        return
      } else {
        // Handle specific error messages
        if (result.error?.includes('not configured')) {
          setLocationValidation({ isValid: false, message: 'Please configure Google Maps API in Settings (Admin panel)' })
        } else if (result.error?.includes('not found')) {
          setLocationValidation({ isValid: false, message: 'Location not found. Please check the WhatsApp location code.' })
        } else {
          setLocationValidation({ isValid: false, message: result.error || 'Failed to resolve location' })
        }
        setResolveError('Failed to decode WhatsApp location')
      }
    } catch (err) {
      console.error('Error resolving WhatsApp location:', err)
      setLocationValidation({ isValid: false, message: 'Network error. Please try again.' })
      setResolveError('Network error while decoding WhatsApp location')
    } finally {
      setResolving(false)
    }
  }

  // Prefill from query params (?jid=...&name=...)
  useEffect(()=>{
    try{
      const params = new URLSearchParams(location.search || '')
      const jid = (params.get('jid')||'').trim()
      const name = (params.get('name')||'').trim()
      if (!jid) return
      // Extract digits (MSISDN) before @
      const msisdn = jid.replace(/@.*/, '')
      const digits = msisdn.replace(/\D/g, '')
      // Country inference by prefix
      const ccList = [
        { cc:'971', opt: COUNTRY_OPTS.find(o=>o.key==='UAE') },
        { cc:'968', opt: COUNTRY_OPTS.find(o=>o.key==='OM') },
        { cc:'966', opt: COUNTRY_OPTS.find(o=>o.key==='KSA') },
        { cc:'973', opt: COUNTRY_OPTS.find(o=>o.key==='BH') },
        { cc:'965', opt: COUNTRY_OPTS.find(o=>o.key==='KW') },
        { cc:'974', opt: COUNTRY_OPTS.find(o=>o.key==='QA') },
        { cc:'91',  opt: COUNTRY_OPTS.find(o=>o.key==='IN') },
      ]
      const matched = ccList.find(x => digits.startsWith(x.cc))
      const country = matched?.opt || DEFAULT_COUNTRY
      const local = matched ? digits.slice(matched.cc.length) : digits
      setForm(f => ({
        ...f,
        phoneCountryCode: country.code,
        orderCountry: country.name,
        city: '',
        customerArea: '',
        customerPhone: local,
      }))
      setCustomerInfo({ name, fullPhone: `${country.code} ${local}`.trim() })
      setOriginMsisdn(digits)
    }catch{}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  // Load current user for agent banner
  useEffect(()=>{
    (async ()=>{
      try{ const { user } = await apiGet('/api/users/me'); setMe(user) }
      catch(_){ setMe(null) }
      finally{ setMeLoaded(true) }
    })()
  },[])

  // Allow agents and users by default; managers require explicit permission
  const canCreateOrder = (
    !meLoaded
      ? true
      : !!(me && (me.role !== 'manager' || (me.managerPermissions && me.managerPermissions.canCreateOrders)))
  )

  async function load(){
    setLoadingList(true)
    try{
      const data = await apiGet('/api/orders')
      setRows(data.orders||[])
    }catch(_){}
    finally{ setLoadingList(false) }
  }

  async function loadProducts(){
    try{
      const data = await apiGet('/api/products')
      setProducts(data.products||[])
    }catch(_){}
  }

  async function sendInvoice(order){
    try{
      setMsg('Sending invoice...')
      await apiPost(`/api/orders/${order._id}/send-invoice`, {})
      setMsg(`✅ Invoice sent to ${order.customerPhone || 'customer'}`)
      setTimeout(() => setMsg(''), 3000)
    }catch(err){
      setMsg(`❌ Failed to send invoice: ${err?.message || 'Unknown error'}`)
      setTimeout(() => setMsg(''), 5000)
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

  useEffect(()=>{ load(); loadProducts() },[])

  // Ensure at least one product row remains
  useEffect(()=>{
    if (!Array.isArray(items) || items.length === 0){
      setItems([{ productId:'', quantity: 1 }])
    }
  }, [items])

  // Live refresh on workspace order changes
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, auth: { token }, withCredentials: true })
      const refresh = ()=>{ load() }
      socket.on('orders.changed', refresh)
    }catch{}
    return ()=>{
      try{ socket && socket.off('orders.changed') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[])

  // Order number is generated by the server; no client-side invoice number

  // Currency conversion via SAR (approximate)
  const SAR_TO = { SAR: 1, AED: 0.98, OMR: 0.10, BHD: 0.10, QAR: 0.97, KWD: 0.082, INR: 22.0 }
  const TO_SAR = { SAR: 1, AED: 1.02, OMR: 9.8,  BHD: 10.0, QAR: 1.03, KWD: 12.2, INR: 0.045 }
  function convertPrice(value, from, to){
    const v = Number(value||0)
    if (!from || !to || from === to) return v
    const inSar = v * (TO_SAR[from] || 1)
    return inSar * (SAR_TO[to] || 1)
  }
  const PHONE_CODE_TO_CCY = { '+966':'SAR', '+971':'AED', '+968':'OMR', '+973':'BHD', '+965':'KWD', '+974':'QAR', '+91':'INR' }
  const PHONE_CODE_TO_COUNTRYKEY = { '+966':'KSA', '+971':'UAE', '+968':'OM', '+973':'BH' }
  const selectedCurrency = PHONE_CODE_TO_CCY[form.phoneCountryCode] || 'SAR'
  // Pricing with multiple items
  const itemsDetailed = useMemo(() => {
    try{
      return (items || []).map((it, idx) => {
        const p = products.find(pp => String(pp._id) === String(it.productId)) || null
        const base = p?.baseCurrency || 'SAR'
        const unit = convertPrice(Number(p?.price || 0), base, selectedCurrency)
        const qty = Math.max(1, Number(it?.quantity||1))
        const amount = unit * qty
        return { idx, product: p, unit, qty, amount }
      })
    }catch{ return [] }
  }, [items, products, selectedCurrency])
  const subtotal = useMemo(() => itemsDetailed.reduce((s, r) => s + (r.amount||0), 0), [itemsDetailed])
  const shippingNum = useMemo(() => Math.max(0, Number(form.shipping||0)), [form.shipping])
  const discountNum = useMemo(() => Math.max(0, Number(form.discount||0)), [form.discount])
  const computedTotal = useMemo(() => Math.max(0, subtotal + shippingNum - discountNum), [subtotal, shippingNum, discountNum])

  // Auto-update total whenever items/shipping/discount change
  useEffect(() => {
    setForm(f => ({ ...f, total: computedTotal.toFixed(2) }))
  }, [computedTotal])

  async function onSubmit(e){
    e.preventDefault()
    setMsg('')
    
    // Check location validation before submitting
    if (locationValidation && !locationValidation.isValid) {
      setMsg(locationValidation.message || 'Invalid address. Please resolve a valid location.')
      return
    }
    
    setLoading(true)
    try{
      // Validate at least one product selected
      const validItems = (items||[]).filter(it => it && it.productId)
      const missing = []
      if (!String(form.customerAddress||'').trim()) missing.push('customerAddress')
      if (!String(form.city||'').trim()) missing.push('city')
      if (!String(form.customerArea||'').trim()) missing.push('customerArea')
      if (!validItems.length) missing.push('items')
      if (missing.length){
        const flags = {}
        if (missing.includes('customerAddress')) flags.customerAddress = true
        if (missing.includes('city')) flags.city = true
        if (missing.includes('customerArea')) flags.customerArea = true
        setFieldErrors(prev => ({ ...prev, ...flags }))
        setLoading(false)
        setMsg(`Please fill required fields: ${missing.filter(x=>x!=='items').map(x=> x==='customerAddress'?'Address':(x==='customerArea'?'Area':x)).join(', ') || 'fields'}`)
        return
      }
      // Ensure we send a readable customerLocation even if using geolocation
      const locString = (form.locationLat && form.locationLng)
        ? `(${Number(form.locationLat).toFixed(6)}, ${Number(form.locationLng).toFixed(6)})`
        : (form.customerLocation || form.customerAddress || form.city || form.orderCountry)
      // Backward compatibility: also send productId/quantity from first item if present
      const firstValid = validItems[0]
      const first = firstValid ? { productId: firstValid.productId, quantity: Math.max(1, Number(firstValid.quantity||1)) } : { productId: form.productId, quantity: Number(form.quantity||1) }
      await apiPost('/api/orders', { 
        ...form, 
        ...first,
        items: validItems,
        customerLocation: locString, 
        preferredTiming: form.preferredTiming,
        // Only send additional phone if enabled
        ...(form.additionalPhoneEnabled ? { additionalPhone: form.additionalPhone, additionalPhonePref: form.additionalPhonePref } : {})
      })
      setMsg('Order submitted')
        setForm({ 
        customerName:'', 
        customerPhone:'', 
        phoneCountryCode: DEFAULT_COUNTRY.code, 
        orderCountry: DEFAULT_COUNTRY.name, 
        city:'', 
        customerArea:'', 
        customerArea:'',
        customerAddress:'', 
        locationLat:'', 
        locationLng:'', 
        customerLocation:'', 
        details:'', 
        productId:'', 
        quantity: 1, 
        total: '', 
        discount:'', 
        shipping:'', 
        preferredTiming: '', // Reset timing
        additionalPhoneEnabled: false,
        additionalPhone: '',
        additionalPhonePref: 'both'
      })
      setItems([])
      setLocationValidation({ isValid: true, message: '' }) // Reset validation
      load()
    }catch(err){
      setMsg(err?.message || 'Failed to submit order')
    }finally{
      setLoading(false)
    }
  }

  function fmtDate(s){ try{ return new Date(s).toLocaleString() }catch{ return ''} }
  function timeAgo(s){
    try{
      const d = new Date(s).getTime(); const now = Date.now(); const diff = Math.max(0, Math.floor((now-d)/1000))
      const mins = Math.floor(diff/60), hrs = Math.floor(mins/60), days = Math.floor(hrs/24)
      if (diff < 60) return `${diff}s ago`
      if (mins < 60) return `${mins}m ago`
      if (hrs < 24) return `${hrs}h ago`
      return `${days}d ago`
    }catch{ return '' }
  }
  function statusBadge(st){
    const v = String(st||'pending').toLowerCase()
    const map = {
      pending: {bg:'#1f2937', bd:'#334155', fg:'#e5e7eb', label:'pending'},
      shipped: {bg:'#0f3f33', bd:'#065f46', fg:'#c7f9ec', label:'shipped'},
      delivered: {bg:'#102a43', bd:'#1f4a6e', fg:'#bee3f8', label:'delivered'},
      returned: {bg:'#3b0d0d', bd:'#7f1d1d', fg:'#fecaca', label:'returned'},
      cancelled: {bg:'#3f1d1d', bd:'#7f1d1d', fg:'#fecaca', label:'cancelled'},
    }
    const c = map[v] || map.pending
    return <span className="badge" style={{background:c.bg, border:`1px solid ${c.bd}`, color:c.fg}}>{c.label}</span>
  }

  function derivedStatus(o){
    const ship = String(o?.shipmentStatus||'').toLowerCase()
    if (['delivered','returned','cancelled'].includes(ship)) return ship
    const st = String(o?.status||'pending').toLowerCase()
    return st
  }

  // Pricing helpers for recent list
  function orderQty(o){ return Math.max(1, Number(o?.quantity||1)) }
  function unitPriceOf(o){ return (o?.productId?.price != null) ? Number(o.productId.price) : 0 }
  function totalPriceOf(o){ return (o?.total != null) ? Number(o.total) : (unitPriceOf(o) * orderQty(o)) }
  function currencyOf(o){ return o?.productId?.baseCurrency || 'SAR' }

  const filteredRows = rows.filter(o => {
    if (statusFilter === 'all') return true
    return derivedStatus(o) === statusFilter
  })

  function useCurrentLocation(){
    if (!navigator.geolocation){
      alert('Geolocation is not supported by this browser')
      return
    }
    navigator.geolocation.getCurrentPosition(async (pos)=>{
      const { latitude, longitude } = pos.coords || {}
      setForm(f=> ({ ...f, locationLat: latitude, locationLng: longitude, customerLocation: `(${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)})` }))
      // Try reverse geocoding to resolve address
      try { await resolveFromCoords(latitude, longitude) } catch(_){ }
    }, (err)=>{
      alert('Failed to get location: ' + (err?.message||'Unknown error'))
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
  }

  async function resolveFromCoords(lat, lng){
    if (!lat || !lng) return
    try{
      // Try Google Maps API first (if available)
      try {
        const settingsRes = await apiGet('/api/settings/ai')
        const googleMapsApiKey = settingsRes?.googleMapsApiKey
        
        if (googleMapsApiKey && !googleMapsApiKey.includes('••••')) {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&language=en&key=${encodeURIComponent(googleMapsApiKey)}`
          const res = await fetch(url)
          if (res.ok) {
            const data = await res.json()
            if (data.status === 'OK' && data.results && data.results.length > 0) {
              const result = data.results[0]
              const display = result.formatted_address || ''
              
              // Extract city, area, and country from address components
              let cityGuess = ''
              let areaGuess = ''
              let countryISO = ''
              
              for (const component of result.address_components || []) {
                if (component.types.includes('locality')) {
                  cityGuess = component.long_name
                } else if (component.types.includes('sublocality') || component.types.includes('sublocality_level_1')) {
                  areaGuess = component.long_name
                } else if (!areaGuess && component.types.includes('neighborhood')) {
                  areaGuess = component.long_name
                } else if (component.types.includes('country')) {
                  countryISO = component.short_name // e.g., "AE", "SA"
                }
              }
              
              // Validate country matches the selected order country (primary UI rule)
              if (form.orderCountry && countryISO) {
                const nameToISO = { 'UAE':'AE', 'Oman':'OM', 'KSA':'SA', 'Bahrain':'BH', 'Qatar':'QA', 'Kuwait':'KW', 'India':'IN' }
                const expectedISO = nameToISO[form.orderCountry]
                if (expectedISO && expectedISO !== countryISO){
                  setLocationValidation({ isValid: false, message: 'WhatsApp location is out of country' })
                  return // do not fill address/city/area
                }
              }

              // Canonicalize city label for display
              const cityCanon = canonicalizeCity(currentCountryKey, cityGuess)

              // Passed validation: fill fields
              setLocationValidation({ isValid: true, message: '' })
              setForm(f=> ({ 
                ...f, 
                customerAddress: display || f.customerAddress || `(${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)})`, 
                city: cityCanon || cityGuess || f.city || 'Nearest Area',
                customerArea: areaGuess || f.customerArea || (cityCanon || cityGuess) || 'Nearby',
              }))
              setAddrLocked(true)
              return
            }
          }
        }
      } catch {}
      
      // Fallback to Nominatim if Google Maps not configured
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`
      const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'OrderApp/1.0' } })
      if (!res.ok) throw new Error('Failed to resolve address')
      const data = await res.json()
      const display = data?.display_name || ''
      const addr = data?.address || {}
      // Separate City and Area from reverse geocoding
      const cityGuess = addr.city || addr.town || addr.village || addr.county || ''
      const cityCanon = canonicalizeCity(currentCountryKey, cityGuess)
      const areaGuess = addr.suburb || addr.neighbourhood || addr.district || addr.quarter || addr.residential || addr.borough || ''

      // Country validation for Nominatim as well (addr.country_code is ISO alpha-2 lowercased)
      try{
        const countryISO = String(addr.country_code||'').toUpperCase()
        if (form.orderCountry && countryISO){
          const nameToISO = { 'UAE':'AE', 'Oman':'OM', 'KSA':'SA', 'Bahrain':'BH', 'Qatar':'QA', 'Kuwait':'KW', 'India':'IN' }
          const expectedISO = nameToISO[form.orderCountry]
          if (expectedISO && expectedISO !== countryISO){
            setLocationValidation({ isValid: false, message: 'WhatsApp location is out of country' })
            return // do not fill address/city/area
          }
        }
      }catch{}
      
      // No city list validation on resolve; only country check above
      
      // Passed validation: fill fields
      setForm(f=> ({ 
        ...f, 
        customerAddress: display || f.customerAddress || `(${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)})`, 
        city: cityCanon || cityGuess || f.city || 'Nearest Area',
        customerArea: areaGuess || f.customerArea || 'Nearby',
      }))
      setAddrLocked(true)
    }catch(err){ 
      setLocationValidation({ isValid: false, message: 'Failed to validate location' })
      setResolveError('Failed to resolve address')
    }
    finally{ setResolving(false) }
  }

  // Preferred timing options (hourly)
  const timingOptions = [
    { value: '9am', label: '9 AM' },
    { value: '10am', label: '10 AM' },
    { value: '11am', label: '11 AM' },
    { value: '12pm', label: '12 PM' },
    { value: '1pm', label: '1 PM' },
    { value: '2pm', label: '2 PM' },
    { value: '3pm', label: '3 PM' },
    { value: '4pm', label: '4 PM' },
    { value: '5pm', label: '5 PM' },
    { value: '6pm', label: '6 PM' },
    { value: '7pm', label: '7 PM' },
    { value: '8pm', label: '8 PM' }
  ]

  // Filter products based on search for specific item (minimum 3 characters)
  function getFilteredProducts(searchText) {
    if (!searchText || searchText.length < 3) {
      return [] // Don't show any products until minimum 3 characters
    }
    const searchLower = searchText.toLowerCase().trim()
    return products.filter(p => 
      p.name?.toLowerCase().includes(searchLower) ||
      p.sku?.toLowerCase().includes(searchLower)
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-purple">Submit Order</div>
          <div className="page-subtitle">Create a new order for a customer</div>
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:12}}>
        {(customerInfo.name || customerInfo.fullPhone) && (
          <div style={{display:'flex', gap:12, alignItems:'center', padding:'8px 10px', background:'var(--panel-2)', border:'1px solid var(--border)', borderRadius:8}}>
            <div style={{fontWeight:600}}>Customer:</div>
            {/* Show only once: prefer name if available, else phone */}
            <div>{customerInfo.name ? customerInfo.name : (customerInfo.fullPhone || '')}</div>
          </div>
        )}
        {String(location.pathname||'').startsWith('/agent') && me && (
          <div style={{display:'flex', gap:12, alignItems:'center', padding:'8px 10px', background:'var(--panel-2)', border:'1px solid var(--border)', borderRadius:8}}>
            <div style={{fontWeight:600}}>Agent:</div>
            <div>{me.firstName} {me.lastName}</div>
          </div>
        )}
        {/* Show warning only for managers without permission, after user info is loaded */}
        {meLoaded && me && me.role === 'manager' && !canCreateOrder && (
          <div className="helper" style={{padding:'8px 10px', background:'var(--panel-2)', border:'1px solid var(--border)', borderRadius:8}}>
            Your manager account does not have permission to create orders. Please contact the owner to enable "Can create orders".
          </div>
        )}
        <form onSubmit={onSubmit} style={{display:'grid'}}>
          <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap:16, alignItems:'start'}}>
            {/* Left column: form fields */}
            <div style={{display:'grid', gap:12, opacity: canCreateOrder ? 1 : 0.6, pointerEvents: canCreateOrder ? 'auto' : 'none'}}>
              <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap:12}}>
                <div>
                  <div className="label">Country</div>
                  <select className="input" name="orderCountry" value={form.orderCountry} onChange={onChange} required disabled={!!originMsisdn}>
                    {COUNTRY_OPTS.map(opt => (
                      <option key={opt.key} value={opt.name}>{`${opt.flag} ${opt.name}`}</option>
                    ))}
                  </select>
                  <div className="helper" style={{fontSize:12, opacity:0.8, marginTop:4}}>Dial code: {form.phoneCountryCode}</div>
                </div>
                <div>
                  <div className="label">City</div>
                  <input className="input" name="city" value={form.city} onChange={onChange} placeholder="Type city" readOnly={addrLocked} style={{ borderColor: fieldErrors.city? '#ef4444': undefined }} />
                  <div style={{fontSize:12, opacity:0.8, marginTop:4}}>Country: {form.orderCountry}</div>
                </div>
                <div>
                  <div className="label">Area</div>
                  <input className="input" name="customerArea" value={form.customerArea} onChange={onChange} placeholder="Type area" readOnly={addrLocked} style={{ borderColor: fieldErrors.customerArea? '#ef4444': undefined }} />
                  <div className="helper" style={{fontSize:12, opacity:0.8, marginTop:4}}>You can edit if needed</div>
                </div>
              </div>

              {/* Customer Name (optional) and Phone */}
              <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:12}}>
                <div>
                  <div className="label">Customer Name (optional)</div>
                  <input className="input" name="customerName" value={form.customerName} onChange={onChange} placeholder="Leave empty to auto-name as customer {invoice}" />
                </div>
                <div>
                  <div className="label">Customer Phone</div>
                  <input className="input" name="customerPhone" value={form.customerPhone} onChange={onChange} required readOnly={!!originMsisdn} />
                  {!!originMsisdn && (
                    <div className="helper" style={{fontSize:12, opacity:0.8, marginTop:4}}>Must match WhatsApp sender: {customerInfo.fullPhone}</div>
                  )}
                </div>
              </div>

              {/* Optional Additional Phone */}
              <div style={{display:'grid', gap:8}}>
                <label style={{display:'flex', alignItems:'center', gap:8}}>
                  <input type="checkbox" checked={!!form.additionalPhoneEnabled} onChange={(e)=> setForm(f=> ({...f, additionalPhoneEnabled: e.target.checked}))} />
                  <span>Add another phone (optional)</span>
                </label>
                {form.additionalPhoneEnabled && (
                  <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 220px', gap:12}}>
                    <input className="input" name="additionalPhone" value={form.additionalPhone} onChange={onChange} placeholder="Additional phone number" />
                    <select className="input" name="additionalPhonePref" value={form.additionalPhonePref} onChange={onChange}>
                      <option value="whatsapp">Whatsapp</option>
                      <option value="calling">Calling</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Products list */}
              <div style={{ display:'grid', gap:10 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <div className="label">Products</div>
                  <button type="button" className="btn secondary" aria-label="Add product" title="Add product" onClick={()=> setItems(prev => [...prev, { productId:'', quantity: 1, searchText: '', showDropdown: false }])}>＋</button>
                </div>
                
                {(items.length === 0) && (
                  <div className="helper">Add one or more products to this order.</div>
                )}
                {items.map((it, i) => {
                  const filteredProducts = getFilteredProducts(it.searchText)
                  const selectedProduct = products.find(p => String(p._id) === String(it.productId))
                  const displayText = selectedProduct 
                    ? `${selectedProduct.name} • ${selectedCurrency} ${convertPrice(Number(selectedProduct.price)||0, selectedProduct.baseCurrency || 'SAR', selectedCurrency).toFixed(2)}`
                    : it.searchText
                  
                  return (
                    <div key={i} style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr auto auto' : 'minmax(300px,1fr) 160px 90px', gap:8, alignItems:'start' }}>
                      <div style={{ position: 'relative' }}>
                        <input
                          className="input"
                          value={displayText}
                          onChange={(e)=>{
                            const text = e.target.value
                            setItems(prev => prev.map((x,idx)=> idx===i ? { ...x, searchText: text, showDropdown: text.length >= 3, productId: '' } : x))
                          }}
                          onFocus={() => {
                            if (it.searchText.length >= 3) {
                              setItems(prev => prev.map((x,idx)=> idx===i ? { ...x, showDropdown: true } : x))
                            }
                          }}
                          onBlur={() => {
                            // Delay to allow click on dropdown
                            setTimeout(() => {
                              setItems(prev => prev.map((x,idx)=> idx===i ? { ...x, showDropdown: false } : x))
                            }, 200)
                          }}
                          placeholder="Type to search products (min 3 characters)..."
                          style={{ width: '100%' }}
                        />
                        {it.showDropdown && filteredProducts.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 1000,
                            background: 'var(--panel)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            marginTop: 4,
                            maxHeight: 240,
                            overflowY: 'auto',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                          }}>
                            {filteredProducts.map(p => {
                              const base = p.baseCurrency || 'SAR'
                              const display = convertPrice(Number(p.price)||0, base, selectedCurrency)
                              return (
                                <div
                                  key={p._id}
                                  onMouseDown={() => {
                                    // Check if this product already exists in items
                                    const existingIndex = items.findIndex((item, idx) => idx !== i && String(item.productId) === String(p._id))
                                    if (existingIndex !== -1) {
                                      // Product exists, increase its quantity and remove current empty row
                                      setItems(prev => {
                                        const updated = prev.map((x, idx) => 
                                          idx === existingIndex 
                                            ? { ...x, quantity: (x.quantity || 1) + 1 } 
                                            : x
                                        )
                                        // Remove current row if it was empty
                                        return updated.filter((_, idx) => idx !== i || prev[i].productId)
                                      })
                                    } else {
                                      // Product doesn't exist, add it normally
                                      setItems(prev => prev.map((x,idx)=> idx===i ? { ...x, productId: p._id, searchText: `${p.name} • ${selectedCurrency} ${display.toFixed(2)}`, showDropdown: false } : x))
                                    }
                                  }}
                                  style={{
                                    padding: '10px 12px',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--border)',
                                    transition: 'background 0.15s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--panel-2)'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <div style={{ fontWeight: 500 }}>{p.name}</div>
                                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{selectedCurrency} {display.toFixed(2)}</div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {it.searchText && it.searchText.length > 0 && it.searchText.length < 3 && (
                          <div className="helper" style={{fontSize:11, opacity:0.7, marginTop:2}}>Type at least 3 characters</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => {
                            const newQty = Math.max(1, (it.quantity || 1) - 1)
                            setItems(prev => prev.map((x,idx)=> idx===i ? { ...x, quantity: newQty } : x))
                          }}
                          disabled={it.quantity <= 1}
                          style={{ padding: '6px 10px', minWidth: 32 }}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <div
                          style={{ 
                            minWidth: 50, 
                            textAlign: 'center', 
                            fontWeight: 600,
                            fontSize: 15,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 8px'
                          }}
                        >
                          {it.quantity || 1}
                        </div>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => {
                            const newQty = (it.quantity || 1) + 1
                            setItems(prev => prev.map((x,idx)=> idx===i ? { ...x, quantity: newQty } : x))
                          }}
                          style={{ padding: '6px 10px', minWidth: 32 }}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={()=> setItems(prev => prev.filter((_,idx)=> idx!==i))}
                        disabled={items.length <= 1}
                        title={items.length <= 1 ? 'At least one product is required' : 'Remove'}
                      >Remove</button>
                    </div>
                  )
                })}
              </div>

              <div>
                <div className="label">Customer Name</div>
                <input className="input" name="customerName" value={form.customerName} onChange={onChange} placeholder="Full name" />
              </div>
              
              <div>
                <div className="label">WhatsApp Location</div>
                <div style={{ position:'relative', marginTop:4 }}>
                  <input
                    className="input"
                    name="coords"
                    value={coordsInput}
                    onChange={(e)=> setCoordsInput(e.target.value)}
                    placeholder="e.g. 57WF+VMP Dubai - United Arab Emirates"
                    style={{
                      width: '100%',
                      paddingRight: 140, // space for the inline button
                    }}
                  />
                  <button
                    type="button"
                    className="btn small"
                    onClick={()=> parseAndSetCoords(coordsInput)}
                    disabled={!coordsInput.trim() || resolving}
                    aria-label="Resolve WhatsApp location"
                    title="Resolve Address"
                    style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', whiteSpace:'nowrap' }}
                  >
                    {resolving ? (<span><span className="spinner"/> Resolving…</span>) : 'Resolve Address'}
                  </button>
                </div>
                {resolving && (
                  <div className="helper" style={{ marginTop:6, display:'flex', alignItems:'center', gap:8 }}>
                    <span className="spinner"/> Resolving address…
                  </div>
                )}
                {!!resolveError && (
                  <div style={{
                    padding: '8px 12px',
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: 6,
                    color: '#9a3412',
                    fontSize: 14,
                    marginTop: 8,
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'space-between',
                    gap:8,
                  }}>
                    <div>{resolveError}</div>
                    <button type="button" className="btn secondary small" onClick={()=> {
                      try{
                        if (form.locationLat && form.locationLng){ resolveFromCoords(form.locationLat, form.locationLng) }
                        else if (coordsInput.trim()){ parseAndSetCoords(coordsInput) }
                      }catch{}
                    }}>Retry</button>
                  </div>
                )}
                {form.locationLat && form.locationLng && (
                  <div style={{display:'flex', gap:8, marginTop:6}}>
                    <button type="button" className="btn secondary" onClick={()=> navigator.clipboard && navigator.clipboard.writeText(`${Number(form.locationLat).toFixed(6)}, ${Number(form.locationLng).toFixed(6)}`)}>Copy</button>
                    <a className="btn secondary" href={`https://www.google.com/maps?q=${form.locationLat},${form.locationLng}`} target="_blank" rel="noreferrer">Open in Maps</a>
                  </div>
                )}
              </div>

              {/* Location validation message */}
              {!locationValidation.isValid && (
                <div style={{
                  padding: '8px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 6,
                  color: '#dc2626',
                  fontSize: 14
                }}>
                  {locationValidation.message}
                </div>
              )}

              {/* Removed duplicate Customer Phone Number block to display number only once */}
              <div>
                <div className="label">Customer Address</div>
                <input className="input" name="customerAddress" value={form.customerAddress} onChange={onChange} placeholder="Street, Building" />
              </div>

              <div>
                <div className="label">Order Details (optional)</div>
                <textarea className="input" name="details" value={form.details} onChange={onChange} placeholder="Describe items, quantities, notes..." rows={4} />
              </div>

              {/* Preferred Timing Dropdown (optional) */}
              <div>
                <div className="label">Preferred Timing (optional)</div>
                <select 
                  className="input" 
                  name="preferredTiming" 
                  value={form.preferredTiming} 
                  onChange={onChange}
                >
                  <option value="">-- Select Preferred Time --</option>
                  {timingOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right column: sticky summary */}
            <div style={{position: isMobile ? 'static' : 'sticky', top:12, display:'grid', gap:12}}>
              <div className="card" style={{display:'grid', gap:12}}>
                <div className="helper" style={{opacity:0.9}}>Items Summary</div>
                <div style={{ display:'grid', gap:6 }}>
                  {itemsDetailed.length ? itemsDetailed.map(r => (
                    <div key={r.idx} style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                      <span style={{ opacity:0.9 }}>{r.product?.name || 'Item'} × {r.qty}</span>
                      <span>{selectedCurrency} {r.amount.toFixed(2)}</span>
                    </div>
                  )) : (
                    <div style={{ opacity:0.7 }}>No items added</div>
                  )}
                </div>

                {/* Order number is assigned after submission by server */}

                <div className="summary">
                  <div className="row"><span className="muted">Subtotal ({selectedCurrency})</span><span>{itemsDetailed.length ? subtotal.toFixed(2) : '0.00'}</span></div>
                  <div className="row" style={{gap:8}}>
                    <span className="muted">Shipping ({selectedCurrency})</span>
                    <input className="input" name="shipping" value={form.shipping} onChange={onChange} placeholder="0.00" style={{maxWidth:140}} />
                  </div>
                  <div className="row" style={{gap:8}}>
                    <span className="muted">Discount ({selectedCurrency})</span>
                    <input className="input" name="discount" value={form.discount} onChange={onChange} placeholder="0.00" style={{maxWidth:140}} />
                  </div>
                  <div style={{display:'grid', gap:6}}>
                    <span className="muted">Total ({selectedCurrency})</span>
                    <input className="input" readOnly value={computedTotal.toFixed(2)} />
                  </div>
                </div>
              </div>
              <button className="btn" type="submit" disabled={loading || !canCreateOrder}>{loading? (<span><span className="spinner"/> Submitting…</span>) : 'Submit Order'}</button>
              {msg && <div style={{opacity:0.9}}>{msg}</div>}
            </div>
          </div>
        </form>
      </div>

      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{fontWeight:700}}>Recent Orders</div>
        </div>
        {/* Quick filters */}
        <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginTop:8}}>
          {[
            {k:'all', label:'All'},
            {k:'pending', label:'Pending'},
            {k:'shipped', label:'Shipped'},
            {k:'delivered', label:'Delivered'},
            {k:'returned', label:'Returned'},
            {k:'cancelled', label:'Cancelled'},
          ].map(it => (
            <button key={it.k} type="button" onClick={()=> setStatusFilter(it.k)}
              className="btn secondary"
              style={{
                padding:'6px 10px',
                background: statusFilter===it.k? 'rgba(0,168,132,0.12)' : 'var(--panel)',
                border: `1px solid ${statusFilter===it.k? 'rgba(0,168,132,0.35)':'var(--border)'}`,
                color: statusFilter===it.k? 'var(--fg)' : 'inherit'
              }}
            >{it.label}</button>
          ))}
        </div>

        <div style={{overflow:'auto', marginTop:8, border:'1px solid var(--border)', borderRadius:8}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
            <thead>
              <tr style={{position:'sticky', top:0, zIndex:1, background:'var(--panel)'}}>
                <th style={{textAlign:'left', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>Order Country</th>
                <th style={{textAlign:'left', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>City</th>
                <th style={{textAlign:'left', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>Area</th>
                <th style={{textAlign:'left', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>Phone</th>
                <th style={{textAlign:'left', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>Address</th>
                <th style={{textAlign:'left', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>Location</th>
                <th style={{textAlign:'left', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>Details</th>
                <th style={{textAlign:'left', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>Product</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>Qty</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>Unit Price</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>Total</th>
                <th style={{textAlign:'left', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>Created by</th>
                <th style={{textAlign:'left', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>Status</th>
                <th style={{textAlign:'left', padding:'10px 12px', borderBottom:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>Created</th>
                <th style={{textAlign:'left', padding:'10px 12px', borderBottom:'1px solid var(--border)'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr><td colSpan={15} style={{padding:'12px', opacity:0.7}}>Loading...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{padding:'16px'}}>
                    <div style={{display:'flex', alignItems:'center', gap:10, opacity:0.8}}>
                      <span>🧾</span>
                      <div>No orders to show for this filter.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((o, idx) => (
                  <tr key={o._id} style={{background: idx%2===0? 'transparent':'var(--panel-2)'}}>
                    <td style={{padding:'10px 12px', borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>{o.orderCountry || '-'}</td>
                    <td style={{padding:'10px 12px', borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>{o.city || '-'}</td>
                    <td style={{padding:'10px 12px', borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>{o.customerArea || '-'}</td>
                    <td style={{padding:'10px 12px', whiteSpace:'nowrap', borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}} title={`${o.phoneCountryCode||''} ${o.customerPhone}`.trim()}>{`${o.phoneCountryCode || ''} ${o.customerPhone}`.trim()}</td>
                    <td style={{padding:'10px 12px', maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}} title={o.customerAddress||''}>{o.customerAddress || '-'}</td>
                    <td style={{padding:'10px 12px', borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>{o.locationLat && o.locationLng ? `(${Number(o.locationLat).toFixed(4)}, ${Number(o.locationLng).toFixed(4)})` : (o.customerLocation || '-')}</td>
                    <td style={{padding:'10px 12px', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}} title={o.details}>{o.details}</td>
                    <td style={{padding:'10px 12px', borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>{o.productId?.name || '-'}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>{o.quantity || 1}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>{currencyOf(o)} {unitPriceOf(o).toFixed(2)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', fontWeight:600, borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>{currencyOf(o)} {totalPriceOf(o).toFixed(2)}</td>
                    <td style={{padding:'10px 12px', borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>
                      {o.createdBy ? (
                        <span title={o.createdBy.email||''}>
                          {(o.createdBy.firstName||'') + ' ' + (o.createdBy.lastName||'')} {o.createdBy.role ? (<span className="badge" style={{marginLeft:6}}>{o.createdBy.role}</span>) : null}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{padding:'10px 12px', borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}}>{statusBadge(derivedStatus(o))}</td>
                    <td style={{padding:'10px 12px', whiteSpace:'nowrap', borderTop:'1px solid var(--border)', borderRight:'1px solid var(--border)'}} title={fmtDate(o.createdAt)}>{timeAgo(o.createdAt)}</td>
                    <td style={{padding:'10px 12px', borderTop:'1px solid var(--border)'}}>
                      <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                        {/* Edit button - show until order is picked up */}
                        {o.shipmentStatus !== 'picked_up' && o.shipmentStatus !== 'in_transit' && o.shipmentStatus !== 'delivered' && (
                          <button
                            className="btn secondary small"
                            onClick={() => openEditPopout(o)}
                            title="Edit Order"
                          >✏️ Edit</button>
                        )}
                        <button
                          className="btn secondary small"
                          onClick={() => sendInvoice(o)}
                          title="Send Invoice to Customer"
                        >📧 Invoice</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
