import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet } from '../../api'
import { useNavigate } from 'react-router-dom'

export default function Transactions(){
  const navigate = useNavigate()
  const [driverRemits, setDriverRemits] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [country, setCountry] = useState('')
  const [countryOptions, setCountryOptions] = useState([])
  const [drivers, setDrivers] = useState([])
  const [deliveredOrders, setDeliveredOrders] = useState([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sortBy, setSortBy] = useState('variance')
  const [sortDir, setSortDir] = useState('desc')
  const [remitModalFor, setRemitModalFor] = useState('')
  const [countryOrders, setCountryOrders] = useState([])
  const [detailModalFor, setDetailModalFor] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(()=>{ /* initial no-op */ },[])
  useEffect(()=>{
    try{
      const onResize = ()=> setIsMobile(typeof window !== 'undefined' && window.innerWidth < 720)
      onResize()
      window.addEventListener('resize', onResize)
      return ()=> window.removeEventListener('resize', onResize)
    }catch{}
  },[])

  // Load country options for filter (top selector)
  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet('/api/orders/options')
        setCountryOptions(Array.isArray(r?.countries) ? r.countries : [])
      } catch {
        setCountryOptions([])
      }
    })()
  }, [])

  // When country changes, load drivers for that country and their delivered orders (paged)
  useEffect(() => {
    if (!country) { setDrivers([]); setDeliveredOrders([]); setDriverRemits([]); setCountryOrders([]); return }
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        // Load drivers for selected country
        const d = await apiGet(`/api/users/drivers?country=${encodeURIComponent(country)}`)
        if (alive) setDrivers(Array.isArray(d?.users) ? d.users : [])
        // Load remittances for selected country (all statuses)
        const remitResp = await apiGet('/api/finance/remittances')
        const allRemits = Array.isArray(remitResp?.remittances) ? remitResp.remittances : []
        const filteredRemits = allRemits.filter(r => String(r?.country||'').trim() === String(country).trim())
        if (alive) setDriverRemits(filteredRemits)
        // Accumulate delivered orders for selected country
        let page = 1
        const lim = 200
        let hasMore = true
        let acc = []
        while (hasMore && page <= 10) {
          const q = new URLSearchParams()
          q.set('country', country)
          q.set('ship', 'delivered')
          q.set('page', String(page))
          q.set('limit', String(lim))
          const r = await apiGet(`/api/orders?${q.toString()}`)
          const arr = Array.isArray(r?.orders) ? r.orders : []
          acc = acc.concat(arr)
          hasMore = !!r?.hasMore
          page += 1
        }
        if (alive) setDeliveredOrders(acc)
        // Accumulate all current orders for selected country (for assigned counts)
        let p2 = 1
        let more2 = true
        let all = []
        while (more2 && p2 <= 10){
          const q2 = new URLSearchParams()
          q2.set('country', country)
          q2.set('page', String(p2))
          q2.set('limit', String(lim))
          const r2 = await apiGet(`/api/orders?${q2.toString()}`)
          const arr2 = Array.isArray(r2?.orders) ? r2.orders : []
          all = all.concat(arr2)
          more2 = !!r2?.hasMore
          p2 += 1
        }
        if (alive) setCountryOrders(all)
      } catch (e) {
        if (alive) setErr(e?.message || 'Failed to load driver finances')
      } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [country])
  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function userName(u){ if (!u) return '-'; return `${u.firstName||''} ${u.lastName||''}`.trim() || (u.email||'-') }
  function dateInRange(d, from, to){ try{ if (!d) return false; const t = new Date(d).getTime(); if (from){ const f = new Date(from).setHours(0,0,0,0); if (t < f) return false } if (to){ const tt = new Date(to).setHours(23,59,59,999); if (t > tt) return false } return true }catch{ return true } }

  // Build per-driver metrics from deliveredOrders for selected country
  function orderNumericTotal(o){
    try{
      if (o && o.total != null && !Number.isNaN(Number(o.total))) return Number(o.total)
      if (Array.isArray(o?.items) && o.items.length){
        let sum = 0; for (const it of o.items){ const price = Number(it?.productId?.price||0); const qty = Math.max(1, Number(it?.quantity||1)); sum += price * qty }
        return sum
      }
      const price = Number(o?.productId?.price||0); const qty = Math.max(1, Number(o?.quantity||1)); return price * qty
    }catch{ return 0 }
  }
  function collectedOf(o){ const c = Number(o?.collectedAmount); if (!Number.isNaN(c) && c>0) return c; const cod = Number(o?.codAmount); if (!Number.isNaN(cod) && cod>0) return cod; return orderNumericTotal(o) }
  const driverStats = useMemo(()=>{
    const map = new Map()
    for (const o of deliveredOrders){
      const dAt = o?.deliveredAt || o?.updatedAt || o?.createdAt
      if ((fromDate || toDate) && !dateInRange(dAt, fromDate, toDate)) continue
      const did = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
      if (!did) continue
      if (!map.has(did)) map.set(did, { deliveredCount:0, collectedSum:0 })
      const s = map.get(did)
      s.deliveredCount += 1
      s.collectedSum += collectedOf(o)
    }
    return map
  }, [deliveredOrders, fromDate, toDate])
  // Sum accepted/received remittances per driver (delivered to company)
  const driverAcceptedSum = useMemo(()=>{
    const by = new Map()
    for (const r of driverRemits){
      if (String(r?.country||'').trim() !== String(country||'').trim()) continue
      const st = String(r?.status||'')
      if (st==='accepted' || st==='received'){
        const id = String(r?.driver?._id || r?.driver || '')
        if (!id) continue
        const when = r?.acceptedAt || r?.createdAt
        if ((fromDate || toDate) && !dateInRange(when, fromDate, toDate)) continue
        if (!by.has(id)) by.set(id, 0)
        by.set(id, by.get(id) + Number(r?.amount||0))
      }
    }
    return by
  }, [driverRemits, country, fromDate, toDate])

  function normalizeShip(s){
    const n = String(s||'').toLowerCase().trim().replace(/\s+/g,'_').replace(/-/g,'_')
    if (n==='picked' || n==='pickedup' || n==='pick_up' || n==='pick-up' || n==='pickup') return 'picked_up'
    if (n==='shipped' || n==='contacted' || n==='attempted') return 'in_transit'
    if (n==='open') return 'open'
    return n
  }
  const openAssignedByDriver = useMemo(()=>{
    const map = new Map()
    for (const o of countryOrders){
      const did = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
      if (!did) continue
      const ship = normalizeShip(o?.shipmentStatus || o?.status)
      const isOpen = ['pending','assigned','picked_up','in_transit','out_for_delivery','no_response'].includes(ship)
      if (!isOpen) continue
      if ((fromDate || toDate) && !dateInRange(o?.updatedAt || o?.createdAt, fromDate, toDate)) continue
      if (!map.has(did)) map.set(did, 0)
      map.set(did, map.get(did) + 1)
    }
    return map
  }, [countryOrders, fromDate, toDate])
  const totalAssignedByDriver = useMemo(()=>{
    const map = new Map()
    for (const o of countryOrders){
      const did = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
      if (!did) continue
      if ((fromDate || toDate) && !dateInRange(o?.updatedAt || o?.createdAt, fromDate, toDate)) continue
      if (!map.has(did)) map.set(did, 0)
      map.set(did, map.get(did) + 1)
    }
    return map
  }, [countryOrders, fromDate, toDate])

  const returnedByDriver = useMemo(()=>{
    const map = new Map()
    for (const o of countryOrders){
      const did = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
      if (!did) continue
      const ship = normalizeShip(o?.shipmentStatus || o?.status)
      if (ship !== 'returned') continue
      if ((fromDate || toDate) && !dateInRange(o?.updatedAt || o?.createdAt, fromDate, toDate)) continue
      if (!map.has(did)) map.set(did, 0)
      map.set(did, map.get(did) + 1)
    }
    return map
  }, [countryOrders, fromDate, toDate])

  const cancelledByDriver = useMemo(()=>{
    const map = new Map()
    for (const o of countryOrders){
      const did = String(o?.deliveryBoy?._id || o?.deliveryBoy || '')
      if (!did) continue
      const ship = normalizeShip(o?.shipmentStatus || o?.status)
      if (ship !== 'cancelled') continue
      if ((fromDate || toDate) && !dateInRange(o?.updatedAt || o?.createdAt, fromDate, toDate)) continue
      if (!map.has(did)) map.set(did, 0)
      map.set(did, map.get(did) + 1)
    }
    return map
  }, [countryOrders, fromDate, toDate])

  function countryCurrency(c){
    const raw = String(c||'').trim().toLowerCase()
    if (!raw) return 'SAR'
    if (raw.includes('saudi') || raw==='ksa') return 'SAR'
    if (raw.includes('united arab emirates') || raw==='uae' || raw==='ae') return 'AED'
    if (raw==='oman' || raw==='om') return 'OMR'
    if (raw==='bahrain' || raw==='bh') return 'BHD'
    if (raw==='india' || raw==='in') return 'INR'
    if (raw==='kuwait' || raw==='kw' || raw==='kwt') return 'KWD'
    if (raw==='qatar' || raw==='qa') return 'QAR'
    return 'SAR'
  }
  const ccy = countryCurrency(country)
  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function goAllOrders(driverId){ const p = new URLSearchParams(); if (country) p.set('country', country); p.set('driver', String(driverId)); navigate(`/user/orders?${p.toString()}`) }
  function goDelivered(driverId){ const p = new URLSearchParams(); if (country) p.set('country', country); p.set('driver', String(driverId)); p.set('ship','delivered'); navigate(`/user/orders?${p.toString()}`) }
  function goDeliveredCollected(driverId){ const p = new URLSearchParams(); if (country) p.set('country', country); p.set('driver', String(driverId)); p.set('ship','delivered'); p.set('collected','true'); navigate(`/user/orders?${p.toString()}`) }

  const rows = useMemo(()=>{
    const arr = drivers.map(d => {
      const id = String(d?._id)
      const s = driverStats.get(id) || { deliveredCount:0, collectedSum:0 }
      const rem = driverAcceptedSum.get(id) || 0
      const variance = (s.collectedSum || 0) - (rem || 0)
      const openAssigned = openAssignedByDriver.get(id) || 0
      const totalAssigned = totalAssignedByDriver.get(id) || 0
      const returned = returnedByDriver.get(id) || 0
      const cancelled = cancelledByDriver.get(id) || 0
      return { id, driver: d, openAssigned, totalAssigned, deliveredCount: s.deliveredCount||0, collectedSum: s.collectedSum||0, remittedSum: rem||0, variance, returned, cancelled }
    })
    const dir = sortDir === 'asc' ? 1 : -1
    const key = sortBy
    arr.sort((a,b)=>{
      const av = a[key] ?? 0
      const bv = b[key] ?? 0
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return arr
  }, [drivers, driverStats, driverAcceptedSum, openAssignedByDriver, totalAssignedByDriver, returnedByDriver, cancelledByDriver, sortBy, sortDir])

  const totals = useMemo(()=>{
    let delivered=0, collected=0, remitted=0, pending=0, openA=0, totalA=0
    for (const r of rows){
      delivered += Number(r.deliveredCount||0)
      collected += Number(r.collectedSum||0)
      remitted += Number(r.remittedSum||0)
      pending += Number(r.variance||0)
      openA += Number(r.openAssigned||0)
      totalA += Number(r.totalAssigned||0)
    }
    return { delivered, collected, remitted, pending, openA, totalA }
  }, [rows])

  function exportCsv(){
    try{
      const header = ['Driver','Email','OpenAssigned','TotalAssigned','Delivered','Returned','Cancelled','Collected','Remitted','Pending']
      const lines = [header.join(',')]
      for (const r of rows){
        lines.push([
          `${r.driver.firstName||''} ${r.driver.lastName||''}`.trim(),
          r.driver.email||'',
          r.openAssigned,
          r.totalAssigned,
          r.deliveredCount,
          r.returned,
          r.cancelled,
          r.collectedSum,
          r.remittedSum,
          r.variance,
        ].map(v => typeof v==='string' && v.includes(',') ? `"${v.replace(/"/g,'""')}"` : v).join(','))
      }
      const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `driver-finances-${country||'all'}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }catch{}
  }

  const filteredRemitsForDriver = useMemo(()=>{
    if (!remitModalFor) return []
    return driverRemits.filter(r => String(r?.driver?._id || r?.driver || '') === String(remitModalFor))
      .filter(r => (fromDate || toDate) ? dateInRange(r?.acceptedAt || r?.createdAt, fromDate, toDate) : true)
  }, [driverRemits, remitModalFor, fromDate, toDate])

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Driver Finances</div>
          <div className="page-subtitle">Monitor drivers' delivered collections and remittances</div>
        </div>
      </div>
      {err && <div className="error">{err}</div>}

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="card-header"><div className="card-title">Filters</div></div>
        <div className="section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          <select className="input" value={country} onChange={(e)=> setCountry(e.target.value)}>
            <option value="">Select Country</option>
            {countryOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input className="input" type="date" value={fromDate} onChange={e=> setFromDate(e.target.value)} />
          <input className="input" type="date" value={toDate} onChange={e=> setToDate(e.target.value)} />
          <select className="input" value={sortBy} onChange={e=> setSortBy(e.target.value)}>
            <option value="variance">Sort by Pending</option>
            <option value="collectedSum">Sort by Collected</option>
            <option value="remittedSum">Sort by Remitted</option>
            <option value="deliveredCount">Sort by Delivered</option>
            <option value="openAssigned">Sort by Open Assigned</option>
            <option value="totalAssigned">Sort by Total Assigned</option>
          </select>
          <select className="input" value={sortDir} onChange={e=> setSortDir(e.target.value)}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      {/* Drivers table */}
      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontWeight: 700 }}>Drivers {country ? `in ${country}` : ''}</div>
          <div className="helper">Currency: {country ? countryCurrency(country) : '-'}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {!isMobile && (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)' }}>Driver</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>Assigned (Open)</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>Total Assigned</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>Delivered Orders</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>Total Collected ({ccy})</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>Delivered to Company ({ccy})</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>Pending ({ccy})</th>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)' }}>Details</th>
                <th style={{ padding: '10px 12px', textAlign:'left' }}>History</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: '10px 12px', opacity: 0.7 }}>Loading…</td></tr>
              ) : !country ? (
                <tr><td colSpan={9} style={{ padding: '10px 12px', opacity: 0.7 }}>Select a country to view driver finances</td></tr>
              ) : drivers.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '10px 12px', opacity: 0.7 }}>No drivers found</td></tr>
              ) : (
                rows.map((r, idx) => {
                  const varianceColor = r.variance > 0 ? 'var(--warning)' : (r.variance < 0 ? 'var(--success)' : 'var(--muted)')
                  const barPct = r.collectedSum > 0 ? Math.min(100, Math.max(0, (r.remittedSum / r.collectedSum) * 100)) : 0
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border)', background: idx % 2 ? 'transparent' : 'var(--panel)' }}>
                      <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                        <button className="btn secondary" onClick={()=> goAllOrders(r.id)} title="View all orders" style={{ padding: '6px 10px' }}>{userName(r.driver)}</button>
                        <div className="helper">{r.driver.email || ''}</div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                        <button className="btn secondary" onClick={()=> { const p = new URLSearchParams(); if (country) p.set('country', country); p.set('driver', r.id); p.set('ship','open'); navigate(`/user/orders?${p.toString()}`) }} title="View open assigned" style={{ padding: '6px 10px', background:'rgba(245,158,11,0.15)', borderColor:'#f59e0b', color:'#f59e0b' }}>{num(r.openAssigned)}</button>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                        <button className="btn secondary" onClick={()=> goAllOrders(r.id)} title="View all assigned" style={{ padding: '6px 10px', background:'rgba(99,102,241,0.15)', borderColor:'#6366f1', color:'#6366f1' }}>{num(r.totalAssigned)}</button>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                        <button className="btn secondary" onClick={()=> goDelivered(r.id)} title="View delivered orders" style={{ padding: '6px 10px', background:'rgba(59,130,246,0.15)', borderColor:'#3b82f6', color:'#3b82f6' }}>{num(r.deliveredCount)}</button>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                        <button className="btn secondary" onClick={()=> goDeliveredCollected(r.id)} title="View delivered orders with collected payments" style={{ padding: '6px 10px', background:'rgba(34,197,94,0.15)', borderColor:'#22c55e', color:'#22c55e' }}>{num(r.collectedSum)}</button>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                        <button className="btn secondary" onClick={()=> setRemitModalFor(r.id)} title="View remittances" style={{ padding: '6px 10px', background:'rgba(34,197,94,0.15)', borderColor:'#22c55e', color:'#22c55e', fontWeight:800 }}>{num(r.remittedSum)}</button>
                        <div className="helper" style={{ marginTop:6 }}>
                          <div style={{ height:6, background:'var(--panel-2)', borderRadius:999 }}>
                            <div style={{ width:`${barPct}%`, height:'100%', borderRadius:999, background:'linear-gradient(90deg, #22c55e, #3b82f6)' }} />
                          </div>
                          <span style={{ color: 'var(--danger)', fontWeight:800 }}>Pending: {num(r.variance)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'var(--danger)', fontWeight:800 }}>
                        {num(r.variance)}
                      </td>
                      <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                        <button className="btn" onClick={()=> setDetailModalFor(r.id)}>Details</button>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button className="btn secondary" onClick={()=> setRemitModalFor(r.id)}>History</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:'2px solid var(--border)', background:'var(--panel)' }}>
                <td style={{ padding:'10px 12px', fontWeight:800 }}>Totals</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, color:'#f59e0b' }}>{num(totals.openA)}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, color:'#6366f1' }}>{num(totals.totalA)}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, color:'#3b82f6' }}>{num(totals.delivered)}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, color:'#22c55e' }}>{num(totals.collected)}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, color:'#22c55e' }}>{num(totals.remitted)}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontWeight:800, color:'var(--danger)' }}>{num(totals.pending)}</td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          )}
          {isMobile && (
            <div style={{ display:'grid', gap:8 }}>
              {loading ? (
                <div className="helper">Loading…</div>
              ) : !country ? (
                <div className="helper">Select a country to view driver finances</div>
              ) : rows.length===0 ? (
                <div className="helper">No drivers found</div>
              ) : rows.map(r => {
                const barPct = r.collectedSum > 0 ? Math.min(100, Math.max(0, (r.remittedSum / r.collectedSum) * 100)) : 0
                return (
                  <div key={r.id} className="card" style={{ display:'grid', gap:8, padding:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontWeight:800 }}>{userName(r.driver)}</div>
                      <button className="btn secondary" onClick={()=> setDetailModalFor(r.id)}>Details</button>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
                      <button className="btn secondary" onClick={()=> { const p = new URLSearchParams(); if (country) p.set('country', country); p.set('driver', r.id); p.set('ship','open'); navigate(`/user/orders?${p.toString()}`) }} style={{ background:'rgba(245,158,11,0.15)', borderColor:'#f59e0b', color:'#f59e0b' }}>Open: {num(r.openAssigned)}</button>
                      <button className="btn secondary" onClick={()=> goAllOrders(r.id)} style={{ background:'rgba(99,102,241,0.15)', borderColor:'#6366f1', color:'#6366f1' }}>Assigned: {num(r.totalAssigned)}</button>
                      <button className="btn secondary" onClick={()=> goDelivered(r.id)} style={{ background:'rgba(59,130,246,0.15)', borderColor:'#3b82f6', color:'#3b82f6' }}>Delivered: {num(r.deliveredCount)}</button>
                      <button className="btn secondary" onClick={()=> goDeliveredCollected(r.id)} style={{ background:'rgba(34,197,94,0.15)', borderColor:'#22c55e', color:'#22c55e' }}>Collected: {num(r.collectedSum)}</button>
                    </div>
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <button className="btn secondary" onClick={()=> setRemitModalFor(r.id)} style={{ background:'rgba(34,197,94,0.15)', borderColor:'#22c55e', color:'#22c55e', fontWeight:800 }}>Remitted: {num(r.remittedSum)}</button>
                        <div style={{ color:'var(--danger)', fontWeight:800 }}>Pending: {num(r.variance)}</div>
                      </div>
                      <div style={{ height:6, background:'var(--panel-2)', borderRadius:999, marginTop:6 }}>
                        <div style={{ width:`${barPct}%`, height:'100%', borderRadius:999, background:'linear-gradient(90deg, #22c55e, #3b82f6)' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {remitModalFor && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Driver Remittances</div>
              <button className="btn light" onClick={()=> setRemitModalFor('')}>Close</button>
            </div>
            <div className="modal-body" style={{ display:'grid', gap:8 }}>
              {filteredRemitsForDriver.length === 0 ? (
                <div className="helper">No remittances in selected date range.</div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                    <thead>
                      <tr>
                        <th style={{ padding:'8px 10px', textAlign:'left' }}>Amount</th>
                        <th style={{ padding:'8px 10px', textAlign:'left' }}>Status</th>
                        <th style={{ padding:'8px 10px', textAlign:'left' }}>Method</th>
                        <th style={{ padding:'8px 10px', textAlign:'left' }}>Accepted</th>
                        <th style={{ padding:'8px 10px', textAlign:'left' }}>Created</th>
                        <th style={{ padding:'8px 10px', textAlign:'left' }}>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRemitsForDriver.map((r, i)=> (
                        <tr key={String(r._id||i)} style={{ borderTop:'1px solid var(--border)' }}>
                          <td style={{ padding:'8px 10px', fontWeight:700, color:'#22c55e' }}>{num(r.amount)} {r.currency||''}</td>
                          <td style={{ padding:'8px 10px' }}>{String(r.status||'').toUpperCase()}</td>
                          <td style={{ padding:'8px 10px' }}>{(String(r.method||'hand').toLowerCase()==='transfer') ? 'Transfer' : 'Hand'}</td>
                          <td style={{ padding:'8px 10px' }}>{r.acceptedAt? new Date(r.acceptedAt).toLocaleString(): '—'}</td>
                          <td style={{ padding:'8px 10px' }}>{r.createdAt? new Date(r.createdAt).toLocaleString(): '—'}</td>
                          <td style={{ padding:'8px 10px' }}>
                            {r.receiptPath ? (
                              <a href={`${API_BASE}${r.receiptPath}`} target="_blank" rel="noopener noreferrer">Download</a>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {detailModalFor && (()=>{
        const r = rows.find(x => String(x.id) === String(detailModalFor))
        if (!r) return null
        const actionsStyle = { display:'flex', gap:8, flexWrap:'wrap' }
        const btnStyle = { padding:'6px 10px' }
        const hist = driverRemits
          .filter(x => String(x?.driver?._id || x?.driver || '') === String(r.id))
          .filter(x => (fromDate || toDate) ? dateInRange(x?.acceptedAt || x?.createdAt, fromDate, toDate) : true)
        return (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-header">
                <div className="modal-title">Driver Details</div>
                <button className="btn light" onClick={()=> setDetailModalFor('')}>Close</button>
              </div>
              <div className="modal-body" style={{ display:'grid', gap:12 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8 }}>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Driver</div>
                    <div style={{ fontWeight:800 }}>{userName(r.driver)}</div>
                    <div className="helper">{r.driver.email||''}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Assigned (Open)</div>
                    <div style={{ fontWeight:800, color:'#f59e0b' }}>{num(r.openAssigned)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Total Assigned</div>
                    <div style={{ fontWeight:800 }}>{num(r.totalAssigned)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Delivered</div>
                    <div style={{ fontWeight:800 }}>{num(r.deliveredCount)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Returned</div>
                    <div style={{ fontWeight:800, color:'var(--danger)' }}>{num(r.returned)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Cancelled</div>
                    <div style={{ fontWeight:800, color:'var(--danger)' }}>{num(r.cancelled)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Collected ({ccy})</div>
                    <div style={{ fontWeight:800, color:'#22c55e' }}>{num(r.collectedSum)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Remitted ({ccy})</div>
                    <div style={{ fontWeight:800, color:'#22c55e' }}>{num(r.remittedSum)}</div>
                  </div>
                  <div className="card" style={{ padding:10 }}>
                    <div className="label">Pending ({ccy})</div>
                    <div style={{ fontWeight:800, color:'var(--danger)' }}>{num(r.variance)}</div>
                  </div>
                </div>
                <div style={actionsStyle}>
                  <button className="btn" style={btnStyle} onClick={()=> { const p = new URLSearchParams(); if (country) p.set('country', country); p.set('driver', r.id); p.set('ship','open'); navigate(`/user/orders?${p.toString()}`) }}>Open Assigned</button>
                  <button className="btn" style={btnStyle} onClick={()=> goAllOrders(r.id)}>All Assigned</button>
                  <button className="btn" style={btnStyle} onClick={()=> goDelivered(r.id)}>Delivered</button>
                  <button className="btn" style={btnStyle} onClick={()=> goDeliveredCollected(r.id)}>Collected</button>
                  <button className="btn" style={btnStyle} onClick={()=> { const p = new URLSearchParams(); if(country) p.set('country', country); p.set('driver', r.id); p.set('ship','returned'); navigate(`/user/orders?${p.toString()}`) }}>Returned</button>
                  <button className="btn" style={btnStyle} onClick={()=> { const p = new URLSearchParams(); if(country) p.set('country', country); p.set('driver', r.id); p.set('ship','cancelled'); navigate(`/user/orders?${p.toString()}`) }}>Cancelled</button>
                </div>
                <div className="card" style={{ padding:10 }}>
                  <div className="card-title">Remittance History</div>
                  {hist.length === 0 ? (
                    <div className="helper">No remittances in selected date range.</div>
                  ) : (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
                        <thead>
                          <tr>
                            <th style={{ padding:'8px 10px', textAlign:'left' }}>Amount</th>
                            <th style={{ padding:'8px 10px', textAlign:'left' }}>Status</th>
                            <th style={{ padding:'8px 10px', textAlign:'left' }}>Method</th>
                            <th style={{ padding:'8px 10px', textAlign:'left' }}>Accepted At</th>
                            <th style={{ padding:'8px 10px', textAlign:'left' }}>Created At</th>
                            <th style={{ padding:'8px 10px', textAlign:'left' }}>Receipt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hist.map((h,i)=> (
                            <tr key={String(h._id||i)} style={{ borderTop:'1px solid var(--border)' }}>
                              <td style={{ padding:'8px 10px', fontWeight:700, color:'#22c55e' }}>{num(h.amount)} {h.currency||''}</td>
                              <td style={{ padding:'8px 10px' }}>{String(h.status||'').toUpperCase()}</td>
                              <td style={{ padding:'8px 10px' }}>{(String(h.method||'hand').toLowerCase()==='transfer') ? 'Transfer' : 'Hand'}</td>
                              <td style={{ padding:'8px 10px' }}>{h.acceptedAt? new Date(h.acceptedAt).toLocaleString(): '—'}</td>
                              <td style={{ padding:'8px 10px' }}>{h.createdAt? new Date(h.createdAt).toLocaleString(): '—'}</td>
                              <td style={{ padding:'8px 10px' }}>{h.receiptPath ? (<a href={`${API_BASE}${h.receiptPath}`} target="_blank" rel="noopener noreferrer">Download</a>) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// old helpers removed with ledger
