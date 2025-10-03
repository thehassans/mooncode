import React, { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../api'

export default function AISettings(){
  const [form, setForm] = useState({ geminiApiKey:'', imageGenApiKey:'', imageGenApiUrl:'', defaultImagePrompt:'' })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState('')
  const [tests, setTests] = useState(null)

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      try{
        const r = await apiGet('/api/settings/ai')
        if (!alive) return
        setForm(f=>({
          ...f,
          // Server masks keys; we don't show full values
          geminiApiKey: r.geminiApiKey || '',
          imageGenApiKey: r.imageGenApiKey || '',
          imageGenApiUrl: r.imageGenApiUrl || '',
          defaultImagePrompt: r.defaultImagePrompt || ''
        }))
        setMsg('')
      }catch(e){
        if (!alive) return
        setMsg(e?.message || 'Failed to load settings')
      }
    })()
    return ()=>{ alive = false }
  },[])

  function onChange(e){
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function onSave(e){
    e.preventDefault()
    setSaving(true)
    setMsg('')
    try{
      const body = {}
      if (form.geminiApiKey && !form.geminiApiKey.includes('••••')) body.geminiApiKey = form.geminiApiKey
      if (form.imageGenApiKey && !form.imageGenApiKey.includes('••••')) body.imageGenApiKey = form.imageGenApiKey
      if (form.imageGenApiUrl) body.imageGenApiUrl = form.imageGenApiUrl
      body.defaultImagePrompt = form.defaultImagePrompt || ''
      const res = await apiPost('/api/settings/ai', body)
      if (res?.success){ setMsg('AI settings saved'); setTimeout(()=> setMsg(''), 1500) }
      else setMsg(res?.error || 'Failed to save')
    }catch(err){ setMsg(err?.message || 'Failed to save') }
    finally{ setSaving(false) }
  }

  async function onTest(){
    setTesting(true)
    setMsg('')
    setTests(null)
    try{
      const body = {}
      if (form.geminiApiKey && !form.geminiApiKey.includes('••••')) body.geminiApiKey = form.geminiApiKey
      if (form.imageGenApiKey && !form.imageGenApiKey.includes('••••')) body.imageGenApiKey = form.imageGenApiKey
      if (form.imageGenApiUrl) body.imageGenApiUrl = form.imageGenApiUrl
      const res = await apiPost('/api/settings/ai/test', body)
      setTests(res?.tests || null)
      if (res?.success){ setMsg('Connection test completed') }
      else setMsg(res?.error || 'Test failed')
    }catch(err){ setMsg(err?.message || 'Test failed') }
    finally{ setTesting(false) }
  }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="card" style={{display:'grid', gap:12}}>
        <div className="card-title">AI Settings</div>
        <div className="card-subtitle">Store API keys used to generate product descriptions and images. Only admins can update these settings.</div>
        <form onSubmit={onSave} className="section" style={{display:'grid', gap:12}}>
          <div className="form-grid">
            <label className="field">
              <div>Gemini API Key (for descriptions)</div>
              <input name="geminiApiKey" className="input" type="password" value={form.geminiApiKey} onChange={onChange} placeholder="Enter Gemini API Key" />
              <div className="helper">Stored securely in server settings. Masked on reload.</div>
            </label>
            <label className="field">
              <div>Image Gen API URL</div>
              <input name="imageGenApiUrl" className="input" value={form.imageGenApiUrl} onChange={onChange} placeholder="https://api.example.com/v1/images/generate" />
            </label>
            <label className="field">
              <div>Image Gen API Key</div>
              <input name="imageGenApiKey" className="input" type="password" value={form.imageGenApiKey} onChange={onChange} placeholder="Enter Image Gen API Key" />
            </label>
            <label className="field" style={{gridColumn:'1 / -1'}}>
              <div>Default Image Prompt</div>
              <textarea name="defaultImagePrompt" className="input" rows={3} value={form.defaultImagePrompt} onChange={onChange} placeholder="e.g. High quality studio photos, clean white background, multiple angles (front, back, side, 45-degree, top), close-up details, consistent lighting, no watermark." />
            </label>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <button className="btn" type="submit" disabled={saving}>{saving? 'Saving…' : 'Save AI Settings'}</button>
            <button className="btn secondary" type="button" onClick={onTest} disabled={testing}>{testing? 'Testing…' : 'Test Connections'}</button>
            {msg && <div className="helper" style={{fontWeight:600}}>{msg}</div>}
          </div>
          {tests && (
            <div className="card" style={{display:'grid', gap:8, padding:12}}>
              <div className="label">Test Results</div>
              <div className="grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                <div className="flex items-center gap-2">
                  <span>{tests.gemini?.ok ? '✅' : '❌'}</span>
                  <span>Gemini: {tests.gemini?.ok ? 'OK' : (tests.gemini?.message || 'Failed')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{tests.imageGen?.ok ? '✅' : '❌'}</span>
                  <span>Image Gen: {tests.imageGen?.ok ? 'OK' : (tests.imageGen?.message || 'Failed')}</span>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
