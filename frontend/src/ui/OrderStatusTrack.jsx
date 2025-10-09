import React from 'react'

// Professional order status track for: pending -> assigned -> picked_up -> in_transit -> out_for_delivery -> <final>
// final can be delivered | no_response | returned | cancelled
export default function OrderStatusTrack({ order, compact=false }){
  // Theme-aware color tokens with sensible fallbacks
  const BLUE = 'var(--primary, #2563eb)'
  const GREEN = 'var(--success, #10b981)'
  const RED = 'var(--danger, #ef4444)'
  const MUTED = 'var(--muted, #6b7280)'
  const FG = 'var(--fg, #111827)'
  const BORDER = 'var(--border, #e5e7eb)'
  const raw0 = String(order?.shipmentStatus || order?.status || 'pending').toLowerCase()
  const norm = (s)=>{
    if (!s) return 'pending'
    if (s==='open') return 'pending'
    if (s==='shipped') return 'in_transit'
    if (s==='attempted' || s==='contacted') return 'in_transit'
    if (s==='picked' || s==='pickedup') return 'picked_up'
    return s
  }
  const raw = norm(raw0)
  const terminal = ['delivered','no_response','returned','cancelled']
  const base = ['pending','assigned','picked_up','in_transit','out_for_delivery']
  const finalKey = terminal.includes(raw) ? raw : 'delivered'
  const steps = [...base, finalKey]

  // Determine progress index
  const indexOf = (k)=> steps.indexOf(k)
  let currentIdx = (raw && steps.includes(raw)) ? indexOf(raw) : 0
  if (!terminal.includes(finalKey) && currentIdx < steps.length-1 && raw==='delivered') currentIdx = steps.length-1

  const labelOf = (k)=>{
    if (k==='in_transit') return 'In Transit'
    if (k==='picked_up') return 'Picked Up'
    if (k==='out_for_delivery') return 'Out for Delivery'
    if (k==='no_response') return 'No Response'
    return k.charAt(0).toUpperCase()+k.slice(1).replace(/_/g,' ')
  }

  const colorOf = (idx, k)=>{
    const doneColor = (finalKey==='delivered' ? BLUE : (terminal.includes(finalKey) ? RED : BLUE)) // primary or danger when final negative
    const activeColor = doneColor
    const future = BORDER
    if (idx < currentIdx) return doneColor
    if (idx === currentIdx) return activeColor
    return future
  }

  function timeOf(k){
    const d = (
      k==='pending' ? (order?.createdAt || null) :
      k==='in_transit' ? (order?.shippedAt || order?.updatedAt || null) :
      k==='delivered' ? (order?.deliveredAt || null) :
      ['cancelled','returned','no_response'].includes(k) ? (order?.updatedAt || null) :
      null
    )
    return d ? new Date(d).toLocaleString() : ''
  }

  function Icon({ k, color }){
    const size = 18
    const s = { width:size, height:size, stroke:color, fill:'none', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round' }
    if (k==='pending') return (
      <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>
    )
    if (k==='assigned') return (
      // Centered user silhouette: head and shoulders perfectly centered
      <svg {...s} viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="3"/>
        <path d="M6 20a6 6 0 0 1 12 0"/>
      </svg>
    )
    if (k==='picked_up') return (
      <svg {...s} viewBox="0 0 24 24"><path d="M3 7h18v10H3z"/><path d="M16 7l-4-4-4 4"/></svg>
    )
    if (k==='in_transit') return (
      <svg {...s} viewBox="0 0 24 24"><rect x="1" y="7" width="15" height="10" rx="2"/><path d="M16 13h3l4 4"/><circle cx="5" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>
    )
    if (k==='out_for_delivery') return (
      <svg {...s} viewBox="0 0 24 24"><path d="M4 4h10v16H4z"/><path d="M14 8l6-3v14l-6-3"/></svg>
    )
    if (k==='delivered') return (
      <svg {...s} viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
    )
    if (k==='cancelled') return (
      <svg {...s} viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
    )
    if (k==='returned') return (
      <svg {...s} viewBox="0 0 24 24"><path d="M9 14l-4-4 4-4"/><path d="M5 10h9a4 4 0 1 1 0 8H7"/></svg>
    )
    if (k==='no_response') return (
      <svg {...s} viewBox="0 0 24 24"><path d="M22 16.92V21a2 2 0 0 1-2.18 2A19.86 19.86 0 0 1 3 6.18 2 2 0 0 1 5 4h4.09"/><path d="M15 3h6v6"/><path d="M10 14a9 9 0 0 0 4 4"/></svg>
    )
    return null
  }

  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={steps.length-1} aria-valuenow={currentIdx}
         style={{display:'grid', gap: compact? 6 : 8}}>
      <div style={{display:'flex', alignItems:'center'}}>
        {steps.map((k, idx)=>{
          const col = colorOf(idx, k)
          const doneCol = (finalKey==='delivered' ? BLUE : (['cancelled','returned','no_response'].includes(finalKey) ? RED : BLUE))
          const leftLineColor = idx === 0 ? 'transparent' : (idx <= currentIdx ? doneCol : BORDER)
          const rightLineColor = idx < currentIdx ? doneCol : BORDER
          const bg = idx <= currentIdx ? (finalKey==='delivered' || idx<steps.length-1 ? 'rgba(37,99,235,0.12)' : 'rgba(239,68,68,0.12)') : 'transparent'
          const finalIconColor = (k==='delivered' && finalKey==='delivered') ? GREEN : (['cancelled','returned','no_response'].includes(finalKey) && k===finalKey ? RED : col)
          const labelColor = idx===currentIdx ? FG : MUTED
          const labelWeight = idx===currentIdx ? 700 : 500
          return (
            <div key={k} style={{flex:'1 1 0%', minWidth:0, display:'grid', rowGap:6, justifyItems:'center'}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', width:'100%'}}>
                <div style={{height:2, background:leftLineColor, visibility: idx===0 ? 'hidden' : 'visible'}} aria-hidden />
                <div title={`${labelOf(k)}${timeOf(k)? ' • '+timeOf(k): ''}`} aria-label={`${labelOf(k)}${timeOf(k)? ', '+timeOf(k): ''}`}
                     style={{width:30, height:30, borderRadius:999, border:`2px solid ${col}`, background:bg, display:'grid', placeItems:'center', boxShadow: idx===currentIdx ? '0 1px 4px rgba(0,0,0,0.12)' : 'none'}}>
                  <Icon k={k} color={finalIconColor} />
                </div>
                <div style={{height:2, background:rightLineColor, visibility: idx===steps.length-1 ? 'hidden' : 'visible'}} aria-hidden />
              </div>
              {compact ? null : (
                <div style={{textAlign:'center', fontSize:12, color: labelColor, fontWeight: labelWeight, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1.15, maxWidth:'100%'}}>{labelOf(k)}</div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{textAlign:'center', fontSize:12, color: (raw==='delivered'? '#065f46' : (['cancelled','returned','no_response'].includes(raw)? '#991b1b' : '#1d4ed8')), fontWeight:700}}>
        {labelOf(raw)}
      </div>
    </div>
  )
}
