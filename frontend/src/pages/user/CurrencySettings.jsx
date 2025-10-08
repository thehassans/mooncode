import React, { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../api'
import { normalizeCurrencyConfig } from '../../util/currency'

export default function CurrencySettings(){
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [cfg, setCfg] = useState({ anchor:'AED', perAED:{}, enabled:[] })
  const CURRENCIES = ['AED','SAR','QAR','BHD','OMR','KWD','USD','CNY','INR','PKR']

  useEffect(()=>{ (async()=>{
    setLoading(true)
    try{
      const res = await apiGet('/api/settings/currency')
      const norm = normalizeCurrencyConfig(res||{})
      setCfg({
        anchor: 'AED',
        perAED: { ...(norm.perAED||{}) },
        enabled: Array.isArray(norm.enabled) ? norm.enabled : []
      })
    }catch(e){ setErr(e?.message || 'Failed to load settings') }
    finally{ setLoading(false) }
  })() }, [])

  function onChangePerAED(code, value){
    const v = Number(value)
    setCfg(c => ({ ...c, perAED: { ...c.perAED, [code]: Number.isFinite(v) && v>=0 ? v : '' } }))
  }

  async function onSave(){
    setSaving(true)
    setMsg('')
    setErr('')
    try{
      // Derive legacy fields for backward compatibility
      const per = Object.fromEntries(CURRENCIES.map(c=>[c, Number(cfg.perAED?.[c]||0)]))
      const sarPerUnit = {}
      const pkrPerUnit = {}
      const perSAR = per.SAR || 1
      const perAED_AED = per.AED || 1
      const perPKR = per.PKR || 0
      for (const k of CURRENCIES){
        const perK = per[k] || 0
        sarPerUnit[k] = (k==='SAR') ? 1 : (perK>0 ? (perSAR / perK) : '')
        pkrPerUnit[k] = (k==='PKR') ? 1 : (perK>0 ? (perPKR / perK) : '')
      }
      const body = {
        anchor: 'AED',
        perAED: cfg.perAED,
        enabled: cfg.enabled,
        // legacy fields for older services
        sarPerUnit,
        pkrPerUnit,
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
          <div className="page-subtitle">Base currency is AED. Configure how many units of each currency equal 1 AED. Used across dashboards and finance calculations.</div>
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
            <div className="card-title">Currency per 1 AED</div>
            <div className="helper">Enter how many units of each currency equal 1 AED. Example: KWD 0.083, OMR 0.10, BHD 0.10, USD 0.27, CNY 1.94, INR 24.16, PKR 76.56.</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10}}>
              {CURRENCIES.map(ccy => (
                <label key={ccy} className="field">
                  <div>{ccy}</div>
                  <input type="number" step="0.0001" min="0" value={cfg.perAED[ccy] ?? ''} onChange={e=> onChangePerAED(ccy, e.target.value)} />
                </label>
              ))}
            </div>
          </div>

          {/* PKR per unit is derived from perAED and saved for legacy services; no separate edit needed */}

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
