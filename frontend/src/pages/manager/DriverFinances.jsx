import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../../api'
import { useToast } from '../../ui/Toast.jsx'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/Modal.jsx'

function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }

export default function DriverFinances(){
  const toast = useToast()
  const navigate = useNavigate()
  const [drivers, setDrivers] = useState([])
  const [managerRemits, setManagerRemits] = useState([])
  const [driverRemits, setDriverRemits] = useState([])
  const [loading, setLoading] = useState(false)
  const [country, setCountry] = useState('')
  const [managerCountries, setManagerCountries] = useState([])
  const [currency, setCurrency] = useState('SAR')
  const [payModal, setPayModal] = useState(null)
  const [paying, setPaying] = useState(false)
  const [accepting, setAccepting] = useState(null)
  const [confirmAcceptModal, setConfirmAcceptModal] = useState(null)

  // Load manager's assigned countries
  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{
        const { user } = await apiGet('/api/users/me')
        const norm = (c)=> c==='Saudi Arabia' ? 'KSA' : (c==='United Arab Emirates' ? 'UAE' : c)
        const arr = Array.isArray(user?.assignedCountries) && user.assignedCountries.length ? user.assignedCountries.map(norm) : (user?.assignedCountry ? [norm(String(user.assignedCountry))] : [])
        if (!arr || !arr.length) { setManagerCountries([]); setCountry(''); return }
        if (alive){ 
          setManagerCountries(arr)
          setCountry(arr[0]||'')
        }
      }catch{}
    })()
    return ()=>{ alive=false }
  },[])

  // Load driver data and manager remittances when country changes
  useEffect(()=>{
    if (!country) return
    loadData()
  },[country])

  async function loadData(){
    if (!country) return
    setLoading(true)
    try{
      const [driversRes, managerRemitsRes, driverRemitsRes] = await Promise.all([
        apiGet(`/api/finance/drivers/summary?country=${encodeURIComponent(country)}&limit=200`),
        apiGet('/api/finance/manager-remittances'),
        apiGet('/api/finance/driver-remittances?limit=200')
      ])
      setDrivers(Array.isArray(driversRes?.drivers) ? driversRes.drivers : [])
      const allRemits = Array.isArray(managerRemitsRes?.remittances) ? managerRemitsRes.remittances : []
      const allDriverRemits = Array.isArray(driverRemitsRes?.remittances) ? driverRemitsRes.remittances : []
      // Filter manager remittances by country (handle variations like KSA/Saudi Arabia, UAE/United Arab Emirates)
      const normalizeCountry = (c) => {
        const s = String(c||'').trim().toLowerCase()
        if (s === 'ksa' || s === 'saudi arabia') return 'ksa'
        if (s === 'uae' || s === 'united arab emirates') return 'uae'
        return s
      }
      const normalizedCountry = normalizeCountry(country)
      const filtered = allRemits.filter(r => normalizeCountry(r?.country) === normalizedCountry)
      setManagerRemits(filtered)
      // Filter pending driver remittances
      const pendingDriverRemits = allDriverRemits.filter(r => r.status === 'pending')
      setDriverRemits(pendingDriverRemits)
      // Set currency based on country
      const cur = country === 'KSA' ? 'SAR' : (country === 'UAE' ? 'AED' : (country === 'OMN' ? 'OMR' : (country === 'BHR' ? 'BHD' : (country === 'KWT' ? 'KWD' : (country === 'QAT' ? 'QAR' : 'SAR')))))
      setCurrency(cur)
    }catch(e){
      toast.error(e?.message || 'Failed to load data')
    }finally{
      setLoading(false)
    }
  }

  // Calculate summary metrics
  const summary = useMemo(()=>{
    let totalCollected = 0
    let sentToCompany = 0
    let pendingApproval = 0

    // Total collected = Sum of what drivers have delivered to manager (deliveredToCompany)
    // This represents money the manager has received from drivers
    for (const d of drivers){
      totalCollected += Number(d.deliveredToCompany || 0)
    }

    // Manager remittances to company
    for (const r of managerRemits){
      if (r.status === 'accepted'){
        sentToCompany += Number(r.amount || 0)
      } else if (r.status === 'pending'){
        pendingApproval += Number(r.amount || 0)
      }
    }

    // To Pay = What manager received from drivers minus what was sent/is pending to company
    const toPayCompany = Math.max(0, totalCollected - sentToCompany - pendingApproval)

    return {
      totalCollected: Math.round(totalCollected),
      sentToCompany: Math.round(sentToCompany),
      pendingApproval: Math.round(pendingApproval),
      toPayCompany: Math.round(toPayCompany)
    }
  }, [drivers, managerRemits])

  async function handlePayToCompany(){
    if (summary.toPayCompany <= 0) return
    setPayModal({
      amount: summary.toPayCompany,
      currency,
      country
    })
  }

  async function confirmPayment(){
    setPaying(true)
    try{
      await apiPost('/api/finance/manager-remittances', {
        amount: payModal.amount,
        method: 'hand',
        country: payModal.country,
        note: `Payment to company for ${payModal.country} - ${new Date().toLocaleDateString()}`
      })
      toast.success('Payment request submitted successfully')
      setPayModal(null)
      await loadData()
    }catch(e){
      toast.error(e?.message || 'Failed to submit payment')
    }finally{
      setPaying(false)
    }
  }

  function openAcceptModal(remittanceId, driverName, amount){
    setConfirmAcceptModal({ remittanceId, driverName, amount })
  }

  async function confirmAcceptPayment(){
    if (!confirmAcceptModal) return
    const { remittanceId, driverName } = confirmAcceptModal
    setAccepting(remittanceId)
    try{
      await apiPost(`/api/finance/remittances/${remittanceId}/accept`, {})
      toast.success(`Payment accepted from ${driverName}`)
      setConfirmAcceptModal(null)
      await loadData()
    }catch(e){
      toast.error(e?.message || 'Failed to accept payment')
    }finally{
      setAccepting(null)
    }
  }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-cyan">Manager Payable to Company</div>
          <div className="page-subtitle">Monitor driver's delivered collections and remittances</div>
        </div>
        <button 
          className="btn success" 
          disabled={!country || summary.toPayCompany <= 0 || loading}
          onClick={handlePayToCompany}
        >
          Pay to Company
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{display:'grid', gap:10}}>
        <div className="card-header"><div className="card-title">Filters</div></div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12}}>
          <select className="input" value={country} onChange={e=> setCountry(e.target.value)}>
            <option value="">Select Country</option>
            {managerCountries.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {country && (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:12}}>
          <div className="card" style={{background:'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color:'#fff'}}>
            <div style={{padding:'16px'}}>
              <div style={{fontSize:14, opacity:0.9}}>Total Collected from Drivers</div>
              <div style={{fontSize:28, fontWeight:800}}>{currency} {num(summary.totalCollected)}</div>
            </div>
          </div>
          <div className="card" style={{background:'linear-gradient(135deg, #10b981 0%, #059669 100%)', color:'#fff'}}>
            <div style={{padding:'16px'}}>
              <div style={{fontSize:14, opacity:0.9}}>Sent to Company</div>
              <div style={{fontSize:28, fontWeight:800}}>{currency} {num(summary.sentToCompany)}</div>
            </div>
          </div>
          <div className="card" style={{background:'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color:'#fff'}}>
            <div style={{padding:'16px'}}>
              <div style={{fontSize:14, opacity:0.9}}>Pending Approval</div>
              <div style={{fontSize:28, fontWeight:800}}>{currency} {num(summary.pendingApproval)}</div>
            </div>
          </div>
          <div className="card" style={{background:'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color:'#fff'}}>
            <div style={{padding:'16px'}}>
              <div style={{fontSize:14, opacity:0.9}}>To Pay Company</div>
              <div style={{fontSize:28, fontWeight:800}}>{currency} {num(summary.toPayCompany)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Drivers Table */}
      {country && (
        <div className="card">
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
            <div style={{fontWeight:700}}>Drivers in {country}</div>
            <div className="helper">Currency: {currency}</div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
              <thead>
                <tr>
                  <th style={{padding:'10px 12px', textAlign:'left', borderRight:'1px solid var(--border)', color:'#8b5cf6'}}>Driver</th>
                  <th style={{padding:'10px 12px', textAlign:'center', borderRight:'1px solid var(--border)', color:'#f59e0b'}}>Assigned (Open)</th>
                  <th style={{padding:'10px 12px', textAlign:'center', borderRight:'1px solid var(--border)', color:'#3b82f6'}}>Total Assigned</th>
                  <th style={{padding:'10px 12px', textAlign:'center', borderRight:'1px solid var(--border)', color:'#10b981'}}>Delivered Orders</th>
                  <th style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#10b981'}}>Total Collected ({currency})</th>
                  <th style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#8b5cf6'}}>Delivered to Company ({currency})</th>
                  <th style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#ef4444'}}>Pending ({currency})</th>
                  <th style={{padding:'10px 12px', textAlign:'center', color:'#3b82f6'}}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({length:5}).map((_,i)=> (
                    <tr key={`sk${i}`}>
                      <td colSpan={8} style={{padding:'10px 12px'}}>
                        <div style={{height:14, background:'var(--panel-2)', borderRadius:6, animation:'pulse 1.2s ease-in-out infinite'}} />
                      </td>
                    </tr>
                  ))
                ) : drivers.length === 0 ? (
                  <tr><td colSpan={8} style={{padding:'10px 12px', opacity:0.7, textAlign:'center'}}>No drivers found</td></tr>
                ) : (
                  drivers.map((d, idx)=> {
                    // Find pending remittance for this driver
                    const pendingRemit = driverRemits.find(r => String(r.driver?._id) === String(d.id))
                    return (
                    <tr key={d.id} style={{borderTop:'1px solid var(--border)', background: idx%2? 'transparent':'var(--panel)'}}>
                      <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>
                        <div style={{fontWeight:700, color:'#8b5cf6'}}>{d.name || 'Unnamed'}</div>
                        <div className="helper">{d.phone || ''}</div>
                      </td>
                      <td style={{padding:'10px 12px', textAlign:'center', borderRight:'1px solid var(--border)'}}>
                        <span style={{color:'#f59e0b', fontWeight:700}}>{num(d.assigned||0)}</span>
                      </td>
                      <td style={{padding:'10px 12px', textAlign:'center', borderRight:'1px solid var(--border)'}}>
                        <span style={{color:'#3b82f6', fontWeight:700}}>{num((d.assigned||0) + (d.deliveredCount||0) + (d.canceled||0))}</span>
                      </td>
                      <td style={{padding:'10px 12px', textAlign:'center', borderRight:'1px solid var(--border)'}}>
                        <span style={{color:'#10b981', fontWeight:700}}>{num(d.deliveredCount||0)}</span>
                      </td>
                      <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>
                        <span style={{color:'#10b981', fontWeight:800}}>{currency} {num(d.collected||0)}</span>
                      </td>
                      <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>
                        <span style={{color:'#8b5cf6', fontWeight:800}}>{currency} {num(d.deliveredToCompany||0)}</span>
                      </td>
                      <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>
                        <span style={{color:'#ef4444', fontWeight:800}}>{currency} {num(d.pendingToCompany||0)}</span>
                      </td>
                      <td style={{padding:'10px 12px', textAlign:'center'}}>
                        <div style={{display:'flex', gap:6, alignItems:'center', justifyContent:'center', flexWrap:'wrap'}}>
                          {pendingRemit ? (
                            <>
                              <button 
                                className="btn success"
                                onClick={()=> openAcceptModal(pendingRemit._id, d.name, pendingRemit.amount)}
                                disabled={accepting === pendingRemit._id}
                                style={{padding:'6px 12px', fontSize:13, whiteSpace:'nowrap'}}
                              >
                                {accepting === pendingRemit._id ? '⏳ Accepting...' : `✓ Accept ${currency} ${num(pendingRemit.amount)}`}
                              </button>
                              {pendingRemit.pdfPath && (
                                <a 
                                  href={pendingRemit.pdfPath}
                                  download
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn"
                                  style={{padding:'6px 12px', fontSize:13, whiteSpace:'nowrap', background:'#dc2626', color:'white'}}
                                  title="Download Settlement PDF"
                                >
                                  📄 PDF
                                </a>
                              )}
                            </>
                          ) : (
                            <span style={{color:'var(--muted)', fontSize:13}}>No pending payments</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pay to Company Modal */}
      <Modal
        title="Pay to Company"
        open={!!payModal}
        onClose={()=> setPayModal(null)}
        footer={
          <>
            <button className="btn secondary" onClick={()=> setPayModal(null)} disabled={paying}>Cancel</button>
            <button 
              className="btn success" 
              disabled={paying}
              onClick={confirmPayment}
            >
              {paying ? 'Submitting...' : 'Confirm Payment'}
            </button>
          </>
        }
      >
        {payModal && (
          <div style={{padding:'16px 0'}}>
            <div style={{fontSize:16, marginBottom:24, textAlign:'center'}}>
              Submit payment of <strong style={{color:'#10b981', fontSize:20}}>{payModal.currency} {num(payModal.amount)}</strong> to company?
            </div>
            <div style={{background:'var(--panel)', padding:12, borderRadius:8, fontSize:14}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                <span style={{opacity:0.7}}>Country:</span>
                <strong>{payModal.country}</strong>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                <span style={{opacity:0.7}}>Currency:</span>
                <strong>{payModal.currency}</strong>
              </div>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <span style={{opacity:0.7}}>Amount:</span>
                <strong style={{color:'#10b981'}}>{payModal.currency} {num(payModal.amount)}</strong>
              </div>
            </div>
            <div style={{marginTop:16, padding:12, background:'rgba(59, 130, 246, 0.1)', borderRadius:8, fontSize:13}}>
              <strong>Note:</strong> This will create a remittance request that needs to be approved by the company.
            </div>
          </div>
        )}
      </Modal>

      {/* Accept Payment Modal */}
      <Modal
        title="Accept Payment from Driver"
        open={!!confirmAcceptModal}
        onClose={()=> setConfirmAcceptModal(null)}
        footer={
          <>
            <button 
              className="btn secondary" 
              onClick={()=> setConfirmAcceptModal(null)} 
              disabled={!!accepting}
            >
              Cancel
            </button>
            <button 
              className="btn success" 
              disabled={!!accepting}
              onClick={confirmAcceptPayment}
            >
              {accepting ? '⏳ Accepting...' : '✓ Accept Payment'}
            </button>
          </>
        }
      >
        {confirmAcceptModal && (
          <div style={{padding:'16px 0'}}>
            <div style={{fontSize:16, marginBottom:24, textAlign:'center'}}>
              Accept payment of <strong style={{color:'#10b981', fontSize:20}}>{currency} {num(confirmAcceptModal.amount)}</strong> from <strong>{confirmAcceptModal.driverName}</strong>?
            </div>
            <div style={{background:'var(--panel)', padding:16, borderRadius:8, fontSize:14}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
                <span style={{opacity:0.7}}>Driver:</span>
                <strong>{confirmAcceptModal.driverName}</strong>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
                <span style={{opacity:0.7}}>Currency:</span>
                <strong>{currency}</strong>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', paddingTop:12, borderTop:'1px solid var(--border)'}}>
                <span style={{opacity:0.7}}>Amount:</span>
                <strong style={{color:'#10b981', fontSize:18}}>{currency} {num(confirmAcceptModal.amount)}</strong>
              </div>
            </div>
            <div style={{marginTop:16, padding:12, background:'rgba(16, 185, 129, 0.1)', borderRadius:8, fontSize:13, borderLeft:'3px solid #10b981'}}>
              <strong>✓ Action:</strong> This will mark the driver's payment as received and update the balance.
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
