import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet, apiPost } from '../../api'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../ui/Toast.jsx'
import Modal from '../../components/Modal.jsx'

export default function ManagerDriverAmounts(){
  const navigate = useNavigate()
  const toast = useToast()
  const [drivers, setDrivers] = useState([])
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [countryOptions, setCountryOptions] = useState([])
  const [country, setCountry] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [payingDriver, setPayingDriver] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [historyModal, setHistoryModal] = useState(null)

  // Load country options
  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet('/api/orders/options')
        const arr = Array.isArray(r?.countries) ? r.countries : []
        const map = new Map()
        for (const c of arr){
          const raw = String(c||'').trim()
          const key = raw.toLowerCase()
          if (!map.has(key)) map.set(key, raw.toUpperCase() === 'UAE' ? 'UAE' : raw)
        }
        setCountryOptions(Array.from(map.values()))
      } catch { setCountryOptions([]) }
    })()
  }, [])

  // Load drivers and payouts
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const [driversRes, payoutsRes] = await Promise.all([
          apiGet('/api/finance/drivers/summary?limit=100'),
          apiGet('/api/finance/driver-commission-payouts')
        ])
        if (alive) {
          setDrivers(Array.isArray(driversRes?.drivers) ? driversRes.drivers : [])
          setPayouts(Array.isArray(payoutsRes?.payouts) ? payoutsRes.payouts : [])
        }
        setErr('')
      } catch (e) {
        if (alive) setErr(e?.message || 'Failed to load driver amounts')
      } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }

  const filteredDrivers = useMemo(()=>{
    let result = drivers
    if (country) {
      result = result.filter(d => String(d?.country||'').trim().toLowerCase() === String(country).trim().toLowerCase())
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(d => 
        String(d.name||'').toLowerCase().includes(term) ||
        String(d.phone||'').toLowerCase().includes(term)
      )
    }
    return result
  }, [drivers, country, searchTerm])

  const totals = useMemo(()=>{
    let totalDelivered = 0, totalCollected = 0, totalCommission = 0, totalSentComm = 0, totalPendingComm = 0
    for (const d of filteredDrivers){
      totalDelivered += Number(d.deliveredCount||0)
      totalCollected += Number(d.collected||0)
      totalCommission += Number(d.driverCommission||0)
      totalSentComm += Number(d.paidCommission||0)
      totalPendingComm += Number(d.pendingCommission||0)
    }
    return { totalDelivered, totalCollected, totalCommission, totalSentComm, totalPendingComm }
  }, [filteredDrivers])

  const displayCurrency = useMemo(()=>{
    if (!filteredDrivers.length) return ''
    return filteredDrivers[0]?.currency || 'SAR'
  }, [filteredDrivers])

  const pendingPayouts = useMemo(()=>{
    return payouts.filter(p => p.status === 'pending')
  }, [payouts])

  async function handlePayCommission() {
    if (!payModal) return
    setPayingDriver(payModal.driver.id)
    try {
      await apiPost('/api/finance/driver-commission-payouts', {
        driverId: payModal.driver.id,
        amount: payModal.amount,
        method: 'hand',
        note: payModal.note || ''
      })
      toast.success('Commission payment submitted for approval')
      setPayModal(null)
      // Refresh data
      const payoutsRes = await apiGet('/api/finance/driver-commission-payouts')
      setPayouts(Array.isArray(payoutsRes?.payouts) ? payoutsRes.payouts : [])
    } catch(e) {
      toast.error(e?.message || 'Failed to submit payment')
    } finally {
      setPayingDriver(null)
    }
  }

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Driver Commission</div>
          <div className="page-subtitle">Pay commission to drivers (requires owner approval)</div>
        </div>
      </div>
      {err && <div className="error">{err}</div>}

      {/* Pending Approvals Alert */}
      {pendingPayouts.length > 0 && (
        <div className="card" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#f59e0b' }}>Pending Approvals:</strong> {pendingPayouts.length} commission payment{pendingPayouts.length !== 1 ? 's' : ''} waiting for owner approval
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div className="card-header"><div className="card-title">Filters</div></div>
        <div className="section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          <select className="input" value={country} onChange={(e)=> setCountry(e.target.value)}>
            <option value="">All Countries</option>
            {countryOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input 
            className="input" 
            type="text" 
            placeholder="Search by driver name or phone..." 
            value={searchTerm} 
            onChange={(e)=> setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:12 }}>
        <div className="card" style={{background:'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Total Delivered</div>
            <div style={{fontSize:28, fontWeight:800}}>{num(totals.totalDelivered)}</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #10b981 0%, #059669 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Total Commission</div>
            <div style={{fontSize:28, fontWeight:800}}>{displayCurrency} {num(totals.totalCommission)}</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Pending Commission</div>
            <div style={{fontSize:28, fontWeight:800}}>{displayCurrency} {num(totals.totalPendingComm)}</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Paid Commission</div>
            <div style={{fontSize:28, fontWeight:800}}>{displayCurrency} {num(totals.totalSentComm)}</div>
          </div>
        </div>
      </div>

      {/* Drivers Table */}
      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontWeight: 700 }}>Driver Commission Summary</div>
          <div className="helper">{filteredDrivers.length} driver{filteredDrivers.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)' }}>Driver</th>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)' }}>Country</th>
                <th style={{ padding: '10px 12px', textAlign:'center', borderRight:'1px solid var(--border)' }}>Delivered</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>Total Commission</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>Pending</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>Paid</th>
                <th style={{ padding: '10px 12px', textAlign:'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:5}).map((_,i)=> (
                  <tr key={`sk${i}`}>
                    <td colSpan={7} style={{ padding:'10px 12px' }}>
                      <div style={{ height:14, background:'var(--panel-2)', borderRadius:6, animation:'pulse 1.2s ease-in-out infinite' }} />
                    </td>
                  </tr>
                ))
              ) : filteredDrivers.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '10px 12px', opacity: 0.7, textAlign:'center' }}>No drivers found</td></tr>
              ) : (
                filteredDrivers.map((d, idx) => (
                  <tr key={String(d.id)} style={{ borderTop: '1px solid var(--border)', background: idx % 2 ? 'transparent' : 'var(--panel)' }}>
                    <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                      <div style={{fontWeight:700}}>{d.name || 'Unnamed'}</div>
                      <div className="helper">{d.phone || ''}</div>
                    </td>
                    <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                      <span style={{fontWeight:700}}>{d.country || '-'}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'center', borderRight:'1px solid var(--border)' }}>
                      <span style={{fontWeight:800}}>{num(d.deliveredCount)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                      <span style={{fontWeight:800}}>{d.currency} {num(d.driverCommission||0)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#f59e0b', fontWeight:800}}>{d.currency} {num(d.pendingCommission||0)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#14b8a6', fontWeight:800}}>{d.currency} {num(d.paidCommission||0)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button 
                          className="btn small"
                          onClick={()=> setHistoryModal(d)}
                          style={{fontSize:12, padding:'4px 8px'}}
                        >
                          History
                        </button>
                        {d.pendingCommission && d.pendingCommission > 0 ? (
                          <button 
                            className="btn success small" 
                            style={{fontSize:12, padding:'4px 8px'}}
                            disabled={payingDriver === d.id}
                            onClick={()=> setPayModal({ driver: d, amount: d.pendingCommission, note: '' })}
                          >
                            Pay Commission
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Commission Modal */}
      <Modal
        title="Pay Driver Commission"
        open={!!payModal}
        onClose={()=> setPayModal(null)}
        footer={
          <>
            <button className="btn secondary" onClick={()=> setPayModal(null)} disabled={!!payingDriver}>Cancel</button>
            <button 
              className="btn success" 
              disabled={!!payingDriver}
              onClick={handlePayCommission}
            >
              {payingDriver ? 'Sending...' : 'Submit for Approval'}
            </button>
          </>
        }
      >
        {payModal && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ fontSize: 16, marginBottom: 16 }}>
              Pay <strong style={{ color: '#10b981', fontSize: 20 }}>{payModal.driver.currency} {num(payModal.amount)}</strong> commission to <strong style={{ color: '#8b5cf6' }}>{payModal.driver.name}</strong>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              ⚠️ This payment will be sent to the owner for approval before the driver receives it.
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 14, fontWeight: 600 }}>Note (Optional)</label>
              <textarea
                className="input"
                value={payModal.note || ''}
                onChange={(e)=> setPayModal({...payModal, note: e.target.value})}
                placeholder="Add a note for this payment..."
                rows={3}
              />
            </div>
            <div style={{ background: 'var(--panel)', padding: 12, borderRadius: 8, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Driver:</span>
                <strong>{payModal.driver.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Phone:</span>
                <strong>{payModal.driver.phone}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ opacity: 0.7 }}>Country:</span>
                <strong>{payModal.driver.country}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ opacity: 0.7 }}>Amount:</span>
                <strong style={{ color: '#10b981' }}>{payModal.driver.currency} {num(payModal.amount)}</strong>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Commission History Modal */}
      <Modal
        title={`Commission History - ${historyModal?.name || ''}`}
        open={!!historyModal}
        onClose={()=> setHistoryModal(null)}
        footer={
          <button className="btn" onClick={()=> setHistoryModal(null)}>Close</button>
        }
      >
        {historyModal && (
          <CommissionHistory driverId={historyModal.id} />
        )}
      </Modal>
    </div>
  )
}

function CommissionHistory({ driverId }) {
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet(`/api/finance/drivers/${driverId}/commission-payouts`)
        setPayouts(Array.isArray(res?.payouts) ? res.payouts : [])
      } catch (e) {
        console.error('Failed to load commission history:', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [driverId])

  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
  }

  if (payouts.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', opacity: 0.7 }}>No commission history</div>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            <th style={{ padding: '10px', textAlign: 'left' }}>Amount</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Receipt</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p, i) => (
            <tr key={String(p._id || i)} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '10px', fontWeight: 700 }}>{p.currency} {num(p.amount)}</td>
              <td style={{ padding: '10px' }}>
                <span className={`badge ${p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning'}`}>
                  {String(p.status || '').toUpperCase()}
                </span>
              </td>
              <td style={{ padding: '10px', fontSize: 13 }}>
                {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}
              </td>
              <td style={{ padding: '10px' }}>
                {p.pdfPath ? (
                  <a 
                    href={`${API_BASE}/api/finance/driver-commission-payouts/${p._id}/download-pdf`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn small"
                    style={{ fontSize: 12, padding: '4px 8px' }}
                  >
                    Download
                  </a>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
