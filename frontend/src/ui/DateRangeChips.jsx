import React from 'react'

// Reusable date-range segmented control
// Props:
// - value: 'today' | 'last7' | 'last30'
// - onChange: (val) => void
// - options?: [{ k, label }]
// - style?: inline style for wrapper
// - size?: 'sm' | 'md'
export default function DateRangeChips({ value, onChange, options, style, size='md' }){
  const opts = options && options.length ? options : [
    { k:'today', label:'Today' },
    { k:'last7', label:'Last 7 Days' },
    { k:'last30', label:'Last 30 Days' },
  ]
  const isActive = (k)=> String(value) === String(k)
  const pad = size==='sm' ? '4px 10px' : '6px 12px'
  const fontSize = size==='sm' ? 12 : 13

  function onKeyDown(e){
    const idx = opts.findIndex(o=> o.k === value)
    if (idx < 0) return
    if (e.key === 'ArrowRight'){
      const next = opts[Math.min(opts.length-1, idx+1)]
      if (next) onChange(next.k)
    } else if (e.key === 'ArrowLeft'){
      const prev = opts[Math.max(0, idx-1)]
      if (prev) onChange(prev.k)
    }
  }

  return (
    <div role="radiogroup" aria-label="Date range"
         style={{ display:'inline-flex', gap:6, padding:4, border:'1px solid var(--border)', background:'var(--panel)', borderRadius:999, boxShadow:'inset 0 1px 1px rgba(0,0,0,0.04)', ...style }}
         onKeyDown={onKeyDown}
    >
      {opts.map((opt, i)=>{
        const active = isActive(opt.k)
        return (
          <button
            key={opt.k}
            type="button"
            role="radio"
            aria-checked={active}
            className="chip"
            onClick={()=> onChange(opt.k)}
            style={{
              cursor:'pointer',
              padding: pad,
              fontSize,
              fontWeight: active ? 800 : 600,
              borderRadius: 999,
              border: active ? '1px solid var(--primary, #2563eb)' : '1px solid transparent',
              background: active ? 'linear-gradient(180deg, var(--panel-2), var(--panel))' : 'transparent',
              color: active ? 'var(--fg)' : 'var(--muted)',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
              transition:'all 120ms ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
