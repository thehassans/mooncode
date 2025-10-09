import React from 'react'

// Professional order status track for: pending -> assigned -> picked_up -> in_transit -> out_for_delivery -> <final>
// final can be delivered | no_response | returned | cancelled
export default function OrderStatusTrack({ order, compact=false }){
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
    const doneColor = (finalKey==='delivered' ? '#2563eb' : (terminal.includes(finalKey) ? '#ef4444' : '#2563eb')) // blue or red track when final negative
    const activeColor = doneColor
    const future = '#e5e7eb'
    if (idx < currentIdx) return doneColor
    if (idx === currentIdx) return activeColor
    return future
  }

  function Icon({ k, color }){
    const size = 16
    const s = { width:size, height:size, stroke:color, fill:'none', strokeWidth:1.8, strokeLinecap:'round', strokeLinejoin:'round' }
    if (k==='pending') return (
      <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>
    )
    if (k==='assigned') return (
      <svg {...s} viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
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
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        {steps.map((k, idx)=>{
          const col = colorOf(idx, k)
          const bg = idx <= currentIdx ? (finalKey==='delivered' || idx<steps.length-1 ? 'rgba(37,99,235,0.12)' : 'rgba(239,68,68,0.12)') : 'transparent'
          return (
            <React.Fragment key={k}>
              <div title={labelOf(k)} style={{width:28, height:28, borderRadius:999, border:`2px solid ${col}`, background:bg, display:'grid', placeItems:'center', flex:'0 0 auto'}}>
                <Icon k={k} color={col} />
              </div>
              {idx < steps.length-1 && (
                <div style={{height:2, flex:'1 1 0%', background: idx < currentIdx ? '#93c5fd' : '#e5e7eb'}} aria-hidden />
              )}
            </React.Fragment>
          )
        })}
      </div>
      {compact ? (
        <div style={{textAlign:'center', fontSize:12, color: (raw==='delivered'? '#065f46' : (['cancelled','returned','no_response'].includes(raw)? '#991b1b' : '#1d4ed8')), fontWeight:700}}>
          {labelOf(raw)}
        </div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:`repeat(${steps.length}, minmax(0,1fr))`, gap:8}}>
          {steps.map((k, idx)=> (
            <div key={k} style={{textAlign:'center', fontSize:12, color: idx===currentIdx ? '#111827' : '#6b7280', fontWeight: idx===currentIdx ? 700 : 500}}>{labelOf(k)}</div>
          ))}
        </div>
      )}
    </div>
  )
}
