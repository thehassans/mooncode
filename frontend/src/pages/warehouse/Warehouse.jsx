import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE, apiGet } from '../../api'
import { io } from 'socket.io-client'

export default function Warehouse(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('name')

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

  async function load(){
    setLoading(true)
    setMsg('')
    try{
      const data = await apiGet('/api/warehouse/summary')
      setItems(data.items || [])
    }catch(err){ setMsg(err?.message || 'Failed to load summary') }
    finally{ setLoading(false) }
  }

  const filtered = useMemo(()=>{
    let out = items
    if (q){
      const s = q.toLowerCase()
      out = out.filter(x => (x.name||'').toLowerCase().includes(s))
    }
    if (sort === 'name'){
      out = [...out].sort((a,b)=> (a.name||'').localeCompare(b.name||''))
    } else if (sort === 'stock_desc'){
      out = [...out].sort((a,b)=> (b.stockLeft?.total||0) - (a.stockLeft?.total||0))
    } else if (sort === 'delivered_desc'){
      out = [...out].sort((a,b)=> (b.delivered?.total||0) - (a.delivered?.total||0))
    }
    return out
  }, [items, q, sort])

  function num(n){ return Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 }) }

  const totals = useMemo(()=>{
    const curKeys = ['SAR','OMR','AED','BHD']
    let stockUAE=0, stockOman=0, stockKSA=0, stockBahrain=0, stockTotal=0
    let deliveredTotal=0, totalBought=0
    const stockValueByC = { SAR:0, OMR:0, AED:0, BHD:0 }
    const deliveredRevByC = { SAR:0, OMR:0, AED:0, BHD:0 }
    for (const it of filtered){
      stockUAE += Number(it?.stockLeft?.UAE||0)
      stockOman += Number(it?.stockLeft?.Oman||0)
      stockKSA += Number(it?.stockLeft?.KSA||0)
      stockBahrain += Number(it?.stockLeft?.Bahrain||0)
      stockTotal += Number(it?.stockLeft?.total||0)
      deliveredTotal += Number(it?.delivered?.total||0)
      totalBought += Number(it?.totalBought||0)
      const sv = it?.stockValueByCurrency || {}
      const dr = it?.deliveredRevenueByCurrency || {}
      for (const k of curKeys){ stockValueByC[k] += Number(sv[k]||0); deliveredRevByC[k] += Number(dr[k]||0) }
    }
    return { stockUAE, stockOman, stockKSA, stockBahrain, stockTotal, deliveredTotal, totalBought, stockValueByC, deliveredRevByC }
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
          <button className="btn" onClick={load} disabled={loading}>{loading? 'Refreshing...' : 'Refresh'}</button>
        </div>
        {msg && <div style={{marginTop:8}}>{msg}</div>}
      </div>

      <div className="card">
        <div style={{fontWeight:600, marginBottom:8}}>Inhouse Products (All Warehouses)</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', borderCollapse:'separate', borderSpacing:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden'}}>
            <thead>
              <tr>
                <th style={{textAlign:'left', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Product</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Buy Price</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Sell Price</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Stock UAE</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Stock Oman</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Stock KSA</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Stock Bahrain</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Stock Total</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Delivered Total</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Total Bought</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Stock Value SAR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Stock Value OMR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Stock Value AED</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Stock Value BHD</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Potential Revenue</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Delivered Revenue SAR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Delivered Revenue OMR</th>
                <th style={{textAlign:'right', padding:'10px 12px', borderRight:'1px solid var(--border)'}}>Delivered Revenue AED</th>
                <th style={{textAlign:'right', padding:'10px 12px'}}>Delivered Revenue BHD</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={19} style={{padding:'10px 12px', opacity:0.7}}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={19} style={{padding:'10px 12px', opacity:0.7}}>No products</td></tr>
              ) : (
                filtered.map(it => (
                  <tr key={it._id} style={{borderTop:'1px solid var(--border)'}}>
                    <td style={{padding:'10px 12px', borderRight:'1px solid var(--border)'}}>{it.name}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.purchasePrice)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.price)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.stockLeft?.UAE)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.stockLeft?.Oman)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.stockLeft?.KSA)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.stockLeft?.Bahrain)}</td>
                    <td style={{padding:'10px 12px', fontWeight:600, textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.stockLeft?.total)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.delivered?.total)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.totalBought)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.stockValueByCurrency?.SAR)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.stockValueByCurrency?.OMR)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.stockValueByCurrency?.AED)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.stockValueByCurrency?.BHD)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.potentialRevenue)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.deliveredRevenueByCurrency?.SAR)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.deliveredRevenueByCurrency?.OMR)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', borderRight:'1px solid var(--border)'}}>{num(it.deliveredRevenueByCurrency?.AED)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right'}}>{num(it.deliveredRevenueByCurrency?.BHD)}</td>
                  </tr>
                ))
              )}
              {/* Highlighted totals row */}
              {!loading && filtered.length>0 && (
                <tr style={{borderTop:'2px solid var(--border)', background:'rgba(59,130,246,0.08)'}}>
                  <td style={{padding:'10px 12px', fontWeight:800}}>Totals</td>
                  <td></td>
                  <td></td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockUAE)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockOman)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockKSA)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockBahrain)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockTotal)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredTotal)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.totalBought)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockValueByC.SAR)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockValueByC.OMR)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockValueByC.AED)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.stockValueByC.BHD)}</td>
                  <td></td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredRevByC.SAR)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredRevByC.OMR)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredRevByC.AED)}</td>
                  <td style={{padding:'10px 12px', fontWeight:800, textAlign:'right'}}>{num(totals.deliveredRevByC.BHD)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
