import React from 'react'

// Reusable order status progress diagram
// Path: assigned -> picked_up -> in_transit -> out_for_delivery -> delivered | no_response | returned | cancelled
export default function OrderProgress({ status }){
  const s0 = String(status||'').toLowerCase()
  const s = (s0 === 'shipped') ? 'in_transit' : (s0 === 'open' ? 'pending' : s0)
  const terminal = ['delivered','no_response','returned','cancelled'].includes(s) ? s : 'delivered'
  const steps = ['assigned','picked_up','in_transit','out_for_delivery', terminal]
  const activeIdx = steps.findIndex(x => x === s)
  const isTerminalRed = ['no_response','returned','cancelled'].includes(s)

  function labelOf(step){ return step.replace(/_/g,' ') }

  return (
    <div className="order-progress" style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
      {steps.map((step, idx)=>{
        const reached = activeIdx >= 0 && idx <= activeIdx
        let color = '#d1d5db' // gray-300
        if (reached) color = isTerminalRed && idx === activeIdx ? '#ef4444' : (step==='delivered' && s==='delivered' && idx===activeIdx ? '#10b981' : '#3b82f6')
        const nextReached = activeIdx >= idx+1
        return (
          <React.Fragment key={step}>
            <div style={{display:'grid', justifyItems:'center'}}>
              <div style={{width:16, height:16, borderRadius:999, background: color}} aria-hidden />
              <div className="helper" style={{fontSize:12, textTransform:'capitalize', marginTop:4}}>{labelOf(step)}</div>
            </div>
            {idx < steps.length-1 && (
              <div style={{height:2, width:28, background: nextReached ? color : '#e5e7eb'}} aria-hidden />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
