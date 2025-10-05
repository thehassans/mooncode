import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiPatch } from '../../api'
import { useToast } from '../../ui/Toast.jsx'

export default function OnlineOrders(){
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('') // new|processing|done|cancelled
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const loadingMoreRef = useRef(false)
  const endRef = useRef(null)

  const buildQuery = useMemo(()=>{
    const sp = new URLSearchParams()
    if (q.trim()) sp.set('q', q.trim())
    if (status.trim()) sp.set('status', status.trim())
    if (start) sp.set('start', start)
    if (end) sp.set('end', end)
    return sp
  }, [q, status, start, end])

  async function load(reset=false){
    if (loadingMoreRef.current) return
    loadingMoreRef.current = true
    try{
      if (reset){ setLoading(true); setRows([]); setPage(1); setHasMore(true) }
      const nextPage = reset ? 1 : (page + 1)
      const params = new URLSearchParams(buildQuery.toString())
      params.set('page', String(nextPage))
      params.set('limit', '20')
      const res = await apiGet(`/api/ecommerce/orders?${params.toString()}`)
      const list = Array.isArray(res?.orders) ? res.orders : []
      setRows(prev => reset ? list : [...prev, ...list])
      setHasMore(!!res?.hasMore)
      setPage(nextPage)
      setError('')
    }catch(e){ setError(e?.message||'Failed to load online orders'); setHasMore(false) }
    finally{ setLoading(false); loadingMoreRef.current = false }
  }

  useEffect(()=>{ load(true) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [buildQuery])
  useEffect(()=>{ load(true) }, [])

  // Infinite scroll
  useEffect(()=>{
    const el = endRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries)=>{
      const [e] = entries
      if (e.isIntersecting && hasMore && !loadingMoreRef.current){ load(false) }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return ()=>{ try{ obs.disconnect() }catch{} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endRef.current, hasMore, page, buildQuery])

  async function updateStatus(id, next){
    try{
      await apiPatch(`/api/ecommerce/orders/${id}`, { status: next })
      setRows(prev => prev.map(r => r._id === id ? { ...r, status: next } : r))
      toast.success('Status updated')
    }catch(e){ toast.error(e?.message || 'Failed to update status') }
  }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-pink">Online Orders</div>
          <div className="page-subtitle">Website orders submitted by customers</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header"><div className="card-title">Filters</div></div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8}}>
          <input className="input" placeholder="Search name, phone, address, city, area" value={q} onChange={e=> setQ(e.target.value)} />
          <select className="input" value={status} onChange={e=> setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="processing">Processing</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input className="input" type="date" value={start} onChange={e=> setStart(e.target.value)} />
          <input className="input" type="date" value={end} onChange={e=> setEnd(e.target.value)} />
          <button className="btn secondary" onClick={()=> load(true)} disabled={loading}>{loading? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>

      {/* List */}
      <div className="card" style={{display:'grid', gap:8}}>
        {loading && rows.length===0 ? (
          <div className="section">Loading…</div>
        ) : error ? (
          <div className="section error">{error}</div>
        ) : rows.length===0 ? (
          <div className="section">No online orders found.</div>
        ) : (
          <div className="section" style={{overflowX:'auto'}}>
            <table className="table" style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
              <thead>
                <tr>
                  <th style={{textAlign:'left'}}>Timestamp</th>
                  <th style={{textAlign:'left'}}>Customer</th>
                  <th style={{textAlign:'left'}}>Phone</th>
                  <th style={{textAlign:'left'}}>Product(s)</th>
                  <th style={{textAlign:'right'}}>Total</th>
                  <th style={{textAlign:'left'}}>Address</th>
                  <th style={{textAlign:'left'}}>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const products = Array.isArray(r.items) ? r.items.map(it => `${it.name||''} (${it.quantity||1})`).join(', ') : '-'
                  const addr = [r.address, r.area, r.city, r.orderCountry].filter(Boolean).join(', ')
                  return (
                    <tr key={r._id} style={{borderTop:'1px solid var(--border)'}}>
                      <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</td>
                      <td>{r.customerName||'-'}</td>
                      <td>{r.customerPhone||'-'}</td>
                      <td style={{maxWidth:280, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={products}>{products}</td>
                      <td style={{textAlign:'right'}}>{(r.currency||'SAR')} {Number(r.total||0).toFixed(2)}</td>
                      <td style={{maxWidth:300, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={addr}>{addr}</td>
                      <td>{r.status||'new'}</td>
                      <td style={{textAlign:'right'}}>
                        <select className="input" value={r.status||'new'} onChange={e=> updateStatus(r._id, e.target.value)}>
                          <option value="new">New</option>
                          <option value="processing">Processing</option>
                          <option value="done">Done</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={endRef} />
    </div>
  )
}
