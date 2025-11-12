import React, { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../api'

export default function InvestorProducts(){
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [packages_, setPackages] = useState([
    { index: 1, name: 'Products Package 1', price: '', profitPercentage: '' },
    { index: 2, name: 'Products Package 2', price: '', profitPercentage: '' },
    { index: 3, name: 'Products Package 3', price: '', profitPercentage: '' },
  ])

  async function load(){
    try{
      setLoading(true)
      const { packages } = await apiGet('/api/users/investor-plans')
      const hydrated = (packages||[]).map(p => ({
        index: p.index,
        name: p.name || `Products Package ${p.index}`,
        price: String(p.price ?? ''),
        profitPercentage: String(p.profitPercentage ?? '')
      }))
      setPackages(hydrated)
    }catch(err){
      console.error('Failed to load investor plans', err)
      setMsg(err?.message || 'Failed to load plans')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [])

  function updateField(idx, key, val){
    setPackages(arr => arr.map(p => p.index === idx ? { ...p, [key]: val } : p))
  }

  async function save(){
    try{
      setSaving(true); setMsg('')
      const payload = { packages: packages_.map(p => ({
        index: p.index,
        name: String(p.name||'').trim() || `Products Package ${p.index}`,
        price: Number(p.price||0),
        profitPercentage: Number(p.profitPercentage||0),
      })) }
      const res = await apiPost('/api/users/investor-plans', payload)
      setMsg('Saved! Investor panel updated.')
      // Reload to normalize values
      await load()
    }catch(err){
      setMsg(err?.message || 'Failed to save')
    }finally{
      setSaving(false)
    }
  }

  return (
    <div className="section" style={{ display: 'grid', gap: 24 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Investor Products</div>
          <div className="page-subtitle">Configure three investment packages for your investors</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Investment Plans</div>
        </div>
        <div style={{ padding: 24 }}>
          {msg && (
            <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: msg.includes('Saved') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: msg.includes('Saved') ? '#10b981' : '#ef4444' }}>{msg}</div>
          )}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="spinner" />
              <div style={{ marginTop: 10, opacity: 0.7 }}>Loading…</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {packages_.map(p => (
                <div key={p.index} className="card" style={{ borderRadius: 12 }}>
                  <div className="card-header"><div className="card-title">Products Package {p.index}</div></div>
                  <div style={{ padding: 16, display:'grid', gap: 12 }}>
                    <div>
                      <div className="label">Name</div>
                      <input className="input" type="text" value={p.name} onChange={e=> updateField(p.index, 'name', e.target.value)} placeholder={`Products Package ${p.index}`} />
                    </div>
                    <div>
                      <div className="label">Price</div>
                      <input className="input" type="number" min="0" step="0.01" value={p.price} onChange={e=> updateField(p.index, 'price', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <div className="label">Profit %</div>
                      <input className="input" type="number" min="0" max="100" step="0.1" value={p.profitPercentage} onChange={e=> updateField(p.index, 'profitPercentage', e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: 16, display:'flex', justifyContent:'flex-end' }}>
          <button className="btn" onClick={save} disabled={saving || loading}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>

      <div style={{ padding: 12, background: 'var(--panel)', borderRadius: 8, fontSize: 13 }}>
        Note: Investors will see these plans under their Investment Plans page. Changes are pushed in real time.
      </div>
    </div>
  )
}
