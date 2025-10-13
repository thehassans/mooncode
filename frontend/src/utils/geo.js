// Simple geolocation helper to detect user country by IP (best-effort)
// No API key required; falls back to browser locale and then to SA

export async function detectCountryCode() {
  // Supported site country codes
  const SUPPORTED = new Set(['SA','AE','OM','BH','IN','KW','QA'])

  // 1) Try ipapi.co
  try {
    const res = await fetch('https://ipapi.co/json/')
    if (res.ok) {
      const data = await res.json()
      const code = String(data?.country || '').toUpperCase()
      if (SUPPORTED.has(code)) return code
    }
  } catch {}

  // 2) Try navigator.language/region
  try {
    const lang = (navigator.language || navigator.userLanguage || '').toUpperCase()
    if (lang.includes('-')) {
      const code = lang.split('-').pop()
      if (SUPPORTED.has(code)) return code
    }
  } catch {}

  // 3) Fallback
  return 'SA'
}
