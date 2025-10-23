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

export default function ManagerExpenses(){
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

  async function load(){
    setLoading(true)
    try{
      const res = await apiGet('/api/finance/expenses')
      setItems(res.expenses||[])
    }catch(err){ console.error(err) }
    finally{ setLoading(false) }
  }
  useEffect(()=>{ load() }, [])

  const pendingExpenses = useMemo(() => items.filter(e => e.status === 'pending'), [items])
  const approvedExpenses = useMemo(() => items.filter(e => e.status === 'approved'), [items])
  const rejectedExpenses = useMemo(() => items.filter(e => e.status === 'rejected'), [items])
  const adExpenses = useMemo(() => approvedExpenses.filter(e => e.type === 'advertisement'), [approvedExpenses])
  
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
      setMsg('Advertisement expense submitted for approval')
      setTimeout(()=> setMsg(''), 3000)
    }catch(err){ 
      setMsg(err?.response?.data?.message || err?.message ||'Failed to save expense') 
    }
  }

  const getStatusBadge = (status) => {
    if (status === 'pending') return <span className="badge" style={{background:'#fef3c7', color:'#92400e', border:'1px solid #fbbf24'}}>⏳ Pending Approval</span>
    if (status === 'approved') return <span className="badge" style={{background:'#d1fae5', color:'#065f46', border:'1px solid #10b981'}}>✅ Approved</span>
    if (status === 'rejected') return <span className="badge" style={{background:'#fee2e2', color:'#991b1b', border:'1px solid #ef4444'}}>❌ Rejected</span>
    return null
  }

  return (
    <div className="container" style={{maxWidth: 1400, margin: '0 auto'}}>
      {/* Header */}
      <div style={{marginBottom: 24}}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:8}}>
          <div style={{
            width:48, height:48, borderRadius:16,
            background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display:'grid', placeItems:'center', fontSize:24
          }}>
            💰
          </div>
          <div>
            <h1 className="page-title gradient">Advertisement Expenses</h1>
            <p className="page-subtitle">Submit expenses for owner approval</p>
          </div>
        </div>
        <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
          <button className="btn" onClick={()=> setOpen(true)}>
            ➕ Add Advertisement Expense
          </button>
        </div>
        {msg && <div className="alert info" style={{marginTop:12}}>{msg}</div>}
      </div>

      {/* Summary Cards by Country */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16, marginBottom:24}}>
        {COUNTRIES.map(c => (
          <div key={c.code} className="card" style={{
            padding:20, 
            background:`linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)`,
            border:'1px solid var(--border)'
          }}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
              <span style={{fontSize:24}}>{c.flag}</span>
              <div style={{fontWeight:700, fontSize:14, color:'var(--text)'}}>{c.name}</div>
            </div>
            <div style={{fontSize:24, fontWeight:800, color:'var(--primary)'}}>{c.currency} {totalByCountry[c.code].toFixed(2)}</div>
            <div style={{fontSize:12, color:'var(--muted)', marginTop:4}}>Approved Ad Expenses</div>
          </div>
        ))}
      </div>

      {/* Status Tabs Summary */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12, marginBottom:24}}>
        <div className="card" style={{padding:16, textAlign:'center', background:'rgba(251, 191, 36, 0.1)', border:'1px solid #fbbf24'}}>
          <div style={{fontSize:28, fontWeight:800, color:'#f59e0b'}}>{pendingExpenses.length}</div>
          <div style={{fontSize:12, color:'var(--muted)', marginTop:4}}>⏳ Pending</div>
        </div>
        <div className="card" style={{padding:16, textAlign:'center', background:'rgba(16, 185, 129, 0.1)', border:'1px solid #10b981'}}>
          <div style={{fontSize:28, fontWeight:800, color:'#10b981'}}>{approvedExpenses.length}</div>
          <div style={{fontSize:12, color:'var(--muted)', marginTop:4}}>✅ Approved</div>
        </div>
        <div className="card" style={{padding:16, textAlign:'center', background:'rgba(239, 68, 68, 0.1)', border:'1px solid #ef4444'}}>
          <div style={{fontSize:28, fontWeight:800, color:'#ef4444'}}>{rejectedExpenses.length}</div>
          <div style={{fontSize:12, color:'var(--muted)', marginTop:4}}>❌ Rejected</div>
        </div>
      </div>

      {/* All Expenses List */}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        <div style={{padding:'16px 20px', borderBottom:'1px solid var(--border)', background:'var(--panel)'}}>
          <h3 style={{margin:0, fontSize:16, fontWeight:700}}>My Expenses ({items.length})</h3>
        </div>
        {loading ? (
          <div style={{padding:40, textAlign:'center', color:'var(--muted)'}}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{padding:40, textAlign:'center', color:'var(--muted)'}}>No expenses yet</div>
        ) : (
          <div style={{padding:16}}>
            <div style={{display:'grid', gap:12}}>
              {items.map(item => (
                <div key={item._id} className="card" style={{
                  padding:16,
                  border:`1px solid ${item.status === 'rejected' ? '#ef4444' : item.status === 'pending' ? '#fbbf24' : 'var(--border)'}`,
                  background: item.status === 'rejected' ? 'rgba(239, 68, 68, 0.05)' : item.status === 'pending' ? 'rgba(251, 191, 36, 0.05)' : 'transparent'
                }}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', gap:12, flexWrap:'wrap'}}>
                    <div style={{flex:1, minWidth:200}}>
                      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                        <div style={{fontWeight:800, fontSize:16}}>{item.title}</div>
                        {getStatusBadge(item.status)}
                      </div>
                      <div style={{display:'flex', gap:12, flexWrap:'wrap', fontSize:13, color:'var(--muted)'}}>
                        <span>📍 {COUNTRIES.find(c => c.code === item.country)?.name || item.country}</span>
                        <span>📅 {new Date(item.incurredAt).toLocaleDateString()}</span>
                        {item.approvedAt && (
                          <span>✓ Approved on {new Date(item.approvedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                      {item.notes && (
                        <div style={{marginTop:8, padding:8, background:'var(--panel)', borderRadius:6, fontSize:13}}>
                          <strong>Notes:</strong> {item.notes}
                        </div>
                      )}
                      {item.status === 'rejected' && item.rejectionReason && (
                        <div style={{marginTop:8, padding:8, background:'rgba(239, 68, 68, 0.1)', borderRadius:6, fontSize:13, color:'#991b1b'}}>
                          <strong>Rejection Reason:</strong> {item.rejectionReason}
                        </div>
                      )}
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:24, fontWeight:800, color:'var(--primary)'}}>{item.currency} {Number(item.amount||0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal open={open} onClose={()=> setOpen(false)} title="Add Advertisement Expense">
        <div style={{display:'grid', gap:16}}>
          <div>
            <label className="label">Title *</label>
            <input className="input" name="title" value={form.title} onChange={onChange} placeholder="e.g. Facebook Ads" />
          </div>
          <div>
            <label className="label">Country *</label>
            <select className="input" name="country" value={form.country} onChange={onChange}>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <div>
              <label className="label">Amount *</label>
              <input className="input" type="number" name="amount" value={form.amount} onChange={onChange} placeholder="0.00" />
            </div>
            <div>
              <label className="label">Currency</label>
              <input className="input" name="currency" value={form.currency} readOnly style={{background:'var(--panel)', cursor:'not-allowed'}} />
            </div>
          </div>
          <div>
            <label className="label">Incurred Date</label>
            <input className="input" type="date" name="incurredAt" value={form.incurredAt} onChange={onChange} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" name="notes" value={form.notes} onChange={onChange} rows={3} placeholder="Additional details..." />
          </div>
          {msg && <div className="alert error">{msg}</div>}
          <div style={{display:'flex', gap:12, justifyContent:'flex-end'}}>
            <button className="btn secondary" onClick={()=> setOpen(false)}>Cancel</button>
            <button className="btn" onClick={onSubmit}>Submit for Approval</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
