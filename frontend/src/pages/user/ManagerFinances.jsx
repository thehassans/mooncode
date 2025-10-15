import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { useToast } from '../../ui/Toast.jsx'

function Info({ label, value }){
  return (
    <div className="panel" style={{ padding:10, borderRadius:10 }}>
      <div className="helper" style={{ fontSize:12 }}>{label}</div>
      <div style={{ fontWeight:700 }}>{value}</div>
    </div>
  )
}

export default function ManagerFinances(){
  const toast = useToast()
  const [country, setCountry] = useState('')
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(false)
  const [remits, setRemits] = useState([])        // driver -> manager
  const [mgrRemits, setMgrRemits] = useState([])  // manager -> company

  useEffect(()=>{ (async()=>{ try{ const r = await apiGet('/api/orders/options'); setCountries(Array.isArray(r?.countries)? r.countries:[]) }catch{} })() },[])

  function ccy(c){ const k=String(c||'').toLowerCase(); if(k.includes('saudi')||k==='ksa') return 'SAR'; if(k.includes('united arab emirates')||k==='uae'||k==='ae') return 'AED'; if(k==='oman'||k==='om') return 'OMR'; if(k==='bahrain'||k==='bh') return 'BHD'; if(k==='india'||k==='in') return 'INR'; if(k==='kuwait'||k==='kw'||k==='kwt') return 'KWD'; if(k==='qatar'||k==='qa') return 'QAR'; return 'SAR' }
  const currency = ccy(country)
  function num(n){ return Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2}) }
  function userName(u){ if(!u) return '-'; return (`${u.firstName||''} ${u.lastName||''}`).trim() || (u.email||'-') }

  async function refresh(){
    if (!country){ setRemits([]); setMgrRemits([]); return }
    setLoading(true)
    try{
      const rs = await apiGet('/api/finance/remittances')
      const all = Array.isArray(rs?.remittances) ? rs.remittances : []
      setRemits(all.filter(x => String(x?.country||'').toLowerCase() === String(country).toLowerCase()))
      const ms = await apiGet(`/api/finance/manager-remittances?country=${encodeURIComponent(country)}`)
      setMgrRemits(Array.isArray(ms?.remittances) ? ms.remittances : [])
    }catch(e){ toast.error(e?.message||'Failed to load') }
    finally{ setLoading(false) }
  }
  useEffect(()=>{ refresh() }, [country])

  const acceptedByManagers = useMemo(()=> remits.filter(r=> String(r.status||'').toLowerCase()==='accepted').reduce((s,r)=> s+Number(r.amount||0),0), [remits])
  const approvedMgrToCompany = useMemo(()=> mgrRemits.filter(r=> String(r.status||'').toLowerCase()==='accepted').reduce((s,r)=> s+Number(r.amount||0),0), [mgrRemits])

  async function acceptMgrRemit(id){ try{ await apiPost(`/api/finance/manager-remittances/${id}/accept`,{}); toast.success('Accepted'); await refresh() }catch(e){ toast.error(e?.message||'Failed to accept') } }
  async function rejectMgrRemit(id){ try{ await apiPost(`/api/finance/manager-remittances/${id}/reject`,{}); toast.warn('Rejected'); await refresh() }catch(e){ toast.error(e?.message||'Failed to reject') } }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Manager Finances</div>
          <div className="page-subtitle">Driver ➝ Manager accepted remittances and Manager ➝ Company approvals</div>
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header"><div className="card-title">Filters</div></div>
        <div className="section" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:8}}>
          <select className="input" value={country} onChange={e=> setCountry(e.target.value)}>
            <option value="">Select Country</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header" style={{justifyContent:'space-between'}}>
          <div className="card-title">Driver ➝ Manager (Accepted)</div>
          <div className="helper">Total: <b style={{color:'#22c55e'}}>{currency} {num(acceptedByManagers)}</b></div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          {loading ? <div className="helper">Loading…</div> : (
            <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
              <thead>
                <tr>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Manager</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Driver</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Country</th>
                  <th style={{textAlign:'right', padding:'8px 10px'}}>Amount ({currency})</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Accepted</th>
                </tr>
              </thead>
              <tbody>
                {remits.filter(r=> String(r.status||'').toLowerCase()==='accepted').map(r => (
                  <tr key={String(r._id)} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'8px 10px'}}>{userName(r.manager)}</td>
                    <td style={{padding:'8px 10px'}}>{userName(r.driver)}</td>
                    <td style={{padding:'8px 10px'}}>{r.country||'-'}</td>
                    <td style={{padding:'8px 10px', textAlign:'right', color:'#22c55e', fontWeight:800}}>{num(r.amount)}</td>
                    <td style={{padding:'8px 10px'}}>{r.acceptedAt ? new Date(r.acceptedAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header" style={{justifyContent:'space-between'}}>
          <div className="card-title">Manager ➝ Company</div>
          <div className="helper">Approved: <b style={{color:'#22c55e'}}>{currency} {num(approvedMgrToCompany)}</b></div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', padding:'8px 10px'}}>Manager</th>
                <th style={{textAlign:'left', padding:'8px 10px'}}>Country</th>
                <th style={{textAlign:'right', padding:'8px 10px'}}>Amount ({currency})</th>
                <th style={{textAlign:'left', padding:'8px 10px'}}>Method</th>
                <th style={{textAlign:'left', padding:'8px 10px'}}>Created</th>
                <th style={{textAlign:'left', padding:'8px 10px'}}>Receipt</th>
                <th style={{textAlign:'left', padding:'8px 10px'}}>Status</th>
                <th style={{textAlign:'left', padding:'8px 10px'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mgrRemits.map(r => (
                <tr key={String(r._id)} style={{borderTop:'1px solid var(--border)'}}>
                  <td style={{padding:'8px 10px'}}>{userName(r.manager)}</td>
                  <td style={{padding:'8px 10px'}}>{r.country||'-'}</td>
                  <td style={{padding:'8px 10px', textAlign:'right', color:'#22c55e', fontWeight:800}}>{num(r.amount)}</td>
                  <td style={{padding:'8px 10px'}}>{String(r.method||'hand').toUpperCase()}</td>
                  <td style={{padding:'8px 10px'}}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</td>
                  <td style={{padding:'8px 10px'}}>{r.receiptPath ? <a href={`${API_BASE}${r.receiptPath}`} target="_blank" rel="noreferrer">Proof</a> : '—'}</td>
                  <td style={{padding:'8px 10px'}}>{String(r.status||'').toUpperCase()}</td>
                  <td style={{padding:'8px 10px'}}>
                    {String(r.status||'').toLowerCase()==='pending' ? (
                      <div style={{display:'flex', gap:6}}>
                        <button className="btn small success" onClick={()=> acceptMgrRemit(String(r._id||''))}>Accept</button>
                        <button className="btn small secondary" onClick={()=> rejectMgrRemit(String(r._id||''))}>Reject</button>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
