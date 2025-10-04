import React, { useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'

export default function UserFinances() {
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

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [m, c, r] = await Promise.all([
          apiGet('/api/users/agents/performance'),
          apiGet('/api/finance/agents/commission'),
          apiGet('/api/finance/agent-remittances'),
        ])
        if (!alive) return
        setMetrics(Array.isArray(m?.metrics) ? m.metrics : [])
        setComm(Array.isArray(c?.agents) ? c.agents : [])
        // Only show requests for this owner
        const list = Array.isArray(r?.remittances) ? r.remittances : []
        setRequests(list.filter((x) => x.status === 'pending' || x.status === 'approved'))
      } catch (e) {
        setMsg(e?.message || 'Failed to load finances')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // Load driver + company (best-effort, paged loaders)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const cp = await apiGet('/api/finance/company/payout-profile').catch(() => ({ profile: null }))
        if (!alive) return
        const prof = cp?.profile
        if (prof && typeof prof === 'object') setCompanyProfile(p => ({ ...p, ...prof }))
      } catch {}
      try { await loadDriversPage(1) } catch {}
      try { await loadDriverRequestsPage(1) } catch {}
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const joined = useMemo(() => {
    const map = new Map(comm.map((a) => [String(a.id), a]))
    return metrics.map((m) => {
      const k = String(m.id)
      const c = map.get(k) || {}
      return {
        id: k,
        name: `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        phone: m.phone || '',
        payoutProfile: c.payoutProfile || {},
        assigned: m.assigned || 0,
        done: m.done || 0,
        avgResponseSeconds: m.avgResponseSeconds,
        deliveredCommissionPKR: c.deliveredCommissionPKR || 0,
        upcomingCommissionPKR: c.upcomingCommissionPKR || 0,
        withdrawnPKR: c.withdrawnPKR || 0,
        pendingPKR: c.pendingPKR || 0,
        availablePKR: Math.max(0, (c.deliveredCommissionPKR || 0) - (c.withdrawnPKR || 0)),
      }
    })
  }, [metrics, comm])

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

      {/* Agent Section Toggle */}
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="card-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div className="card-title">Agent Finances</div>
          <button className="btn secondary" onClick={() => setShowAgent(v => !v)}>{showAgent ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      {showAgent && (
        <>
      {/* Agent Metrics */}
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="card-header">
          <div className="card-title">Agent Performance, Earnings & Payment Details</div>
        </div>
        <div className="section" style={{ overflowX: 'auto' }}>
          {joined.length === 0 ? (
            <div className="empty-state">No agents</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Agent</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Orders</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Chats Assigned</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Avg Response</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Payout Method</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Payment Detail</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Pending (PKR)</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Upcoming (PKR)</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Withdrawn (PKR)</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Available (PKR)</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Manual Receipt</th>
                </tr>
              </thead>
              <tbody>
                {joined.map((a) => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 600 }}>{a.name || '—'}</div>
                      <div className="helper" style={{ fontSize: 12 }}>
                        {a.phone || ''}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>{a.done}</td>
                    <td style={{ padding: '8px 10px' }}>{a.assigned}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {a.avgResponseSeconds != null ? `${a.avgResponseSeconds}s` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {String(a?.payoutProfile?.method || '').toUpperCase() || '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {(() => {
                        const p = a.payoutProfile || {}
                        const method = String(p.method || '')
                        if (!method) return '—'
                        if (method === 'bank') {
                          const bank = [p.bankName, p.iban || p.accountNumber]
                            .filter(Boolean)
                            .join(' · ')
                          return `${p.accountName || ''}${bank ? ' — ' + bank : ''}`
                        } else {
                          const wallet = [p.accountName, p.phoneNumber || p.accountNumber]
                            .filter(Boolean)
                            .join(' · ')
                          return wallet || '—'
                        }
                      })()}
                    </td>
                    <td style={{ padding: '8px 10px' }}>{(a.pendingPKR || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {(a.upcomingCommissionPKR || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {(a.withdrawnPKR || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--success)' }}>
                      {(a.availablePKR || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <div
                        style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
                      >
                        <input
                          className="input small"
                          style={{ width: 120 }}
                          placeholder="Amount"
                          value={manualMap[a.id]?.amount ?? ''}
                          onChange={(e) =>
                            setManualMap((m) => ({
                              ...m,
                              [a.id]: { ...(m[a.id] || {}), amount: e.target.value },
                            }))
                          }
                        />
                        <input
                          className="input small"
                          style={{ width: 200 }}
                          placeholder="Note (optional)"
                          value={manualMap[a.id]?.note ?? ''}
                          onChange={(e) =>
                            setManualMap((m) => ({
                              ...m,
                              [a.id]: { ...(m[a.id] || {}), note: e.target.value },
                            }))
                          }
                        />
                        <button className="btn small" onClick={() => onSendManual(a)}>
                          Send
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Requests */}
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="card-header">
          <div className="card-title">Agent Requests</div>
          <div className="card-subtitle">Send payouts directly; no approval step needed.</div>
        </div>
        <div className="section" style={{ overflowX: 'auto' }}>
          {requests.length === 0 ? (
            <div className="empty-state">No agent requests</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Agent</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Phone</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Payout Method</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Payment Detail</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Requested (PKR)</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Send Amount (PKR)</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={String(r._id || r.id)} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px' }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {r.agent?.firstName} {r.agent?.lastName}
                    </td>
                    <td style={{ padding: '8px 10px' }}>{r.agent?.phone || ''}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {String(r.agent?.payoutProfile?.method || '').toUpperCase() || '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {(() => {
                        const p = r.agent?.payoutProfile || {}
                        const method = String(p.method || '')
                        if (!method) return '—'
                        if (method === 'bank') {
                          const bank = [p.bankName, p.iban || p.accountNumber]
                            .filter(Boolean)
                            .join(' · ')
                          return `${p.accountName || ''}${bank ? ' — ' + bank : ''}`
                        } else {
                          const wallet = [p.accountName, p.phoneNumber || p.accountNumber]
                            .filter(Boolean)
                            .join(' · ')
                          return wallet || '—'
                        }
                      })()}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      PKR {Number(r.amount || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        className="input small"
                        style={{ width: 140 }}
                        value={sendMap[String(r._id || r.id)] ?? String(r.amount || '')}
                        onChange={(e) =>
                          setSendMap((m) => ({ ...m, [String(r._id || r.id)]: e.target.value }))
                        }
                        placeholder="PKR"
                      />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <button className="btn small" onClick={() => onSend(r)}>
                        Send
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Manual Receipt (Global) */}
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="card-header">
          <div className="card-title">Send Manual Receipt</div>
          <div className="card-subtitle">
            Send a manual payout receipt to any agent via WhatsApp (does not affect balances).
          </div>
        </div>
        <div
          className="section"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}
        >
          <select
            className="input"
            style={{ minWidth: 220 }}
            value={manualGlobal.agentId}
            onChange={(e) => setManualGlobal((s) => ({ ...s, agentId: e.target.value }))}
          >
            <option value="">Select agent…</option>
            {joined.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.phone ? `(${a.phone})` : ''}
              </option>
            ))}
          </select>
          <input
            className="input"
            style={{ width: 160 }}
            placeholder="Amount"
            value={manualGlobal.amount}
            onChange={(e) => setManualGlobal((s) => ({ ...s, amount: e.target.value }))}
          />
          <input
            className="input"
            style={{ width: 260 }}
            placeholder="Note (optional)"
            value={manualGlobal.note}
            onChange={(e) => setManualGlobal((s) => ({ ...s, note: e.target.value }))}
          />
          <button className="btn" onClick={onSendManualGlobal}>
            Send Manual Receipt
          </button>
        </div>
      </div>
      </>
      )}

      {/* Driver Section Toggle */}
      <div className="card" style={{ display:'grid', gap:10 }}>
        <div className="card-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div className="card-title">Driver Finances</div>
          <button className="btn secondary" onClick={() => setShowDriver(v => !v)}>{showDriver ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      {showDriver && (
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
                <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
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
                    </tr>
                  </thead>
                  <tbody>
                    {driverDeliveries.map(d => (
                      <tr key={String(d.id||d._id)} style={{ borderTop:'1px solid var(--border)' }}>
                        <td style={{ padding:'8px 10px' }}>{d.name||'—'}</td>
                        <td style={{ padding:'8px 10px' }}>{d.phone||''}</td>
                        <td style={{ padding:'8px 10px' }}>{d.assigned??'—'}</td>
                        <td style={{ padding:'8px 10px' }}>{d.canceled??'—'}</td>
                        <td style={{ padding:'8px 10px' }}>{d.deliveredCount??'—'}</td>
                        <td style={{ padding:'8px 10px' }}>{(d.currency||'').toString()} {Number(d.collected||0).toLocaleString()}</td>
                        <td style={{ padding:'8px 10px' }}>{(d.currency||'').toString()} {Number(d.deliveredToCompany||0).toLocaleString()}</td>
                        <td style={{ padding:'8px 10px', fontWeight:700, color:'var(--warning)' }}>{(d.currency||'').toString()} {Number(d.pendingToCompany||0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div ref={driverEndRef} />
            </div>
          </div>
          {/* Driver Requests */}
          <div className="card" style={{ display:'grid', gap:10 }}>
            <div className="card-header">
              <div className="card-title">Driver Earnings, Payment Details & Requests</div>
            </div>
            <div className="section" style={{ overflowX:'auto' }}>
              {driverRequests.length === 0 ? (
                <div className="empty-state">No driver requests</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
                  <thead>
                    <tr>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Date</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Driver</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Phone</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Payout Method</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Payment Detail</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Proof</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Requested</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Send Amount</th>
                      <th style={{textAlign:'left', padding:'8px 10px'}}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverRequests.map(r => (
                      <tr key={String(r._id||r.id)} style={{ borderTop:'1px solid var(--border)' }}>
                        <td style={{ padding:'8px 10px' }}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
                        <td style={{ padding:'8px 10px' }}>{r.driver?.firstName} {r.driver?.lastName}</td>
                        <td style={{ padding:'8px 10px' }}>{r.driver?.phone||''}</td>
                        <td style={{ padding:'8px 10px' }}>{String(r.driver?.payoutProfile?.method||'').toUpperCase()||'—'}</td>
                        <td style={{ padding:'8px 10px' }}>{(() => { const p=r.driver?.payoutProfile||{}; const method=String(p.method||''); if(!method) return '—'; if(method==='bank'){ const bank=[p.bankName, (p.iban||p.accountNumber)].filter(Boolean).join(' · '); return `${p.accountName||''}${bank? ' — '+bank: ''}` } else { const wallet=[p.accountName, (p.phoneNumber||p.accountNumber)].filter(Boolean).join(' · '); return wallet||'—' } })()}</td>
                        <td style={{ padding:'8px 10px' }}>{r?.receiptPath ? (<a href={`${API_BASE}${r.receiptPath}`} target="_blank" rel="noopener noreferrer" download>Download</a>) : '—'}</td>
                        <td style={{ padding:'8px 10px' }}>{String(r.currency||'')} {Number(r.amount||0).toLocaleString()}</td>
                        <td style={{ padding:'8px 10px' }}>
                          <input className="input small" style={{ width:140 }} value={driverSendMap[String(r._id||r.id)] ?? String(r.amount||'')} onChange={e=> setDriverSendMap(m=>({ ...m, [String(r._id||r.id)]: e.target.value }))} placeholder={String(r.currency||'')} />
                        </td>
                        <td style={{ padding:'8px 10px' }}>
                          <button className="btn small" onClick={() => onSendDriver(r)}>Send</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div ref={drReqEndRef} />
            </div>
          </div>
        </>
      )}

      {/* Company Section Toggle */}
      <div className="card" style={{ display:'grid', gap:10 }}>
        <div className="card-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div className="card-title">Company Details</div>
          <button className="btn secondary" onClick={() => setShowCompany(v => !v)}>{showCompany ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      {showCompany && (
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
