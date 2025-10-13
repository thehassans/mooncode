import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'

export default function Shipments(){
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(()=>{ load() },[])
  // Live refresh on order updates
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token')||''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const reload = ()=>{ try{ load() }catch{} }
      socket.on('orders.changed', reload)
    }catch{}
    return ()=>{ try{ socket && socket.off('orders.changed') }catch{}; try{ socket && socket.disconnect() }catch{} }
  },[])

  async function load(){
    setLoading(true)
    try{
      const data = await apiGet('/api/orders')
      setRows(data.orders || [])
    }catch(err){ setMsg(err?.message || 'Failed to load orders') }
    finally{ setLoading(false) }
  }

  // Shipped logic removed from UI. We only keep Deliver/Return actions.

  async function onDeliver(o){
    try{
      await apiPost(`/api/orders/${o._id}/deliver`, { collectedAmount: Number(o.collectedAmount || 0) })
      await load()
    }catch(err){ alert(err?.message || 'Failed to mark delivered') }
  }

  async function onReturn(o){
    try{
      await apiPost(`/api/orders/${o._id}/return`, { reason: o.returnReason || '' })
      await load()
    }catch(err){ alert(err?.message || 'Failed to mark returned') }
  }

  const filtered = useMemo(()=> rows.slice(), [rows])

  // Group by country for 4 tables
  const groups = useMemo(()=>{
    const by = { UAE: [], Oman: [], KSA: [], Bahrain: [] }
    for (const o of filtered){
      const c = ['UAE','Oman','KSA','Bahrain'].includes(String(o.orderCountry)) ? o.orderCountry : 'UAE'
      by[c].push(o)
    }
    return by
  }, [filtered])

  function priceOf(o){
    const qty = Math.max(1, Number(o?.quantity||1))
    if (o?.total != null) return Number(o.total)
    const unit = Number(o?.productId?.price||0)
    return unit * qty
  }

  function userName(u){ if (!u) return '-'; return `${u.firstName||''} ${u.lastName||''}`.trim() || (u.email||'-') }

  function fmtDate(s){ try{ return new Date(s).toLocaleString() }catch{ return ''} }

  function StatusBadge({ s }){
    const k = String(s||'').toLowerCase()
    let style = { border:'1px solid #e5e7eb', color:'#374151', padding:'2px 8px', borderRadius:999, fontSize:12 }
    if (k==='delivered') style = { ...style, borderColor:'#10b981', color:'#065f46' }
    else if (['in_transit','assigned','picked_up'].includes(k)) style = { ...style, borderColor:'#3b82f6', color:'#1d4ed8' }
    else if (['returned','cancelled','canceled'].includes(k)) style = { ...style, borderColor:'#ef4444', color:'#991b1b' }
    else if (k==='pending') style = { ...style, borderColor:'#f59e0b', color:'#b45309' }
    return <span style={style}>{s||'-'}</span>
  }

  function CountryTable({ country, list }){
    const totals = useMemo(()=>{
      let amt = 0
      for (const o of list) amt += priceOf(o)
      return { count: list.length, amt }
    }, [list])
    return (
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
          <div style={{fontWeight:700}}>{country} Shipments</div>
          <div className="helper">Orders: {totals.count.toLocaleString()} • Total Amount: {totals.amt.toFixed(2)}</div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
            <thead>
              <tr>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>City</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Phone</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Details</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Product</th>
                <th style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>Qty</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Delivery Boy</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Created By</th>
                <th style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>Total Amount</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Notes</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Status</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Courier</th>
                <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)'}}>Tracking</th>
                <th style={{padding:'10px 12px', textAlign:'left'}}>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} style={{padding:'10px 12px', opacity:0.7}}>Loading...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={13} style={{padding:'10px 12px', opacity:0.7}}>No orders</td></tr>
              ) : (
                list.map((o, idx) => (
                  <tr key={o._id} style={{borderTop:'1px solid var(--border)', background: idx%2? 'transparent':'var(--panel)'}}>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{o.city || '-'}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{`${o.phoneCountryCode||''} ${o.customerPhone||''}`.trim()}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{o.details||'-'}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{o.productId?.name||'-'}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{Math.max(1, Number(o.quantity||1))}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{o.deliveryBoy ? userName(o.deliveryBoy) : '-'}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{o.createdBy ? userName(o.createdBy) : '-'}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{priceOf(o).toFixed(2)}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{o.deliveryNotes||'-'}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}><StatusBadge s={o.shipmentStatus} /></td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{o.courierName||'-'}</td>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{o.trackingNumber||'-'}</td>
                    <td style={{padding:'10px 12px'}}>{o.createdAt? new Date(o.createdAt).toLocaleString() : ''}</td>
                  </tr>
                ))
              )}
              {!loading && list.length>0 && (
                <tr style={{borderTop:'2px solid var(--border)', background:'rgba(59,130,246,0.08)'}}>
                  <td style={{padding:'10px 12px', fontWeight:800}}>Totals</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{totals.amt.toFixed(2)}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div style={{display:'grid', gap:12}}>
      <div className="page-header"><div className="page-title">Shipments</div><div className="page-subtitle">Delivered-focused shipment view by country</div></div>
      {msg && <div className="error">{msg}</div>}
      <CountryTable country="UAE" list={groups.UAE} />
      <CountryTable country="Oman" list={groups.Oman} />
      <CountryTable country="KSA" list={groups.KSA} />
      <CountryTable country="Bahrain" list={groups.Bahrain} />
    </div>
  )
}
