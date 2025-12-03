export const API_BASE = (() => {
  const raw = import.meta.env.VITE_API_BASE ?? ''
  let base = String(raw).trim()
  // Treat empty or '/' as same-origin root
  if (base === '' || base === '/') base = ''
  // If someone accidentally sets 'http:' or 'https:' (no host), fallback to same-origin
  if (/^https?:\/?$/.test(base)) base = ''
  // Localhost fallback or default path-prefix for production
  try {
    if (!base && typeof window !== 'undefined') {
      const host = String(window.location.hostname || '')
      const isLocal = /^localhost$|^127\.0\.0\.1$/.test(host)
      base = isLocal ? 'http://localhost:4000' : '/api'
    }
  } catch {}
  // If provided as relative without leading slash (e.g., 'api'), fix it
  if (base && !/^https?:\/\//i.test(base) && !base.startsWith('/')) base = '/' + base
  // Remove trailing slash
  if (base.endsWith('/')) base = base.slice(0, -1)
  return base
})()

function buildUrl(path) {
  let p = String(path || '')
  if (!p.startsWith('/')) p = '/' + p
  try {
    const base = String(API_BASE || '').trim()
    if (!base) return p
    // If base has '/api' as its pathname, avoid double '/api' in requests
    let basePath = base
    let origin = ''
    if (/^https?:\/\//i.test(base)) {
      const u = new URL(base)
      origin = u.origin
      basePath = u.pathname || ''
    }
    basePath = basePath.replace(/\/$/, '')
    if (basePath === '/api' && p.startsWith('/api/')) {
      p = p.slice(4) // remove leading '/api'
    }
    const prefix = basePath && basePath !== '/' ? basePath : ''
    return `${origin}${prefix}${p}` || p
  } catch {
    return p
  }
}

// Helpers for resilient POSTs (login/register):
function genIdempotencyKey() {
  try {
    const arr = new Uint8Array(16)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr)
    else for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256)
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return String(Date.now()) + '-' + Math.random().toString(36).slice(2)
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithPostResilience(
  url,
  init,
  { retries = 0, timeoutMs = 12000, retryHttpOn = [] } = {}
) {
  let attempt = 0
  let delay = 400
  while (true) {
    const controller = new AbortController()
    const timer = setTimeout(
      () => {
        try {
          controller.abort()
        } catch {}
      },
      Math.max(1000, timeoutMs)
    )
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)
      if (attempt < retries && retryHttpOn && retryHttpOn.includes(res.status)) {
        await wait(delay)
        attempt++
        delay = Math.min(delay * 2, 2500)
        continue
      }
      return res
    } catch (err) {
      clearTimeout(timer)
      const msg = String((err && err.message) || '')
      const isNet =
        /network|abort|failed to fetch|TypeError|load failed|incomplete envelope|ECONN|EHOST|EPIPE|TLS|connection reset|timeout/i.test(
          msg
        )
      if (attempt < retries && isNet) {
        await wait(delay)
        attempt++
        delay = Math.min(delay * 2, 2500)
        continue
      }
      // Persist error and rethrow
      try {
        appendErrorLog({ url, message: msg, phase: 'post', attempt })
      } catch {}
      throw err
    }
  }
}

function authHeader() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Optional toast helpers (kept for compatibility, no-ops here)
function toastError(_message) {
  /* suppressed globally */
}
function toastInfo(_message) {
  /* suppressed globally */
}

// Lightweight persistent error log in localStorage
function appendErrorLog(entry) {
  try {
    const key = 'error_logs'
    const prev = JSON.parse(localStorage.getItem(key) || '[]')
    const now = Date.now()
    const item = { ts: now, ...entry }
    const next = [item, ...prev].slice(0, 200) // cap to last 200
    localStorage.setItem(key, JSON.stringify(next))
  } catch {}
}

async function handle(res) {
  if (res.ok) return res
  // Centralize auth failures: clear token and redirect to login
  if (res.status === 401) {
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('me')
    } catch {}
    if (!location.pathname.startsWith('/login')) {
      // If on a public path (root, product page, etc.), reload to clear state but stay on page
      // Otherwise, redirect to login
      const p = location.pathname
      const isPublic =
        p === '/' ||
        p.startsWith('/product/') ||
        p === '/catalog' ||
        p === '/checkout' ||
        p === '/home' ||
        p === '/about' ||
        p === '/contact' ||
        p === '/categories' ||
        p === '/terms' ||
        p === '/privacy' ||
        p.startsWith('/investor/signup') ||
        p === '/investorsignup' ||
        p === '/investor-register'

      if (isPublic) {
        location.reload()
      } else {
        location.href = '/login'
      }
    }
  }
  // Prefer JSON error bodies
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    let body = null
    try {
      body = await res.clone().json()
    } catch {}
    if (body) {
      const msg = body?.error || body?.message || `HTTP ${res.status}`
      const e = new Error(msg)
      try {
        e.status = res.status
      } catch {}
      try {
        const ra = res.headers.get('retry-after')
        if (ra) {
          let ms = 0
          if (/^\d+$/.test(ra.trim())) ms = parseInt(ra.trim(), 10) * 1000
          else {
            const when = Date.parse(ra)
            if (!Number.isNaN(when)) ms = Math.max(0, when - Date.now())
          }
          if (ms) e.retryAfterMs = ms
        }
      } catch {}
      // Persist error log (no toasts)
      try {
        appendErrorLog({ url: res.url || null, status: res.status, message: msg, body })
      } catch {}
      throw e
    }
  }
  // Fallback: text/HTML error pages (reverse proxies or unhandled middleware)
  const raw = await res.text()
  const looksHtml = ct.includes('text/html') || /^\s*<!DOCTYPE|^\s*<html/i.test(raw || '')
  const stripHtml = (s) =>
    String(s || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  let friendly = ''
  if (res.status === 413) friendly = 'Upload too large. Please try a smaller file.'
  else if (res.status === 502 || res.status === 504)
    friendly = 'Server temporarily unavailable. Please try again.'
  else if (res.status >= 500) friendly = 'Internal server error. Please try again.'
  const text = looksHtml
    ? friendly || `HTTP ${res.status}`
    : stripHtml(raw) || friendly || `HTTP ${res.status}`
  const e = new Error(text)
  try {
    e.status = res.status
  } catch {}
  try {
    const ra = res.headers.get('retry-after')
    if (ra) {
      let ms = 0
      if (/^\d+$/.test(ra.trim())) ms = parseInt(ra.trim(), 10) * 1000
      else {
        const when = Date.parse(ra)
        if (!Number.isNaN(when)) ms = Math.max(0, when - Date.now())
      }
      if (ms) e.retryAfterMs = ms
    }
  } catch {}
  // Persist error log (no toasts)
  try {
    appendErrorLog({ url: res.url || null, status: res.status, message: text, html: looksHtml })
  } catch {}
  throw e
}

export async function apiGet(path, opt = {}) {
  const res = await fetchWithRetry(
    buildUrl(path),
    { headers: { 'Content-Type': 'application/json', ...authHeader() }, signal: opt.signal },
    { method: 'GET' }
  )
  await handle(res)
  return res.json()
}

export async function apiPost(path, body) {
  const url = buildUrl(path)
  const isLogin =
    /\/auth\/login$/.test(path) || /\/api\/auth\/login$/.test(path) || path.includes('/auth/login')
  const isInvestorRegister = path.includes('/auth/register-investor')
  const headers = { 'Content-Type': 'application/json', ...authHeader() }
  // Add a lightweight idempotency key for registration attempts (safe if server ignores)
  if (isInvestorRegister) {
    try {
      headers['X-Idempotency-Key'] = genIdempotencyKey()
    } catch {}
  }
  const init = {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    keepalive: true,
    cache: 'no-store',
  }
  // Retries: login (safe) up to 2 on network errors/502-504; register (cautious) 1 on network errors only
  const retries = isLogin ? 2 : isInvestorRegister ? 1 : 0
  const res = await fetchWithPostResilience(url, init, {
    retries,
    timeoutMs: 12000,
    retryHttpOn: isLogin ? [502, 503, 504] : [],
  })
  await handle(res)
  return res.json()
}

export async function apiUpload(path, formData) {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { ...authHeader() },
    body: formData,
  })
  await handle(res)
  return res.json()
}

export async function apiGetBlob(path) {
  const res = await fetchWithRetry(
    buildUrl(path),
    { headers: { ...authHeader() } },
    { method: 'GET' }
  )
  await handle(res)
  return res.blob()
}

export async function apiPatch(path, body) {
  const res = await fetch(buildUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  })
  await handle(res)
  return res.json()
}

export async function apiDelete(path) {
  const res = await fetch(buildUrl(path), { method: 'DELETE', headers: { ...authHeader() } })
  await handle(res)
  return res.json()
}

export async function apiUploadPatch(path, formData) {
  const res = await fetch(buildUrl(path), {
    method: 'PATCH',
    headers: { ...authHeader() },
    body: formData,
  })
  await handle(res)
  return res.json()
}

// Internal: retry helper primarily for idempotent GET requests
let __getCooldownUntil = 0
const __routeCooldown = new Map() // key -> until timestamp
async function fetchWithRetry(url, init, opts) {
  const method = (opts && opts.method) || (init && init.method) || 'GET'
  const retryable = method.toUpperCase() === 'GET'
  const urlStr = String(url || '')
  const isMsgs = urlStr.includes('/api/wa/messages')
  const isChats = urlStr.includes('/api/wa/chats')
  const maxRetries = retryable ? (isMsgs || isChats ? 0 : 3) : 0
  let attempt = 0
  let delay = 400
  while (true) {
    // honor global cooldown after recent 429s
    if (retryable && __getCooldownUntil) {
      const now = Date.now()
      if (now < __getCooldownUntil) {
        await new Promise((r) => setTimeout(r, __getCooldownUntil - now))
      }
    }
    // Honor per-route cooldown (per jid) for WA endpoints
    if (retryable && (isMsgs || isChats)) {
      try {
        const u = new URL(
          urlStr,
          typeof location !== 'undefined' ? location.origin : 'https://example.com'
        )
        const jid = u.searchParams.get('jid') || ''
        const key = (isMsgs ? 'msgs:' : 'chats:') + jid
        const until = __routeCooldown.get(key) || 0
        if (until && Date.now() < until) {
          await new Promise((r) => setTimeout(r, until - Date.now()))
        }
      } catch {}
    }
    const res = await fetch(url, init)
    // If 429 on WA endpoints, set per-route cooldown even if we won't retry
    if (retryable && (isMsgs || isChats) && res.status === 429) {
      let waitMs = delay
      try {
        const ra = res.headers.get('retry-after')
        if (ra) {
          if (/^\d+$/.test(ra.trim())) waitMs = Math.max(waitMs, parseInt(ra.trim(), 10) * 1000)
          else {
            const when = Date.parse(ra)
            if (!Number.isNaN(when)) waitMs = Math.max(waitMs, when - Date.now())
          }
        }
      } catch {}
      const jitter = Math.floor(Math.random() * 350)
      __getCooldownUntil = Date.now() + Math.min(Math.max(1500, waitMs) + jitter, 8000)
      try {
        const u = new URL(
          urlStr,
          typeof location !== 'undefined' ? location.origin : 'https://example.com'
        )
        const jid = u.searchParams.get('jid') || ''
        const key = (isMsgs ? 'msgs:' : 'chats:') + jid
        __routeCooldown.set(key, Date.now() + Math.max(2000, waitMs) + jitter)
      } catch {}
    }
    // Retry on 429/502/503/504 for GETs
    if (
      retryable &&
      (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) &&
      attempt < maxRetries
    ) {
      // honor Retry-After header if present
      let waitMs = delay
      try {
        const ra = res.headers.get('retry-after')
        if (ra) {
          if (/^\d+$/.test(ra.trim())) {
            waitMs = Math.max(waitMs, parseInt(ra.trim(), 10) * 1000)
          } else {
            const when = Date.parse(ra)
            if (!Number.isNaN(when)) waitMs = Math.max(waitMs, when - Date.now())
          }
        }
      } catch {}
      // set a global cooldown so other GETs back off too (jitter to avoid sync)
      const jitter = Math.floor(Math.random() * 350)
      __getCooldownUntil = Date.now() + Math.min(Math.max(1500, waitMs) + jitter, 8000)
      // set per-route cooldown for WA endpoints so subsequent loads queue instead of burst
      if (isMsgs || isChats) {
        try {
          const u = new URL(
            urlStr,
            typeof location !== 'undefined' ? location.origin : 'https://example.com'
          )
          const jid = u.searchParams.get('jid') || ''
          const key = (isMsgs ? 'msgs:' : 'chats:') + jid
          __routeCooldown.set(key, Date.now() + Math.max(2000, waitMs) + jitter)
        } catch {}
      }
      await new Promise((r) => setTimeout(r, Math.max(200, waitMs)))
      attempt++
      delay = Math.min(delay * 2, 3000)
      continue
    }
    return res
  }
}
