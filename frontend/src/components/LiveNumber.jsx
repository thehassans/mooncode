import React, { useEffect, useRef, useState } from 'react'

export default function LiveNumber({
  value = 0,
  duration = 450,
  prefix = '',
  suffix = '',
  locale = undefined,
  maximumFractionDigits = 2,
  className = '',
}) {
  const [display, setDisplay] = useState(Number(value) || 0)
  const [flash, setFlash] = useState(false)
  const rafRef = useRef(null)
  const startRef = useRef({ from: Number(value) || 0, to: Number(value) || 0, t0: 0 })

  useEffect(() => {
    const to = Number(value) || 0
    const from = display
    if (from === to) return
    startRef.current = { from, to, t0: performance.now() }
    setFlash(true)
    const step = (t) => {
      const { from, to, t0 } = startRef.current
      const p = Math.min(1, (t - t0) / Math.max(120, duration))
      const eased = 1 - Math.pow(1 - p, 3)
      const v = from + (to - from) * eased
      setDisplay(v)
      if (p < 1) rafRef.current = requestAnimationFrame(step)
      else rafRef.current = null
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(step)
    const tm = setTimeout(() => setFlash(false), Math.min(900, duration + 500))
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      clearTimeout(tm)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const fmt = (n) => {
    try {
      return n.toLocaleString(locale, { maximumFractionDigits })
    } catch {
      return String(Math.round(n))
    }
  }

  return (
    <span className={(flash ? 'live-number changed ' : 'live-number ') + (className || '')}>
      {prefix}
      {fmt(display)}
      {suffix}
    </span>
  )
}
