import React, { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../api'

export default function CurrencySettings(){
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [cfg, setCfg] = useState({ anchor:'SAR', sarPerUnit:{}, pkrPerUnit:{}, enabled:[] })
  const CURRENCIES = ['SAR','AED','OMR','BHD','INR','KWD','QAR','USD','CNY']

  useEffect(()=>{ (async()=>{
    setLoading(true)
    try{
      const res = await apiGet('/api/settings/currency')
      setCfg({
        anchor: String(res.anchor||'SAR').toUpperCase(),
        sarPerUnit: { ...(res.sarPerUnit||{}) },
        pkrPerUnit: { ...(res.pkrPerUnit||{}) },
        enabled: Array.isArray(res.enabled) ? res.enabled.map(x=>String(x).toUpperCase()) : []
      })
    }catch(e){ setErr(e?.message || 'Failed to load settings') }
    finally{ setLoading(false) }
  })() }, [])

  function onChangeSar(code, value){
    const v = Number(value)
    setCfg(c => ({ ...c, sarPerUnit: { ...c.sarPerUnit, [code]: Number.isFinite(v) && v>0 ? v : '' } }))
  }
  function onChangePkr(code, value){
    const v = Number(value)
    setCfg(c => ({ ...c, pkrPerUnit: { ...c.pkrPerUnit, [code]: Number.isFinite(v) && v>0 ? v : '' } }))
  }

  async function onSave(){
    setSaving(true)
    setMsg('')
    setErr('')
    try{
      const body = {
        anchor: cfg.anchor,
        sarPerUnit: cfg.sarPerUnit,
        pkrPerUnit: cfg.pkrPerUnit,
        enabled: cfg.enabled,
      }
      await apiPost('/api/settings/currency', body)
      setMsg('Saved')
      setTimeout(()=> setMsg(''), 1500)
    }catch(e){ setErr(e?.message || 'Failed to save') }
    finally{ setSaving(false) }
  }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Currency Conversion</div>
          <div className="page-subtitle">Configure SAR-based display rates and PKR finance rates. These values drive pricing and finance calculations.</div>
        </div>
      </div>

      {loading ? (
        <div className="card"><div className="section">Loading…</div></div>
      ) : (
        <div className="card" style={{display:'grid', gap:14}}>
          <div className="section" style={{display:'grid', gap:10}}>
            <div className="label">Enabled Currencies</div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {CURRENCIES.map(ccy => (
                <label key={ccy} className="badge" style={{display:'inline-flex', alignItems:'center', gap:6}}>
                  <input
                    type="checkbox"
                    checked={cfg.enabled.includes(ccy)}
                    onChange={(e)=> setCfg(c => ({ ...c, enabled: e.target.checked ? Array.from(new Set([...c.enabled, ccy])) : c.enabled.filter(x=>x!==ccy) }))}
                  /> {ccy}
                </label>
              ))}
            </div>
          </div>

          <div className="section" style={{display:'grid', gap:10}}>
            <div className="card-title">SAR per 1 unit</div>
            <div className="helper">Used for UI cross-currency display conversions.</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10}}>
              {CURRENCIES.map(ccy => (
                <label key={ccy} className="field">
                  <div>{ccy}</div>
                  <input type="number" step="0.0001" min="0" value={cfg.sarPerUnit[ccy] ?? ''} onChange={e=> onChangeSar(ccy, e.target.value)} />
                </label>
              ))}
            </div>
          </div>

          <div className="section" style={{display:'grid', gap:10}}>
            <div className="card-title">PKR per 1 unit</div>
            <div className="helper">Used for agent commissions/remittances and finance calculations.</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10}}>
              {CURRENCIES.map(ccy => (
                <label key={ccy} className="field">
                  <div>{ccy}</div>
                  <input type="number" step="0.01" min="0" value={cfg.pkrPerUnit[ccy] ?? ''} onChange={e=> onChangePkr(ccy, e.target.value)} />
                </label>
              ))}
            </div>
          </div>

          {(msg || err) && (
            <div className="section" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div className="helper" style={{color: err? '#dc2626' : '#16a34a', fontWeight:700}}>{err || msg}</div>
              <div />
            </div>
          )}

          <div className="section" style={{display:'flex', justifyContent:'flex-end', gap:8}}>
            <button type="button" className="btn" onClick={onSave} disabled={saving}>{saving? 'Saving…' : 'Save Settings'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
