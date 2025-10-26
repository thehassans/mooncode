import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../../api'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../ui/Toast.jsx'
import Modal from '../../components/Modal.jsx'

export default function DriverAmounts(){
  const navigate = useNavigate()
  const toast = useToast()
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [countryOptions, setCountryOptions] = useState([])
  const [country, setCountry] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [payingDriver, setPayingDriver] = useState(null)
  const [payModal, setPayModal] = useState(null)

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

  // Load drivers
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const r = await apiGet('/api/finance/drivers/summary?limit=100')
        if (alive) setDrivers(Array.isArray(r?.drivers) ? r.drivers : [])
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
    let totalDelivered = 0, totalCollected = 0, totalSent = 0, totalPending = 0, totalCommission = 0, totalWithdrawnComm = 0, totalPendingComm = 0
    for (const d of filteredDrivers){
      totalDelivered += Number(d.deliveredCount||0)
      totalCollected += Number(d.collected||0)
      totalSent += Number(d.deliveredToCompany||0)
      totalPending += Number(d.pendingToCompany||0)
      totalCommission += Number(d.driverCommission||0)
      totalWithdrawnComm += Number(d.withdrawnCommission||0)
      totalPendingComm += Number(d.pendingCommission||0)
    }
    return { totalDelivered, totalCollected, totalSent, totalPending, totalCommission, totalWithdrawnComm, totalPendingComm }
  }, [filteredDrivers])

  // Get currency for display
  const displayCurrency = useMemo(()=>{
    if (!filteredDrivers.length) return ''
    return filteredDrivers[0]?.currency || 'SAR'
  }, [filteredDrivers])

  return (
    <div className="section" style={{ display: 'grid', gap: 12 }}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Driver Amounts</div>
          <div className="page-subtitle">Monitor driver deliveries and commission details</div>
        </div>
      </div>
      {err && <div className="error">{err}</div>}

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
            <div style={{fontSize:14, opacity:0.9}}>Total Delivered Orders</div>
            <div style={{fontSize:28, fontWeight:800}}>{num(totals.totalDelivered)}</div>
            <div style={{fontSize:12, opacity:0.8, marginTop:4}}>Successfully delivered</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #10b981 0%, #059669 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Total Collected</div>
            <div style={{fontSize:28, fontWeight:800}}>{displayCurrency} {num(totals.totalCollected)}</div>
            <div style={{fontSize:12, opacity:0.8, marginTop:4}}>Cash on delivery</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Total Driver Commission</div>
            <div style={{fontSize:28, fontWeight:800}}>{displayCurrency} {num(totals.totalCommission)}</div>
            <div style={{fontSize:12, opacity:0.8, marginTop:4}}>Total earned commission</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Commission Withdrawn</div>
            <div style={{fontSize:28, fontWeight:800}}>{displayCurrency} {num(totals.totalWithdrawnComm)}</div>
            <div style={{fontSize:12, opacity:0.8, marginTop:4}}>Already paid to drivers</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Commission Pending</div>
            <div style={{fontSize:28, fontWeight:800}}>{displayCurrency} {num(totals.totalPendingComm)}</div>
            <div style={{fontSize:12, opacity:0.8, marginTop:4}}>Available to withdraw</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Sent to Company</div>
            <div style={{fontSize:28, fontWeight:800}}>{displayCurrency} {num(totals.totalSent)}</div>
            <div style={{fontSize:12, opacity:0.8, marginTop:4}}>Remitted amounts</div>
          </div>
        </div>
        <div className="card" style={{background:'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color:'#fff'}}>
          <div style={{padding:'16px'}}>
            <div style={{fontSize:14, opacity:0.9}}>Pending to Company</div>
            <div style={{fontSize:28, fontWeight:800}}>{displayCurrency} {num(totals.totalPending)}</div>
            <div style={{fontSize:12, opacity:0.8, marginTop:4}}>Yet to remit</div>
          </div>
        </div>
      </div>

      {/* Drivers Table */}
      <div className="card">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontWeight: 700 }}>Driver Delivery & Commission Summary</div>
          <div className="helper">{filteredDrivers.length} driver{filteredDrivers.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#8b5cf6' }}>Driver</th>
                <th style={{ padding: '10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#6366f1' }}>Country</th>
                <th style={{ padding: '10px 12px', textAlign:'center', borderRight:'1px solid var(--border)', color:'#3b82f6' }}>Assigned</th>
                <th style={{ padding: '10px 12px', textAlign:'center', borderRight:'1px solid var(--border)', color:'#10b981' }}>Delivered</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e' }}>Collected</th>
                <th style={{ padding: '10px 12px', textAlign:'center', borderRight:'1px solid var(--border)', color:'#a855f7' }}>Commission/Order</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#06b6d4' }}>Commission</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#8b5cf6' }}>Withdrawn</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#f59e0b' }}>Pending</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#14b8a6' }}>Sent</th>
                <th style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#ef4444' }}>To Remit</th>
                <th style={{ padding: '10px 12px', textAlign:'center', color:'#8b5cf6' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:5}).map((_,i)=> (
                  <tr key={`sk${i}`}>
                    <td colSpan={12} style={{ padding:'10px 12px' }}>
                      <div style={{ height:14, background:'var(--panel-2)', borderRadius:6, animation:'pulse 1.2s ease-in-out infinite' }} />
                    </td>
                  </tr>
                ))
              ) : filteredDrivers.length === 0 ? (
                <tr><td colSpan={12} style={{ padding: '10px 12px', opacity: 0.7, textAlign:'center' }}>No drivers found</td></tr>
              ) : (
                filteredDrivers.map((d, idx) => (
                  <tr key={String(d.id)} style={{ borderTop: '1px solid var(--border)', background: idx % 2 ? 'transparent' : 'var(--panel)' }}>
                    <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                      <div style={{fontWeight:700, color:'#8b5cf6'}}>{d.name || 'Unnamed'}</div>
                      <div className="helper">{d.phone || ''}</div>
                    </td>
                    <td style={{ padding: '10px 12px', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#6366f1', fontWeight:700}}>{d.country || '-'}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'center', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#3b82f6', fontWeight:700}}>{num(d.assigned)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'center', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#10b981', fontWeight:800}}>{num(d.deliveredCount)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#22c55e', fontWeight:800}}>{d.currency} {num(d.collected)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'center', borderRight:'1px solid var(--border)' }}>
                      {d.commissionPerOrder && d.commissionPerOrder > 0 ? (
                        <span style={{color:'#a855f7', fontWeight:700}}>{d.commissionCurrency || d.currency} {num(d.commissionPerOrder)}</span>
                      ) : (
                        <span style={{color:'#ef4444', fontWeight:600, fontSize:12}}>Not Set</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#06b6d4', fontWeight:800}}>{d.currency} {num(d.driverCommission||0)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#8b5cf6', fontWeight:800}}>{d.currency} {num(d.withdrawnCommission||0)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#f59e0b', fontWeight:800}}>{d.currency} {num(d.pendingCommission||0)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#14b8a6', fontWeight:800}}>{d.currency} {num(d.deliveredToCompany)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'right', borderRight:'1px solid var(--border)' }}>
                      <span style={{color:'#ef4444', fontWeight:800}}>{d.currency} {num(d.pendingToCompany)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign:'center' }}>
                      {d.pendingCommission && d.pendingCommission > 0 ? (
                        <button 
                          className="btn success" 
                          style={{fontSize:12, padding:'6px 12px'}}
                          disabled={payingDriver === d.id}
                          onClick={()=> setPayModal({ driver: d, amount: d.pendingCommission })}
                        >
                          Pay Commission
                        </button>
                      ) : (
                        <span style={{color:'var(--text-muted)', fontSize:12}}>No pending</span>
                      )}
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
              onClick={async()=>{
                setPayingDriver(payModal.driver.id)
                try{
                  await apiPost(`/api/finance/drivers/${payModal.driver.id}/pay-commission`, { amount: payModal.amount })
                  toast.success('Commission payment sent successfully')
                  setPayModal(null)
                  // Refresh data
                  const r = await apiGet('/api/finance/drivers/summary?limit=100')
                  setDrivers(Array.isArray(r?.drivers) ? r.drivers : [])
                }catch(e){
                  toast.error(e?.message || 'Failed to send payment')
                }finally{
                  setPayingDriver(null)
                }
              }}
            >
              {payingDriver ? 'Sending...' : 'Confirm Payment'}
            </button>
          </>
        }
      >
        {payModal && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ fontSize: 16, marginBottom: 24, textAlign: 'center' }}>
              Send <strong style={{ color: '#10b981', fontSize: 20 }}>{payModal.driver.currency} {num(payModal.amount)}</strong> commission to <strong style={{ color: '#8b5cf6' }}>{payModal.driver.name}</strong>?
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
    </div>
  )
}
