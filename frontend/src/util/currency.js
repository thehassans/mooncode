import { apiGet } from '../api'

const DEFAULT = {
  sarPerUnit: {
    SAR: 1,
    AED: 1.02,
    OMR: 9.78,
    BHD: 9.94,
    INR: 0.046,
    KWD: 12.2,
    QAR: 1.03,
    USD: 3.75,
    CNY: 0.52,
  },
  enabled: ['AED','OMR','SAR','BHD','INR','KWD','QAR','USD','CNY'],
  updatedAt: null,
}

let cache = null
let ts = 0

export function getCachedCurrencyConfig(){
  return cache || DEFAULT
}

export async function getCurrencyConfig(force=false){
  try{
    if (!force && cache && Date.now() - ts < 5 * 60 * 1000){
      return cache
    }
    const cfg = await apiGet('/api/settings/currency')
    cache = {
      ...DEFAULT,
      ...(cfg || {}),
      sarPerUnit: { ...DEFAULT.sarPerUnit, ...((cfg && cfg.sarPerUnit) || {}) },
    }
    ts = Date.now()
    return cache
  }catch{
    cache = cache || DEFAULT
    return cache
  }
}

export function convert(amount, from, to, cfg){
  const v = Number(amount||0)
  const conf = (cfg && cfg.sarPerUnit) ? cfg.sarPerUnit : (cache && cache.sarPerUnit) ? cache.sarPerUnit : DEFAULT.sarPerUnit
  const f = conf[String(from||'SAR').toUpperCase()]
  const t = conf[String(to||'SAR').toUpperCase()]
  if (!f || !t) return v
  return v * (f / t)
}
