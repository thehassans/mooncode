export const API_BASE = (() => {
  const raw = import.meta.env.VITE_API_BASE ?? ''
  let base = String(raw).trim()
  // Treat empty or '/' as same-origin root
  if (base === '' || base === '/') base = ''
  // If someone accidentally sets 'http:' or 'https:' (no host), fallback to same-origin
  if (/^https?:\/?$/.test(base)) base = ''
  // Localhost fallback: if unset and running on localhost dev port, use backend 4000
  try{
    if (!base && typeof window !== 'undefined'){
      const host = String(window.location.hostname||'')
      const isLocal = /^localhost$|^127\.0\.0\.1$/.test(host)
      if (isLocal) base = 'http://localhost:4000'
    }
  }catch{}
  // Remove trailing slash
  if (base.endsWith('/')) base = base.slice(0, -1)
  return base
})();

function authHeader(){
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Optional toast helpers (kept for compatibility, no-ops here)
function toastError(_message){ /* suppressed globally */ }
function toastInfo(_message){ /* suppressed globally */ }

// Lightweight persistent error log in localStorage
function appendErrorLog(entry){
  try{
    const key = 'error_logs'
    const prev = JSON.parse(localStorage.getItem(key) || '[]')
    const now = Date.now()
    const item = { ts: now, ...entry }
    const next = [item, ...prev].slice(0, 200) // cap to last 200
    localStorage.setItem(key, JSON.stringify(next))
  }catch{}
}

async function handle(res){
  if (res.ok) return res;
  // Centralize auth failures: clear token and redirect to login
  if (res.status === 401) {
    try { localStorage.removeItem('token'); localStorage.removeItem('me'); } catch {}
    if (!location.pathname.startsWith('/login')) {
      // Suppressed toaster; update location directly
      location.href = '/login';
    }
  }
  // Prefer JSON error bodies
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')){
    let body = null;
    try{ body = await res.clone().json(); }catch{}
    if (body){
      const msg = body?.error || body?.message || `HTTP ${res.status}`;
      const e = new Error(msg);
      try{ e.status = res.status }catch{}
      try{
        const ra = res.headers.get('retry-after');
        if (ra){
          let ms = 0;
          if (/^\d+$/.test(ra.trim())) ms = parseInt(ra.trim(), 10) * 1000
          else { const when = Date.parse(ra); if (!Number.isNaN(when)) ms = Math.max(0, when - Date.now()) }
          if (ms) e.retryAfterMs = ms
        }
      }catch{}
      // Persist error log (no toasts)
      try{ appendErrorLog({ url: res.url || null, status: res.status, message: msg, body }) }catch{}
      throw e;
    }
  }
  // Fallback: text/HTML error pages (reverse proxies or unhandled middleware)
  const raw = await res.text();
  const looksHtml = ct.includes('text/html') || /^\s*<!DOCTYPE|^\s*<html/i.test(raw || '');
  const stripHtml = (s)=> String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  let friendly = '';
  if (res.status === 413) friendly = 'Upload too large. Please try a smaller file.';
  else if (res.status === 502 || res.status === 504) friendly = 'Server temporarily unavailable. Please try again.';
  else if (res.status >= 500) friendly = 'Internal server error. Please try again.';
  const text = looksHtml ? (friendly || `HTTP ${res.status}`) : (stripHtml(raw) || friendly || `HTTP ${res.status}`);
  const e = new Error(text);
  try{ e.status = res.status }catch{}
  try{
    const ra = res.headers.get('retry-after');
    if (ra){
      let ms = 0;
      if (/^\d+$/.test(ra.trim())) ms = parseInt(ra.trim(), 10) * 1000
      else { const when = Date.parse(ra); if (!Number.isNaN(when)) ms = Math.max(0, when - Date.now()) }
      if (ms) e.retryAfterMs = ms
    }
  }catch{}
  // Persist error log (no toasts)
  try{ appendErrorLog({ url: res.url || null, status: res.status, message: text, html: looksHtml }) }catch{}
  throw e;
}

export async function apiGet(path){
  const res = await fetchWithRetry(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json', ...authHeader() } }, { method: 'GET' });
  await handle(res);
  return res.json();
}

export async function apiPost(path, body){
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(body) });
  await handle(res);
  return res.json();
}

export async function apiUpload(path, formData){
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { ...authHeader() }, body: formData });
  await handle(res);
  return res.json();
}

export async function apiGetBlob(path){
  const res = await fetchWithRetry(`${API_BASE}${path}`, { headers: { ...authHeader() } }, { method: 'GET' });
  await handle(res);
  return res.blob();
}

export async function apiPatch(path, body){
  const res = await fetch(`${API_BASE}${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(body) });
  await handle(res);
  return res.json();
}

export async function apiDelete(path){
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: { ...authHeader() } });
  await handle(res);
  return res.json();
}

export async function apiUploadPatch(path, formData){
  const res = await fetch(`${API_BASE}${path}`, { method: 'PATCH', headers: { ...authHeader() }, body: formData });
  await handle(res);
  return res.json();
}

// Internal: retry helper primarily for idempotent GET requests
let __getCooldownUntil = 0
const __routeCooldown = new Map() // key -> until timestamp
async function fetchWithRetry(url, init, opts){
  const method = (opts && opts.method) || (init && init.method) || 'GET'
  const retryable = method.toUpperCase() === 'GET'
  const urlStr = String(url || '')
  const isMsgs = urlStr.includes('/api/wa/messages')
  const isChats = urlStr.includes('/api/wa/chats')
  const maxRetries = retryable ? ((isMsgs || isChats) ? 0 : 3) : 0
  let attempt = 0
  let delay = 400
  while(true){
    // honor global cooldown after recent 429s
    if (retryable && __getCooldownUntil){
      const now = Date.now()
      if (now < __getCooldownUntil){
        await new Promise(r => setTimeout(r, __getCooldownUntil - now))
      }
    }
    // Honor per-route cooldown (per jid) for WA endpoints
    if (retryable && (isMsgs || isChats)){
      try{
        const u = new URL(urlStr, (typeof location!=='undefined'? location.origin : 'https://example.com'))
        const jid = u.searchParams.get('jid') || ''
        const key = (isMsgs? 'msgs:' : 'chats:') + jid
        const until = __routeCooldown.get(key) || 0
        if (until && Date.now() < until){
          await new Promise(r => setTimeout(r, until - Date.now()))
        }
      }catch{}
    }
    const res = await fetch(url, init)
    // If 429 on WA endpoints, set per-route cooldown even if we won't retry
    if (retryable && (isMsgs || isChats) && res.status === 429){
      let waitMs = delay
      try{
        const ra = res.headers.get('retry-after')
        if (ra){
          if (/^\d+$/.test(ra.trim())) waitMs = Math.max(waitMs, parseInt(ra.trim(),10)*1000)
          else { const when = Date.parse(ra); if (!Number.isNaN(when)) waitMs = Math.max(waitMs, when - Date.now()) }
        }
      }catch{}
      const jitter = Math.floor(Math.random()*350)
      __getCooldownUntil = Date.now() + Math.min(Math.max(1500, waitMs) + jitter, 8000)
      try{
        const u = new URL(urlStr, (typeof location!=='undefined'? location.origin : 'https://example.com'))
        const jid = u.searchParams.get('jid') || ''
        const key = (isMsgs? 'msgs:' : 'chats:') + jid
        __routeCooldown.set(key, Date.now() + Math.max(2000, waitMs) + jitter)
      }catch{}
    }
    // Retry on 429/502/503/504 for GETs
    if (retryable && (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) && attempt < maxRetries){
      // honor Retry-After header if present
      let waitMs = delay
      try{
        const ra = res.headers.get('retry-after')
        if (ra){
          if (/^\d+$/.test(ra.trim())){
            waitMs = Math.max(waitMs, parseInt(ra.trim(), 10) * 1000)
          } else {
            const when = Date.parse(ra)
            if (!Number.isNaN(when)) waitMs = Math.max(waitMs, when - Date.now())
          }
        }
      }catch{}
      // set a global cooldown so other GETs back off too (jitter to avoid sync)
      const jitter = Math.floor(Math.random()*350)
      __getCooldownUntil = Date.now() + Math.min(Math.max(1500, waitMs) + jitter, 8000)
      // set per-route cooldown for WA endpoints so subsequent loads queue instead of burst
      if (isMsgs || isChats){
        try{
          const u = new URL(urlStr, (typeof location!=='undefined'? location.origin : 'https://example.com'))
          const jid = u.searchParams.get('jid') || ''
          const key = (isMsgs? 'msgs:' : 'chats:') + jid
          __routeCooldown.set(key, Date.now() + Math.max(2000, waitMs) + jitter)
        }catch{}
      }
      await new Promise(r => setTimeout(r, Math.max(200, waitMs)))
      attempt++
      delay = Math.min(delay * 2, 3000)
      continue
    }
    return res
  }
}
