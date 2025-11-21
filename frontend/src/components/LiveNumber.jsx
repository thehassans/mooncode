import React, { useEffect, useRef, useState } from 'react'

export default function LiveNumber({
  value = 0,
  duration = 800, // Slower, smoother duration
  prefix = '',
  suffix = '',
  locale = undefined,
  maximumFractionDigits = 2,
  className = '',
  showDelta = true,
}) {
  const [display, setDisplay] = useState(Number(value) || 0)
  const [delta, setDelta] = useState(0)
  const [highlight, setHighlight] = useState(null) // 'up' | 'down' | null
  const rafRef = useRef(null)
  const startRef = useRef({ from: Number(value) || 0, to: Number(value) || 0, t0: 0 })
  const prevRef = useRef(Number(value) || 0)

  useEffect(() => {
    const to = Number(value) || 0
    const from = display
    if (from === to) return

    // Determine direction for highlight
    const diff = to - prevRef.current
    if (diff !== 0) {
      setDelta(diff)
      setHighlight(diff > 0 ? 'up' : 'down')
      // Reset highlight after animation
      setTimeout(() => setHighlight(null), duration + 200)
    }

    startRef.current = { from, to, t0: performance.now() }
    prevRef.current = to

    const step = (t) => {
      const { from, to, t0 } = startRef.current
      // Ease out quart
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 4)

      const v = from + (to - from) * eased
      setDisplay(v)

      if (p < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = null
        setDisplay(to) // Ensure exact final value
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  const fmt = (n) => {
    try {
      return n.toLocaleString(locale, { maximumFractionDigits })
    } catch {
      return String(Math.round(n))
    }
  }

  const getColorClass = () => {
    if (highlight === 'up') return 'text-emerald-500 transition-colors duration-300'
    if (highlight === 'down') return 'text-rose-500 transition-colors duration-300'
    return 'transition-colors duration-500'
  }

  return (
    <span className={`inline-flex items-center gap-1 ${getColorClass()} ${className}`}>
      <span>
        {prefix}
        {fmt(display)}
        {suffix}
      </span>
      {showDelta && delta !== 0 && highlight && (
        <span
          className={`animate-pulse rounded-full px-1.5 py-0.5 text-xs font-bold ${
            highlight === 'up'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
              : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
          }`}
        >
          {highlight === 'up' ? '↑' : '↓'}
        </span>
      )}
    </span>
  )
}
