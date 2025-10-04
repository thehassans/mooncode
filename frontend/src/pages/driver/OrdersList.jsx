import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiGet } from '../../api'

const VIEWS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'attempted', label: 'Attempted' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'no_response', label: 'No Response' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default function DriverOrdersList(){
  const location = useLocation()
  const navigate = useNavigate()
  const qs = useMemo(()=> new URLSearchParams(location.search), [location.search])
  const view = qs.get('view') || 'assigned'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load(){
    setLoading(true)
    setError('')
    try{
      const data = await apiGet(`/api/orders/driver/list?view=${encodeURIComponent(view)}`)
      setRows(Array.isArray(data?.orders) ? data.orders : [])
    }catch(e){ setError(e?.message || 'Failed to load orders') }
    finally{ setLoading(false) }
  }
  useEffect(()=>{ load() },[view])

  function setView(v){
    const q = new URLSearchParams(location.search)
    q.set('view', v)
    navigate(`/driver/orders?${q.toString()}`)
  }

  function fmtDate(s){ try{ return new Date(s).toLocaleString() }catch{ return '' } }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">{VIEWS.find(v=>v.key===view)?.label || 'Orders'}</div>
          <div className="page-subtitle">Your orders ({view.replace('_',' ')})</div>
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          {VIEWS.map(v => (
            <button key={v.key} className={`btn ${v.key===view? '' : 'secondary'}`} onClick={()=> setView(v.key)}>{v.label}</button>
          ))}
        </div>
      </div>

      {error ? <div className="card"><div className="section"><div className="helper-text error">{error}</div></div></div> : null}

      <div className="card">
        <div className="card-header">
          <div className="card-title">Orders</div>
          <div className="card-subtitle">{rows.length} found</div>
        </div>
        <div style={{overflow:'auto'}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Invoice</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Customer</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>City</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Status</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{padding:12, opacity:0.7}}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} style={{padding:12, opacity:0.7}}>No orders</td></tr>
              ) : (
                rows.map(o => (
                  <tr key={String(o._id||o.id)} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'10px 12px'}}>{o.invoiceNumber || (String(o._id||'').slice(-6).toUpperCase())}</td>
                    <td style={{padding:'10px 12px'}}>{o.customerName||'-'}</td>
                    <td style={{padding:'10px 12px'}}>{o.city||'-'}</td>
                    <td style={{padding:'10px 12px'}}>{o.shipmentStatus||'-'}</td>
                    <td style={{padding:'10px 12px'}}>{fmtDate(o.createdAt)}</td>
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
