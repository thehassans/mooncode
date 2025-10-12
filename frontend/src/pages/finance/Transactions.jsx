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

  useEffect(()=>{ /* initial no-op */ },[])

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
    if (!country) { setDrivers([]); setDeliveredOrders([]); setDriverRemits([]); return }
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
      return { id, driver: d, deliveredCount: s.deliveredCount||0, collectedSum: s.collectedSum||0, remittedSum: rem||0, variance }
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
  }, [drivers, driverStats, driverAcceptedSum, sortBy, sortDir])

  function exportCsv(){
    try{
      const header = ['Driver','Email','Delivered','Collected','Remitted','Variance']
      const lines = [header.join(',')]
      for (const r of rows){
        lines.push([
          `${r.driver.firstName||''} ${r.driver.lastName||''}`.trim(),
          r.driver.email||'',
          r.deliveredCount,
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
            <option value="variance">Sort by Variance</option>
            <option value="collectedSum">Sort by Collected</option>
            <option value="remittedSum">Sort by Remitted</option>
            <option value="deliveredCount">Sort by Delivered</option>
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
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)' }}>Driver</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>Delivered Orders</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>Total Collected ({ccy})</th>
                <th style={{ padding: '10px 12px', textAlign:'right' }}>Delivered to Company ({ccy})</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: '10px 12px', opacity: 0.7 }}>Loading…</td></tr>
              ) : !country ? (
                <tr><td colSpan={4} style={{ padding: '10px 12px', opacity: 0.7 }}>Select a country to view driver finances</td></tr>
              ) : drivers.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '10px 12px', opacity: 0.7 }}>No drivers found</td></tr>
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
                        <button className="btn secondary" onClick={()=> goDelivered(r.id)} title="View delivered orders" style={{ padding: '6px 10px' }}>{num(r.deliveredCount)}</button>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                        <button className="btn secondary" onClick={()=> goDeliveredCollected(r.id)} title="View delivered orders with collected payments" style={{ padding: '6px 10px' }}>{num(r.collectedSum)}</button>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign:'right' }}>
                        <button className="btn secondary" onClick={()=> setRemitModalFor(r.id)} title="View remittances" style={{ padding: '6px 10px', color:'#0ea5e9' }}>{num(r.remittedSum)}</button>
                        <div className="helper" style={{ marginTop:6 }}>
                          <div style={{ height:6, background:'var(--panel-2)', borderRadius:999 }}>
                            <div style={{ width:`${barPct}%`, height:'100%', borderRadius:999, background:'linear-gradient(90deg, #22c55e, #3b82f6)' }} />
                          </div>
                          <span style={{ color: varianceColor, fontWeight:700 }}>Variance: {num(r.variance)}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
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
    </div>
  )
}

// old helpers removed with ledger
