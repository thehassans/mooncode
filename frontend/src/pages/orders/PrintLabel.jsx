import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiGet } from '../../api'

export default function PrintLabel(){
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const barcodeRef = useRef(null)

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{ const { order } = await apiGet(`/api/orders/view/${id}`); if(alive) setOrder(order) }catch{ if(alive) setOrder(null) } finally{ if(alive) setLoading(false) }
    })()
    return ()=>{ alive = false }
  }, [id])

  // Lazy-load JsBarcode via CDN and render once order is ready
  useEffect(()=>{
    if (!order) return
    function loadScript(src){
      return new Promise((resolve, reject)=>{
        const s = document.createElement('script')
        s.src = src; s.async = true
        s.onload = resolve
        s.onerror = reject
        document.head.appendChild(s)
      })
    }
    (async ()=>{
      try{
        if (!window.JsBarcode){ await loadScript('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js') }
        const code = String(order.invoiceNumber || String(order._id||'').slice(-5) || '').toUpperCase()
        try{ window.JsBarcode(barcodeRef.current, code, { format:'CODE128', displayValue: false, margin: 0, height: 40 }) }catch{}
        // Auto open print dialog after a brief delay
        setTimeout(()=>{ try{ window.print() }catch{} }, 300)
      }catch{}
    })()
  }, [order])

  function fmt(n){ try{ return Number(n||0).toFixed(2) }catch{ return '0.00' } }
  function fmt2(n){ try{ return Number(n||0).toFixed(2) }catch{ return '0.00' } }

  if (loading){
    return (
      <div style={{display:'grid', placeItems:'center', minHeight:'100vh'}}>
        <div style={{display:'grid', gap:8, justifyItems:'center', color:'#9aa4b2'}}>
          <div className="spinner"/>
          <div>Preparing label…</div>
        </div>
      </div>
    )
  }
  if (!order){
    return <div style={{padding:20}}>Order not found</div>
  }

  const customerName = order.customerName || '-'
  const phoneFull = `${order.phoneCountryCode||''} ${order.customerPhone||''}`.trim()
  const whatsapp = phoneFull
  // Build a more detailed address without duplication and excluding coordinates
  function tokenize(src, maxSegs){
    if (!src) return []
    try{
      let arr = String(src).replace(/\([^)]*\)/g,'').split(',').map(s=>s.trim()).filter(Boolean)
      if (typeof maxSegs==='number') arr = arr.slice(0, maxSegs)
      return arr
    }catch{ return [] }
  }
  const tokens = [
    ...tokenize(order.customerAddress, 3),
    ...tokenize(order.customerArea, 1),
    ...tokenize(order.city, 1),
    ...tokenize(order.orderCountry, 1),
    ...tokenize(order.customerLocation, 3),
  ]
  const seen = new Set()
  const noCoords = tokens.filter(t=>{
    const s = String(t||'').trim()
    if (!s) return false
    // Exclude numeric-only and lat/long-like segments
    if (/^-?\d+(?:\.\d+)?$/.test(s)) return false
    if (/^-?\d{1,3}\.\d{3,}$/.test(s)) return false
    return true
  }).filter(t=>{
    const k = t.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const addressDetail = noCoords.join(', ').slice(0, 160)
  // Build display items from order.items (if any) else fallback to single productId/details
  const hasItems = Array.isArray(order.items) && order.items.length > 0
  const displayItems = hasItems
    ? order.items.map(it => ({
        name: it?.productId?.name || '-',
        qty: Math.max(1, Number(it?.quantity||1)),
        unit: (it?.productId?.price != null) ? Number(it.productId.price) : undefined,
      }))
    : [
        {
          name: order.productId?.name || (order.details ? String(order.details) : '-') ,
          qty: Math.max(1, Number(order.quantity||1)),
          unit: (order.productId?.price != null) ? Number(order.productId.price) : undefined,
        }
      ]
  const totalQty = displayItems.reduce((s, it) => s + Math.max(1, Number(it.qty||1)), 0)
  const total = (order.total!=null)
    ? Number(order.total)
    : displayItems.reduce((s, it) => s + ((it.unit!=null ? Number(it.unit) : 0) * Math.max(1, Number(it.qty||1))), 0)
  // Limit number of visible rows to keep within 4x6 page
  const MAX_ROWS = 5
  const visibleItems = displayItems.slice(0, MAX_ROWS)
  const moreCount = Math.max(0, displayItems.length - MAX_ROWS)
  // Default payment mode to COD unless clearly paid in full
  const paymentMode = ((Number(order.collectedAmount||0) > 0) && (Number(order.total||0) > 0) && (Number(order.collectedAmount||0) >= Number(order.total||0))) ? 'PAID' : 'COD'
  const driverName = order.deliveryBoy ? `${order.deliveryBoy.firstName||''} ${order.deliveryBoy.lastName||''}`.trim() : '-'
  const invoice = String(order.invoiceNumber || String(order._id||'').slice(-5)).toUpperCase()
  const discount = Number(order.discount || 0)
  const noteText = (()=>{
    const candidates = [order.deliveryNotes, order.note, order.notes, order.managerNote]
    for (const v of candidates){ if (v!=null && String(v).trim()) return String(v) }
    return '-'
  })()

  return (
    <div className="print-outer" style={{display:'grid', placeItems:'center', padding:0}}>
      <style>{`
        @page { size: 4in 6in; margin: 0; }
        @media print {
          html, body, #root { width: 4in; height: 6in; margin: 0; background: #fff; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-outer { display: block !important; place-items: initial !important; }
          .label-4x6 { width: 4in; height: 6in; }
        }
        body, html, #root { background: #fff; }
        * { box-sizing: border-box; }
        .label-4x6 { width: 4in; height: 6in; box-sizing: border-box; padding: 8px; color: #000; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; overflow: hidden; page-break-before: avoid; page-break-after: avoid; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
        /* Make all text bold for strong print contrast */
        .label-4x6, .label-4x6 * { font-weight: 700 !important; }
        .grid { display: grid; gap: 6px; }
        .row { display:flex; justify-content:space-between; align-items:center; }
        .h { font-weight: 800; }
        .sec { border: 1px solid #000; border-radius: 4px; padding: 6px; page-break-inside: avoid; }
        .title { font-size: 13px; font-weight: 800; text-decoration: underline; }
        .tbl { width: 100%; border-collapse: separate; border-spacing: 0; }
        .tbl th, .tbl td { border: 1px solid #000; padding: 3px 5px; font-size: 11px; }
        .tbl th { background: #f3f4f6; }
        .badge { display:inline-block; padding:2px 6px; border:1px solid #000; border-radius: 4px; font-weight:700; }
        .muted { opacity: .85; }
        .addr { white-space: normal; word-break: break-word; font-size: 12px; }
        .small { font-size: 11px; }
        .contact-line { display:flex; gap:6px; align-items:center; flex-wrap:nowrap; }
        .ellipsis { display:inline-block; max-width: 2.5in; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .grid-3 { display:grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 4px 8px; align-items:center; }
        .label-row { font-weight:800; font-size:11px; }
        .value-row { font-size:12px; }
        .grid-2 { display:grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; align-items:center; }
        .mini { border: 1px solid #000; border-radius: 4px; padding: 4px 6px; }
      `}</style>
      <div className="label-4x6 grid">
        {/* Header row: single wider box covering brand + header meta */}
        <div className="sec row" style={{gap:8}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <img
              alt="BuySial"
              src={`${import.meta.env.BASE_URL}buysial.png`}
              onError={(e)=>{e.currentTarget.src = `${import.meta.env.BASE_URL}BuySial2.png`}}
              style={{height:66, objectFit:'contain'}}
            />
          </div>
          <div style={{display:'grid', justifyItems:'end', marginLeft:'auto'}}>
            <div className="badge" style={{justifySelf:'end'}}>{paymentMode}</div>
            <div className="muted" style={{fontSize:12}}>DATE: {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Shipper Info */}
        <div className="sec grid">
          <div className="title">Shipper Information</div>
          <div className="grid-3">
            <div className="label-row">Name</div>
            <div className="label-row">Phone</div>
            <div className="label-row">WhatsApp</div>
            <div className="value-row">{customerName}</div>
            <div className="value-row">{phoneFull || '-'}</div>
            <div className="value-row">{whatsapp || '-'}</div>
          </div>
          <div><strong>Address:</strong><div className="addr">{addressDetail || '-'}</div></div>
        </div>

        {/* Product Details */}
        <div className="sec grid">
          <div className="title">Product Details</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Product Name</th>
                <th style={{width:'70px'}}>Quantity</th>
                <th style={{width:'80px'}}>Price</th>
                <th style={{width:'80px'}}>Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((it, idx) => (
                <tr key={idx}>
                  <td style={{whiteSpace:'normal', wordBreak:'break-word'}}>{it.name || '-'}</td>
                  <td style={{textAlign:'center'}}>{it.qty}</td>
                  <td style={{textAlign:'right'}}>{it.unit!=null ? fmt(it.unit) : '-'}</td>
                  <td style={{textAlign:'right'}}>{it.unit!=null ? fmt(it.unit * it.qty) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {moreCount>0 && (
            <div className="muted" style={{fontSize:10}}>{`+ ${moreCount} more item(s)`}</div>
          )}
          {discount > 0 && (
            <div className="row" style={{justifyContent:'flex-end'}}>
              <div><strong>Discount:</strong> {fmt2(discount)}</div>
            </div>
          )}
        </div>

        {/* Footer grid: driver + note (two columns), order no + total, barcode */}
        <div className="grid" style={{gridTemplateColumns:'1fr', gap:8}}>
          <div className="sec grid-2">
            <div className="label-row">Assigned Driver</div>
            <div className="label-row">Note</div>
            <div className="value-row">{driverName || '-'}</div>
            <div className="value-row" style={{minWidth:0}}><span className="ellipsis">{noteText}</span></div>
          </div>
          {/* Order No and Total Amount on same line */}
          <div className="sec row" style={{gap:8}}>
            <div style={{display:'flex', gap:6}}><div className="h">Order No:</div><div>{invoice}</div></div>
            <div style={{display:'flex', gap:6, alignItems:'center'}}><div className="h">Total Amount:</div><div style={{fontSize:16, fontWeight:800}}>{(total!=null) ? fmt2(total) : '-'}</div></div>
          </div>
          <div className="sec" style={{display:'grid', gap:2, alignItems:'center', justifyItems:'center'}}>
            <svg ref={barcodeRef} style={{width:'100%', height:46}} shapeRendering="crispEdges"/>
          </div>
        </div>

        <div className="no-print" style={{display:'flex', justifyContent:'flex-end', gap:8}}>
          <button className="btn" onClick={()=> window.print()}>Print</button>
        </div>
      </div>
    </div>
  )
}
