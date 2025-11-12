import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'

export default function InvestorRequests(){
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState([])
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('pending')

  async function load(){
    try{
      setLoading(true)
      const { requests } = await apiGet('/api/users/investor-requests')
      setList(Array.isArray(requests) ? requests : [])
    }catch(e){ setMsg(e?.message || 'Failed to load') }
    finally{ setLoading(false) }
  }

  useEffect(()=>{
    load()
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(undefined, { path:'/socket.io', transports:['polling'], upgrade:false, auth:{ token }, withCredentials:true })
      socket.on('investor.request.created', load)
      socket.on('investor.request.accepted', load)
      socket.on('investor.request.rejected', load)
    }catch{}
    return ()=>{ try{ socket && socket.disconnect() }catch{} }
  },[])

  async function accept(id){
    try{ await apiPost(`/api/users/investor-requests/${id}/accept`, {}); setMsg('Accepted'); setTimeout(()=> setMsg(''), 1500); load() }catch(e){ setMsg(e?.message || 'Failed'); setTimeout(()=> setMsg(''), 2000) }
  }
  async function reject(id){
    try{ await apiPost(`/api/users/investor-requests/${id}/reject`, {}); setMsg('Rejected'); setTimeout(()=> setMsg(''), 1500); load() }catch(e){ setMsg(e?.message || 'Failed'); setTimeout(()=> setMsg(''), 2000) }
  }

  function fmt(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function when(s){ try{ return new Date(s).toLocaleString() }catch{ return '' } }
  function badge(status){
    const base = { padding:'6px 10px', borderRadius:999, fontSize:12, fontWeight:800 }
    if (status==='accepted') return <span style={{...base, background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.35)', color:'#10b981'}}>Accepted</span>
    if (status==='rejected') return <span style={{...base, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.35)', color:'#ef4444'}}>Rejected</span>
    return <span style={{...base, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.35)', color:'#3b82f6'}}>Pending</span>
  }

  const filtered = useMemo(()=>{
    const t = String(tab||'').toLowerCase()
    const text = String(q||'').trim().toLowerCase()
    return (list||[])
      .filter(r => t==='all' ? true : r.status===t)
      .filter(r => !text ? true : (
        String(r.investor?.firstName||'').toLowerCase().includes(text) ||
        String(r.investor?.lastName||'').toLowerCase().includes(text) ||
        String(r.investor?.email||'').toLowerCase().includes(text) ||
        String(r.packageName||'').toLowerCase().includes(text)
      ))
  }, [list, tab, q])

  return (
    <div className="section" style={{ display:'grid', gap: 20, maxWidth: 1200, margin:'0 auto' }}>
      <div style={{ borderRadius: 16, padding: 20, background:'linear-gradient(135deg, rgba(102,126,234,0.12), rgba(118,75,162,0.12))', border:'1px solid rgba(102,126,234,0.25)', boxShadow:'0 10px 40px rgba(102,126,234,0.15)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, background:'linear-gradient(135deg, #667eea, #764ba2)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Investor Requests</div>
            <div style={{ opacity:0.75 }}>Review incoming investment requests and approve or reject</div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <div style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:999, padding:4, display:'flex', gap:4 }}>
              {['pending','accepted','rejected','all'].map(t => (
                <button key={t} onClick={()=> setTab(t)} style={{ padding:'8px 12px', borderRadius:999, border:'none', cursor:'pointer', fontWeight:800, background: (tab===t)?'linear-gradient(135deg, #667eea, #764ba2)':'transparent', color:(tab===t)?'#fff':'var(--text)' }}>{t[0].toUpperCase()+t.slice(1)}</button>
              ))}
            </div>
            <input value={q} onChange={e=> setQ(e.target.value)} placeholder="Search investor or package" style={{ padding:'10px 14px', borderRadius:999, border:'1px solid var(--border)', background:'var(--panel)' }} />
          </div>
        </div>
      </div>

      {msg && (
        <div style={{ padding:12, borderRadius:8, background:'var(--panel)', border:'1px solid var(--border)' }}>{msg}</div>
      )}

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div className="spinner" />
          <div style={{ marginTop: 10, opacity: 0.7 }}>Loading…</div>
        </div>
      ) : (
        <div style={{ display:'grid', gap:12 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, borderRadius: 12, border:'1px solid var(--border)', background:'var(--panel)', textAlign:'center', opacity:0.8 }}>No requests</div>
          ) : (
            filtered.map(r => (
              <div key={r._id} style={{ display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:12, padding:16, borderRadius:14, border:'1px solid var(--border)', background:'linear-gradient(135deg, rgba(250,250,250,0.6), rgba(255,255,255,0.6))' }}>
                <div style={{ display:'grid', gap:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <div style={{ fontWeight:900 }}>{(r.investor?.firstName||'') + ' ' + (r.investor?.lastName||'')}</div>
                    {badge(r.status)}
                  </div>
                  <div style={{ fontSize:13, opacity:0.85 }}>Package {r.packageIndex}: {r.packageName} • Price: {r.currency} {fmt(r.packagePrice)} • Profit: {fmt(r.packageProfitPercentage)}%</div>
                  <div style={{ fontSize:13 }}>Requested Amount: <b>{r.currency} {fmt(r.amount)}</b>{r.note?` • Note: ${r.note}`:''} • {when(r.createdAt)}</div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {r.status === 'pending' ? (
                    <>
                      <button onClick={()=> accept(r._id)} style={{ padding:'10px 14px', borderRadius:999, border:'none', background:'linear-gradient(135deg, #10b981, #059669)', color:'#fff', fontWeight:900, cursor:'pointer' }}>Accept</button>
                      <button onClick={()=> reject(r._id)} style={{ padding:'10px 14px', borderRadius:999, border:'1px solid rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.08)', color:'#ef4444', fontWeight:900, cursor:'pointer' }}>Reject</button>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
