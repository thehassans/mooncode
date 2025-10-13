import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet } from '../../api'
import { io } from 'socket.io-client'
import { getCurrencyConfig, convert as fxConvert } from '../../util/currency'
import { useNavigate } from 'react-router-dom'

export default function Warehouse(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('name')
  const [ccyCfg, setCcyCfg] = useState(null)
  const navigate = useNavigate()
  const [prodMap, setProdMap] = useState({})
  const [countryFilter, setCountryFilter] = useState('All')
  const COUNTRY_KEYS = ['UAE','Oman','KSA','Bahrain','India','Kuwait','Qatar']
  const CUR_KEY_ORDER = ['SAR','OMR','AED','BHD','INR','KWD','QAR']

  useEffect(()=>{ load() },[])
  // Live refresh on order deliveries
  useEffect(()=>{
    let socket
    try{
      const token = localStorage.getItem('token')||''
      socket = io(API_BASE || undefined, { path:'/socket.io', transports:['polling'], upgrade:false, withCredentials:true, auth:{ token } })
      const reload = ()=>{ try{ load() }catch{} }
      socket.on('orders.changed', reload)
    }catch{}
    return ()=>{ try{ socket && socket.off('orders.changed') }catch{}; try{ socket && socket.disconnect() }catch{} }
  },[])

  // Load currency configuration once for conversions
  useEffect(()=>{ let alive=true; getCurrencyConfig().then(cfg=>{ if(alive) setCcyCfg(cfg) }).catch(()=>{}); return ()=>{ alive=false } },[])

  async function load(){
    setLoading(true)
    setMsg('')
    try{
      const data = await apiGet('/api/warehouse/summary')
      const arr = Array.isArray(data?.items) ? data.items : []
      if (arr.length > 0){
        setItems(arr)
        try{
          const pr = await apiGet('/api/products')
          const list = Array.isArray(pr?.products) ? pr.products : (Array.isArray(pr) ? pr : [])
          setProdMap(buildProductMap(list))
        }catch{}
      } else {
        // Fallback: build minimal summary from products
        try{
          const pr = await apiGet('/api/products')
          const list = Array.isArray(pr?.products) ? pr.products : (Array.isArray(pr) ? pr : [])
          const mapped = list.map(p => {
            const stock = {
              UAE: Number(p?.stockUAE||0),
              Oman: Number(p?.stockOman||0),
              KSA: Number(p?.stockKSA||0),
              Bahrain: Number(p?.stockBahrain||0),
              India: Number(p?.stockIndia||0),
              Kuwait: Number(p?.stockKuwait||0),
              Qatar: Number(p?.stockQatar||0),
            }
            const total = Object.values(stock).reduce((a,b)=> a + Number(b||0), 0)
            const base = p?.baseCurrency || p?.currency || 'SAR'
            const purchase = Number(p?.purchasePrice||0)
            const sell = Number(p?.price||0)
            const stockValueByCurrency = {
              SAR: conv(purchase, base, 'SAR') * total,
              OMR: conv(purchase, base, 'OMR') * total,
              AED: conv(purchase, base, 'AED') * total,
              BHD: conv(purchase, base, 'BHD') * total,
            }
            return {
              _id: String(p?._id||p?.id||p?.name||Math.random()),
              name: p?.name || '-',
              purchasePrice: purchase,
              price: sell,
              baseCurrency: base,
              images: Array.isArray(p?.images)? p.images.filter(Boolean): [],
              stockLeft: { ...stock, total },
              delivered: { UAE:0, Oman:0, KSA:0, Bahrain:0, India:0, Kuwait:0, Qatar:0, total:0 },
              totalBought: 0,
              stockValueByCurrency,
              deliveredRevenueByCurrency: { SAR:0, OMR:0, AED:0, BHD:0 },
              potentialRevenue: conv(sell, base, 'SAR') * total,
            }
          })
          setItems(mapped)
          setProdMap(buildProductMap(list))
          setMsg('Showing fallback from products')
        }catch(e2){
          setItems([])
          setMsg('Failed to load summary')
        }
      }
    }catch(err){ 
      // Fallback if summary endpoint fails
      try{
        const pr = await apiGet('/api/products')
        const list = Array.isArray(pr?.products) ? pr.products : (Array.isArray(pr) ? pr : [])
        const mapped = list.map(p => {
          const stock = {
            UAE: Number(p?.stockUAE||0),
            Oman: Number(p?.stockOman||0),
            KSA: Number(p?.stockKSA||0),
            Bahrain: Number(p?.stockBahrain||0),
            India: Number(p?.stockIndia||0),
            Kuwait: Number(p?.stockKuwait||0),
            Qatar: Number(p?.stockQatar||0),
          }
          const total = Object.values(stock).reduce((a,b)=> a + Number(b||0), 0)
          const base = p?.baseCurrency || p?.currency || 'SAR'
          const purchase = Number(p?.purchasePrice||0)
          const sell = Number(p?.price||0)
          const stockValueByCurrency = {
            SAR: conv(purchase, base, 'SAR') * total,
            OMR: conv(purchase, base, 'OMR') * total,
            AED: conv(purchase, base, 'AED') * total,
            BHD: conv(purchase, base, 'BHD') * total,
          }
          return {
            _id: String(p?._id||p?.id||p?.name||Math.random()),
            name: p?.name || '-',
            purchasePrice: purchase,
            price: sell,
            baseCurrency: base,
            images: Array.isArray(p?.images)? p.images.filter(Boolean): [],
            stockLeft: { ...stock, total },
            delivered: { UAE:0, Oman:0, KSA:0, Bahrain:0, India:0, Kuwait:0, Qatar:0, total:0 },
            totalBought: 0,
            stockValueByCurrency,
            deliveredRevenueByCurrency: { SAR:0, OMR:0, AED:0, BHD:0 },
            potentialRevenue: conv(sell, base, 'SAR') * total,
          }
        })
        setItems(mapped)
        setProdMap(buildProductMap(list))
        setMsg('Showing fallback from products')
      }catch{ setMsg(err?.message || 'Failed to load summary') }
    }
    finally{ setLoading(false) }
  }

  const filtered = useMemo(()=>{
    let out = items
    if (q){
      const s = q.toLowerCase()
      out = out.filter(x => (x.name||'').toLowerCase().includes(s))
    }
    if (countryFilter && countryFilter !== 'All'){
      out = out.filter(x => Number(x?.stockLeft?.[countryFilter]||0) > 0 || Number(x?.delivered?.[countryFilter]||0) > 0)
    }
    if (sort === 'name'){
      out = [...out].sort((a,b)=> (a.name||'').localeCompare(b.name||''))
    } else if (sort === 'stock_desc'){
      out = [...out].sort((a,b)=> (b.stockLeft?.total||0) - (a.stockLeft?.total||0))
    } else if (sort === 'delivered_desc'){
      out = [...out].sort((a,b)=> (b.delivered?.total||0) - (a.delivered?.total||0))
    }
    return out
  }, [items, q, sort, countryFilter])

  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }
  function conv(v, from, to){
    const val = Number(v||0)
    const f = String(from||'SAR').toUpperCase()
    const t = String(to||'SAR').toUpperCase()
    if (!ccyCfg) return f===t ? val : 0
    try{ return fxConvert(val, f, t, ccyCfg) }catch{ return f===t ? val : 0 }
  }
  const COUNTRY_TO_CCY = useMemo(()=>({ UAE:'AED', Oman:'OMR', KSA:'SAR', Bahrain:'BHD', India:'INR', Kuwait:'KWD', Qatar:'QAR' }),[])
  function goOrders(productName, country, ship){
    const p = new URLSearchParams()
    if (country) p.set('country', country)
    if (ship) p.set('ship', ship)
    if (productName) p.set('q', productName)
    navigate(`/user/orders?${p.toString()}`)
  }

  function buildProductMap(list){
    const m = {}
    for (const p of Array.isArray(list)? list: []){
      const key = String(p?.name||'').trim()
      const images = Array.isArray(p?.images) ? p.images.filter(Boolean) : []
      const category = String(p?.category||'').trim()
      if (key) m[key] = { images, category }
    }
    return m
  }
  function getImages(it){
    const self = Array.isArray(it?.images) ? it.images.filter(Boolean) : []
    if (self.length) return self
    const name = String(it?.name||'').trim()
    const found = prodMap[name]
    return found?.images || []
  }
  function imgUrl(path){
    const p = String(path||'')
    if (!p) return ''
    return p.startsWith('http') ? p : `${API_BASE}${p}`
  }
  function initials(name){
    const parts = String(name||'').trim().split(/\s+/).filter(Boolean)
    const a = (parts[0]||'').charAt(0).toUpperCase()
    const b = (parts[1]||'').charAt(0).toUpperCase()
    return (a + b) || 'P'
  }

  function calcStockValueByCurrency(it){
    const base = it?.baseCurrency || it?.currency || 'SAR'
    const p = Number(it?.purchasePrice||0)
    const s = it?.stockLeft || {}
    const m = { AED: s.UAE||0, OMR: s.Oman||0, SAR: s.KSA||0, BHD: s.Bahrain||0, INR: s.India||0, KWD: s.Kuwait||0, QAR: s.Qatar||0 }
    const out = {}
    for (const k of CUR_KEY_ORDER){ out[k] = conv(p, base, k) * Number(m[k]||0) }
    return out
  }
  function calcDeliveredRevByCurrency(it){
    const base = it?.baseCurrency || it?.currency || 'SAR'
    const price = Number(it?.price||0)
    const d = it?.delivered || {}
    const m = { AED: d.UAE||0, OMR: d.Oman||0, SAR: d.KSA||0, BHD: d.Bahrain||0, INR: d.India||0, KWD: d.Kuwait||0, QAR: d.Qatar||0 }
    const out = {}
    for (const k of CUR_KEY_ORDER){ out[k] = conv(price, base, k) * Number(m[k]||0) }
    return out
  }

  const totals = useMemo(()=>{
    const curKeys = CUR_KEY_ORDER
    let stockUAE=0, stockOman=0, stockKSA=0, stockBahrain=0, stockIndia=0, stockKuwait=0, stockQatar=0, stockTotal=0
    let deliveredUAE=0, deliveredOman=0, deliveredKSA=0, deliveredBahrain=0, deliveredIndia=0, deliveredKuwait=0, deliveredQatar=0, deliveredTotal=0
    let totalBought=0, potentialRevenueTotal=0
    const stockValueByC = { SAR:0, OMR:0, AED:0, BHD:0, INR:0, KWD:0, QAR:0 }
    const deliveredRevByC = { SAR:0, OMR:0, AED:0, BHD:0, INR:0, KWD:0, QAR:0 }
    for (const it of filtered){
      stockUAE += Number(it?.stockLeft?.UAE||0)
      stockOman += Number(it?.stockLeft?.Oman||0)
      stockKSA += Number(it?.stockLeft?.KSA||0)
      stockBahrain += Number(it?.stockLeft?.Bahrain||0)
      stockIndia += Number(it?.stockLeft?.India||0)
      stockKuwait += Number(it?.stockLeft?.Kuwait||0)
      stockQatar += Number(it?.stockLeft?.Qatar||0)
      stockTotal += Number(it?.stockLeft?.total||0)
      deliveredUAE += Number(it?.delivered?.UAE||0)
      deliveredOman += Number(it?.delivered?.Oman||0)
      deliveredKSA += Number(it?.delivered?.KSA||0)
      deliveredBahrain += Number(it?.delivered?.Bahrain||0)
      deliveredIndia += Number(it?.delivered?.India||0)
      deliveredKuwait += Number(it?.delivered?.Kuwait||0)
      deliveredQatar += Number(it?.delivered?.Qatar||0)
      deliveredTotal += Number(it?.delivered?.total||0)
      totalBought += Number(it?.totalBought||0)
      const sv = calcStockValueByCurrency(it)
      const dr = calcDeliveredRevByCurrency(it)
      for (const k of curKeys){ stockValueByC[k] += Number(sv[k]||0); deliveredRevByC[k] += Number(dr[k]||0) }
      potentialRevenueTotal += Number(it?.potentialRevenue||0)
    }
    return { stockUAE, stockOman, stockKSA, stockBahrain, stockIndia, stockKuwait, stockQatar, stockTotal, deliveredUAE, deliveredOman, deliveredKSA, deliveredBahrain, deliveredIndia, deliveredKuwait, deliveredQatar, deliveredTotal, totalBought, potentialRevenueTotal, stockValueByC, deliveredRevByC }
  }, [filtered])

  return (
    <div>
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
          <div style={{fontWeight:700, fontSize:18}}>Warehouse Summary</div>
          <input className="input" placeholder="Search products" value={q} onChange={e=>setQ(e.target.value)} style={{minWidth:240}} />
          <select className="input" value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="name">Sort: Name</option>
            <option value="stock_desc">Sort: Stock Left (desc)</option>
            <option value="delivered_desc">Sort: Delivered (desc)</option>
          </select>
          <select className="input" value={countryFilter} onChange={e=>setCountryFilter(e.target.value)}>
            <option value="All">All Countries</option>
            {COUNTRY_KEYS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button className="btn" onClick={load} disabled={loading}>{loading? 'Refreshing...' : 'Refresh'}</button>
        </div>
        {msg && <div style={{marginTop:8}}>{msg}</div>}
      </div>

      <div className="card">
        <div style={{fontWeight:800, marginBottom:8}}>Inhouse Products (All Warehouses)</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Product</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#3b82f6'}}>Stock UAE</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#3b82f6'}}>Stock Oman</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#3b82f6'}}>Stock KSA</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#3b82f6'}}>Stock Bahrain</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#3b82f6'}}>Stock India</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#3b82f6'}}>Stock Kuwait</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#3b82f6'}}>Stock Qatar</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#3b82f6'}}>Stock Total</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#f59e0b'}}>Delivered UAE</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#f59e0b'}}>Delivered Oman</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#f59e0b'}}>Delivered KSA</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#f59e0b'}}>Delivered Bahrain</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#f59e0b'}}>Delivered India</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#f59e0b'}}>Delivered Kuwait</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#f59e0b'}}>Delivered Qatar</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#f59e0b'}}>Delivered Total</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>Stock Value SAR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>Stock Value OMR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>Stock Value AED</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>Stock Value BHD</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>Stock Value INR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>Stock Value KWD</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>Stock Value QAR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#22c55e'}}>Delivered Revenue SAR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#22c55e'}}>Delivered Revenue OMR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#22c55e'}}>Delivered Revenue AED</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#22c55e'}}>Delivered Revenue BHD</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#22c55e'}}>Delivered Revenue INR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#22c55e'}}>Delivered Revenue KWD</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#22c55e'}}>Delivered Revenue QAR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Total Bought</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#6366f1'}}>Buy AED</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#6366f1'}}>Buy OMR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#6366f1'}}>Buy SAR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#6366f1'}}>Buy BHD</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#6366f1'}}>Buy INR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#6366f1'}}>Buy KWD</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#6366f1'}}>Buy QAR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#22c55e'}}>Sell AED</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#22c55e'}}>Sell OMR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#22c55e'}}>Sell SAR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#22c55e'}}>Sell BHD</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#22c55e'}}>Sell INR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)', color:'#22c55e'}}>Sell KWD</th>
                <th style={{textAlign:'right', padding:'10px 12px', color:'#22c55e'}}>Sell QAR</th>
                <th style={{textAlign:'right', padding:'10px 12px', color:'#22c55e'}}>Potential Revenue</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:5}).map((_,i)=> (
                  <tr key={`sk${i}`}>
                    <td colSpan={47} style={{ padding:'10px 12px' }}>
                      <div style={{ height:14, background:'var(--panel-2)', borderRadius:6, animation:'pulse 1.2s ease-in-out infinite' }} />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={47} style={{padding:'10px 12px', opacity:0.7}}>No products</td></tr>
              ) : (
                filtered.map(it => (
                  <tr key={it._id} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>
                      {(() => {
                        const imgs = getImages(it)
                        const img = imgs[0] || ''
                        const meta = prodMap[String(it?.name||'').trim()] || {}
                        const cat = meta.category || ''
                        return (
                          <div style={{display:'flex', alignItems:'center', gap:10}}>
                            <div style={{width:44, height:44, borderRadius:10, overflow:'hidden', background:'var(--panel-2)', border:'1px solid var(--border)', display:'grid', placeItems:'center'}}>
                              {img ? (
                                <img src={imgUrl(img)} alt={it.name||'Product'} loading="lazy" style={{width:'100%', height:'100%', objectFit:'cover', cursor:'zoom-in'}} onClick={()=>{ try{ window.open(imgUrl(img), '_blank', 'noopener,noreferrer') }catch{} }} />
                              ) : (
                                <div style={{fontWeight:800, fontSize:12, color:'var(--muted)'}}>{initials(it.name)}</div>
                              )}
                            </div>
                            <div>
                              <div style={{fontWeight:800}}>{it.name}</div>
                              {cat ? <div className="helper" style={{fontSize:12}}>{cat}</div> : null}
                            </div>
                          </div>
                        )
                      })()}
                    </td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#3b82f6'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'UAE', 'open')}>{num(it.stockLeft?.UAE)}</span></td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#3b82f6'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'Oman', 'open')}>{num(it.stockLeft?.Oman)}</span></td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#3b82f6'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'KSA', 'open')}>{num(it.stockLeft?.KSA)}</span></td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#3b82f6'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'Bahrain', 'open')}>{num(it.stockLeft?.Bahrain)}</span></td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#3b82f6'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'India', 'open')}>{num(it.stockLeft?.India)}</span></td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#3b82f6'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'Kuwait', 'open')}>{num(it.stockLeft?.Kuwait)}</span></td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#3b82f6'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'Qatar', 'open')}>{num(it.stockLeft?.Qatar)}</span></td>
                    <td style={{padding:'10px 12px', fontWeight:600, textAlign:'right', borderRight:'1px solid var(--border)', color:'#3b82f6'}}>{num(it.stockLeft?.total)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#f59e0b'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'UAE', 'delivered')}>{num(it.delivered?.UAE)}</span></td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#f59e0b'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'Oman', 'delivered')}>{num(it.delivered?.Oman)}</span></td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#f59e0b'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'KSA', 'delivered')}>{num(it.delivered?.KSA)}</span></td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#f59e0b'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'Bahrain', 'delivered')}>{num(it.delivered?.Bahrain)}</span></td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#f59e0b'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'India', 'delivered')}>{num(it.delivered?.India)}</span></td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#f59e0b'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'Kuwait', 'delivered')}>{num(it.delivered?.Kuwait)}</span></td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#f59e0b'}}><span style={{cursor:'pointer'}} onClick={()=> goOrders(it.name, 'Qatar', 'delivered')}>{num(it.delivered?.Qatar)}</span></td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#f59e0b'}}>{num(it.delivered?.total)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>{num(calcStockValueByCurrency(it).SAR)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>{num(calcStockValueByCurrency(it).OMR)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>{num(calcStockValueByCurrency(it).AED)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>{num(calcStockValueByCurrency(it).BHD)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>{num(calcStockValueByCurrency(it).INR)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>{num(calcStockValueByCurrency(it).KWD)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#06b6d4'}}>{num(calcStockValueByCurrency(it).QAR)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(calcDeliveredRevByCurrency(it).SAR)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(calcDeliveredRevByCurrency(it).OMR)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(calcDeliveredRevByCurrency(it).AED)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(calcDeliveredRevByCurrency(it).BHD)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(calcDeliveredRevByCurrency(it).INR)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(calcDeliveredRevByCurrency(it).KWD)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(calcDeliveredRevByCurrency(it).QAR)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.totalBought)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#6366f1'}}>{num(conv(it.purchasePrice, it.baseCurrency||it.currency||'SAR', 'AED'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#6366f1'}}>{num(conv(it.purchasePrice, it.baseCurrency||it.currency||'SAR', 'OMR'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#6366f1'}}>{num(conv(it.purchasePrice, it.baseCurrency||it.currency||'SAR', 'SAR'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#6366f1'}}>{num(conv(it.purchasePrice, it.baseCurrency||it.currency||'SAR', 'BHD'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#6366f1'}}>{num(conv(it.purchasePrice, it.baseCurrency||it.currency||'SAR', 'INR'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#6366f1'}}>{num(conv(it.purchasePrice, it.baseCurrency||it.currency||'SAR', 'KWD'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#6366f1'}}>{num(conv(it.purchasePrice, it.baseCurrency||it.currency||'SAR', 'QAR'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(conv(it.price, it.baseCurrency||it.currency||'SAR', 'AED'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(conv(it.price, it.baseCurrency||it.currency||'SAR', 'OMR'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(conv(it.price, it.baseCurrency||it.currency||'SAR', 'SAR'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(conv(it.price, it.baseCurrency||it.currency||'SAR', 'BHD'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(conv(it.price, it.baseCurrency||it.currency||'SAR', 'INR'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(conv(it.price, it.baseCurrency||it.currency||'SAR', 'KWD'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)', color:'#22c55e'}}>{num(conv(it.price, it.baseCurrency||it.currency||'SAR', 'QAR'))}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', color:'#22c55e'}}>{num(it.potentialRevenue)}</td>
                  </tr>
                ))
              )}
              {/* Highlighted totals row */}
              {!loading && filtered.length>0 && (
                <tr style={{borderTop:'2px solid var(--border)', background:'var(--panel)'}}>
                  <td style={{padding:'10px 12px', fontWeight:800}}>Totals</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockUAE)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockOman)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockKSA)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockBahrain)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockIndia)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockKuwait)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockQatar)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockTotal)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredUAE)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredOman)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredKSA)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredBahrain)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredIndia)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredKuwait)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredQatar)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredTotal)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockValueByC.SAR)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockValueByC.OMR)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockValueByC.AED)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockValueByC.BHD)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockValueByC.INR)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockValueByC.KWD)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockValueByC.QAR)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredRevByC.SAR)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredRevByC.OMR)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredRevByC.AED)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredRevByC.BHD)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredRevByC.INR)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredRevByC.KWD)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredRevByC.QAR)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.totalBought)}</td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px'}}></td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.potentialRevenueTotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
