import React, { useEffect, useState } from 'react'
import { apiGet, apiPost, API_BASE } from '../../api'
import { getCurrencyConfig, convert } from '../../util/currency'
import { io } from 'socket.io-client'

export default function InvestorPlans() {
  const [loading, setLoading] = useState(true)
  const [packages_, setPackages] = useState([
    { index: 1, name: 'Products Package 1', price: 0, profitPercentage: 0 },
    { index: 2, name: 'Products Package 2', price: 0, profitPercentage: 0 },
    { index: 3, name: 'Products Package 3', price: 0, profitPercentage: 0 },
  ])
  const [toast, setToast] = useState('')
  const [currencyReady, setCurrencyReady] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [reqPkg, setReqPkg] = useState(null)
  const [reqAmount, setReqAmount] = useState('')
  const [reqNote, setReqNote] = useState('')
  const [reqSubmitting, setReqSubmitting] = useState(false)
  const [reqError, setReqError] = useState('')

  async function load() {
    try {
      setLoading(true)
      const { packages } = await apiGet('/api/investor/plans')
      setPackages(packages || [])
    } catch (err) {
      console.error('Failed to load plans', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const token = localStorage.getItem('token') || ''
    const socket = io(undefined, {
      path: '/socket.io',
      transports: ['polling'],
      upgrade: false,
      auth: { token },
      withCredentials: true,
    })
    socket.on('investor-plans.updated', load)
    return () => {
      try {
        socket.off('investor-plans.updated', load)
        socket.disconnect()
      } catch {}
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await getCurrencyConfig()
      } catch {}
      if (alive) setCurrencyReady(true)
    })()
    return () => {
      alive = false
    }
  }, [])

  const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

  function openRequest(p) {
    try {
      const suggested = Math.max(0, Number(convert(p.price, 'SAR', 'AED') || 0))
      setReqPkg(p)
      setReqAmount(suggested ? String(suggested) : '')
      setReqNote('')
      setReqError('')
      setRequestOpen(true)
    } catch {
      setReqPkg(p)
      setRequestOpen(true)
    }
  }
  function closeRequest() {
    setRequestOpen(false)
    setReqPkg(null)
    setReqSubmitting(false)
    setReqError('')
  }
  async function submitRequest() {
    if (!reqPkg) return
    const amt = Number(reqAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setReqError('Enter a valid amount')
      return
    }
    try {
      setReqSubmitting(true)
      await apiPost('/api/investor/requests', {
        packageIndex: reqPkg.index,
        amount: amt,
        currency: 'AED',
        note: reqNote || '',
      })
      setRequestOpen(false)
      setReqPkg(null)
      setToast('Request sent to owner')
      setTimeout(() => setToast(''), 2500)
    } catch (e) {
      setReqError(e?.message || 'Failed to send request')
    } finally {
      setReqSubmitting(false)
    }
  }

  return (
    <div className="section" style={{ display: 'grid', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Hero */}
      <div
        style={{
          borderRadius: 20,
          padding: 24,
          background:
            'linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.12))',
          border: '1px solid rgba(102, 126, 234, 0.25)',
          boxShadow: '0 10px 40px rgba(102, 126, 234, 0.15)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                lineHeight: 1,
                marginBottom: 6,
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Investment Plans
            </div>
            <div style={{ opacity: 0.75 }}>
              Choose a products package set by the workspace owner
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                background: 'linear-gradient(135deg, #10b981, #059669)',
              }}
            >
              Live Updates
            </span>
          </div>
        </div>
      </div>

      {/* Plans */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div className="spinner" />
          <div style={{ marginTop: 10, opacity: 0.7 }}>Loading plans…</div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 18,
          }}
        >
          {packages_.map((p) => (
            <div
              key={p.index}
              style={{
                position: 'relative',
                borderRadius: 20,
                padding: 24,
                color: '#fff',
                boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                background:
                  p.index === 1
                    ? 'linear-gradient(135deg, var(--brand-primary, #6d83f2) 0%, var(--brand-secondary, #764ba2) 100%)'
                    : p.index === 2
                      ? 'linear-gradient(135deg, #4facfe 0%, #00d2fe 100%)'
                      : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                overflow: 'hidden',
                transition: 'transform .25s ease, box-shadow .25s ease',
                minHeight: 200,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)'
                e.currentTarget.style.boxShadow = '0 18px 60px rgba(0,0,0,0.18)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.12)'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.12,
                  background: 'radial-gradient(600px 200px at 0% 0%, #fff, transparent)',
                  pointerEvents: 'none',
                }}
              />
              {/* Image preview (if provided by owner) */}
              {p.image ? (
                <div
                  style={{
                    position: 'relative',
                    margin: '-12px -12px 12px -12px',
                    borderRadius: 16,
                    overflow: 'hidden',
                    aspectRatio: '16 / 9',
                    boxShadow: 'inset 0 -40px 80px rgba(0,0,0,0.25)',
                  }}
                >
                  <img
                    src={`${API_BASE}${p.image}`}
                    alt={p.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : null}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    opacity: 0.95,
                  }}
                >
                  Products Package {p.index}
                </div>
                <span
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {fmt(p.profitPercentage)}% Profit
                </span>
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 6 }}>
                  {p.name || `Products Package ${p.index}`}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 14, opacity: 0.95 }}>Price</div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>
                    AED {fmt(convert(p.price, 'SAR', 'AED'))}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 14,
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.9 }}>Configured by owner</div>
                <button
                  type="button"
                  onClick={() => openRequest(p)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #f9fafb, #e5e7eb)',
                    color: '#0f172a',
                    border: 'none',
                    boxShadow: '0 6px 18px rgba(15,23,42,0.35)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Request this package
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Removed owner-configured note per request */}

      {requestOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              width: 'min(560px, 92vw)',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 20px 80px rgba(0,0,0,0.35)',
              background: 'var(--panel-2)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                padding: 20,
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: '#fff',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 900 }}>Request Investment</div>
              <div style={{ opacity: 0.9, fontSize: 12 }}>
                Submit your investment request for the selected package
              </div>
            </div>
            <div style={{ padding: 20, background: 'var(--card-bg)' }}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {reqPkg?.name || (reqPkg ? `Products Package ${reqPkg.index}` : '')}
                  </div>
                  {reqPkg ? (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span
                        style={{
                          padding: '6px 10px',
                          borderRadius: 999,
                          background: 'rgba(102,126,234,0.15)',
                          border: '1px solid rgba(102,126,234,0.35)',
                          fontSize: 12,
                          fontWeight: 800,
                          color: 'var(--fg)',
                        }}
                      >
                        {fmt(reqPkg.profitPercentage)}% Profit
                      </span>
                      <span
                        style={{
                          padding: '6px 10px',
                          borderRadius: 999,
                          background: 'rgba(16,185,129,0.12)',
                          border: '1px solid rgba(16,185,129,0.35)',
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#10b981',
                        }}
                      >
                        AED {fmt(convert(reqPkg.price || 0, 'SAR', 'AED'))}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                    Investment amount (AED)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g. 20000"
                    value={reqAmount}
                    onChange={(e) => setReqAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: 'var(--panel)',
                      color: 'var(--fg)',
                      outline: 'none',
                      fontWeight: 700,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                    Note to owner (optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Any details you'd like to add"
                    value={reqNote}
                    onChange={(e) => setReqNote(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: 'var(--panel)',
                      color: 'var(--fg)',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
                {reqError ? (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid rgba(239,68,68,0.35)',
                      background: 'rgba(239,68,68,0.1)',
                      color: '#ef4444',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {reqError}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  onClick={closeRequest}
                  disabled={reqSubmitting}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: 'var(--panel)',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitRequest}
                  disabled={reqSubmitting}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 999,
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    fontWeight: 900,
                    cursor: 'pointer',
                    opacity: reqSubmitting ? 0.7 : 1,
                  }}
                >
                  {reqSubmitting ? 'Sending…' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .section { padding: 16px !important; }
        }
        .toast {
          position: fixed;
          left: 50%;
          bottom: 24px;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          color: #fff;
          padding: 10px 14px;
          border-radius: 999px;
          font-size: 13px;
          z-index: 9999;
          box-shadow: 0 8px 30px rgba(0,0,0,0.25);
        }
      `}</style>
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  )
}
