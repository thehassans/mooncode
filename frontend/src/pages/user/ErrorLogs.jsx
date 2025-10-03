import React, { useEffect, useState } from 'react'
import { API_BASE } from '../../api.js'

export default function ErrorLogs(){
  const [errorLogs, setErrorLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(()=>{
    loadLogs()
  },[])

  async function loadLogs(){
    setLoading(true)
    setMsg('')
    try{
      const r = await fetch(`${API_BASE}/api/error-logs`)
      if (r.ok){
        const data = await r.json()
        setErrorLogs(Array.isArray(data) ? data : [])
      }
    }catch(err){
      setMsg('Failed to load error logs')
    }finally{
      setLoading(false)
    }
  }

  async function clearLogs(){
    if (!confirm('Are you sure you want to clear all error logs?')) return
    setMsg('Clearing logs...')
    try{
      const r = await fetch(`${API_BASE}/api/error-logs`, { method: 'DELETE' })
      if (r.ok){
        setErrorLogs([])
        setMsg('Error logs cleared successfully')
      } else {
        setMsg('Failed to clear logs')
      }
    }catch(err){
      setMsg('Failed to clear logs')
    }
    setTimeout(()=> setMsg(''), 2000)
  }

  function downloadLogs(){
    const blob = new Blob([JSON.stringify(errorLogs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `error-logs-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function fmtTime(ts){
    try{
      const d = new Date(ts)
      return d.toLocaleString()
    }catch{
      return String(ts||'')
    }
  }

  return (
    <div className="content" style={{ padding:16, display:'grid', gap:16, maxWidth: 1400, margin:'0 auto' }}>
      <div style={{ display:'grid', gap:6 }}>
        <div style={{ fontWeight:800, fontSize:20 }}>Error Logs</div>
        <div className="helper">View and manage application error logs. Showing latest {Math.min(500, errorLogs.length)} of {errorLogs.length} entries.</div>
      </div>

      <div className="card" style={{display:'grid', gap:12}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8}}>
          <div className="card-title">System Errors</div>
          <div className="flex items-center gap-2">
            <button className="btn secondary" onClick={loadLogs} disabled={loading} type="button">
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button className="btn secondary" onClick={downloadLogs} type="button" disabled={errorLogs.length === 0}>
              Download JSON
            </button>
            <button className="btn danger" onClick={clearLogs} type="button" disabled={errorLogs.length === 0}>
              Clear All
            </button>
          </div>
        </div>

        {msg && <div className="helper" style={{fontWeight:600, color: msg.includes('Failed') ? 'var(--danger)' : 'var(--success)'}}>{msg}</div>}

        {errorLogs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', opacity: 0.6 }}>
            {loading ? 'Loading error logs...' : 'No error logs found'}
          </div>
        ) : (
          <div style={{ overflow:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
            <table className="table" style={{ width:'100%', fontSize:13 }}>
              <thead>
                <tr>
                  <th style={{position:'sticky', top:0, background:'var(--panel)', zIndex:10, minWidth:160}}>Timestamp</th>
                  <th style={{position:'sticky', top:0, background:'var(--panel)', zIndex:10, minWidth:80}}>Status</th>
                  <th style={{position:'sticky', top:0, background:'var(--panel)', zIndex:10, minWidth:300}}>Message</th>
                  <th style={{position:'sticky', top:0, background:'var(--panel)', zIndex:10, minWidth:250}}>URL</th>
                  <th style={{position:'sticky', top:0, background:'var(--panel)', zIndex:10, minWidth:120}}>Method</th>
                </tr>
              </thead>
              <tbody>
                {errorLogs.slice(0, 500).map((it, idx) => (
                  <tr key={idx}>
                    <td style={{whiteSpace:'nowrap'}}>{fmtTime(it.ts)}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: it.status >= 500 ? 'var(--danger)' : it.status >= 400 ? 'var(--warning)' : 'var(--muted)',
                        color: 'white'
                      }}>
                        {it.status ?? 'N/A'}
                      </span>
                    </td>
                    <td style={{maxWidth: 400}}>
                      <div style={{whiteSpace:'pre-wrap', wordBreak:'break-word'}} title={it.message}>
                        {String(it.message||'')}
                      </div>
                    </td>
                    <td style={{maxWidth: 350}}>
                      <div style={{whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden'}} title={it.url}>
                        {String(it.url||'')}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'var(--panel-2)',
                        color: 'var(--fg)'
                      }}>
                        {it.method || 'GET'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
