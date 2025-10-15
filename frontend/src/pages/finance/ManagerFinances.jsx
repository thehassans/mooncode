import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { io } from 'socket.io-client'
import Modal from '../../components/Modal.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function ManagerFinances(){
  const toast = useToast()
  const [country, setCountry] = useState('')
  const [status, setStatus] = useState('')
  const [manager, setManager] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [countries, setCountries] = useState([])
  const [managers, setManagers] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [acceptModal, setAcceptModal] = useState(null)

  useEffect(()=>{
    (async()=>{
      try{
        const r = await apiGet('/api/orders/options')
        const arr = Array.isArray(r?.countries) ? r.countries : []
        const map = new Map()
        for (const c of arr){
          const raw = String(c||'').trim()
          const key = raw.toLowerCase()
          if (!map.has(key)) map.set(key, raw.toUpperCase() === 'UAE' ? 'UAE' : raw)
        }
        setCountries(Array.from(map.values()))
      }catch{ setCountries([]) }
    })()
  },[])

  useEffect(()=>{ (async()=>{ try{ const m = await apiGet('/api/users/managers?q='); setManagers(Array.isArray(m?.users)? m.users: []) }catch{ setManagers([]) } })() },[])

  async function loadRemits(){
    setLoading(true)
    try{
      const q = new URLSearchParams()
      if (country) q.set('country', country)
      if (status) q.set('status', status)
      if (manager) q.set('manager', manager)
      if (fromDate) q.set('start', fromDate)
      if (toDate) q.set('end', toDate)
      q.set('limit','200')
      const r = await apiGet(`/api/finance/manager-remittances?${q.toString()}`)
      const list = Array.isArray(r?.remittances) ? r.remittances : []
      list.sort((a,b)=>{
        const dir = sortDir==='asc'?1:-1
        const ka = sortBy==='amount'? Number(a.amount||0) : new Date(a.createdAt||0).getTime()
        const kb = sortBy==='amount'? Number(b.amount||0) : new Date(b.createdAt||0).getTime()
        if (ka<kb) return -1*dir; if (ka>kb) return 1*dir; return 0
      })
      setRows(list)
      setErr('')
    }catch(e){ setErr(e?.message||'Failed to load remittances') }
    finally{ setLoading(false) }
  }
  useEffect(()=>{ loadRemits() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [country, status, manager, fromDate, toDate, sortBy, sortDir])

  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token')||''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const onEvt = ()=> loadRemits()
      socket.on('managerRemit.created', onEvt)
      socket.on('managerRemit.accepted', onEvt)
      socket.on('managerRemit.rejected', onEvt)
    }catch{}
    return ()=>{
      try{ socket && socket.off('managerRemit.created') }catch{}
      try{ socket && socket.off('managerRemit.accepted') }catch{}
      try{ socket && socket.off('managerRemit.rejected') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[])

  async function accept(id){ try{ await apiPost(`/api/finance/manager-remittances/${id}/accept`,{}); toast.success('Accepted'); setAcceptModal(null); await loadRemits() }catch(e){ toast.error(e?.message||'Failed to accept') } }
  async function reject(id){ try{ await apiPost(`/api/finance/manager-remittances/${id}/reject`,{}); toast.warn('Rejected'); setAcceptModal(null); await loadRemits() }catch(e){ toast.error(e?.message||'Failed to reject') } }

  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }

  function exportCsv(){
    try{
      const header = ['Manager','Email','Country','Amount','Currency','Method','Status','Created']
      const lines = [header.join(',')]
      for (const r of rows){
        lines.push([
          `${r.manager?.firstName||''} ${r.manager?.lastName||''}`.trim(),
          r.manager?.email||'',
          r.country||'',
          r.amount||0,
          r.currency||'',
          (r.method||'').toUpperCase(),
          r.status||'',
          r.createdAt ? new Date(r.createdAt).toISOString() : '',
        ].map(v=> typeof v==='string' && v.includes(',') ? `"${v.replace(/"/g,'""')}"` : v).join(','))
      }
      const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `manager-finances-${country||'all'}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }catch{}
  }

  const filteredByManager = useMemo(()=>{
    const map = new Map()
    for (const r of rows){
      const id = String(r?.manager?._id || r?.manager || '')
      if (!id) continue
      if (!map.has(id)) map.set(id, [])
      map.get(id).push(r)
    }
    return map
  }, [rows])

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Manager Finances</div>
          <div className="page-subtitle">View and accept amounts sent by managers to the company</div>
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header">
          <div className="card-title">Filters</div>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:8}}>
          <select className="input" value={country} onChange={e=> setCountry(e.target.value)}>
            <option value=''>All Countries</option>
            {countries.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" value={manager} onChange={e=> setManager(e.target.value)}>
            <option value=''>All Managers</option>
            {managers.map(m=> <option key={String(m._id)} value={String(m._id)}>{`${m.firstName||''} ${m.lastName||''}`.trim() || (m.email||'Manager')}</option>)}
          </select>
          <select className="input" value={status} onChange={e=> setStatus(e.target.value)}>
            <option value=''>All Status</option>
            <option value='pending'>Pending</option>
            <option value='accepted'>Accepted</option>
            <option value='rejected'>Rejected</option>
          </select>
          <input className="input" type="date" value={fromDate} onChange={e=> setFromDate(e.target.value)} />
          <input className="input" type="date" value={toDate} onChange={e=> setToDate(e.target.value)} />
          <select className="input" value={sortBy} onChange={e=> setSortBy(e.target.value)}>
            <option value='createdAt'>Sort by Date</option>
            <option value='amount'>Sort by Amount</option>
          </select>
          <select className="input" value={sortDir} onChange={e=> setSortDir(e.target.value)}>
            <option value='desc'>Desc</option>
            <option value='asc'>Asc</option>
          </select>
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:8}}>
        <div className="card-header" style={{alignItems:'center', justifyContent:'space-between'}}>
          <div className="card-title">All Manager Remittances</div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          {err && <div className="error">{err}</div>}
          {loading ? (
            <div className="helper">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="helper">No remittances found</div>
          ) : (
            <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
              <thead>
                <tr>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Manager</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Country</th>
                  <th style={{textAlign:'right', padding:'8px 10px'}}>Amount</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Method</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Note</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Created</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Status</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r=> (
                  <tr key={String(r._id||r.id)} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'8px 10px'}}>{`${r.manager?.firstName||''} ${r.manager?.lastName||''}`.trim() || (r.manager?.email||'-')}</td>
                    <td style={{padding:'8px 10px'}}>{r.country||'-'}</td>
                    <td style={{padding:'8px 10px', textAlign:'right', color:'#22c55e', fontWeight:800}}>{(r.currency||'')+' '+num(r.amount)}</td>
                    <td style={{padding:'8px 10px'}}>{String(r.method||'').toUpperCase()}</td>
                    <td style={{padding:'8px 10px'}}>{r.note||''}</td>
                    <td style={{padding:'8px 10px'}}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</td>
                    <td style={{padding:'8px 10px'}}>{r.status}</td>
                    <td style={{padding:'8px 10px'}}>
                      {r.status==='pending' ? (
                        <div style={{display:'flex', gap:8}}>
                          <button className="btn success" onClick={()=> setAcceptModal(r)}>Accept</button>
                          <button className="btn danger" onClick={()=> reject(String(r._id||r.id))}>Reject</button>
                        </div>
                      ) : (
                        <span className="helper">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {acceptModal && (
        <Modal
          title="Accept Manager Remittance"
          open={!!acceptModal}
          onClose={()=> setAcceptModal(null)}
          footer={
            <>
              <button className="btn secondary" onClick={()=> setAcceptModal(null)}>Close</button>
              <button className="btn success" onClick={()=> accept(String(acceptModal?._id||''))}>Accept</button>
              <button className="btn danger" onClick={()=> reject(String(acceptModal?._id||''))}>Reject</button>
            </>
          }
        >
          <div style={{display:'grid', gap:8}}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:8}}>
              <Info label="Manager" value={`${acceptModal?.manager?.firstName||''} ${acceptModal?.manager?.lastName||''}`.trim() || (acceptModal?.manager?.email||'-')} />
              <Info label="Country" value={acceptModal?.country||'-'} />
              <Info label="Amount" value={`${acceptModal?.currency||''} ${Number(acceptModal?.amount||0).toFixed(2)}`} />
              <Info label="Method" value={String(acceptModal?.method||'hand').toUpperCase()} />
              {acceptModal?.note ? <Info label="Note" value={acceptModal?.note} /> : null}
              <Info label="Created" value={acceptModal?.createdAt ? new Date(acceptModal.createdAt).toLocaleString() : '-'} />
            </div>
            {acceptModal?.receiptPath ? (
              <div>
                <div className="helper">Proof</div>
                <img src={`${API_BASE}${acceptModal.receiptPath}`} alt="Proof" style={{maxWidth:'100%', borderRadius:8, border:'1px solid var(--border)'}} />
              </div>
            ) : null}
          </div>
        </Modal>
      )}
    </div>
  )
}

function Info({ label, value }){
  return (
    <div className="panel" style={{ padding:10, borderRadius:10 }}>
      <div className="helper" style={{ fontSize:12 }}>{label}</div>
      <div style={{ fontWeight:700 }}>{value}</div>
    </div>
  )
}
