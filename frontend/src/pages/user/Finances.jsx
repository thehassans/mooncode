import React, { useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { useLocation, useNavigate } from 'react-router-dom'

export default function UserFinances() {
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState([]) // { id, name, assigned, done, avgResponseSeconds }
  const [comm, setComm] = useState([]) // { id, payoutProfile, deliveredCommissionPKR, upcomingCommissionPKR, withdrawnPKR, pendingPKR }
  const [requests, setRequests] = useState([])
  const [sendMap, setSendMap] = useState({}) // remitId -> amount input string
  const [manualMap, setManualMap] = useState({}) // agentId -> { amount, note }
  const [manualGlobal, setManualGlobal] = useState({ agentId: '', amount: '', note: '' })
  const [msg, setMsg] = useState('')
  // Collapsible sections
  const [showAgent, setShowAgent] = useState(false) // initially closed
  const [showDriver, setShowDriver] = useState(false)
  const [showCompany, setShowCompany] = useState(false)
  const [active, setActive] = useState('agent') // agent | driver | company
  // Driver finances (paged with infinite scroll)
  const [driverDeliveries, setDriverDeliveries] = useState([])
  const [driverPage, setDriverPage] = useState(1)
  const [driverHasMore, setDriverHasMore] = useState(true)
  const driverLoadingRef = useRef(false)
  const driverEndRef = useRef(null)

  const [driverRequests, setDriverRequests] = useState([])
  const [drReqPage, setDrReqPage] = useState(1)
  const [drReqHasMore, setDrReqHasMore] = useState(true)
  const drReqLoadingRef = useRef(false)
  const drReqEndRef = useRef(null)

  const [driverSendMap, setDriverSendMap] = useState({})
  // Company payout profile
  const [companyProfile, setCompanyProfile] = useState({ method:'bank', accountName:'', bankName:'', iban:'', accountNumber:'', phoneNumber:'' })
  const [companyMsg, setCompanyMsg] = useState('')
  const driverInitRef = useRef(false)
  const companyInitRef = useRef(false)

  useEffect(() => {
    let alive = true
    const endEarly = () => { if (alive) setLoading(false) }
    // Safety: if network is slow, stop blocking UI after a short delay
    const slowTimer = setTimeout(endEarly, 800)

    // Fetch metrics first; when done (or fails), allow UI to render
    ;(async () => {
      try {
        const m = await apiGet('/api/users/agents/performance')
        if (!alive) return
        setMetrics(Array.isArray(m?.metrics) ? m.metrics : [])
      } catch (e) {
        setMsg(e?.message || 'Failed to load finances')
      } finally {
        endEarly()
      }
    })()
    // Fetch commissions in parallel
    ;(async () => {
      try {
        const c = await apiGet('/api/finance/agents/commission')
        if (!alive) return
        setComm(Array.isArray(c?.agents) ? c.agents : [])
      } catch {}
    })()
    // Fetch agent remittance requests in parallel
    ;(async () => {
      try {
        const r = await apiGet('/api/finance/agent-remittances')
        if (!alive) return
        const list = Array.isArray(r?.remittances) ? r.remittances : []
        setRequests(list.filter((x) => x.status === 'pending' || x.status === 'approved'))
      } catch {}
    })()

    return () => {
      alive = false
      clearTimeout(slowTimer)
    }
  }, [])

  // Open a specific section if requested via query param
  useEffect(()=>{
    try{
      const sp = new URLSearchParams(location.search||'')
      const sec = String(sp.get('section')||'').toLowerCase()
      if (sec === 'driver') { setActive('driver'); setShowDriver(true) }
      else if (sec === 'company') { setActive('company'); setShowCompany(true) }
      else { setActive('agent'); setShowAgent(true) }
    }catch{}
  }, [location.search])

  function setActiveSection(next){
    try{
      setActive(next)
      const sp = new URLSearchParams(location.search||'')
      sp.set('section', next)
      navigate({ pathname: location.pathname || '/user/finances', search: `?${sp.toString()}` }, { replace:true })
      if (next==='driver') setShowDriver(true)
      if (next==='company') setShowCompany(true)
    }catch{}
  }

  // Load company payout profile lazily when section is opened first time
  useEffect(() => {
    if (!showCompany || companyInitRef.current) return
    companyInitRef.current = true
    let alive = true
    ;(async () => {
      try {
        const cp = await apiGet('/api/finance/company/payout-profile').catch(() => ({ profile: null }))
        if (!alive) return
        const prof = cp?.profile
        if (prof && typeof prof === 'object') setCompanyProfile(p => ({ ...p, ...prof }))
      } catch {}
    })()
    return () => { alive = false }
  }, [showCompany])

  // Load driver data lazily when Driver section is opened first time
  useEffect(() => {
    if (!showDriver || driverInitRef.current) return
    driverInitRef.current = true
    ;(async () => { try { await loadDriversPage(1) } catch {} })()
    ;(async () => { try { await loadDriverRequestsPage(1) } catch {} })()
  }, [showDriver])

  async function loadDriversPage(page){
    if (driverLoadingRef.current) return
    driverLoadingRef.current = true
    try{
      const r = await apiGet(`/api/finance/drivers/summary?page=${page}&limit=20`)
      const list = Array.isArray(r?.drivers) ? r.drivers : []
      setDriverDeliveries(prev => page===1 ? list : [...prev, ...list])
      setDriverHasMore(!!r?.hasMore)
      setDriverPage(page)
    }catch{
      if (page===1) setDriverDeliveries([])
      setDriverHasMore(false)
    }finally{
      driverLoadingRef.current = false
    }
  }

  async function loadDriverRequestsPage(page){
    if (drReqLoadingRef.current) return
    drReqLoadingRef.current = true
    try{
      const r = await apiGet(`/api/finance/driver-remittances?page=${page}&limit=20`)
      const list = Array.isArray(r?.remittances) ? r.remittances : []
      setDriverRequests(prev => page===1 ? list : [...prev, ...list])
      setDrReqHasMore(!!r?.hasMore)
      setDrReqPage(page)
    }catch{
      if (page===1) setDriverRequests([])
      setDrReqHasMore(false)
    }finally{
      drReqLoadingRef.current = false
    }
  }

  // Infinite scroll observers
  useEffect(()=>{
    const el = driverEndRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries)=>{
      const [e] = entries
      if (e.isIntersecting && driverHasMore && !driverLoadingRef.current){
        loadDriversPage(driverPage + 1)
      }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return ()=> { try{ obs.disconnect() }catch{} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverEndRef.current, driverHasMore, driverPage])

  useEffect(()=>{
    const el = drReqEndRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries)=>{
      const [e] = entries
      if (e.isIntersecting && drReqHasMore && !drReqLoadingRef.current){
        loadDriverRequestsPage(drReqPage + 1)
      }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return ()=> { try{ obs.disconnect() }catch{} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drReqEndRef.current, drReqHasMore, drReqPage])

  // Helper: format seconds to "Xm Ys"
  function formatDuration(seconds){
    try{
      const s = Math.max(0, Math.round(seconds||0))
      const m = Math.floor(s/60), r = s%60
      return m>0 ? `${m}m ${r}s` : `${r}s`
    }catch{ return '-' }
  }

  // Latest request per agent (prefer pending; else latest approved)
  const latestRequestByAgent = useMemo(()=>{
    try{
      const map = new Map()
      for (const r of (Array.isArray(requests)? requests: [])){
        const agentId = String(r?.agent?._id || r?.agent?.id || r?.agent || '')
        if (!agentId) continue
        const curr = {
          amount: Number(r?.amount||0),
          status: String(r?.status||'').toLowerCase(),
          created: r?.createdAt ? new Date(r.createdAt).getTime() : 0,
        }
        const prev = map.get(agentId)
        if (!prev) { map.set(agentId, curr); continue }
        const pref = (x)=> x.status==='pending' ? 2 : (x.status==='approved'? 1 : 0)
        if (pref(curr) > pref(prev) || (pref(curr)===pref(prev) && curr.created > prev.created)){
          map.set(agentId, curr)
        }
      }
      return map
    }catch{ return new Map() }
  }, [requests])

  const joined = useMemo(() => {
    const byId = new Map(comm.map((a) => [String(a.id), a]))
    return metrics.map((m) => {
      const k = String(m.id)
      const c = byId.get(k) || {}
      const availablePKR = Math.max(0, (c.deliveredCommissionPKR || 0) - (c.withdrawnPKR || 0))
      const req = latestRequestByAgent.get(k)
      const requestedPKR = Number(req?.amount || 0)
      const remainingAfterRequest = Math.max(0, availablePKR - requestedPKR)
      return {
        id: k,
        name: `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        phone: m.phone || '',
        payoutProfile: c.payoutProfile || {},
        submitted: Number(m?.submitted ?? m?.ordersSubmitted ?? 0),
        delivered: Number(m?.done || 0),
        chatsAssigned: Number(m?.assigned || 0),
        avgResponseSeconds: m.avgResponseSeconds,
        paymentMethod: String(c?.payoutProfile?.method||'').toUpperCase()||'—',
        deliveredCommissionPKR: c.deliveredCommissionPKR || 0,
        upcomingCommissionPKR: c.upcomingCommissionPKR || 0,
        withdrawnPKR: c.withdrawnPKR || 0,
        pendingPKR: c.pendingPKR || 0,
        availablePKR,
        requestedPKR,
        remainingAfterRequest,
      }
    })
  }, [metrics, comm, latestRequestByAgent])

  // Driver payout send
  async function onSendDriver(remit) {
    const remitId = String(remit._id || remit.id)
    let amount = Number(driverSendMap[remitId] ?? remit.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return alert('Enter a valid amount')
    }
    try {
      setMsg('Sending to driver...')
      const res = await apiPost(`/api/finance/driver-remittances/${remitId}/send`, { amount })
      if (res?.remit) {
        setMsg('Driver payment sent')
        setDriverRequests((reqs) => reqs.filter((r) => String(r._id || r.id) !== remitId))
        setTimeout(() => setMsg(''), 1500)
      } else {
        setMsg(res?.message || 'Failed to send')
      }
    } catch (e) {
      setMsg(e?.message || 'Failed to send')
    }
  }

  // Save company payout/bank details
  async function onSaveCompany() {
    try {
      setCompanyMsg('Saving...')
      const res = await apiPost('/api/finance/company/payout-profile', { ...companyProfile })
      if (res?.ok) { setCompanyMsg('Saved'); setTimeout(() => setCompanyMsg(''), 1200) }
      else { setCompanyMsg(res?.message || 'Failed to save') }
    } catch (e) { setCompanyMsg(e?.message || 'Failed to save') }
  }

  async function onSend(remit) {
    const remitId = String(remit._id || remit.id)
    let amount = Number(sendMap[remitId] ?? remit.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return alert('Enter a valid amount')
    }
    if (amount < 10000) return alert('Minimum amount is PKR 10,000')
    try {
      setMsg('Sending...')
      const res = await apiPost(`/api/finance/agent-remittances/${remitId}/send`, { amount })
      if (res?.remit) {
        setMsg('Sent and receipt dispatched via WhatsApp')
        setRequests((reqs) => reqs.filter((r) => String(r._id || r.id) !== remitId))
        setTimeout(() => setMsg(''), 1500)
      } else {
        setMsg(res?.message || 'Failed to send')
      }
    } catch (e) {
      setMsg(e?.message || 'Failed to send')
    }
  }

  async function onSendManual(agent) {
    const agentId = String(agent.id)
    const entry = manualMap[agentId] || {}
    const amount = Number(entry.amount)
    const note = (entry.note || '').trim()
    if (!Number.isFinite(amount) || amount <= 0) {
      return alert('Enter a valid manual amount')
    }
    try {
      setMsg('Sending manual receipt...')
      const res = await apiPost(`/api/finance/agents/${agentId}/send-manual-receipt`, {
        amount,
        note,
      })
      if (res?.ok) {
        setMsg('Manual receipt sent via WhatsApp')
        setManualMap((m) => ({ ...m, [agentId]: { amount: '', note: '' } }))
        setTimeout(() => setMsg(''), 1500)
      } else {
        setMsg(res?.message || 'Failed to send manual receipt')
      }
    } catch (e) {
      setMsg(e?.message || 'Failed to send manual receipt')
    }
  }

  async function onSendManualGlobal() {
    const agentId = String(manualGlobal.agentId || '')
    const amount = Number(manualGlobal.amount)
    const note = (manualGlobal.note || '').trim()
    if (!agentId) return alert('Select an agent')
    if (!Number.isFinite(amount) || amount <= 0) return alert('Enter a valid amount')
    try {
      setMsg('Sending manual receipt...')
      const res = await apiPost(`/api/finance/agents/${agentId}/send-manual-receipt`, {
        amount,
        note,
      })
      if (res?.ok) {
        setMsg('Manual receipt sent via WhatsApp')
        setManualGlobal({ agentId: '', amount: '', note: '' })
        setTimeout(() => setMsg(''), 1500)
      } else {
        setMsg(res?.message || 'Failed to send manual receipt')
      }
    } catch (e) {
      setMsg(e?.message || 'Failed to send manual receipt')
    }
  }

  if (loading) {
    return (
      <div className="content" style={{ padding: 16 }}>
        <div className="spinner" /> Loading finances…
      </div>
    )
  }

  return (
    <div className="content" style={{ display: 'grid', gap: 16, padding: 16 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Finances</div>
        <div className="helper">Review agent, driver, and company finance details and requests.</div>
      </div>

      {/* Horizontal options (professional segmented control) */}
      <div className="card" style={{ position:'sticky', top:0, zIndex:5, backdropFilter:'blur(6px)' }}>
        <div className="section" style={{ display:'flex', gap:10, overflowX:'auto' }}>
          {(['agent','driver','company']).map(k => (
            <button
              key={k}
              className="chip"
              onClick={()=> setActiveSection(k)}
              aria-pressed={active===k}
              style={{
                padding:'8px 16px',
                border:'1px solid var(--border)',
                borderRadius:999,
                background: active===k ? 'linear-gradient(180deg, var(--panel-2), var(--panel))' : 'var(--panel)',
                boxShadow: active===k ? '0 1px 4px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                fontWeight: active===k? 900:600,
                letterSpacing: 0.2,
              }}
            >{k.charAt(0).toUpperCase()+k.slice(1)}</button>
          ))}
        </div>
      </div>

      {active==='agent' && (
        <>
      {/* Agent Integrated Metrics */}
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="card-header">
          <div className="card-title">Agent Performance, Earnings & Payment Details</div>
        </div>
        <div className="section" style={{ overflowX: 'auto' }}>
          {joined.length === 0 ? (
            <div className="empty-state">No agents</div>
          ) : (
            <table style={{ width: '100%', minWidth: 1080, borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Agent</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Submitted Orders</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Delivered Orders</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Chats Assigned</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Avg Response</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Payment Detail</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Wallet (PKR)</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Requested (PKR)</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Remaining (PKR)</th>
                </tr>
              </thead>
              <tbody>
                {joined.map((a) => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 700 }}>{a.name || '—'}</div>
                      <div className="helper" style={{ fontSize: 12 }}>{a.phone || ''}</div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>{Number(a.submitted||0).toLocaleString()}</td>
                    <td style={{ padding: '8px 10px' }}>{Number(a.delivered||0).toLocaleString()}</td>
                    <td style={{ padding: '8px 10px' }}>{Number(a.chatsAssigned||0).toLocaleString()}</td>
                    <td style={{ padding: '8px 10px' }}>{a.avgResponseSeconds!=null? formatDuration(a.avgResponseSeconds) : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {(() => {
                        const p = a.payoutProfile || {}
                        const method = String(p.method || '')
                        if (!method) return '—'
                        if (method === 'bank') {
                          const bank = [p.bankName, p.iban || p.accountNumber].filter(Boolean).join(' · ')
                          return `${p.accountName || ''}${bank ? ' — ' + bank : ''}`
                        }
                        const wallet = [p.accountName, p.phoneNumber || p.accountNumber].filter(Boolean).join(' · ')
                        return wallet || '—'
                      })()}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight:700, color:'var(--success)' }}>{Number(a.availablePKR||0).toLocaleString()}</td>
                    <td style={{ padding: '8px 10px' }}>{Number(a.requestedPKR||0).toLocaleString()}</td>
                    <td style={{ padding: '8px 10px', fontWeight:700 }}>{Number(a.remainingAfterRequest||0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Agent Requests integrated above in table (Requested column) */}

      {/* Manual Receipt removed from UI per spec */}
      </>
      )}

      {active==='driver' && (
        <>
          {/* Driver Deliveries */}
          <div className="card" style={{ display:'grid', gap:10 }}>
            <div className="card-header">
              <div className="card-title">Driver Deliveries</div>
              <div className="card-subtitle">Assignments, cancellations, delivered, collected, delivered to company and pending.</div>
            </div>
            <div className="section" style={{ overflowX:'auto' }}>
              {driverDeliveries.length === 0 ? (
                <div className="empty-state">No driver data</div>
              ) : (
                <table style={{ width:'100%', minWidth: 980, borderCollapse:'separate', borderSpacing:0 }}>
                  <thead>
                    <tr>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Driver</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Phone</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Assigned</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Cancelled</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Delivered</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Collected</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Delivered to Company</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Pending to Company</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Method</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Proof</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverDeliveries.map(d => {
                      const drvId = String(d.id||d._id)
                      const pending = driverRequests.find(rr => (String(rr?.driver?._id||rr?.driver?.id||'')===drvId) && String(rr?.status||'').toLowerCase()==='pending')
                      return (
                        <tr key={drvId} style={{ borderTop:'1px solid var(--border)' }}>
                          <td style={{ padding:'8px 10px' }}>{d.name||'—'}</td>
                          <td style={{ padding:'8px 10px' }}>{d.phone||''}</td>
                          <td style={{ padding:'8px 10px' }}>{d.assigned??'—'}</td>
                          <td style={{ padding:'8px 10px' }}>{d.canceled??'—'}</td>
                          <td style={{ padding:'8px 10px' }}>{d.deliveredCount??'—'}</td>
                          <td style={{ padding:'8px 10px' }}>{(d.currency||'').toString()} {Number(d.collected||0).toLocaleString()}</td>
                          <td style={{ padding:'8px 10px' }}>{(d.currency||'').toString()} {Number(d.deliveredToCompany||0).toLocaleString()}</td>
                          <td style={{ padding:'8px 10px', fontWeight:700, color:'var(--warning)' }}>{(d.currency||'').toString()} {Number(d.pendingToCompany||0).toLocaleString()}</td>
                          <td style={{ padding:'8px 10px' }}>
                            {pending ? (
                              <>
                                {String(pending.method||'hand').toLowerCase()==='transfer' ? (
                                  <span className="badge" style={{borderColor:'#3b82f6', color:'#1d4ed8'}}>Transfer</span>
                                ) : (
                                  <>
                                    <span className="badge" style={{borderColor:'#6b7280', color:'#374151'}}>Hand</span>
                                    <div className="helper" style={{marginTop:4}}>
                                      Paid to: {pending.paidToName || `${(pending?.manager?.firstName||'')} ${(pending?.manager?.lastName||'')}`.trim() || '-'}
                                    </div>
                                  </>
                                )}
                              </>
                            ) : '—'}
                          </td>
                          <td style={{ padding:'8px 10px' }}>
                            {pending?.receiptPath ? (
                              <>
                                <a href={`${API_BASE}${pending.receiptPath}`} target="_blank" rel="noopener noreferrer" download>Download</a>
                                {' '}
                                <span className="helper">• Proof: {pending?.proofOk===true ? <span style={{color:'var(--success)'}}>Yes</span> : pending?.proofOk===false ? <span style={{color:'var(--danger)'}}>No</span> : '—'}</span>
                              </>
                            ) : (
                              <span className="helper">Proof: {pending?.proofOk===true ? <span style={{color:'var(--success)'}}>Yes</span> : pending?.proofOk===false ? <span style={{color:'var(--danger)'}}>No</span> : '—'}</span>
                            )}
                          </td>
                          <td style={{ padding:'8px 10px' }}>
                            <button className="btn small" disabled={!pending} onClick={() => pending && onSendDriver(pending)}>Accept</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
              <div ref={driverEndRef} />
            </div>
          </div>
        </>
      )}

      {active==='company' && (
        <div className="card" style={{ display:'grid', gap:10 }}>
          <div className="card-header">
            <div className="card-title">Payout / Bank Details</div>
            <div className="card-subtitle">Visible to drivers for settlements.</div>
          </div>
          <div className="section" style={{ display:'grid', gap:12, maxWidth:720 }}>
            <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
              <div className="label">Method</div>
              <select className="input" value={companyProfile.method||'bank'} onChange={e=> setCompanyProfile(p=>({ ...p, method: e.target.value }))}>
                <option value="bank">Bank</option>
                <option value="wallet">Wallet</option>
              </select>
            </div>
            <div className="form-grid">
              <div>
                <div className="label">Account Name</div>
                <input className="input" value={companyProfile.accountName||''} onChange={e=> setCompanyProfile(p=>({ ...p, accountName: e.target.value }))} />
              </div>
              <div>
                <div className="label">Bank Name</div>
                <input className="input" value={companyProfile.bankName||''} onChange={e=> setCompanyProfile(p=>({ ...p, bankName: e.target.value }))} />
              </div>
              <div>
                <div className="label">IBAN / Account #</div>
                <input className="input" value={(companyProfile.iban||companyProfile.accountNumber)||''} onChange={e=> setCompanyProfile(p=>({ ...p, iban: e.target.value, accountNumber: e.target.value }))} />
              </div>
              <div>
                <div className="label">Wallet Phone (if wallet)</div>
                <input className="input" value={companyProfile.phoneNumber||''} onChange={e=> setCompanyProfile(p=>({ ...p, phoneNumber: e.target.value }))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <button className="btn" onClick={onSaveCompany}>Save Company Details</button>
              {companyMsg && <div className="helper" style={{ fontWeight:600 }}>{companyMsg}</div>}
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className="helper" style={{ fontWeight: 600 }}>
          {msg}
        </div>
      )}
    </div>
  )
}
