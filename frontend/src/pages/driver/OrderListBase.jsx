import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../../api'
import { useNavigate, useLocation } from 'react-router-dom'
import DateRangeChips from '../../ui/DateRangeChips.jsx'

export default function OrderListBase({ title, subtitle, endpoint, showDeliverCancel=false, showMap=true, showTotalCollected=false, withFilters=false, withRange=false }){
  const nav = useNavigate()
  const location = useLocation()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [ship, setShip] = useState('')
  const [range, setRange] = useState('last7') // today | last7 | last30
  // Initialize filters from URL on mount and when URL changes
  useEffect(()=>{
    try{
      const sp = new URLSearchParams(location.search || '')
      const q0 = sp.get('q') || ''
      const s0 = sp.get('ship') || ''
      setQ(q0)
      setShip(s0)
      if (withRange){
        const from = sp.get('fromDate') || ''
        const to = sp.get('toDate') || ''
        if (from && to){
          try{
            const f = new Date(from), t = new Date(to)
            const msInDay = 24*60*60*1000
            const diffDays = Math.round((t.setHours(0,0,0,0) - f.setHours(0,0,0,0))/msInDay) + 1
            const isToday = (f.toDateString() === (new Date().toDateString()))
            if (diffDays===1 && isToday) setRange('today')
            else if (diffDays===7) setRange('last7')
            else if (diffDays===30) setRange('last30')
          }catch{}
        }
      }
    }catch{}
  }, [location.search, withRange])
  const rangeDates = useMemo(()=>{
    if (!withRange) return null
    try{
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
  }, [withRange, range])
  const totalCollected = React.useMemo(()=>{
    try{ return (rows||[]).reduce((sum,o)=> sum + (Number(o?.collectedAmount)||0), 0) }catch{ return 0 }
  }, [rows])

  async function load(){
    setLoading(true); setError('')
    try{
      const url = (()=>{
        const hasQ = endpoint.includes('?')
        const sp = new URLSearchParams()
        if (withFilters){
          if (q.trim()) sp.set('q', q.trim())
          if (ship.trim()) sp.set('ship', ship.trim())
        }
        if (withRange && rangeDates && rangeDates.from && rangeDates.to){
          sp.set('fromDate', rangeDates.from)
          sp.set('toDate', rangeDates.to)
        }
        const qs = sp.toString()
        if (!qs) return endpoint
        return endpoint + (hasQ ? '&' : '?') + qs
      })()
      const res = await apiGet(url)
      setRows(res.orders||[])
    }
    catch(e){ setRows([]); setError(e?.message||'Failed to load') }
    finally{ setLoading(false) }
  }
  useEffect(()=>{ load() },[endpoint, q, ship, withFilters, withRange, rangeDates?.from, rangeDates?.to])

  function mapsUrl(o){
    const lat = o?.locationLat, lng = o?.locationLng
    if (typeof lat === 'number' && typeof lng === 'number') return `https://www.google.com/maps?q=${lat},${lng}`
    const addr = o?.customerAddress || o?.customerLocation || ''
    return addr ? `https://www.google.com/maps?q=${encodeURIComponent(addr)}` : ''
  }
  function openMaps(o){ const url = mapsUrl(o); if (url) window.open(url, '_blank', 'noopener,noreferrer') }

  async function markDelivered(o){
    try{
      const note = window.prompt('Delivery note (optional)', '')
      const amtStr = window.prompt('Collected amount (optional)', '')
      const payload = {}
      if (note && note.trim()) payload.note = note.trim()
      const amt = Number(amtStr)
      if (!Number.isNaN(amt) && amtStr !== null && amtStr !== '') payload.collectedAmount = Math.max(0, amt)
      await apiPost(`/api/orders/${o._id||o.id}/deliver`, payload)
      load()
    }catch(e){ alert(e?.message || 'Failed to mark delivered') }
  }
  async function cancel(o){
    try{
      const reason = window.prompt('Reason for cancellation', '')
      if (reason === null) return
      await apiPost(`/api/orders/${o._id||o.id}/cancel`, { reason })
      load()
    }catch(e){ alert(e?.message || 'Failed to cancel') }
  }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header" style={{alignItems:'center', gap:8}}>
        <button className="btn secondary" onClick={()=> nav(-1)} aria-label="Back" title="Back" style={{width:36, height:36, padding:0}}>←</button>
        <div>
          <div className="page-title gradient heading-blue">{title}</div>
          {subtitle ? <div className="page-subtitle">{subtitle}</div> : null}
        </div>
      </div>

      <div className="card" style={{display:'grid'}}>
        {withRange && (
          <div className="section" style={{display:'grid', gap:8}}>
            <DateRangeChips value={range} onChange={setRange} />
          </div>
        )}
        {withFilters && (
          <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8}}>
            <input className="input" placeholder="Search invoice, product, customer, city" value={q} onChange={e=> setQ(e.target.value)} />
            <select className="input" value={ship} onChange={e=> setShip(e.target.value)}>
              <option value="">All Statuses</option>
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
        )}
        {showTotalCollected && !loading && !error && (
          <div className="section" style={{display:'flex', justifyContent:'flex-end'}}>
            <div className="chip" title="Sum of collectedAmount on these orders">Total Collected: {totalCollected.toFixed(2)}</div>
          </div>
        )}
        {loading ? <div className="section">Loading…</div> : error ? <div className="section helper-text error">{error}</div> : rows.length === 0 ? (
          <div className="section">No orders</div>
        ) : (
          <div className="section" style={{display:'grid', gap:10}}>
            {rows.map(o => (
              <div key={String(o._id||o.id)} className="panel" style={{display:'grid', gap:8, border:'1px solid var(--border)', borderRadius:10, padding:12}}>
                <div style={{display:'flex', justifyContent:'space-between', gap:8, alignItems:'center'}}>
                  <div style={{fontWeight:800}}>#{o.invoiceNumber || String(o._id||'').slice(-6)}</div>
                  <div style={{display:'flex', gap:6, alignItems:'center'}}>
                    {o.orderCountry ? <span className="badge">{o.orderCountry}</span> : null}
                    {o.city ? <span className="chip">{o.city}</span> : null}
                  </div>
                </div>
                <div className="helper">{o.customerName || '-'} • {o.customerPhone || '-'}</div>
                {o.collectedAmount != null && Number(o.collectedAmount) > 0 ? (
                  <div className="helper"><strong>Collected:</strong> {Number(o.collectedAmount).toFixed(2)}</div>
                ) : null}
                <div className="helper" style={{whiteSpace:'pre-wrap'}}>{o.customerAddress || o.customerLocation || '-'}</div>
                <div style={{display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap'}}>
                  {showMap ? <button className="btn secondary" onClick={()=> openMaps(o)}>Map</button> : null}
                  {showDeliverCancel && (
                    <>
                      <button className="btn" onClick={()=> markDelivered(o)}>Mark Delivered</button>
                      <button className="btn danger" onClick={()=> cancel(o)}>Cancel</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
