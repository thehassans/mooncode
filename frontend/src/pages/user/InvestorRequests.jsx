import React, { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../api'

export default function InvestorRequests(){
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState([])
  const [msg, setMsg] = useState('')

  async function load(){
    try{
      setLoading(true)
      const { requests } = await apiGet('/api/users/investor-requests')
      setList(Array.isArray(requests) ? requests : [])
    }catch(e){ setMsg(e?.message || 'Failed to load') }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ load() }, [])

  async function accept(id){
    try{ await apiPost(`/api/users/investor-requests/${id}/accept`, {}); setMsg('Accepted'); setTimeout(()=> setMsg(''), 1500); load() }catch(e){ setMsg(e?.message || 'Failed'); setTimeout(()=> setMsg(''), 2000) }
  }
  async function reject(id){
    try{ await apiPost(`/api/users/investor-requests/${id}/reject`, {}); setMsg('Rejected'); setTimeout(()=> setMsg(''), 1500); load() }catch(e){ setMsg(e?.message || 'Failed'); setTimeout(()=> setMsg(''), 2000) }
  }

  function fmt(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function when(s){ try{ return new Date(s).toLocaleString() }catch{ return '' } }

  return (
    <div className="section" style={{ display:'grid', gap: 24 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Investor Requests</div>
          <div className="page-subtitle">Review and accept or reject investment requests</div>
        </div>
      </div>

      {msg && (
        <div style={{ padding:12, borderRadius:8, background:'var(--panel)', border:'1px solid var(--border)' }}>{msg}</div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div className="spinner" />
          <div style={{ marginTop: 10, opacity: 0.7 }}>Loading…</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header"><div className="card-title">Requests</div></div>
          <div style={{ padding: 12 }}>
            {list.length === 0 ? (
              <div style={{ padding: 24, opacity: 0.7 }}>No requests</div>
            ) : (
              <div style={{ display:'grid', gap: 12 }}>
                {list.map(r => (
                  <div key={r._id} className="card" style={{ display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', padding:12 }}>
                    <div style={{ display:'grid', gap:6 }}>
                      <div style={{ fontWeight:700 }}>{(r.investor?.firstName||'') + ' ' + (r.investor?.lastName||'')}</div>
                      <div style={{ fontSize:13, opacity:0.8 }}>Package {r.packageIndex}: {r.packageName} • Price: {r.currency} {fmt(r.packagePrice)} • Profit: {fmt(r.packageProfitPercentage)}%</div>
                      <div style={{ fontSize:13 }}>Requested Amount: {r.currency} {fmt(r.amount)} • Status: {r.status} • {when(r.createdAt)}</div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      {r.status === 'pending' ? (
                        <>
                          <button className="btn" onClick={()=> accept(r._id)}>Accept</button>
                          <button className="btn danger" onClick={()=> reject(r._id)}>Reject</button>
                        </>
                      ) : (
                        <span style={{ fontSize:12, textTransform:'uppercase', opacity:0.8 }}>{r.status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
