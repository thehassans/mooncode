import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPatch } from '../../api.js'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'

export default function DriverMe() {
  const navigate = useNavigate()
  const [me, setMe] = useState(() => {
    try { return JSON.parse(localStorage.getItem('me') || '{}') } catch { return {} }
  })
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [remittances, setRemittances] = useState([])
  const [remSummary, setRemSummary] = useState({ totalDeliveredOrders: 0, totalCollectedAmount: 0, deliveredToCompany: 0, pendingToCompany: 0, currency: '' })
  const [payout, setPayout] = useState(()=>({ method: me?.payoutProfile?.method || 'bank', accountName: me?.payoutProfile?.accountName||'', bankName: me?.payoutProfile?.bankName||'', iban: me?.payoutProfile?.iban||'', accountNumber: me?.payoutProfile?.accountNumber||'', phoneNumber: me?.payoutProfile?.phoneNumber||'' }))
  const [savingPayout, setSavingPayout] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try { const r = await apiGet('/api/users/me'); if (alive) { setMe(r?.user || {}); setPayout(p=>({ ...p, ...((r?.user?.payoutProfile)||{}) })) } } catch {}
      try { const r2 = await apiGet('/api/orders/driver/assigned'); if (alive) setOrders(r2?.orders || []) } catch {}
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  // Socket: live updates for remittance acceptance
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      socket.on('remittance.accepted', ()=> { try{ loadRemittances() }catch{} })
    }catch{}
    return ()=>{
      try{ socket && socket.off('remittance.accepted') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[])

  async function loadRemittances(){
    try{ const res = await apiGet('/api/finance/remittances'); setRemittances(Array.isArray(res?.remittances)? res.remittances:[]) }catch{ setRemittances([]) }
  }
  async function loadRemittanceSummary(range){
    try{
      const params = new URLSearchParams()
      if (range?.fromDate) params.set('fromDate', range.fromDate)
      if (range?.toDate) params.set('toDate', range.toDate)
      const res = await apiGet(`/api/finance/remittances/summary?${params.toString()}`)
      setRemSummary({
        totalDeliveredOrders: Number(res?.totalDeliveredOrders||0),
        totalCollectedAmount: Number(res?.totalCollectedAmount||0),
        deliveredToCompany: Number(res?.deliveredToCompany||0),
        pendingToCompany: Number(res?.pendingToCompany||0),
        currency: res?.currency || ''
      })
    }catch{ setRemSummary({ totalDeliveredOrders:0, totalCollectedAmount:0, deliveredToCompany:0, pendingToCompany:0, currency:'' }) }
  }

  // Initial load for remittances and settlement summary
  useEffect(()=>{ try{ loadRemittances(); loadRemittanceSummary({}) }catch{} },[])
  const PHONE_CODE_TO_CCY = { '+966':'SAR', '+971':'AED', '+968':'OMR', '+973':'BHD', '+965':'KWD', '+974':'QAR', '+91':'INR' }
  const COUNTRY_TO_CCY = { 'SA':'SAR', 'AE':'AED', 'OM':'OMR', 'BH':'BHD', 'KW':'KWD', 'QA':'QAR', 'IN':'INR', 'KSA':'SAR', 'UAE':'AED', 'India':'INR', 'Kuwait':'KWD', 'Qatar':'QAR' }
  function currencyFromPhoneCode(code){ try{ return PHONE_CODE_TO_CCY[String(code||'').trim()] || 'SAR' }catch{ return 'SAR' } }
  function preferredCurrency(me){
    const c = String(me?.country||'').toUpperCase().trim()
    if (COUNTRY_TO_CCY[c]) return COUNTRY_TO_CCY[c]
    return 'SAR'
  }

  async function savePayout(){
    try{
      setSavingPayout(true)
      await apiPatch('/api/users/me/payout-profile', { ...payout })
      alert('Payout profile saved')
    }catch(e){ alert(e?.message||'Failed to save payout profile') }
    finally{ setSavingPayout(false) }
  }

  const stats = useMemo(() => {
    const list = orders || []
    const delivered = list.filter(o => String(o?.shipmentStatus||'').toLowerCase() === 'delivered')
    const inTransit = list.filter(o => ['in_transit','assigned','attempted','contacted','picked_up'].includes(String(o?.shipmentStatus||'').toLowerCase()))
    const cancelled = list.filter(o => String(o?.shipmentStatus||'').toLowerCase() === 'cancelled')
    const returned = list.filter(o => String(o?.shipmentStatus||'').toLowerCase() === 'returned')

    const byCcy = {}
    for (const o of delivered){
      const ccy = currencyFromPhoneCode(o?.phoneCountryCode || '')
      if (!byCcy[ccy]) byCcy[ccy] = { collected:0, cod:0, balance:0 }
      byCcy[ccy].collected += Math.max(0, Number(o?.collectedAmount||0))
      byCcy[ccy].cod += Math.max(0, Number(o?.codAmount||0))
      byCcy[ccy].balance += Math.max(0, Number(o?.balanceDue||0))
    }

    return {
      totalAssigned: list.length,
      deliveredCount: delivered.length,
      inTransitCount: inTransit.length,
      cancelledCount: cancelled.length,
      returnedCount: returned.length,
      byCcy,
      primaryCcy: preferredCurrency(me),
    }
  }, [orders, me])

  return (
    <div className="content" style={{ display: 'grid', gap: 16, padding: 16, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Driver Profile</div>
        <div className="helper">Your profile and delivery stats</div>
      </div>
      <div style={{display:'flex', justifyContent:'flex-end'}}>
        <button className="btn light" onClick={() => { try{ localStorage.removeItem('token'); localStorage.removeItem('me') }catch{}; try{ navigate('/login', { replace:true }) }catch{} }}>Logout</button>
      </div>

      {/* Settlement Summary */}
      <div className="card" style={{ display:'grid', gap:10 }}>
        <div className="card-header">
          <div className="card-title">My Settlement Summary</div>
        </div>
        <div className="section" style={{ display:'grid', gap:8 }}>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <span className="badge">Total Delivered Orders: {remSummary.totalDeliveredOrders}</span>
            <span className="badge">Total Collected: {remSummary.currency} {Number(remSummary.totalCollectedAmount||0).toFixed(2)}</span>
            <span className="badge">Delivered to Company: {remSummary.currency} {Number(remSummary.deliveredToCompany||0).toFixed(2)}</span>
            <span className="badge warning">Pending to Company: {remSummary.currency} {Number(remSummary.pendingToCompany||0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* My Payout Profile */}
      <div className="card" style={{ display:'grid', gap:10 }}>
        <div className="card-header">
          <div className="card-title">My Payout Profile</div>
          <div className="card-subtitle">Provide your bank/wallet details for payouts</div>
        </div>
        <div className="section" style={{ display:'grid', gap:10 }}>
          <div className="form-grid">
            <label className="field">
              <div>Method</div>
              <select className="input" value={payout.method||'bank'} onChange={e=> setPayout(p=>({ ...p, method: e.target.value }))}>
                <option value="bank">Bank</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="nayapay">NayaPay</option>
                <option value="sadapay">SadaPay</option>
              </select>
            </label>
            <label className="field">
              <div>Name on Account</div>
              <input className="input" value={payout.accountName||''} onChange={e=> setPayout(p=>({ ...p, accountName: e.target.value }))} placeholder="e.g. Ahmed Ali" />
            </label>
            {payout.method==='bank' && (
              <>
                <label className="field">
                  <div>Bank Name</div>
                  <input className="input" value={payout.bankName||''} onChange={e=> setPayout(p=>({ ...p, bankName: e.target.value }))} placeholder="e.g. HBL" />
                </label>
                <label className="field">
                  <div>IBAN</div>
                  <input className="input" value={payout.iban||''} onChange={e=> setPayout(p=>({ ...p, iban: e.target.value }))} placeholder="PK.." />
                </label>
                <label className="field">
                  <div>Account Number</div>
                  <input className="input" value={payout.accountNumber||''} onChange={e=> setPayout(p=>({ ...p, accountNumber: e.target.value }))} placeholder="1234567890" />
                </label>
              </>
            )}
            {payout.method!=='bank' && (
              <label className="field">
                <div>Phone Number</div>
                <input className="input" value={payout.phoneNumber||''} onChange={e=> setPayout(p=>({ ...p, phoneNumber: e.target.value }))} placeholder="03XXXXXXXXX" />
              </label>
            )}
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button className="btn" disabled={savingPayout} onClick={savePayout}>{savingPayout? 'Saving…' : 'Save Payout Profile'}</button>
          </div>
        </div>
      </div>

      {/* My Remittances */}
      <div className="card" style={{display:'grid', gap:8}}>
        <div className="card-header">
          <div className="card-title">My Remittances</div>
        </div>
        <div className="section" style={{overflowX:'auto'}}>
          {remittances.length === 0 ? (
            <div className="empty-state">No remittances yet</div>
          ) : (
            <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
              <thead>
                <tr>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Date</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Manager</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Amount</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Period</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Delivered</th>
                  <th style={{textAlign:'left', padding:'8px 10px'}}>Status</th>
                </tr>
              </thead>
              <tbody>
                {remittances.map(r => (
                  <tr key={String(r._id||r.id)} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'8px 10px'}}>{new Date(r.createdAt).toLocaleString()}</td>
                    <td style={{padding:'8px 10px'}}>{`${r.manager?.firstName||''} ${r.manager?.lastName||''}`}</td>
                    <td style={{padding:'8px 10px'}}>{`${r.currency||''} ${Number(r.amount||0).toFixed(2)}`}</td>
                    <td style={{padding:'8px 10px'}}>{r.fromDate? new Date(r.fromDate).toLocaleDateString() : '-'} — {r.toDate? new Date(r.toDate).toLocaleDateString() : '-'}</td>
                    <td style={{padding:'8px 10px'}}>{r.totalDeliveredOrders||0}</td>
                    <td style={{padding:'8px 10px'}}>{r.status==='accepted' ? <span className="badge" style={{borderColor:'#10b981', color:'#10b981'}}>Delivered</span> : <span className="badge" style={{borderColor:'#f59e0b', color:'#f59e0b'}}>Pending</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Profile */}
      <div className="panel" style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 999, background: 'var(--panel-2)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 20 }}>
            {(((me.firstName||'')[0]) || 'D').toUpperCase()}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{(me.firstName||'') + ' ' + (me.lastName||'')}</div>
            <div className="helper" style={{ fontSize: 14 }}>{me.email || ''}</div>
            {me.phone && (
              <div className="helper" style={{ fontSize: 14 }}>{me.phone}</div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="card" style={{ display:'grid', gap:12, padding: 16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight: 700 }}>My Delivery Stats</div>
          <div className="chip" title="Preferred currency" style={{background:'var(--panel-2)'}}>Preferred: {stats.primaryCcy}</div>
        </div>
        {loading ? (
          <div className="helper">Loading…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <Stat title="Total Assigned" value={stats.totalAssigned} />
              <Stat title="Delivered" value={stats.deliveredCount} highlight="success" />
              <Stat title="In Transit" value={stats.inTransitCount} />
              <Stat title="Cancelled" value={stats.cancelledCount} />
              <Stat title="Returned" value={stats.returnedCount} />
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Delivered Amounts by Currency</div>
              <div style={{ display: 'flex', gap: 8, flexWrap:'wrap' }}>
                {Object.keys(stats.byCcy).length === 0 ? (
                  <span className="helper">No delivered orders yet</span>
                ) : (
                  Object.entries(stats.byCcy).map(([ccy, v]) => (
                    <div key={ccy} className="panel" style={{ padding: 10, borderRadius: 10, display:'grid', gap:6, minWidth: 200 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ fontWeight: 700 }}>{ccy}</div>
                        <span className="chip" style={{ background: 'var(--panel-2)' }}>Delivered</span>
                      </div>
                      <Row label="Collected" value={`${ccy} ${v.collected.toFixed(2)}`} />
                      <Row label="COD" value={`${ccy} ${v.cod.toFixed(2)}`} />
                      <Row label="Balance" value={`${ccy} ${v.balance.toFixed(2)}`} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ title, value, highlight }){
  const color = highlight === 'success' ? 'var(--success)' : 'var(--fg)'
  return (
    <div className="panel" style={{ padding: 12 }}>
      <div className="helper" style={{ marginBottom: 6 }}>{title}</div>
      <div style={{ fontWeight: 800, fontSize: 20, color }}>{String(value)}</div>
    </div>
  )
}

function Row({ label, value }){
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize: 14 }}>
      <span className="helper">{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  )
}
