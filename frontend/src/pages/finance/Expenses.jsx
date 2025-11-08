import React, { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../../api'
import Modal from '../../components/Modal.jsx'

const COUNTRIES = [
  { code: 'KSA', name: 'Saudi Arabia', flag: '🇸🇦', currency: 'SAR' },
  { code: 'UAE', name: 'United Arab Emirates', flag: '🇦🇪', currency: 'AED' },
  { code: 'Oman', name: 'Oman', flag: '🇴🇲', currency: 'OMR' },
  { code: 'Bahrain', name: 'Bahrain', flag: '🇧🇭', currency: 'BHD' },
  { code: 'India', name: 'India', flag: '🇮🇳', currency: 'INR' },
  { code: 'Kuwait', name: 'Kuwait', flag: '🇰🇼', currency: 'KWD' },
  { code: 'Qatar', name: 'Qatar', flag: '🇶🇦', currency: 'QAR' },
]

export default function Expenses(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ 
    title: '',
    type: 'advertisement',
    amount: '',
    country: 'UAE',
    currency: 'AED',
    notes: '',
    incurredAt: ''
  })
  const [msg, setMsg] = useState('')
  const [approvalModal, setApprovalModal] = useState({ open: false, expense: null, action: '' })
  const [rejectReason, setRejectReason] = useState('')

  async function load(){
    setLoading(true)
    try{
      const res = await apiGet('/api/finance/expenses')
      setItems(res.expenses||[])
    }catch(err){ console.error(err) }
    finally{ setLoading(false) }
  }
  useEffect(()=>{ load() }, [])

  const pendingManagerExpenses = useMemo(() => items.filter(e => e.status === 'pending' && e.createdBy?.role === 'manager'), [items])
  const adExpenses = useMemo(() => items.filter(e => e.type === 'advertisement' && e.status === 'approved'), [items])
  
  function openApprovalModal(expense, action){
    setApprovalModal({ open: true, expense, action })
    setRejectReason('')
  }
  
  function closeApprovalModal(){
    setApprovalModal({ open: false, expense: null, action: '' })
    setRejectReason('')
  }
  
  async function confirmApproval(){
    const { expense, action } = approvalModal
    if (!expense) return
    
    try{
      if (action === 'approve') {
        await apiPost(`/api/finance/expenses/${expense._id}/approve`, {})
        setMsg('✅ Expense approved successfully')
      } else if (action === 'reject') {
        if (!rejectReason.trim()) {
          alert('Please provide a reason for rejection')
          return
        }
        await apiPost(`/api/finance/expenses/${expense._id}/reject`, { reason: rejectReason })
        setMsg('❌ Expense rejected')
      }
      setTimeout(()=> setMsg(''), 3000)
      closeApprovalModal()
      await load()
    }catch(err){
      setMsg(err?.response?.data?.message || err?.message || 'Failed to process request')
    }
  }
  const totalByCountry = useMemo(() => {
    const byCountry = {}
    COUNTRIES.forEach(c => { byCountry[c.code] = 0 })
    adExpenses.forEach(e => {
      if (e.country && byCountry[e.country] !== undefined) {
        byCountry[e.country] += Number(e.amount || 0)
      }
    })
    return byCountry
  }, [adExpenses])

  function onChange(e){ 
    const {name,value} = e.target
    setForm(f => {
      const updated = {...f, [name]: value}
      // Auto-set currency when country changes
      if (name === 'country') {
        const country = COUNTRIES.find(c => c.code === value)
        if (country) updated.currency = country.currency
      }
      return updated
    })
  }

  async function onSubmit(){
    setMsg('')
    if (!form.title || !form.amount || !form.country) {
      setMsg('Please fill in all required fields')
      return
    }
    try{
      await apiPost('/api/finance/expenses', { 
        ...form,
        amount: Number(form.amount||0)
      })
      setOpen(false)
      setForm({ 
        title: '',
        type: 'advertisement',
        amount: '',
        country: 'UAE',
        currency: 'AED',
        notes: '',
        incurredAt: ''
      })
      await load()
      setMsg('Advertisement expense added successfully')
      setTimeout(()=> setMsg(''), 2000)
    }catch(err){ 
      setMsg(err?.response?.data?.message || err?.message ||'Failed to save expense') 
    }
  }

  return (
    <div className="container" style={{maxWidth: 1400, margin: '0 auto'}}>
      {/* Header */}
      <div style={{marginBottom: 24}}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:8}}>
          <div style={{
            width:48, height:48, borderRadius:16,
            background:'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display:'grid', placeItems:'center', fontSize:24
          }}>📊</div>
          <div>
            <h1 style={{fontSize:28, fontWeight:900, margin:0}}>Advertisement Expense Management</h1>
            <p style={{fontSize:14, opacity:0.7, margin:0}}>Track and manage advertising spend across all markets</p>
          </div>
        </div>
      </div>

      {/* Pending Manager Expenses - Approval Section */}
      {pendingManagerExpenses.length > 0 && (
        <div style={{marginBottom: 24}}>
          <div className="card" style={{
            padding: 0,
            overflow: 'hidden',
            borderRadius: 16,
            border: '2px solid #fbbf24',
            background: 'rgba(251, 191, 36, 0.05)'
          }}>
            <div style={{
              padding: '16px 20px',
              background: 'rgba(251, 191, 36, 0.1)',
              borderBottom: '1px solid #fbbf24',
              display:'flex',
              justifyContent:'space-between',
              alignItems:'center'
            }}>
              <div style={{display:'flex', alignItems:'center', gap:12}}>
                <span style={{fontSize:24}}>⏳</span>
                <div>
                  <h3 style={{margin:0, fontSize:18, fontWeight:800}}>
                    Manager Expenses Pending Approval ({pendingManagerExpenses.length})
                  </h3>
                  <p style={{margin:0, fontSize:13, opacity:0.7}}>Review and approve expenses from your managers</p>
                </div>
              </div>
            </div>
            <div style={{padding: 16}}>
              <div style={{display:'grid', gap:12}}>
                {pendingManagerExpenses.map(exp => {
                  const country = COUNTRIES.find(c => c.code === exp.country)
                  const managerName = `${exp.createdBy?.firstName || ''} ${exp.createdBy?.lastName || ''}`.trim() || 'Manager'
                  return (
                    <div key={exp._id} className="card" style={{
                      padding: 16,
                      border: '1px solid #fbbf24',
                      background: 'rgba(251, 191, 36, 0.05)',
                      display:'flex',
                      justifyContent:'space-between',
                      alignItems:'center',
                      gap:16,
                      flexWrap:'wrap'
                    }}>
                      <div style={{flex:1, minWidth:250}}>
                        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                          <div style={{fontWeight:800, fontSize:16}}>{exp.title}</div>
                          <span className="badge" style={{background:'#fef3c7', color:'#92400e'}}>
                            👤 {managerName}
                          </span>
                        </div>
                        <div style={{display:'flex', gap:16, flexWrap:'wrap', fontSize:13, color:'var(--muted)'}}>
                          {country && (
                            <span style={{display:'flex', alignItems:'center', gap:4}}>
                              <span style={{fontSize:16}}>{country.flag}</span>
                              {country.name}
                            </span>
                          )}
                          <span>📅 {fmtDate(exp.incurredAt)}</span>
                          <span style={{fontWeight:700, color:'#f59e0b', fontSize:15}}>
                            {exp.currency} {fmtNum(exp.amount)}
                          </span>
                        </div>
                        {exp.notes && (
                          <div style={{marginTop:8, padding:8, background:'var(--panel)', borderRadius:6, fontSize:13}}>
                            <strong>Notes:</strong> {exp.notes}
                          </div>
                        )}
                      </div>
                      <div style={{display:'flex', gap:8}}>
                        <button 
                          className="btn success" 
                          onClick={() => openApprovalModal(exp, 'approve')}
                          style={{padding:'8px 16px', fontSize:14, fontWeight:600}}
                        >
                          ✅ Approve
                        </button>
                        <button 
                          className="btn danger" 
                          onClick={() => openApprovalModal(exp, 'reject')}
                          style={{padding:'8px 16px', fontSize:14, fontWeight:600}}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Country Cards Grid */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16, marginBottom:24}}>
        {COUNTRIES.map(country => {
          const total = totalByCountry[country.code] || 0
          const count = adExpenses.filter(e => e.country === country.code).length
          return (
            <div key={country.code} className="card" style={{
              padding: 20,
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              transition: 'all 0.2s ease',
              cursor: 'default'
            }}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:12}}>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <span style={{fontSize:24}}>{country.flag}</span>
                  <div>
                    <div style={{fontWeight:700, fontSize:15}}>{country.name}</div>
                    <div style={{fontSize:12, opacity:0.6}}>{count} expense{count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              </div>
              <div style={{
                fontSize: 28,
                fontWeight: 900,
                color: total > 0 ? '#f59e0b' : '#6b7280',
                marginTop: 8
              }}>
                {country.currency} {fmtNum(total)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Expense Button */}
      <div style={{marginBottom: 24, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2 style={{fontSize:20, fontWeight:800, margin:0}}>All Advertisements</h2>
        <div style={{display:'flex', gap:12}}>
          <button className="btn secondary" onClick={load} disabled={loading}>
            {loading ? '⟳ Refreshing...' : '⟳ Refresh'}
          </button>
          <button className="btn" onClick={()=> setOpen(true)} style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: 'none',
            padding: '10px 20px',
            fontWeight: 700
          }}>
            + Add Advertisement Expense
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card" style={{padding: 0, overflow: 'hidden', borderRadius: 16}}>
        <div style={{overflow:'auto'}}>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead style={{background: 'var(--panel)', borderBottom: '2px solid var(--border)'}}>
              <tr>
                <th style={{textAlign:'left', padding:'16px 20px', fontWeight:700, fontSize:13, opacity:0.8}}>CAMPAIGN</th>
                <th style={{textAlign:'left', padding:'16px 20px', fontWeight:700, fontSize:13, opacity:0.8}}>COUNTRY</th>
                <th style={{textAlign:'left', padding:'16px 20px', fontWeight:700, fontSize:13, opacity:0.8}}>CREATED BY</th>
                <th style={{textAlign:'right', padding:'16px 20px', fontWeight:700, fontSize:13, opacity:0.8}}>AMOUNT</th>
                <th style={{textAlign:'left', padding:'16px 20px', fontWeight:700, fontSize:13, opacity:0.8}}>NOTES</th>
                <th style={{textAlign:'left', padding:'16px 20px', fontWeight:700, fontSize:13, opacity:0.8}}>DATE</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{padding:'40px 20px',textAlign:'center',opacity:.6}}>Loading expenses...</td></tr>
              ) : adExpenses.length === 0 ? (
                <tr><td colSpan={6} style={{padding:'40px 20px',textAlign:'center',opacity:.6}}>
                  <div style={{fontSize:48,marginBottom:12}}>📊</div>
                  <div style={{fontWeight:600}}>No advertisement expenses yet</div>
                  <div style={{fontSize:14,opacity:0.7}}>Start tracking your advertising spend</div>
                </td></tr>
              ) : adExpenses.map((e, idx) => {
                const country = COUNTRIES.find(c => c.code === e.country)
                const isManager = e.createdBy?.role === 'manager'
                const creatorName = isManager 
                  ? `${e.createdBy?.firstName || ''} ${e.createdBy?.lastName || ''}`.trim() || 'Manager'
                  : 'Owner'
                return (
                  <tr key={e._id} style={{
                    borderBottom: idx < adExpenses.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background 0.15s ease'
                  }}>
                    <td style={{padding:'16px 20px'}}>
                      <div style={{fontWeight:600}}>{e.title}</div>
                    </td>
                    <td style={{padding:'16px 20px'}}>
                      {country && (
                        <div style={{display:'flex', alignItems:'center', gap:8}}>
                          <span style={{fontSize:18}}>{country.flag}</span>
                          <span>{country.name}</span>
                        </div>
                      )}
                    </td>
                    <td style={{padding:'16px 20px'}}>
                      <div style={{display:'flex', alignItems:'center', gap:6}}>
                        <span style={{fontSize:16}}>{isManager ? '🧑‍💼' : '👤'}</span>
                        <span style={{fontWeight:isManager ? 600 : 400, color: isManager ? 'var(--primary)' : 'var(--text)'}}>
                          {creatorName}
                        </span>
                      </div>
                    </td>
                    <td style={{padding:'16px 20px', textAlign:'right'}}>
                      <span style={{fontWeight:700, fontSize:16, color:'#f59e0b'}}>
                        {e.currency} {fmtNum(e.amount)}
                      </span>
                    </td>
                    <td style={{padding:'16px 20px', maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={e.notes||''}>
                      {e.notes || <span style={{opacity:0.4}}>—</span>}
                    </td>
                    <td style={{padding:'16px 20px', fontSize:14, opacity:0.7}}>
                      {fmtDate(e.incurredAt||e.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      <Modal title="Add Advertisement Expense" open={open} onClose={()=> setOpen(false)} footer={(
        <>
          <button className="btn secondary" onClick={()=> setOpen(false)}>Cancel</button>
          <button className="btn" onClick={onSubmit} style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: 'none'
          }}>
            💾 Save Expense
          </button>
        </>
      )}>
        <div style={{display:'grid', gap:16}}>
          <div>
            <label className="label" style={{fontWeight:600, marginBottom:6, display:'block'}}>
              Campaign Name <span style={{color:'#ef4444'}}>*</span>
            </label>
            <input 
              className="input" 
              name="title" 
              value={form.title} 
              onChange={onChange} 
              placeholder="e.g., Facebook Ads - Summer Campaign" 
              style={{fontSize:15}}
            />
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <div>
              <label className="label" style={{fontWeight:600, marginBottom:6, display:'block'}}>
                Country <span style={{color:'#ef4444'}}>*</span>
              </label>
              <select className="input" name="country" value={form.country} onChange={onChange} style={{fontSize:15}}>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" style={{fontWeight:600, marginBottom:6, display:'block'}}>
                Currency
              </label>
              <input 
                className="input" 
                value={form.currency}
                readOnly
                style={{fontSize:15, background:'var(--panel)', opacity:0.8}}
              />
            </div>
          </div>

          <div>
            <label className="label" style={{fontWeight:600, marginBottom:6, display:'block'}}>
              Amount <span style={{color:'#ef4444'}}>*</span>
            </label>
            <input 
              className="input" 
              name="amount" 
              type="number" 
              step="0.01" 
              min="0"
              value={form.amount} 
              onChange={onChange} 
              placeholder="0.00" 
              style={{fontSize:15}}
            />
          </div>

          <div>
            <label className="label" style={{fontWeight:600, marginBottom:6, display:'block'}}>
              Notes (Optional)
            </label>
            <textarea 
              className="input" 
              name="notes" 
              value={form.notes} 
              onChange={onChange} 
              placeholder="Add details about this advertising expense..."
              rows={3}
              style={{fontSize:15, resize:'vertical', minHeight:80}}
            />
          </div>

          <div>
            <label className="label" style={{fontWeight:600, marginBottom:6, display:'block'}}>
              Date
            </label>
            <input 
              className="input" 
              name="incurredAt" 
              type="date" 
              value={form.incurredAt} 
              onChange={onChange} 
              style={{fontSize:15}}
            />
          </div>
        </div>
        {msg && <div style={{marginTop:12, padding:12, borderRadius:8, background: msg.includes('success') ? '#10b98120' : '#ef444420', color: msg.includes('success') ? '#10b981' : '#ef4444', fontSize:14}}>{msg}</div>}
      </Modal>

      {/* Approval/Rejection Modal */}
      {approvalModal.open && approvalModal.expense && (
        <Modal 
          open={approvalModal.open} 
          onClose={closeApprovalModal}
          title={approvalModal.action === 'approve' ? '✅ Approve Expense' : '❌ Reject Expense'}
        >
          <div style={{display:'grid', gap:20}}>
            {/* Expense Details */}
            <div style={{
              padding:20, 
              background:'var(--panel)', 
              borderRadius:12, 
              border:'1px solid var(--border)'
            }}>
              <div style={{display:'grid', gap:12}}>
                <div>
                  <div style={{fontSize:12, fontWeight:600, opacity:0.6, marginBottom:4}}>CAMPAIGN TITLE</div>
                  <div style={{fontSize:16, fontWeight:700}}>{approvalModal.expense.title}</div>
                </div>
                
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                  <div>
                    <div style={{fontSize:12, fontWeight:600, opacity:0.6, marginBottom:4}}>COUNTRY</div>
                    <div style={{display:'flex', alignItems:'center', gap:6}}>
                      {(() => {
                        const country = COUNTRIES.find(c => c.code === approvalModal.expense.country)
                        return country ? (
                          <>
                            <span style={{fontSize:18}}>{country.flag}</span>
                            <span style={{fontWeight:600}}>{country.name}</span>
                          </>
                        ) : approvalModal.expense.country
                      })()}
                    </div>
                  </div>
                  
                  <div>
                    <div style={{fontSize:12, fontWeight:600, opacity:0.6, marginBottom:4}}>AMOUNT</div>
                    <div style={{fontSize:20, fontWeight:800, color:'#f59e0b'}}>
                      {approvalModal.expense.currency} {fmtNum(approvalModal.expense.amount)}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{fontSize:12, fontWeight:600, opacity:0.6, marginBottom:4}}>SUBMITTED BY</div>
                  <div style={{display:'flex', alignItems:'center', gap:6}}>
                    <span style={{fontSize:18}}>🧑‍💼</span>
                    <span style={{fontWeight:600}}>
                      {`${approvalModal.expense.createdBy?.firstName || ''} ${approvalModal.expense.createdBy?.lastName || ''}`.trim() || 'Manager'}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{fontSize:12, fontWeight:600, opacity:0.6, marginBottom:4}}>DATE</div>
                  <div style={{fontWeight:600}}>{fmtDate(approvalModal.expense.incurredAt)}</div>
                </div>

                {approvalModal.expense.notes && (
                  <div>
                    <div style={{fontSize:12, fontWeight:600, opacity:0.6, marginBottom:4}}>NOTES</div>
                    <div style={{
                      padding:12, 
                      background:'var(--bg)', 
                      borderRadius:8, 
                      fontSize:14,
                      lineHeight:1.6
                    }}>
                      {approvalModal.expense.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Rejection Reason (only for reject action) */}
            {approvalModal.action === 'reject' && (
              <div>
                <label className="label" style={{fontWeight:600, marginBottom:8, display:'block', color:'#ef4444'}}>
                  Reason for Rejection <span style={{color:'#ef4444'}}>*</span>
                </label>
                <textarea 
                  className="input" 
                  value={rejectReason} 
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a clear reason for rejecting this expense..."
                  rows={4}
                  style={{
                    fontSize:14, 
                    resize:'vertical', 
                    minHeight:100,
                    borderColor: '#ef4444'
                  }}
                />
                <div style={{fontSize:12, opacity:0.7, marginTop:4}}>
                  This reason will be visible to the manager
                </div>
              </div>
            )}

            {/* Confirmation Message */}
            <div style={{
              padding:16, 
              background: approvalModal.action === 'approve' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderRadius:8,
              border: `1px solid ${approvalModal.action === 'approve' ? '#10b981' : '#ef4444'}`
            }}>
              <div style={{display:'flex', alignItems:'center', gap:12}}>
                <span style={{fontSize:24}}>{approvalModal.action === 'approve' ? '✅' : '⚠️'}</span>
                <div>
                  <div style={{fontWeight:700, fontSize:15, marginBottom:4}}>
                    {approvalModal.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                  </div>
                  <div style={{fontSize:13, opacity:0.8}}>
                    {approvalModal.action === 'approve' 
                      ? 'This expense will be approved and included in your expense reports.'
                      : 'This expense will be rejected and the manager will be notified.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{display:'flex', gap:12, justifyContent:'flex-end'}}>
              <button 
                className="btn secondary" 
                onClick={closeApprovalModal}
                style={{padding:'10px 20px', fontWeight:600}}
              >
                Cancel
              </button>
              <button 
                className={`btn ${approvalModal.action === 'approve' ? 'success' : 'danger'}`}
                onClick={confirmApproval}
                style={{
                  padding:'10px 24px', 
                  fontWeight:700,
                  background: approvalModal.action === 'approve' 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  border: 'none'
                }}
              >
                {approvalModal.action === 'approve' ? '✅ Confirm Approval' : '❌ Confirm Rejection'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function fmtDate(s){ 
  try{ 
    const d = new Date(s)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }catch{ return '' } 
}
function fmtNum(n){ 
  const v = Number(n||0)
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}
