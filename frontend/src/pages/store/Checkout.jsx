import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost, API_BASE } from '../../api'

const COUNTRY_TO_CODE = { KSA:'+966', UAE:'+971', Oman:'+968', Bahrain:'+973' }

export default function Checkout(){
  const navigate = useNavigate()
  const [cart, setCart] = useState(()=>{ try{ return JSON.parse(localStorage.getItem('cart')||'[]') }catch{ return [] } })
  const [country, setCountry] = useState(()=> localStorage.getItem('store_country') || 'KSA')
  const [form, setForm] = useState({ name:'', phone:'', city:'', area:'', address:'', details:'' })
  const [submitting, setSubmitting] = useState(false)
  const phoneCode = COUNTRY_TO_CODE[country] || '+966'

  useEffect(()=>{ try{ localStorage.setItem('cart', JSON.stringify(cart)) }catch{} },[cart])

  const total = useMemo(()=> cart.reduce((s, it) => s + (Number(it.price||0) * Math.max(1, Number(it.qty||1))), 0), [cart])
  const currency = cart[0]?.currency || 'SAR'

  function onChange(e){
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function submitOrder(){
    if (!cart.length){ alert('Your cart is empty'); return }
    if (!form.name || !form.phone || !form.city){ alert('Please fill your name, phone and city'); return }
    try{
      setSubmitting(true)
      const items = cart.map(it => ({ productId: it.id, quantity: Math.max(1, Number(it.qty||1)) }))
      const first = items[0]
      const body = {
        customerName: form.name,
        customerPhone: form.phone,
        phoneCountryCode: phoneCode,
        orderCountry: country,
        city: form.city,
        customerArea: form.area,
        customerAddress: form.address,
        details: form.details || `Website order for ${cart.length} items`,
        items,
        productId: first?.productId,
        quantity: first?.quantity,
        total: total.toFixed(2),
        source: 'website',
        websiteOrder: true,
      }
      await apiPost('/api/orders', body)
      alert('Order submitted. We will contact you shortly!')
      setCart([])
      try{ localStorage.setItem('cart', '[]') }catch{}
      setForm({ name:'', phone:'', city:'', area:'', address:'', details:'' })
      navigate('/catalog')
    }catch(err){ alert(err?.message||'Failed to submit order') }
    finally{ setSubmitting(false) }
  }

  return (
    <div className="content" style={{ padding:16, display:'grid', gap:16 }}>
      <div className="page-header" style={{alignItems:'center', justifyContent:'space-between'}}>
        <div>
          <div className="page-title gradient heading-green">Checkout</div>
          <div className="page-subtitle">Review your cart and complete your order</div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn secondary" onClick={()=> navigate('/catalog')}>Continue Shopping</button>
        </div>
      </div>

      {/* Invoice-style summary */}
      <div className="card" style={{display:'grid', gap:12}}>
        <div className="card-title" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <span>Cart Summary</span>
          <span style={{fontWeight:800}}>
            Total: {currency} {total.toFixed(2)}
          </span>
        </div>
        {!cart.length ? (
          <div className="helper">Your cart is empty</div>
        ) : (
          <div className="section" style={{overflowX:'auto'}}>
            <table className="table" style={{width:'100%', borderCollapse:'separate', borderSpacing:0}}>
              <thead>
                <tr>
                  <th style={{textAlign:'left'}}>Item</th>
                  <th style={{textAlign:'right'}}>Unit</th>
                  <th style={{textAlign:'right'}}>Qty</th>
                  <th style={{textAlign:'right'}}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((it, idx) => (
                  <tr key={idx} style={{borderTop:'1px solid var(--border)'}}>
                    <td>
                      <div style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:8, alignItems:'center'}}>
                        <img alt="thumb" src={it.image? `${API_BASE}${it.image}`: `${import.meta.env.BASE_URL}placeholder.png`} style={{width:44, height:44, objectFit:'cover', borderRadius:6, border:'1px solid var(--border)'}}/>
                        <div>
                          <div style={{fontWeight:700}}>{it.name}</div>
                          <div className="helper" style={{fontSize:12}}>ID: {it.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{textAlign:'right'}}>{it.currency} {Number(it.price||0).toFixed(2)}</td>
                    <td style={{textAlign:'right'}}>{Math.max(1, Number(it.qty||1))}</td>
                    <td style={{textAlign:'right', fontWeight:700}}>{it.currency} {(Number(it.price||0)*Math.max(1, Number(it.qty||1))).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{textAlign:'right', fontWeight:800}}>Total</td>
                  <td style={{textAlign:'right', fontWeight:800}}>{currency} {total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Customer details */}
      <div className="card" style={{display:'grid', gap:12}}>
        <div className="card-title">Customer Details</div>
        <div className="section" style={{display:'grid', gap:12}}>
          <div className="form-grid">
            <label className="field">
              <div>Name</div>
              <input name="name" className="input" value={form.name} onChange={onChange} placeholder="Full name" />
            </label>
            <label className="field">
              <div>Phone</div>
              <div style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:6, alignItems:'center'}}>
                <div className="input" style={{padding:'0 10px'}}>{phoneCode}</div>
                <input name="phone" className="input" value={form.phone} onChange={onChange} placeholder="5xxxxxxx" />
              </div>
            </label>
            <label className="field">
              <div>City</div>
              <input name="city" className="input" value={form.city} onChange={onChange} placeholder="City" />
            </label>
            <label className="field">
              <div>Area</div>
              <input name="area" className="input" value={form.area} onChange={onChange} placeholder="Area / district" />
            </label>
            <label className="field" style={{gridColumn:'1 / -1'}}>
              <div>Address</div>
              <input name="address" className="input" value={form.address} onChange={onChange} placeholder="Street, building" />
            </label>
            <label className="field" style={{gridColumn:'1 / -1'}}>
              <div>Details (optional)</div>
              <textarea name="details" className="input" rows={3} value={form.details} onChange={onChange} placeholder="Any notes for delivery" />
            </label>
          </div>
          <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
            <button className="btn secondary" onClick={()=> navigate('/catalog')}>Back to Catalog</button>
            <button className="btn" onClick={submitOrder} disabled={!cart.length || submitting}>{submitting? 'Submitting…' : 'Place Order'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
