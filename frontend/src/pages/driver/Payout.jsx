import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiUpload } from '../../api.js'

export default function DriverPayout(){
  const [company, setCompany] = useState({ method:'bank', accountName:'', bankName:'', iban:'', accountNumber:'', phoneNumber:'' })
  const [companyMsg, setCompanyMsg] = useState('')
  const [summary, setSummary] = useState({ totalDeliveredOrders: 0, totalCancelledOrders: 0, totalCollectedAmount: 0, deliveredToCompany: 0, pendingToCompany: 0, currency: '' })
  const [remittances, setRemittances] = useState([])
  const [form, setForm] = useState({ method:'hand', amount:'', note:'', paidToName:'', file:null })
  const [submitting, setSubmitting] = useState(false)
  const [showCompany, setShowCompany] = useState(false)
  

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{ const r = await apiGet('/api/finance/company/payout-profile'); if (alive) setCompany(c=>({ ...c, ...(r?.profile||{}) })) }catch{}
      try{ const s = await apiGet('/api/finance/remittances/summary'); if (alive) setSummary({ totalDeliveredOrders: Number(s?.totalDeliveredOrders||0), totalCancelledOrders: Number(s?.totalCancelledOrders||0), totalCollectedAmount: Number(s?.totalCollectedAmount||0), deliveredToCompany: Number(s?.deliveredToCompany||0), pendingToCompany: Number(s?.pendingToCompany||0), currency: s?.currency||'' }) }catch{}
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

  // Prefill amount with pending when available and field is empty or non-positive
  useEffect(()=>{
    setForm(f => {
      const current = Number(f.amount || 0)
      if (!f.amount || !Number.isFinite(current) || current <= 0){
        return { ...f, amount: pendingToCompany.toFixed(2) }
      }
      return f
    })
  }, [pendingToCompany])

  return (
    <div className="content" style={{ display:'grid', gap:16, padding:16, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display:'grid', gap:6 }}>
        <div style={{ fontWeight:800, fontSize:20 }}>Payout</div>
        <div className="helper">Remit collected COD amounts to the company and track settlements.</div>
      </div>

      {/* Top Totals */}
      <div className="card" id="summary" style={{ display:'grid', gap:10 }}>
        <div className="card-header"><div className="card-title">My Settlement Summary</div></div>
        <div className="section" style={{ display:'grid', gap:8 }}>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <span className="badge">Total Delivered Orders: {summary.totalDeliveredOrders}</span>
            <span className="badge">Total Collected (Delivered): {summary.currency} {summary.totalCollectedAmount.toFixed(2)}</span>
            <span className="badge">Delivered to Company: {summary.currency} {Number(summary.deliveredToCompany||0).toFixed(2)}</span>
            <span className="badge warning">Pending Delivery to Company: {summary.currency} {pendingToCompany.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Pay Amount to Company */}
      <div className="card" id="pay" style={{ display:'grid', gap:10 }}>
        <div className="card-header"><div className="card-title">Pay Amount to Company</div></div>
        <div className="section" style={{ display:'grid', gap:10 }}>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <label className="badge" style={{display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer'}}>
              <input type="radio" name="method" value="hand" checked={form.method==='hand'} onChange={()=> setForm(f=>({...f, method:'hand'}))} /> Pay by hand
            </label>
            <label className="badge" style={{display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer'}}>
              <input type="radio" name="method" value="transfer" checked={form.method==='transfer'} onChange={()=> setForm(f=>({...f, method:'transfer'}))} /> Transfer to company
            </label>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:10 }}>
            <div>
              <label className="input-label">Amount ({summary.currency})</label>
              <input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={e=> setForm(f=>({...f, amount:e.target.value}))} placeholder={`Max ${pendingToCompany.toFixed(2)}`} />
            </div>
            {form.method==='hand' && (
              <div>
                <label className="input-label">Paid to (Name)</label>
                <input className="input" type="text" value={form.paidToName} onChange={e=> setForm(f=>({...f, paidToName:e.target.value}))} placeholder={company.accountName || 'Company Rep Name'} />
              </div>
            )}
            {form.method==='transfer' && (
              <div>
                <label className="input-label">Upload Proof (image)</label>
                <input className="input" type="file" accept="image/*" onChange={e=> setForm(f=>({...f, file: (e.target.files && e.target.files[0]) || null}))} />
              </div>
            )}
          </div>
          <div>
            <label className="input-label">Note (optional)</label>
            <textarea className="input" rows={2} value={form.note} onChange={e=> setForm(f=>({...f, note:e.target.value}))} />
          </div>
          <div>
            <button className="btn" disabled={submitting} onClick={async()=>{
              if (!form.amount) return alert('Enter amount')
              const amt = Number(form.amount)
              if (Number.isNaN(amt) || amt<=0) return alert('Enter a valid amount')
              if (amt > pendingToCompany) return alert('Amount exceeds pending to company')
              if (form.method==='transfer' && !form.file) return alert('Please attach a proof image for transfer to company')
              setSubmitting(true)
              try{
                const fd = new FormData()
                fd.append('amount', String(amt))
                fd.append('method', form.method)
                if (form.method==='hand' && form.paidToName) fd.append('paidToName', form.paidToName)
                if (form.note) fd.append('note', form.note)
                if (form.method==='transfer' && form.file) fd.append('receipt', form.file)
                await apiUpload('/api/finance/remittances', fd)
                // refresh summary and list
                try{ const s = await apiGet('/api/finance/remittances/summary'); setSummary({ totalDeliveredOrders: Number(s?.totalDeliveredOrders||0), totalCancelledOrders: Number(s?.totalCancelledOrders||0), totalCollectedAmount: Number(s?.totalCollectedAmount||0), deliveredToCompany: Number(s?.deliveredToCompany||0), pendingToCompany: Number(s?.pendingToCompany||0), currency: s?.currency||'' }) }catch{}
                try{ const rr = await apiGet('/api/finance/remittances'); setRemittances(Array.isArray(rr?.remittances)? rr.remittances:[]) }catch{}
                setForm({ method:'hand', amount:'', note:'', paidToName:'', file:null })
                alert('Request sent to company. You will be notified when approved.')
              }catch(e){ alert(e?.message || 'Failed to send request') }
              finally{ setSubmitting(false) }
            }}>Send Request</button>
          </div>
        </div>
      </div>

      {/* My Remittances */}
      <div className="card" id="remittances" style={{ display:'grid', gap:10 }}>
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
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Method</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Approver</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Amount</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {remittances.map(r => (
                  <tr key={String(r._id||r.id)} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{ padding:'8px 10px' }}>{new Date(r.createdAt).toLocaleString()}</td>
                    <td style={{ padding:'8px 10px' }}>{(r.method||'hand').toUpperCase()}</td>
                    <td style={{ padding:'8px 10px' }}>{r?.manager?.role==='user' ? 'Owner' : (r?.manager?.role==='manager' ? 'Manager' : '-')}</td>
                    <td style={{ padding:'8px 10px' }}>{summary.currency||'SAR'} {Number(r.amount||0).toFixed(2)}</td>
                    <td style={{ padding:'8px 10px' }}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Company Details (collapsible) */}
      <div className="card" style={{ display:'grid', gap:10 }}>
        <div className="card-header" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div className="card-title">Company Bank / Wallet Details</div>
            <div className="card-subtitle">Use these details to remit collected amounts</div>
          </div>
          <button className="btn secondary" onClick={()=> setShowCompany(v=>!v)}>{showCompany ? 'Hide' : 'Show'}</button>
        </div>
        {showCompany && (
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
        )}
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
