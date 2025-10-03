import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiGet, apiPatch } from '../../api.js'
import { useToast } from '../../ui/Toast.jsx'

export default function EditOrder(){
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState([])
  
  const [editForm, setEditForm] = useState({
    customerName: '',
    customerPhone: '',
    phoneCountryCode: '+971',
    orderCountry: '',
    city: '',
    customerArea: '',
    customerAddress: '',
    locationLat: '',
    locationLng: '',
    details: '',
    items: [],
    discount: 0,
    shippingFee: 0
  })

  // Currency conversion
  const RATES = {
    SAR: { SAR: 1, AED: 0.98, OMR: 0.10, BHD: 0.10, KWD: 0.082, QAR: 0.97, INR: 22.0 },
    AED: { SAR: 1.02, AED: 1, OMR: 0.10, BHD: 0.10, KWD: 0.084, QAR: 0.99, INR: 22.5 },
    OMR: { SAR: 9.78, AED: 9.58, OMR: 1, BHD: 0.98, KWD: 0.81, QAR: 9.6, INR: 215 },
    BHD: { SAR: 9.94, AED: 9.74, OMR: 1.02, BHD: 1, KWD: 0.83, QAR: 9.7, INR: 218 },
    KWD: { SAR: 12.2, AED: 12.0, OMR: 1.23, BHD: 1.20, KWD: 1, QAR: 11.9, INR: 262 },
    QAR: { SAR: 1.03, AED: 1.01, OMR: 0.104, BHD: 0.103, KWD: 0.084, QAR: 1, INR: 22.7 },
    INR: { SAR: 0.045, AED: 0.044, OMR: 0.0047, BHD: 0.0046, KWD: 0.0038, QAR: 0.044, INR: 1 },
  }
  
  function convertPrice(value, from, to){
    const v = Number(value||0)
    if (!from || !to) return v
    const r = RATES[from]?.[to]
    return r ? v * r : v
  }
  
  const PHONE_CODE_TO_CCY = { '+966':'SAR', '+971':'AED', '+968':'OMR', '+973':'BHD', '+965':'KWD', '+974':'QAR', '+91':'INR' }
  
  // Calculate pricing
  const editCurrency = useMemo(() => PHONE_CODE_TO_CCY[editForm.phoneCountryCode] || 'SAR', [editForm.phoneCountryCode])
  
  const editItemsDetailed = useMemo(() => {
    try{
      return (editForm.items || []).map((it, idx) => {
        const p = products.find(pp => String(pp._id) === String(it.productId)) || null
        const base = p?.baseCurrency || 'SAR'
        const unit = convertPrice(Number(p?.price || 0), base, editCurrency)
        const qty = Math.max(1, Number(it?.quantity||1))
        const amount = unit * qty
        return { idx, product: p, unit, qty, amount }
      })
    }catch{ return [] }
  }, [editForm.items, products, editCurrency])
  
  const editSubtotal = useMemo(() => editItemsDetailed.reduce((s, r) => s + (r.amount||0), 0), [editItemsDetailed])
  const editShippingNum = useMemo(() => Math.max(0, Number(editForm.shippingFee||0)), [editForm.shippingFee])
  const editDiscountNum = useMemo(() => Math.max(0, Number(editForm.discount||0)), [editForm.discount])
  const editComputedTotal = useMemo(() => Math.max(0, editSubtotal + editShippingNum - editDiscountNum), [editSubtotal, editShippingNum, editDiscountNum])

  // Load order and products
  useEffect(()=>{
    (async()=>{
      setLoading(true)
      try{
        const [orderRes, productsRes] = await Promise.all([
          apiGet(`/api/orders/view/${id}`),
          apiGet('/api/products')
        ])
        
        setOrder(orderRes.order || orderRes)
        setProducts(Array.isArray(productsRes?.products)? productsRes.products : [])
        
        const o = orderRes.order || orderRes
        setEditForm({
          customerName: o.customerName || '',
          customerPhone: o.customerPhone || '',
          phoneCountryCode: o.phoneCountryCode || '+971',
          orderCountry: o.orderCountry || '',
          city: o.city || '',
          customerArea: o.customerArea || '',
          customerAddress: o.customerAddress || '',
          locationLat: o.locationLat || '',
          locationLng: o.locationLng || '',
          details: o.details || '',
          items: (o.items && o.items.length > 0) 
            ? o.items.map(it => ({ productId: it.productId?._id || it.productId, quantity: it.quantity || 1 }))
            : [{ productId: o.productId?._id || o.productId || '', quantity: o.quantity || 1 }],
          discount: o.discount || 0,
          shippingFee: o.shippingFee || 0
        })
      }catch(e){
        toast.error(e?.message || 'Failed to load order')
      }finally{
        setLoading(false)
      }
    })()
  }, [id])

  async function saveEdit(){
    setSaving(true)
    try{
      const payload = {
        ...editForm,
        total: editComputedTotal
      }
      await apiPatch(`/api/orders/${id}`, payload)
      toast.success('Order updated successfully')
      setTimeout(() => window.close(), 1000)
    }catch(e){
      toast.error(e?.message || 'Failed to update order')
    }finally{
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{padding:40, textAlign:'center'}}>
        <div>Loading order...</div>
      </div>
    )
  }

  function shortId(id){ return String(id||'').slice(-5).toUpperCase() }

  return (
    <div className="section" style={{maxWidth:1000, margin:'0 auto', padding:20}}>
      <div className="card-header" style={{alignItems:'center', justifyContent:'space-between', marginBottom:20}}>
        <div className="card-title">Edit Order {order?.invoiceNumber? ('#'+order.invoiceNumber) : shortId(order?._id)}</div>
        <button className="btn light" onClick={()=> window.close()}>Close</button>
      </div>
      
      <div style={{display:'grid', gap:16}}>
        {/* Customer Info */}
        <div style={{display:'grid', gap:12}}>
          <div style={{fontWeight:800}}>Customer Information</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12}}>
            <div>
              <div className="label">Customer Name</div>
              <input className="input" value={editForm.customerName || ''} onChange={e=> setEditForm(f=>({...f, customerName:e.target.value}))} />
            </div>
            <div>
              <div className="label">Customer Phone</div>
              <div style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:6}}>
                <input className="input" value={editForm.phoneCountryCode || ''} onChange={e=> setEditForm(f=>({...f, phoneCountryCode:e.target.value}))} style={{maxWidth:80}} />
                <input className="input" value={editForm.customerPhone || ''} onChange={e=> setEditForm(f=>({...f, customerPhone:e.target.value}))} />
              </div>
            </div>
          </div>
        </div>

        {/* Location */}
        <div style={{display:'grid', gap:12}}>
          <div style={{fontWeight:800}}>Location</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12}}>
            <div>
              <div className="label">Country</div>
              <input className="input" value={editForm.orderCountry || ''} onChange={e=> setEditForm(f=>({...f, orderCountry:e.target.value}))} />
            </div>
            <div>
              <div className="label">City</div>
              <input className="input" value={editForm.city || ''} onChange={e=> setEditForm(f=>({...f, city:e.target.value}))} />
            </div>
            <div>
              <div className="label">Area</div>
              <input className="input" value={editForm.customerArea || ''} onChange={e=> setEditForm(f=>({...f, customerArea:e.target.value}))} />
            </div>
          </div>
          <div>
            <div className="label">Address</div>
            <input className="input" value={editForm.customerAddress || ''} onChange={e=> setEditForm(f=>({...f, customerAddress:e.target.value}))} />
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <div>
              <div className="label">Latitude</div>
              <input className="input" type="number" step="any" value={editForm.locationLat || ''} onChange={e=> setEditForm(f=>({...f, locationLat:e.target.value}))} />
            </div>
            <div>
              <div className="label">Longitude</div>
              <input className="input" type="number" step="any" value={editForm.locationLng || ''} onChange={e=> setEditForm(f=>({...f, locationLng:e.target.value}))} />
            </div>
          </div>
        </div>

        {/* Products */}
        <div style={{display:'grid', gap:12}}>
          <div style={{fontWeight:800}}>Products</div>
          {(editForm.items || []).map((item, idx) => (
            <div key={idx} style={{display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, alignItems:'end'}}>
              <div>
                <div className="label">Product</div>
                <select className="input" value={item.productId || ''} onChange={e=> {
                  const newItems = [...editForm.items]
                  newItems[idx] = { ...newItems[idx], productId: e.target.value }
                  setEditForm(f=>({...f, items: newItems}))
                }}>
                  <option value="">Select Product</option>
                  {products.map(p => (
                    <option key={p._id} value={p._id}>{p.name} - {p.baseCurrency} {p.price}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="label">Quantity</div>
                <div style={{display:'flex', gap:4, alignItems:'center'}}>
                  <button type="button" className="btn secondary" onClick={()=>{
                    const newItems = [...editForm.items]
                    newItems[idx] = { ...newItems[idx], quantity: Math.max(1, (newItems[idx].quantity||1) - 1) }
                    setEditForm(f=>({...f, items: newItems}))
                  }} disabled={item.quantity<=1}>−</button>
                  <div style={{minWidth:40, textAlign:'center', fontWeight:600}}>{item.quantity || 1}</div>
                  <button type="button" className="btn secondary" onClick={()=>{
                    const newItems = [...editForm.items]
                    newItems[idx] = { ...newItems[idx], quantity: (newItems[idx].quantity||1) + 1 }
                    setEditForm(f=>({...f, items: newItems}))
                  }}>+</button>
                </div>
              </div>
              {editForm.items.length > 1 && (
                <button type="button" className="btn danger" onClick={()=>{
                  setEditForm(f=>({...f, items: f.items.filter((_,i)=> i!==idx)}))
                }} style={{padding:'8px 12px'}}>Remove</button>
              )}
            </div>
          ))}
          <button type="button" className="btn secondary" onClick={()=>{
            setEditForm(f=>({...f, items: [...(f.items||[]), {productId:'', quantity:1}]}))
          }} style={{justifySelf:'start'}}>+ Add Product</button>
        </div>

        {/* Pricing */}
        <div style={{display:'grid', gap:12}}>
          <div style={{fontWeight:800}}>Pricing Summary</div>
          
          {editItemsDetailed.length > 0 && (
            <div style={{display:'grid', gap:6, padding:'12px', backgroundColor:'var(--surface-secondary)', borderRadius:'8px'}}>
              <div className="helper" style={{fontWeight:600}}>Items Breakdown ({editCurrency})</div>
              {editItemsDetailed.map(r => (
                <div key={r.idx} style={{display:'flex', justifyContent:'space-between', fontSize:14}}>
                  <span>{r.product?.name || 'Item'} × {r.qty}</span>
                  <span style={{fontWeight:600}}>{r.amount.toFixed(2)}</span>
                </div>
              ))}
              <div style={{borderTop:'1px solid var(--border)', paddingTop:6, marginTop:6, display:'flex', justifyContent:'space-between', fontWeight:700}}>
                <span>Subtotal</span>
                <span>{editSubtotal.toFixed(2)}</span>
              </div>
            </div>
          )}
          
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12}}>
            <div>
              <div className="label">Discount ({editCurrency})</div>
              <input className="input" type="number" step="0.01" value={editForm.discount || 0} onChange={e=> setEditForm(f=>({...f, discount:Number(e.target.value)||0}))} />
            </div>
            <div>
              <div className="label">Shipping Fee ({editCurrency})</div>
              <input className="input" type="number" step="0.01" value={editForm.shippingFee || 0} onChange={e=> setEditForm(f=>({...f, shippingFee:Number(e.target.value)||0}))} />
            </div>
            <div>
              <div className="label">Total ({editCurrency})</div>
              <input className="input" type="number" step="0.01" readOnly value={editComputedTotal.toFixed(2)} style={{fontWeight:700, backgroundColor:'var(--surface-secondary)'}} />
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div>
          <div className="label">Order Details</div>
          <textarea className="input" rows={4} value={editForm.details || ''} onChange={e=> setEditForm(f=>({...f, details:e.target.value}))} />
        </div>

        <div style={{display:'flex', gap:8, justifyContent:'flex-end', padding:'20px 0'}}>
          <button className="btn light" onClick={()=> window.close()}>Cancel</button>
          <button className="btn primary" onClick={saveEdit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
