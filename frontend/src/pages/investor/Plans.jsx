import React, { useEffect, useState } from 'react'
import { apiGet } from '../../api'
import { io } from 'socket.io-client'

export default function InvestorPlans(){
  const [loading, setLoading] = useState(true)
  const [packages_, setPackages] = useState([
    { index: 1, name: 'Products Package 1', price: 0, profitPercentage: 0 },
    { index: 2, name: 'Products Package 2', price: 0, profitPercentage: 0 },
    { index: 3, name: 'Products Package 3', price: 0, profitPercentage: 0 },
  ])
  const [toast, setToast] = useState('')

  async function load(){
    try{
      setLoading(true)
      const { packages } = await apiGet('/api/investors/plans')
      setPackages(packages || [])
    }catch(err){
      console.error('Failed to load plans', err)
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{
    load()
    const token = localStorage.getItem('token') || ''
    const socket = io(undefined, { path: '/socket.io', transports: ['polling'], upgrade: false, auth: { token }, withCredentials: true })
    socket.on('investor-plans.updated', load)
    return ()=>{ try{ socket.off('investor-plans.updated', load); socket.disconnect() }catch{} }
  },[])

  const fmt = (n)=> Number(n||0).toLocaleString(undefined, { maximumFractionDigits: 2 })

  return (
    <div className="section" style={{ display: 'grid', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{
        borderRadius: 20,
        padding: 24,
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.12))',
        border: '1px solid rgba(102, 126, 234, 0.25)',
        boxShadow: '0 10px 40px rgba(102, 126, 234, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, marginBottom: 6,
              background: 'linear-gradient(135deg, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Investment Plans
            </div>
            <div style={{ opacity: 0.75 }}>Choose a products package set by the workspace owner</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#fff',
              background: 'linear-gradient(135deg, #10b981, #059669)' }}>Live Updates</span>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {packages_.map((p) => (
            <div
              key={p.index}
              style={{
                position: 'relative',
                borderRadius: 20,
                padding: 24,
                color: '#fff',
                boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                background: p.index===1 
                  ? 'linear-gradient(135deg, var(--brand-primary, #6d83f2) 0%, var(--brand-secondary, #764ba2) 100%)' 
                  : p.index===2 
                  ? 'linear-gradient(135deg, #4facfe 0%, #00d2fe 100%)' 
                  : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                overflow: 'hidden',
                transition: 'transform .25s ease, box-shadow .25s ease',
                minHeight: 200,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseEnter={(e)=>{ e.currentTarget.style.transform='translateY(-6px)'; e.currentTarget.style.boxShadow='0 18px 60px rgba(0,0,0,0.18)'}}
              onMouseLeave={(e)=>{ e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 12px 40px rgba(0,0,0,0.12)'}}
            >
              <div style={{ position: 'absolute', inset: 0, opacity: 0.12, background: 'radial-gradient(600px 200px at 0% 0%, #fff, transparent)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.95 }}>Products Package {p.index}</div>
                <span style={{ padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
                  {fmt(p.profitPercentage)}% Profit
                </span>
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 6 }}>{p.name || `Products Package ${p.index}`}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontSize: 14, opacity: 0.95 }}>Price</div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>SAR {fmt(p.price)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, opacity: 0.9 }}>Configured by owner</div>
                <button
                  type="button"
                  onClick={async ()=>{
                    try{
                      const txt = `Package ${p.index}: ${p.name} | Price: SAR ${fmt(p.price)} | Profit: ${fmt(p.profitPercentage)}%`
                      await navigator.clipboard.writeText(txt)
                      setToast('Plan details copied. Contact your owner to proceed.')
                      setTimeout(()=> setToast(''), 2500)
                    }catch{}
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(4px)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Request this package
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: 14, background: 'var(--panel)', borderRadius: 12, fontSize: 13, border: '1px solid var(--border)' }}>
        Plans are configured by the store owner in the User panel under <b>Investor Products</b>. Updates appear here automatically.
      </div>

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
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}
