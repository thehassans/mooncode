import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../../api'
import { useNavigate, useLocation } from 'react-router-dom'
import { useToast } from '../../ui/Toast.jsx'

export default function OrderListBase({ title, subtitle, endpoint, showDeliverCancel=false, showMap=true, showTotalCollected=false, withFilters=false }){
  const nav = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [ship, setShip] = useState('')
  const [submitting, setSubmitting] = useState(null)
  // Initialize filters from URL on mount and when URL changes
  useEffect(()=>{
    try{
      const sp = new URLSearchParams(location.search || '')
      const q0 = sp.get('q') || ''
      const s0 = sp.get('ship') || ''
      setQ(q0)
      setShip(s0)
    }catch{}
  }, [location.search])
  const filteredRows = React.useMemo(()=>{
    return Array.isArray(rows)? rows : []
  }, [rows])
  const totalCollected = React.useMemo(()=>{
    try{ return (filteredRows||[]).reduce((sum,o)=> sum + (Number(o?.collectedAmount)||0), 0) }catch{ return 0 }
  }, [filteredRows])

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
  useEffect(()=>{ load() },[endpoint, q, ship, withFilters])

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

  async function submitReturn(o){
    const id = String(o._id || o.id)
    const invoiceNum = o.invoiceNumber || String(id).slice(-6)
    try{
      setSubmitting(id)
      await apiPost(`/api/orders/${id}/return/submit`, {})
      toast.success(`Order #${invoiceNum} submitted to company for verification`)
      load()
    }catch(e){
      toast.error(e?.message || 'Failed to submit order')
    }finally{
      setSubmitting(null)
    }
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
        {withFilters && (
          <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8}}>
            <input 
              className="input" 
              placeholder="🔍 Search: Invoice #, Phone, Name, Area..." 
              value={q} 
              onChange={e=> setQ(e.target.value)}
              style={{fontSize:14}}
            />
            <select className="input" value={ship} onChange={e=> setShip(e.target.value)} style={{fontSize:14}}>
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
        {loading ? <div className="section">Loading…</div> : error ? <div className="section helper-text error">{error}</div> : filteredRows.length === 0 ? (
          <div className="section">No orders</div>
        ) : (
          <div className="section" style={{display:'grid', gap:10}}>
            {filteredRows.map(o => {
              const isSubmitting = submitting === String(o._id || o.id)
              const status = String(o.shipmentStatus || '').toLowerCase()
              const isCancelledOrReturned = ['cancelled', 'returned'].includes(status)
              const canSubmit = isCancelledOrReturned && !o.returnSubmittedToCompany && !o.returnVerified
              const isVerified = o.returnVerified
              const isSubmitted = o.returnSubmittedToCompany && !isVerified
              
              return (
                <div key={String(o._id||o.id)} className="panel" style={{display:'grid', gap:8, border:`1px solid ${isCancelledOrReturned ? '#ef4444' : 'var(--border)'}`, borderRadius:10, padding:12, background: isCancelledOrReturned ? 'rgba(239, 68, 68, 0.05)' : 'transparent'}}>
                  <div style={{display:'flex', justifyContent:'space-between', gap:8, alignItems:'center'}}>
                    <div style={{display:'flex', gap:8, alignItems:'center'}}>
                      <div style={{fontWeight:800}}>#{o.invoiceNumber || String(o._id||'').slice(-6)}</div>
                      {isCancelledOrReturned && (
                        <span className="badge" style={{background:'#fecaca', color:'#991b1b', textTransform:'capitalize'}}>
                          {status}
                        </span>
                      )}
                    </div>
                    <div style={{display:'flex', gap:6, alignItems:'center'}}>
                      {o.orderCountry ? <span className="badge">{o.orderCountry}</span> : null}
                      {o.city ? <span className="chip">{o.city}</span> : null}
                    </div>
                  </div>
                  <div style={{fontSize:14, fontWeight:600, marginBottom:4}}>
                    {(() => {
                      if (o.productId?.name) return o.productId.name
                      if (o.items && Array.isArray(o.items)) {
                        for (const item of o.items) {
                          if (item?.productId?.name) return item.productId.name
                        }
                      }
                      return 'Product'
                    })()}
                  </div>
                  <div className="helper">{o.customerName || '-'} • {o.customerPhone || '-'}</div>
                  {o.collectedAmount != null && Number(o.collectedAmount) > 0 ? (
                    <div className="helper"><strong>Collected:</strong> {Number(o.collectedAmount).toFixed(2)}</div>
                  ) : null}
                  <div className="helper" style={{whiteSpace:'pre-wrap'}}>{o.customerAddress || o.customerLocation || '-'}</div>
                  
                  {/* Return/Cancel Verification Status - Only for cancelled/returned orders */}
                  {isCancelledOrReturned && (
                    <div style={{marginTop:4}}>
                      {isVerified && (
                        <div style={{color:'#10b981', fontWeight:700, fontSize:14}}>
                          ✅ {status.charAt(0).toUpperCase() + status.slice(1)} Order Verified
                        </div>
                      )}
                      {isSubmitted && (
                        <div style={{color:'#f59e0b', fontWeight:700, fontSize:14}}>
                          ⏳ Submitted - Awaiting Verification
                        </div>
                      )}
                      {!isSubmitted && !isVerified && (
                        <div style={{color:'#6b7280', fontWeight:600, fontSize:13}}>
                          ℹ️ Ready to submit to company for verification
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div style={{display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap'}}>
                    {showMap ? <button className="btn secondary" onClick={()=> openMaps(o)}>Map</button> : null}
                    {showDeliverCancel && !isCancelledOrReturned ? <button className="btn success" onClick={()=> markDelivered(o)}>Mark Delivered</button> : null}
                    {showDeliverCancel && !isCancelledOrReturned ? <button className="btn danger" onClick={()=> cancel(o)}>Cancel</button> : null}
                    {/* Show submit button for all cancelled/returned orders that aren't verified yet */}
                    {canSubmit && (
                      <button 
                        className="btn" 
                        onClick={() => submitReturn(o)} 
                        disabled={isSubmitting}
                        style={{background:'#f59e0b', border:'none', fontWeight:600}}
                      >
                        {isSubmitting ? '⏳ Submitting...' : '📤 Submit to Company'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
