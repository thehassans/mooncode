import { apiGet } from '../api'

// Default config anchored to AED using requested rates:
// 1 AED = 1 SAR, 1 QAR, 0.10 BHD, 0.10 OMR, 0.083 KWD, 0.27 USD, 1.94 CNY, 24.16 INR, 76.56 PKR
const DEFAULT = {
  anchor: 'AED',
  perAED: {
    AED: 1,
    SAR: 1,
    QAR: 1,
    BHD: 0.10,
    OMR: 0.10,
    KWD: 0.083,
    USD: 0.27,
    CNY: 1.94,
    INR: 24.16,
    PKR: 76.56,
  },
  enabled: ['AED','SAR','QAR','BHD','OMR','KWD','USD','CNY','INR','PKR'],
  updatedAt: null,
}

let cache = null
let ts = 0

function resolveRole(){
  try{ const me = JSON.parse(localStorage.getItem('me')||'null'); return me?.role || null }catch{ return null }
}
function shouldFetchCurrency(){
  try{
    const role = resolveRole()
    if (role === 'agent' || role === 'driver') return false
  }catch{}
  try{
    const p = (typeof window!=='undefined' ? (window.location?.pathname||'') : '')
    if (p.startsWith('/agent') || p.startsWith('/driver')) return false
  }catch{}
  return true
}

export function getCachedCurrencyConfig(){
  return cache || DEFAULT
}

// Build a normalized AED-anchored config from server payload (supports legacy SAR-anchored shape)
export function normalizeCurrencyConfig(cfg){
  if (!cfg || typeof cfg !== 'object') return { ...DEFAULT }
  const anchor = String(cfg.anchor || 'AED').toUpperCase()
  let perAED = {}
  if (cfg.perAED && typeof cfg.perAED === 'object'){
    perAED = { ...DEFAULT.perAED, ...Object.fromEntries(Object.entries(cfg.perAED).map(([k,v])=>[String(k).toUpperCase(), Number(v)||0])) }
  } else if (anchor === 'SAR' && cfg.sarPerUnit){
    // Legacy: SAR per 1 unit. Compute C per AED = (SAR per AED) / (SAR per C)
    const s = Object.fromEntries(Object.entries(cfg.sarPerUnit||{}).map(([k,v])=>[String(k).toUpperCase(), Number(v)||0]))
    const sAED = Number(s.AED)||1
    perAED = { ...DEFAULT.perAED }
    for (const k of Object.keys({ ...DEFAULT.perAED, ...s })){
      const sK = Number(s[k])||0
      if (k === 'AED') perAED.AED = 1
      else if (sAED>0 && sK>0) perAED[k] = sAED / sK
    }
    // Also include PKR per AED from legacy field if present
    const pkrPerUnit = Object.fromEntries(Object.entries(cfg.pkrPerUnit||{}).map(([k,v])=>[String(k).toUpperCase(), Number(v)||0]))
    if (pkrPerUnit.AED>0) perAED.PKR = pkrPerUnit.AED
  } else {
    // Assume AED anchor with possibly missing perAED
    perAED = { ...DEFAULT.perAED }
  }
  const enabled = Array.isArray(cfg.enabled) ? cfg.enabled.map(c=>String(c).toUpperCase()) : DEFAULT.enabled
  return { anchor: 'AED', perAED, enabled, updatedAt: cfg.updatedAt || null }
}

export async function getCurrencyConfig(force=false){
  try{
    if (!force && cache && Date.now() - ts < 5 * 60 * 1000){
      return cache
    }
    // Skip network fetch for roles/routes that typically lack permission
    if (!force && !shouldFetchCurrency()){
      cache = cache || { ...DEFAULT }
      ts = Date.now()
      return cache
    }
    const raw = await apiGet('/api/settings/currency')
    cache = normalizeCurrencyConfig(raw || {})
    ts = Date.now()
    return cache
  }catch{
    cache = cache || { ...DEFAULT }
    return cache
  }
}

// Convert to AED using perAED mapping (C per AED)
export function toAEDByCode(amount, code, cfg){
  const v = Number(amount||0)
  const conf = (cfg && cfg.perAED) ? cfg.perAED : (cache && cache.perAED) ? cache.perAED : DEFAULT.perAED
  const c = String(code||'AED').toUpperCase()
  const r = Number(conf[c]) || 0
  if (c === 'AED' || !r) return v
  // amount in C -> AED = amount / (C per AED)
  return v / r
}

export function fromAED(amountAED, code, cfg){
  const v = Number(amountAED||0)
  const conf = (cfg && cfg.perAED) ? cfg.perAED : (cache && cache.perAED) ? cache.perAED : DEFAULT.perAED
  const c = String(code||'AED').toUpperCase()
  const r = Number(conf[c]) || 0
  if (c === 'AED' || !r) return v
  // AED -> C = amount * (C per AED)
  return v * r
}

export function convert(amount, from, to, cfg){
  const aed = toAEDByCode(amount, from, cfg)
  return fromAED(aed, to, cfg)
}

// Convenience: AED -> PKR using config
export function aedToPKR(amountAED, cfg){
  return fromAED(amountAED, 'PKR', cfg)
}
