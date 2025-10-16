import React, { useEffect, useMemo, useState } from 'react'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import { API_BASE, apiGet, apiPost, apiDelete } from '../../api'
import { io } from 'socket.io-client'
import Modal from '../../components/Modal.jsx'

export default function Investors(){
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', password:'', phone:'', investmentAmount:'', currency:'SAR' })
  const [assignments, setAssignments] = useState([{ productId:'', country:'', profitPerUnit:'' }])
  const [countries, setCountries] = useState([])
  const [rates, setRates] = useState({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [products, setProducts] = useState([])
  const [phoneError, setPhoneError] = useState('')
  const [delModal, setDelModal] = useState({ open:false, busy:false, error:'', confirm:'', investor:null })

  const CURRENCIES = [
    { key:'AED', label:'AED (UAE Dirham)' },
    { key:'SAR', label:'SAR (Saudi Riyal)' },
    { key:'OMR', label:'OMR (Omani Rial)' },
    { key:'BHD', label:'BHD (Bahraini Dinar)' },
  ]

  function onChange(e){
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function onAssignChange(idx, key, value){
    setAssignments(arr => arr.map((row, i) => i===idx ? { ...row, [key]: value } : row))
  }

  function addAssignment(){ setAssignments(arr => [...arr, { productId:'', country:'', profitPerUnit:'' }]) }
  function removeAssignment(idx){ setAssignments(arr => arr.filter((_r, i) => i !== idx)) }

  async function loadManagers(query=''){
    setLoadingList(true)
    try{
      const data = await apiGet(`/api/users/investors?q=${encodeURIComponent(query)}`)
      setRows((data.users||[]).map(u => ({
        id: u._id || u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        createdAt: u.createdAt,
        currency: u.investorProfile?.currency || 'SAR',
        investmentAmount: u.investorProfile?.investmentAmount || 0,
        assignedProducts: (u.investorProfile?.assignedProducts||[]).map(a => ({ name: a.product?.name || '-', profitPerUnit: a.profitPerUnit }))
      })))
    }catch(_e){ setRows([]) }
    finally{ setLoadingList(false) }
  }

  async function loadProducts(){
    try{ const data = await apiGet('/api/products'); setProducts(data.products||[]) }catch(_e){ setProducts([]) }
  }

  async function loadCountries(){
    try{ 
      const data = await apiGet('/api/orders/options')
      const arr = Array.isArray(data?.countries) ? data.countries : []
      const map = new Map()
      for (const c of arr){
        const raw = String(c||'').trim()
        const key = raw.toLowerCase()
        if (!map.has(key)) map.set(key, raw.toUpperCase() === 'UAE' ? 'UAE' : raw)
      }
      setCountries(Array.from(map.values()))
    }catch{ setCountries([]) }
  }

  async function loadRates(){
    try{
      const data = await apiGet('/api/settings/currency')
      setRates(data?.rates || {})
    }catch{ setRates({}) }
  }

  useEffect(()=>{ loadManagers(''); loadProducts(); loadCountries(); loadRates() },[])

  // small debounce for search
  useEffect(()=>{
    const id = setTimeout(()=> loadManagers(q), 300)
    return ()=> clearTimeout(id)
  },[q])

  // Real-time: refresh investors list when a new investor is created in this workspace
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token') || ''
      socket = io(API_BASE || undefined, { path: '/socket.io', transports: ['polling'], upgrade: false, auth: { token }, withCredentials: true })
      const refresh = ()=>{ loadManagers(q) }
      socket.on('investor.created', refresh)
      socket.on('investor.deleted', refresh)
    }catch{}
    return ()=>{
      try{ socket && socket.off('investor.created') }catch{}
      try{ socket && socket.off('investor.deleted') }catch{}
      try{ socket && socket.disconnect() }catch{}
    }
  },[q])

  async function onSubmit(e){
    e.preventDefault()
    setMsg('')
    setLoading(true)
    try{
      // Basic validation for phone number
      if (form.phone && !isValidPhoneNumber(form.phone)){
        setLoading(false)
        setPhoneError('Enter a valid phone number with country code')
        setMsg('')
        return
      }
      const payload = {
        ...form,
        investmentAmount: Number(form.investmentAmount || 0),
        assignments: assignments
          .filter(a => a.productId && a.profitPerUnit !== '')
          .map(a => ({ 
            productId: a.productId, 
            country: a.country || '',
            profitPerUnit: Number(a.profitPerUnit||0) 
          }))
      }
      await apiPost('/api/users/investors', payload)
      setMsg('Investor created successfully')
      setForm({ firstName:'', lastName:'', email:'', password:'', phone:'', investmentAmount:'', currency:'SAR' })
      setPhoneError('')
      setAssignments([{ productId:'', country:'', profitPerUnit:'' }])
      loadManagers(q)
    }catch(err){ setMsg(err?.message || 'Failed to create investor') }
    finally{ setLoading(false) }
  }

  function openDelete(investor){ setDelModal({ open:true, busy:false, error:'', confirm:'', investor }) }
  function closeDelete(){ setDelModal(m=>({ ...m, open:false })) }
  async function confirmDelete(){
    const investor = delModal.investor
    if (!investor) return
    const want = (investor.email||'').trim().toLowerCase()
    const typed = (delModal.confirm||'').trim().toLowerCase()
    if (!typed || typed !== want){ setDelModal(m=>({ ...m, error: 'Please type the investor\'s email to confirm.' })); return }
    setDelModal(m=>({ ...m, busy:true, error:'' }))
    try{
      await apiDelete(`/api/users/investors/${investor.id}`)
      setDelModal({ open:false, busy:false, error:'', confirm:'', investor:null })
      loadManagers(q)
    }catch(e){ setDelModal(m=>({ ...m, busy:false, error: e?.message || 'Failed to delete investor' })) }
  }

  function fmtDate(s){ try{ return new Date(s).toLocaleString() }catch{ return ''} }

  return (
    <div className="section">
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-green">Investors</div>
          <div className="page-subtitle">Create and manage investors. Assign one or more inhouse products and set their profit per unit.</div>
        </div>
      </div>

      {/* Create Investor */}
      <div className="card">
        <div className="card-header">
          <div className="card-title modern">Create Investor</div>
          <div className="card-subtitle">Fill in details and assign products with profit per unit</div>
        </div>
        <form onSubmit={onSubmit} className="section" style={{display:'grid', gap:12}}>
          <div className="form-grid">
            <div>
              <div className="label">First Name</div>
              <input className="input" name="firstName" value={form.firstName} onChange={onChange} placeholder="John" required autoComplete="given-name" />
            </div>
            <div>
              <div className="label">Last Name</div>
              <input className="input" name="lastName" value={form.lastName} onChange={onChange} placeholder="Doe" required autoComplete="family-name" />
            </div>
            <div>
              <div className="label">Email</div>
              <input className="input" type="email" name="email" value={form.email} onChange={onChange} placeholder="investor@example.com" required autoComplete="email" />
            </div>
          </div>
          <div className="form-grid">
            <div>
              <div className="label">Phone</div>
              <div className={`PhoneInput ${phoneError? 'input-error':''}`}>
                <PhoneInput
                  defaultCountry="AE"
                  placeholder="Enter phone number"
                  value={form.phone}
                  onChange={(value)=> { setForm(f=>({ ...f, phone: value||'' })); setPhoneError('') }}
                  international
                  withCountryCallingCode
                />
              </div>
              <div className={`helper-text ${phoneError? 'error':''}`}>{phoneError || 'Include country code, e.g. +971 50 123 4567'}</div>
            </div>
            <div>
              <div className="label">Password</div>
              <input className="input" type="password" name="password" value={form.password} onChange={onChange} placeholder="Minimum 6 characters" required autoComplete="new-password" />
            </div>
          </div>
          <div className="form-grid">
            <div>
              <div className="label">Investment Amount</div>
              <input className="input" type="number" min="0" step="0.01" name="investmentAmount" value={form.investmentAmount} onChange={onChange} placeholder="0.00" />
            </div>
            <div>
              <div className="label">Currency</div>
              <select className="input" name="currency" value={form.currency} onChange={onChange}>
                {CURRENCIES.map(c => (<option key={c.key} value={c.key}>{c.label}</option>))}
              </select>
              <div className="helper">Currencies: AED, SAR (SR), OMR (Omani), BHD (Bahraini)</div>
            </div>
          </div>

          <div>
            <div className="label">Assigned Products</div>
            <div style={{display:'grid', gap:16}}>
              {assignments.map((row, idx) => {
                const selectedProduct = products.find(p => p._id === row.productId)
                const showInfo = selectedProduct && row.country
                
                // Get country-specific stock
                let countryStock = 0
                if (selectedProduct && row.country) {
                  const stockByCountry = selectedProduct.stockByCountry || {}
                  countryStock = stockByCountry[row.country] || 0
                }
                
                // Convert price from product's base currency to investor's currency
                let convertedPrice = selectedProduct?.price || 0
                if (selectedProduct && selectedProduct.baseCurrency !== form.currency) {
                  const fromRate = rates[selectedProduct.baseCurrency] || 1
                  const toRate = rates[form.currency] || 1
                  convertedPrice = (convertedPrice / fromRate) * toRate
                }
                
                const estimatedRevenue = countryStock * convertedPrice
                
                return (
                  <div key={idx} style={{padding:12, background:'var(--panel)', borderRadius:8, border:'1px solid var(--border)'}}>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 140px auto', gap:8, alignItems:'center', marginBottom: showInfo ? 12 : 0}}>
                      <select className="input" value={row.productId} onChange={e=>onAssignChange(idx, 'productId', e.target.value)}>
                        <option value="">-- Select Product --</option>
                        {products.map(p => (<option key={p._id} value={p._id}>{p.name}</option>))}
                      </select>
                      <select className="input" value={row.country} onChange={e=>onAssignChange(idx, 'country', e.target.value)}>
                        <option value="">-- Select Country --</option>
                        {countries.map(c => (<option key={c} value={c}>{c}</option>))}
                      </select>
                      <input className="input" type="number" min="0" step="0.01" value={row.profitPerUnit} onChange={e=>onAssignChange(idx,'profitPerUnit', e.target.value)} placeholder="Profit/unit" />
                      <div style={{display:'flex', gap:6}}>
                        {assignments.length > 1 && (
                          <button type="button" className="btn danger" onClick={()=>removeAssignment(idx)} title="Remove" aria-label="Remove">🗑️</button>
                        )}
                        {idx === assignments.length-1 && (
                          <button type="button" className="btn secondary" onClick={addAssignment} title="Add another" aria-label="Add">＋</button>
                        )}
                      </div>
                    </div>
                    {showInfo && (
                      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, paddingTop:12, borderTop:'1px solid var(--border)'}}>
                        <div style={{padding:8, background:'var(--panel-2)', borderRadius:6}}>
                          <div className="helper" style={{fontSize:11}}>Stock in {row.country}</div>
                          <div style={{fontWeight:700, color:'#f59e0b'}}>{countryStock} units</div>
                        </div>
                        <div style={{padding:8, background:'var(--panel-2)', borderRadius:6}}>
                          <div className="helper" style={{fontSize:11}}>Price/Unit</div>
                          <div style={{fontWeight:700, color:'#10b981'}}>{form.currency} {convertedPrice.toFixed(2)}</div>
                        </div>
                        <div style={{padding:8, background:'var(--panel-2)', borderRadius:6}}>
                          <div className="helper" style={{fontSize:11}}>Est. Revenue</div>
                          <div style={{fontWeight:700, color:'#3b82f6'}}>{form.currency} {estimatedRevenue.toFixed(2)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="helper" style={{marginTop:6}}>Select product, country, and profit per unit. Stock and revenue are shown for reference.</div>
          </div>

          <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
            <button className="btn" type="submit" disabled={loading}>{loading? 'Creating...' : 'Create Investor'}</button>
          </div>
          {msg && <div style={{opacity:0.9}}>{msg}</div>}
        </form>
      </div>

      {/* Investors List */}
      <div className="card" style={{marginTop:12, display:'grid', gap:12}}>
        <div className="card-header">
          <div className="card-title">Your Investors</div>
          <input className="input" placeholder="Search by name, email, phone" value={q} onChange={e=>setQ(e.target.value)} style={{maxWidth:320}}/>
        </div>
        <div style={{overflow:'auto'}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Name</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Email</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Phone</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Investment</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Products</th>
                <th style={{textAlign:'left', padding:'10px 12px'}}>Created</th>
                <th style={{textAlign:'right', padding:'10px 12px'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr><td colSpan={7} style={{padding:12, opacity:0.7}}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} style={{padding:12, opacity:0.7}}>No investors found</td></tr>
              ) : (
                rows.map(u=> (
                  <tr key={u.id} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'10px 12px'}}>{u.firstName} {u.lastName}</td>
                    <td style={{padding:'10px 12px'}}>{u.email}</td>
                    <td style={{padding:'10px 12px'}}>{u.phone||'-'}</td>
                    <td style={{padding:'10px 12px'}}>{u.currency} {Number(u.investmentAmount||0).toFixed(2)}</td>
                    <td style={{padding:'10px 12px'}}>
                      <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                        {(u.assignedProducts||[]).map((a,i)=> (
                          <span key={i} className="badge">{a.name} (+{a.profitPerUnit})</span>
                        ))}
                      </div>
                    </td>
                    <td style={{padding:'10px 12px'}}>{fmtDate(u.createdAt)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right'}}>
                      <button className="btn danger" onClick={()=>openDelete(u)}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{fontSize:12, opacity:0.8}}>
          Investors can sign in at <code>/login</code> using the email and password above. They will be redirected to <code>/investor</code>.
        </div>
      </div>
      <Modal
        title="Are you sure you want to delete this investor?"
        open={delModal.open}
        onClose={closeDelete}
        footer={
          <>
            <button className="btn secondary" type="button" onClick={closeDelete} disabled={delModal.busy}>Cancel</button>
            <button
              className="btn danger"
              type="button"
              disabled={delModal.busy || (delModal.confirm||'').trim().toLowerCase() !== (delModal.investor?.email||'').trim().toLowerCase()}
              onClick={confirmDelete}
            >{delModal.busy ? 'Deleting…' : 'Delete Investor'}</button>
          </>
        }
      >
        <div style={{display:'grid', gap:12}}>
          <div style={{lineHeight:1.5}}>
            You are about to delete the investor
            {delModal.investor ? <strong> {delModal.investor.firstName} {delModal.investor.lastName}</strong> : null}.
            This will:
            <ul style={{margin:'8px 0 0 18px'}}>
              <li>Remove their account and login credentials immediately.</li>
              <li>Revoke access tokens (deleted users cannot authenticate).</li>
            </ul>
          </div>
          <div>
            <div className="label">Type the investor's email to confirm</div>
            <input
              className="input"
              placeholder={delModal.investor?.email || 'investor@example.com'}
              value={delModal.confirm}
              onChange={e=> setDelModal(m=>({ ...m, confirm: e.target.value, error:'' }))}
              disabled={delModal.busy}
            />
            {delModal.error && <div className="helper-text error">{delModal.error}</div>}
          </div>
        </div>
      </Modal>
    </div>
  )
}
