import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost, API_BASE } from '../../api'

// Currency conversion via SAR (approximate)
const SAR_TO = { SAR: 1, AED: 0.98, OMR: 0.10, BHD: 0.10, QAR: 0.97, KWD: 0.082, INR: 22.0 }
const TO_SAR = { SAR: 1, AED: 1.02, OMR: 9.8,  BHD: 10.0, QAR: 1.03, KWD: 12.2, INR: 0.045 }
const COUNTRY_TO_CCY = { KSA:'SAR', UAE:'AED', Oman:'OMR', Bahrain:'BHD', India:'INR', Kuwait:'KWD', Qatar:'QAR' }
const COUNTRY_TO_CODE = { KSA:'+966', UAE:'+971', Oman:'+968', Bahrain:'+973', India:'+91', Kuwait:'+965', Qatar:'+974' }

function convertPrice(value, from, to){
  const v = Number(value||0)
  if (!from || !to || from === to) return v
  const inSar = v * (TO_SAR[from] || 1)
  return inSar * (SAR_TO[to] || 1)
}

function useProducts(){
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  useEffect(()=>{ (async()=>{
    setLoading(true)
    try{
      const data = await apiGet('/api/products')
      const list = Array.isArray(data.products) ? data.products : []
      list.sort((a,b)=> String(a.name||'').localeCompare(String(b.name||'')))
      setRows(list)
    }catch(err){ setMsg(err?.message||'Failed to load products') }
    finally{ setLoading(false) }
  })() },[])
  return { rows, loading, msg }
}

export default function Catalog(){
  const navigate = useNavigate()
  const { rows, loading, msg } = useProducts()
  const [country, setCountry] = useState(()=> localStorage.getItem('store_country') || 'KSA')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null) // product detail modal
  const [cart, setCart] = useState(()=>{ try{ return JSON.parse(localStorage.getItem('cart')||'[]') }catch{ return [] } })
  const [checkout, setCheckout] = useState({ name:'', phone:'', city:'', area:'', address:'', details:'' })
  const currency = COUNTRY_TO_CCY[country] || 'SAR'
  const phoneCode = COUNTRY_TO_CODE[country] || '+966'

  useEffect(()=>{ try{ localStorage.setItem('cart', JSON.stringify(cart)) }catch{} },[cart])
  useEffect(()=>{ try{ localStorage.setItem('store_country', country) }catch{} },[country])

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase()
    return rows.filter(p=>{
      // show only products available in this country
      const avail = Array.isArray(p.availableCountries) ? p.availableCountries : []
      const hasCountry = avail.includes(country)
      if (!hasCountry) return false
      if (!q) return true
      return String(p.name||'').toLowerCase().includes(q) || String(p.category||'').toLowerCase().includes(q)
    })
  }, [rows, country, query])

  function addToCart(prod, qty=1){
    const id = String(prod._id)
    setCart(prev => {
      const found = prev.find(it => it.id === id)
      if (found){ return prev.map(it => it.id===id ? { ...it, qty: Math.max(1, it.qty + qty) } : it) }
      const price = convertPrice(Number(prod.price||0), prod.baseCurrency||'SAR', currency)
      const img = Array.isArray(prod.images) && prod.images.length ? prod.images[0] : null
      return [...prev, { id, name: prod.name||'Product', price, currency, qty: Math.max(1, qty), image: img }]
    })
    // Navigate to checkout after adding
    setTimeout(()=> navigate('/checkout'), 10)
  }
  function removeFromCart(id){ setCart(prev => prev.filter(it => it.id !== id)) }
  function updateQty(id, qty){ setCart(prev => prev.map(it => it.id===id ? { ...it, qty: Math.max(1, Number(qty)||1) } : it)) }

  const total = useMemo(()=> cart.reduce((s, it) => s + (Number(it.price||0) * Math.max(1, Number(it.qty||1))), 0), [cart])

  async function submitOrder(){
    if (!cart.length){ alert('Your cart is empty'); return }
    if (!checkout.name || !checkout.phone || !checkout.city){ alert('Please fill your name, phone and city'); return }
    try{
      // Prepare items for backend
      const items = cart.map(it => ({ productId: it.id, quantity: Math.max(1, Number(it.qty||1)) }))
      const first = items[0]
      const body = {
        customerName: checkout.name,
        customerPhone: checkout.phone,
        phoneCountryCode: phoneCode,
        orderCountry: country,
        city: checkout.city,
        customerArea: checkout.area,
        customerAddress: checkout.address,
        details: checkout.details || `Website order for ${cart.length} items`,
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
      setCheckout({ name:'', phone:'', city:'', area:'', address:'', details:'' })
    }catch(err){ alert(err?.message||'Failed to submit order') }
  }

  function jumpToCheckout(){ navigate('/checkout') }

  return (
    <div style={{display:'grid', gridTemplateRows:'auto 1fr'}}>
      {/* Storefront Header */}
      <div style={{position:'sticky', top:0, zIndex:20, background:'var(--sidebar-bg)', borderBottom:'1px solid var(--sidebar-border)'}}>
        <div style={{display:'grid', gridTemplateColumns:'auto 1fr auto', gap:12, alignItems:'center', padding:'8px 12px'}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <img alt="BuySial" src={`${import.meta.env.BASE_URL}BuySial2.png`} style={{height:28, width:'auto'}}/>
            <div style={{fontWeight:900}}>BuySial Store</div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:8, alignItems:'center'}}>
            <select className="input" value={country} onChange={e=> setCountry(e.target.value)}>
              {['KSA','UAE','Oman','Bahrain','India','Kuwait','Qatar'].map(c => (<option key={c} value={c}>{c}</option>))}
            </select>
            <input className="input" placeholder="Search products" value={query} onChange={e=> setQuery(e.target.value)} />
          </div>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <button className="btn" onClick={jumpToCheckout} title="View cart">
              🛒 Cart ({cart.reduce((s,it)=> s + Math.max(1, Number(it.qty||1)), 0)})
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="content" style={{ padding:16, display:'grid', gap:16 }}>
        <div className="page-header" style={{alignItems:'center', justifyContent:'space-between'}}>
          <div>
            <div className="page-title gradient heading-pink">Catalog</div>
            <div className="page-subtitle">Browse products and place an order online</div>
          </div>
        </div>

      {loading ? (
        <div className="helper">Loading…</div>
      ) : msg ? (
        <div className="error">{msg}</div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:12}}>
          {filtered.map(p => (
            <div key={p._id} className="card" style={{display:'grid', gap:8}}>
              <div style={{position:'relative', paddingTop:'70%', background:'var(--panel)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
                <img
                  alt={p.name}
                  src={p.images && p.images[0] ? `${API_BASE}${p.images[0]}` : `${import.meta.env.BASE_URL}placeholder.png`}
                  onClick={()=> setSelected(p)}
                  style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', cursor:'pointer'}}
                />
              </div>
              <div style={{display:'grid', gap:4}}>
                <div style={{fontWeight:800}}>{p.name}</div>
                <div className="helper">{p.category||'Other'}</div>
                <div style={{fontWeight:800}}>{currency} {convertPrice(Number(p.price||0), p.baseCurrency||'SAR', currency).toFixed(2)}</div>
              </div>
              <div style={{display:'flex', gap:8}}>
                <button className="btn" onClick={()=> addToCart(p, 1)}>Add to Cart</button>
                <button className="btn secondary" onClick={()=> setSelected(p)}>View</button>
              </div>
            </div>
          ))}
        </div>
      )}
      

      {/* Product modal */}
      {selected && (
        <div className="modal" role="dialog" aria-modal="true" onClick={()=> setSelected(null)}>
          <div className="modal-card" onClick={e=> e.stopPropagation()} style={{maxWidth:960}}>
            <div className="card-header" style={{justifyContent:'space-between', alignItems:'center'}}>
              <div className="card-title">{selected.name}</div>
              <button className="btn light" onClick={()=> setSelected(null)}>Close</button>
            </div>
            <div className="section" style={{display:'grid', gap:12}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <div style={{display:'grid', gap:8}}>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8}}>
                    {(selected.images||[]).slice(0,4).map((img, i)=>(
                      <img key={i} alt={`img-${i}`} src={`${API_BASE}${img}`} style={{width:'100%', height:110, objectFit:'cover', borderRadius:6, border:'1px solid var(--border)'}}/>
                    ))}
                    {(!selected.images || selected.images.length===0) && (
                      <img alt="placeholder" src={`${import.meta.env.BASE_URL}placeholder.png`} style={{width:'100%', height:110, objectFit:'cover', borderRadius:6, border:'1px solid var(--border)'}}/>
                    )}
                  </div>
                </div>
                <div style={{display:'grid', gap:10}}>
                  <div style={{fontSize:22, fontWeight:900}}>{currency} {convertPrice(Number(selected.price||0), selected.baseCurrency||'SAR', currency).toFixed(2)}</div>
                  <div style={{whiteSpace:'pre-wrap', opacity:0.9}}>{selected.description || 'No description'}</div>
                  <div style={{display:'flex', gap:8}}>
                    <button className="btn" onClick={()=> addToCart(selected, 1)}>Add to Cart</button>
                    <button className="btn secondary" onClick={()=>{ addToCart(selected, 1); setSelected(null) }}>Add & Close</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
