import React, { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../../api'

export default function UserAPISetup(){
  const [form, setForm] = useState({ geminiApiKey:'', googleMapsApiKey:'', geminiDescModel:'gemini-1.5-pro', geminiImageModel:'imagen-3.0-generate-001' })
  const [fb, setFb] = useState({ accessToken:'', appId:'' })
  const [saving, setSaving] = useState(false)
  const [savingMaps, setSavingMaps] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testingMaps, setTestingMaps] = useState(false)
  const [msg, setMsg] = useState('')
  const [tests, setTests] = useState(null)
  const [mapsMsg, setMapsMsg] = useState('')
  const [mapsStatus, setMapsStatus] = useState(null) // 'active', 'inactive', null
  const [fbMsg, setFbMsg] = useState('')

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
          googleMapsApiKey: r.googleMapsApiKey || '',
          geminiDescModel: r.geminiDescModel || 'gemini-1.5-pro',
          geminiImageModel: r.geminiImageModel || 'imagen-3.0-generate-001'
        }))
        // Set Maps status indicator
        if (r.googleMapsApiKey && r.googleMapsApiKey.includes('••••')) {
          setMapsStatus('active')
        } else {
          setMapsStatus('inactive')
        }
        setMsg('')
      }catch(e){
        if (!alive) return
        setMsg(e?.message || 'Failed to load settings')
      }
      try{
        const fbRes = await apiGet('/api/settings/facebook')
        if (!alive) return
        setFb(f=>({ accessToken: fbRes?.accessToken || localStorage.getItem('fb_access_token') || '', appId: fbRes?.appId || localStorage.getItem('fb_app_id') || '' }))
      }catch{
        if (!alive) setFb(f=>({ accessToken: localStorage.getItem('fb_access_token') || '', appId: localStorage.getItem('fb_app_id') || '' }))
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
      body.geminiDescModel = form.geminiDescModel || 'gemini-1.5-pro'
      body.geminiImageModel = form.geminiImageModel || 'imagen-3.0-generate-001'
      const res = await apiPost('/api/settings/ai', body)
      if (res?.success){ setMsg('AI settings saved'); setTimeout(()=> setMsg(''), 1500) }
      else setMsg(res?.error || 'Failed to save')
    }catch(err){ setMsg(err?.message || 'Failed to save') }
    finally{ setSaving(false) }
  }

  async function onSaveMaps(e){
    e.preventDefault()
    setSavingMaps(true)
    setMapsMsg('')
    try{
      const body = {}
      if (form.googleMapsApiKey && !form.googleMapsApiKey.includes('••••')) body.googleMapsApiKey = form.googleMapsApiKey
      const res = await apiPost('/api/settings/ai', body)
      if (res?.success){ 
        setMapsMsg('Google Maps API key saved successfully')
        setMapsStatus('active')
        setTimeout(()=> setMapsMsg(''), 2000)
      } else {
        setMapsMsg(res?.error || 'Failed to save')
      }
    }catch(err){ 
      setMapsMsg(err?.message || 'Failed to save') 
    }
    finally{ setSavingMaps(false) }
  }

  async function onTest(){
    setTesting(true)
    setMsg('')
    setTests(null)
    try{
      const body = {}
      if (form.geminiApiKey && !form.geminiApiKey.includes('••••')) body.geminiApiKey = form.geminiApiKey
      if (form.googleMapsApiKey && !form.googleMapsApiKey.includes('••••')) body.googleMapsApiKey = form.googleMapsApiKey
      const res = await apiPost('/api/settings/ai/test', body)
      setTests(res?.tests || null)
      if (res?.success){ setMsg('Connection test completed') }
      else setMsg(res?.error || 'Test failed')
    }catch(err){ setMsg(err?.message || 'Test failed') }
    finally{ setTesting(false) }
  }

  async function saveFacebook(e){
    e.preventDefault()
    setFbMsg('')
    try{
      const res = await apiPost('/api/settings/facebook', { accessToken: fb.accessToken, appId: fb.appId })
      if (res?.success){ setFbMsg('Facebook settings saved') }
      else throw new Error(res?.error || 'Failed to save on server')
    }catch(err){
      // Fallback to localStorage when server endpoint not available
      try{ localStorage.setItem('fb_access_token', fb.accessToken||'') }catch{}
      try{ localStorage.setItem('fb_app_id', fb.appId||'') }catch{}
      setFbMsg('Saved locally (server endpoint unavailable)')
    }
    finally{
      setTimeout(()=> setFbMsg(''), 2000)
    }
  }

  async function testFacebook(){
    setFbMsg('Testing Facebook API…')
    try{
      const url = `https://graph.facebook.com/v17.0/me?access_token=${encodeURIComponent(fb.accessToken||'')}`
      const r = await fetch(url)
      if (r.ok){ setFbMsg('Facebook API Connection Successful') }
      else { setFbMsg('Facebook API test failed') }
    }catch{ setFbMsg('Facebook API test failed') }
    finally{ setTimeout(()=> setFbMsg(''), 2500) }
  }

  async function testGoogleMaps(){
    setTestingMaps(true)
    setMapsMsg('Testing Google Maps API…')
    try{
      const apiKey = form.googleMapsApiKey
      if (!apiKey || apiKey.includes('••••')){
        setMapsMsg('Please enter a valid API key first')
        setTestingMaps(false)
        setTimeout(()=> setMapsMsg(''), 2500)
        return
      }
      
      // Test with a simple geocoding request (reverse geocode a known location)
      const testLat = 25.2048
      const testLng = 55.2708
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${testLat},${testLng}&key=${encodeURIComponent(apiKey)}`
      const r = await fetch(url)
      
      if (r.ok){
        const data = await r.json()
        if (data.status === 'OK'){
          setMapsMsg('✅ Google Maps API Connection Successful')
        } else if (data.status === 'REQUEST_DENIED'){
          setMapsMsg('❌ API Key Invalid or Geocoding API not enabled')
        } else {
          setMapsMsg(`❌ Test failed: ${data.status}`)
        }
      } else {
        setMapsMsg('❌ Google Maps API test failed')
      }
    }catch(err){
      setMapsMsg('❌ Google Maps API test failed')
    }
    finally{
      setTestingMaps(false)
      setTimeout(()=> setMapsMsg(''), 4000)
    }
  }

  return (
    <div className="content" style={{ padding:16, display:'grid', gap:16, maxWidth: 900, margin:'0 auto' }}>
      <div style={{ display:'grid', gap:6 }}>
        <div style={{ fontWeight:800, fontSize:20 }}>API Setup</div>
        <div className="helper">Store API keys used to integrate with external services like Facebook, AI, and Maps. This setup applies to your workspace.</div>
      </div>

      {/* Facebook API */}
      <div className="card" style={{display:'grid', gap:12}}>
        <div className="card-title">Facebook API</div>
        <form onSubmit={saveFacebook} className="section" style={{display:'grid', gap:12}}>
          <div className="form-grid">
            <label className="field">
              <div>Access Token</div>
              <input className="input" value={fb.accessToken} onChange={e=> setFb(f=>({ ...f, accessToken: e.target.value }))} placeholder="EAAB..." />
            </label>
            <label className="field">
              <div>App ID</div>
              <input className="input" value={fb.appId} onChange={e=> setFb(f=>({ ...f, appId: e.target.value }))} placeholder="1234567890" />
            </label>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <button className="btn" type="submit">Save Facebook Settings</button>
            <button className="btn secondary" type="button" onClick={testFacebook}>Test Connection</button>
            {fbMsg && <div className="helper" style={{fontWeight:600}}>{fbMsg}</div>}
          </div>
        </form>
      </div>

      {/* Gemini AI Settings */}
      <div className="card" style={{display:'grid', gap:12}}>
        <div className="card-title">Gemini AI Settings</div>
        <form onSubmit={onSave} className="section" style={{display:'grid', gap:12}}>
          <div className="form-grid">
            <label className="field">
              <div>Gemini API Key</div>
              <input name="geminiApiKey" className="input" type="password" value={form.geminiApiKey} onChange={onChange} placeholder="Enter Gemini API Key" />
              <div className="helper">Used for product descriptions and image generation. Stored securely on server.</div>
            </label>
            <label className="field">
              <div>Description Model</div>
              <select name="geminiDescModel" className="input" value={form.geminiDescModel} onChange={onChange}>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Recommended)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-pro">Gemini Pro</option>
              </select>
              <div className="helper">Model used for generating product descriptions.</div>
            </label>
            <label className="field">
              <div>Image Generation Model</div>
              <select name="geminiImageModel" className="input" value={form.geminiImageModel} onChange={onChange}>
                <option value="imagen-3.0-generate-001">Imagen 3.0 (Recommended)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              </select>
              <div className="helper">Model used for generating product images.</div>
            </label>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <button className="btn" type="submit" disabled={saving}>{saving? 'Saving…' : 'Save AI Settings'}</button>
            <button className="btn secondary" type="button" onClick={onTest} disabled={testing}>{testing? 'Testing…' : 'Test Gemini'}</button>
            {msg && <div className="helper" style={{fontWeight:600}}>{msg}</div>}
          </div>
          {tests && (
            <div className="card" style={{display:'grid', gap:8, padding:12}}>
              <div className="label">Test Results</div>
              <div className="grid" style={{display:'grid', gap:8}}>
                <div className="flex items-center gap-2">
                  <span>{tests.gemini?.ok ? '✅' : '❌'}</span>
                  <span>Gemini: {tests.gemini?.ok ? 'OK' : (tests.gemini?.message || 'Failed')}</span>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Google Maps API Settings */}
      <div className="card" style={{display:'grid', gap:12}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div className="card-title">Google Maps API</div>
          {mapsStatus && (
            <div style={{
              display:'flex',
              alignItems:'center',
              gap:8,
              padding:'6px 12px',
              borderRadius:8,
              background: mapsStatus === 'active' ? '#f0fdf4' : '#fef2f2',
              border: `2px dashed ${mapsStatus === 'active' ? '#86efac' : '#fecaca'}`,
              fontSize:13,
              fontWeight:600,
              color: mapsStatus === 'active' ? '#16a34a' : '#dc2626'
            }}>
              <span style={{fontSize:16}}>{mapsStatus === 'active' ? '✓' : '○'}</span>
              <span>{mapsStatus === 'active' ? 'API Key Active' : 'Not Configured'}</span>
            </div>
          )}
        </div>
        <form onSubmit={onSaveMaps} className="section" style={{display:'grid', gap:12}}>
          <div className="form-grid">
            <label className="field" style={{gridColumn:'1 / -1'}}>
              <div>Google Maps API Key</div>
              <input name="googleMapsApiKey" className="input" type="password" value={form.googleMapsApiKey} onChange={onChange} placeholder="Enter Google Maps API Key" />
              <div className="helper">Used for geocoding, reverse geocoding, and resolving WhatsApp location codes in order workflow. Stored securely on server.</div>
            </label>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <button className="btn" type="submit" disabled={savingMaps}>{savingMaps? 'Saving…' : 'Save API Key'}</button>
            <button className="btn secondary" type="button" onClick={testGoogleMaps} disabled={testingMaps}>{testingMaps? 'Testing…' : 'Test Connection'}</button>
            {mapsMsg && <div className="helper" style={{fontWeight:600, color: mapsMsg.includes('✅') || mapsMsg.includes('success') ? '#16a34a' : mapsMsg.includes('❌') ? '#dc2626' : 'inherit'}}>{mapsMsg}</div>}
          </div>
          <div style={{
            padding:12,
            background:'#f8fafc',
            borderRadius:8,
            border:'1px solid #e2e8f0',
            fontSize:13,
            lineHeight:1.6
          }}>
            <div style={{fontWeight:600, marginBottom:8}}>📍 Integration Points:</div>
            <ul style={{margin:0, paddingLeft:20}}>
              <li>Submit Order page - Resolve WhatsApp location codes</li>
              <li>Address geocoding and validation</li>
              <li>Automatic city and area detection</li>
              <li>Complete address population from location data</li>
            </ul>
          </div>
        </form>
      </div>
    </div>
  )
}
