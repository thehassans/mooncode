import React, { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../../api.js'

export default function DriverPayout(){
  const [company, setCompany] = useState({ method:'bank', accountName:'', bankName:'', iban:'', accountNumber:'', phoneNumber:'' })
  const [companyMsg, setCompanyMsg] = useState('')
  const [summary, setSummary] = useState({ totalDeliveredOrders: 0, totalCollectedAmount: 0, deliveredToCompany: 0, pendingToCompany: 0, currency: '' })
  const [remittances, setRemittances] = useState([])
  

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{ const r = await apiGet('/api/finance/company/payout-profile'); if (alive) setCompany(c=>({ ...c, ...(r?.profile||{}) })) }catch{}
      try{ const s = await apiGet('/api/finance/remittances/summary'); if (alive) setSummary({ totalDeliveredOrders: Number(s?.totalDeliveredOrders||0), totalCollectedAmount: Number(s?.totalCollectedAmount||0), deliveredToCompany: Number(s?.deliveredToCompany||0), pendingToCompany: Number(s?.pendingToCompany||0), currency: s?.currency||'' }) }catch{}
      try{ const rr = await apiGet('/api/finance/remittances'); if (alive) setRemittances(Array.isArray(rr?.remittances)? rr.remittances:[]) }catch{}
    })()
    return ()=>{ alive = false }
  },[])

  const pendingToCompany = useMemo(()=>{
    const direct = summary?.pendingToCompany
    if (direct != null && !Number.isNaN(Number(direct))) return Number(direct)
    const total = Number(summary?.totalCollectedAmount||0)
    const delivered = Number(summary?.deliveredToCompany||0)
    return Math.max(0, total - delivered)
  }, [summary])

  return (
    <div className="content" style={{ display:'grid', gap:16, padding:16, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display:'grid', gap:6 }}>
        <div style={{ fontWeight:800, fontSize:20 }}>Payout</div>
        <div className="helper">Drivers collect amounts from customers on delivery and must remit those amounts to the company. View company bank details and your settlement summary below.</div>
      </div>

      {/* Company Details */}
      <div className="card" style={{ display:'grid', gap:10 }}>
        <div className="card-header">
          <div className="card-title">Company Bank / Wallet Details</div>
          <div className="card-subtitle">Use these details to remit collected amounts to the company</div>
        </div>
        <div className="section" style={{ display:'grid', gap:8 }}>
          <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap:8 }}>
            <Info label="Method" value={(company.method||'bank').toUpperCase()} />
            <Info label="Account Name" value={company.accountName||'—'} />
            {company.method==='bank' && (
              <>
                <Info label="Bank Name" value={company.bankName||'—'} />
                <Info label="IBAN / Account #" value={company.iban || company.accountNumber || '—'} />
              </>
            )}
            {company.method!=='bank' && (
              <Info label="Wallet Phone" value={company.phoneNumber||'—'} />
            )}
          </div>
          {companyMsg && <div className="helper" style={{ fontWeight:600 }}>{companyMsg}</div>}
        </div>
      </div>

      {/* My Settlement Summary */}
      <div className="card" style={{ display:'grid', gap:10 }}>
        <div className="card-header">
          <div className="card-title">My Settlement Summary</div>
        </div>
        <div className="section" style={{ display:'grid', gap:8 }}>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <span className="badge">Total Delivered Orders: {summary.totalDeliveredOrders}</span>
            <span className="badge">Total Collected: {summary.currency} {summary.totalCollectedAmount.toFixed(2)}</span>
            <span className="badge">Delivered to Company: {summary.currency} {Number(summary.deliveredToCompany||0).toFixed(2)}</span>
            <span className="badge warning">Pending to Company: {summary.currency} {pendingToCompany.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* My Remittances */}
      <div className="card" style={{ display:'grid', gap:10 }}>
        <div className="card-header">
          <div className="card-title">My Remittances</div>
        </div>
        <div className="section" style={{ overflowX:'auto' }}>
          {remittances.length===0 ? (
            <div className="empty-state">No remittances yet</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
              <thead>
                <tr>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Date</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Approver</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Amount</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {remittances.map(r => (
                  <tr key={String(r._id||r.id)} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{ padding:'8px 10px' }}>{new Date(r.createdAt).toLocaleString()}</td>
                    <td style={{ padding:'8px 10px' }}>{r.approverRole==='user' ? 'Owner' : 'Manager'}</td>
                    <td style={{ padding:'8px 10px' }}>PKR {Number(r.amount||0).toFixed(2)}</td>
                    <td style={{ padding:'8px 10px' }}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
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
