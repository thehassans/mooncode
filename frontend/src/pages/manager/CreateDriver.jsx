import React, { useMemo, useState } from 'react'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import { apiPost } from '../../api'

export default function ManagerCreateDriver(){
  // Country/city options (same as user Drivers form)
  const COUNTRY_OPTS = [
    { key:'UAE', name:'UAE', code:'+971', flag:'🇦🇪' },
    { key:'OM', name:'Oman', code:'+968', flag:'🇴🇲' },
    { key:'KSA', name:'KSA', code:'+966', flag:'🇸🇦' },
    { key:'BH', name:'Bahrain', code:'+973', flag:'🇧🇭' },
    { key:'IN', name:'India', code:'+91', flag:'🇮🇳' },
    { key:'KW', name:'Kuwait', code:'+965', flag:'🇰🇼' },
    { key:'QA', name:'Qatar', code:'+974', flag:'🇶🇦' },
  ]
  const COUNTRY_CITIES = useMemo(()=>({
    UAE: ['Abu Dhabi','Dubai','Sharjah','Ajman','Umm Al Quwain','Ras Al Khaimah','Fujairah','Al Ain','Madinat Zayed','Ruways','Liwa','Kalba','Khor Fakkan','Dibba Al-Fujairah','Dibba Al-Hisn'],
    OM: ['Muscat','Muttrah','Bawshar','Aseeb','Seeb','Qurayyat','Nizwa','Sohar','Sur','Ibri','Rustaq','Buraimi','Salalah','Khasab','Ibra','Sinaw','Jalan Bani Bu Ali','Jalan Bani Bu Hasan'],
    KSA: ['Riyadh','Jeddah','Makkah','Madinah','Dammam','Khobar','Dhahran','Taif','Tabuk','Abha','Khamis Mushait','Jizan','Najran','Hail','Buraydah','Unaizah','Qatif','Al Ahsa','Jubail','Yanbu','Al Bahah','Arar','Sakaka','Hafar Al Batin','Al Majmaah','Al Kharj','Al Qurayyat','Rafha'],
    BH: ['Manama','Riffa','Muharraq','Hamad Town','Aali','Isa Town','Sitra','Budaiya','Jidhafs','Sanad','Tubli','Zallaq'],
    IN: [],
    KW: [],
    QA: [],
  }),[])
  const DEFAULT_COUNTRY = COUNTRY_OPTS[2] // KSA

  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', password:'', phone:'', country: DEFAULT_COUNTRY.name, city:'' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [phoneError, setPhoneError] = useState('')

  const currentCountryKey = useMemo(()=>{
    const byName = COUNTRY_OPTS.find(c=>c.name===form.country)
    return byName?.key || DEFAULT_COUNTRY.key
  },[form.country])
  const cities = COUNTRY_CITIES[currentCountryKey] || []

  const phoneDefaultCountry = useMemo(()=>{
    const map = { UAE:'AE', Oman:'OM', KSA:'SA', Bahrain:'BH', India:'IN', Kuwait:'KW', Qatar:'QA' }
    return map[form.country] || 'AE'
  },[form.country])

  function onChange(e){
    const { name, value } = e.target
    if (name === 'country') return setForm(f=>({ ...f, country:value, city:'', phone:'' }))
    setForm(f=>({ ...f, [name]: value }))
  }

  async function onSubmit(e){
    e.preventDefault()
    setMsg('')
    setLoading(true)
    try{
      if (!form.phone){ setLoading(false); setPhoneError('Phone number is required'); return }
      if (!isValidPhoneNumber(form.phone)){ setLoading(false); setPhoneError('Enter a valid phone number with country code'); return }
      const allowedCodes = ['+971', '+968', '+966', '+973', '+965', '+974', '+91']
      const clean = form.phone.replace(/\s/g,'')
      if (!allowedCodes.some(c=> clean.startsWith(c))){ setLoading(false); setPhoneError('Only UAE, Oman, KSA, Bahrain, Kuwait, Qatar or India numbers allowed'); return }

      await apiPost('/api/users/drivers', { ...form })
      setMsg('Driver created successfully')
      setForm({ firstName:'', lastName:'', email:'', password:'', phone:'', country: DEFAULT_COUNTRY.name, city:'' })
      setPhoneError('')
    }catch(err){ setMsg(err?.message || 'Failed to create driver') }
    finally{ setLoading(false) }
  }

  return (
    <div className="section" style={{display:'grid', gap:12}}>
      <div className="page-header">
        <div>
          <div className="page-title gradient heading-blue">Create Driver</div>
          <div className="page-subtitle">Managers with permission can add drivers for their workspace</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title modern">Driver Details</div>
        </div>
        <form onSubmit={onSubmit} className="section" style={{display:'grid', gap:12}}>
          <div className="form-grid">
            <div>
              <div className="label">First Name</div>
              <input className="input" name="firstName" value={form.firstName} onChange={onChange} placeholder="John" required />
            </div>
            <div>
              <div className="label">Last Name</div>
              <input className="input" name="lastName" value={form.lastName} onChange={onChange} placeholder="Doe" required />
            </div>
            <div>
              <div className="label">Email</div>
              <input className="input" type="email" name="email" value={form.email} onChange={onChange} placeholder="driver@example.com" required />
            </div>
          </div>

          <div className="form-grid">
            <div>
              <div className="label">Phone</div>
              <div className={`PhoneInput ${phoneError? 'input-error':''}`}>
                <PhoneInput
                  key={phoneDefaultCountry}
                  defaultCountry={phoneDefaultCountry}
                  countries={['AE','OM','SA','BH','IN','KW','QA']}
                  placeholder="Enter phone number"
                  value={form.phone}
                  onChange={(value)=> { setForm(f=>({ ...f, phone: value||'' })); setPhoneError('') }}
                  international
                  withCountryCallingCode
                />
              </div>
              <div className={`helper-text ${phoneError? 'error':''}`}>{phoneError || 'Only UAE, Oman, KSA, Bahrain, Kuwait, Qatar and India numbers allowed'}</div>
            </div>
            <div>
              <div className="label">Country</div>
              <select className="input" name="country" value={form.country} onChange={onChange}>
                {COUNTRY_OPTS.map(opt => (
                  <option key={opt.key} value={opt.name}>{`${opt.flag} ${opt.name}`}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="label">City</div>
              <select className="input" name="city" value={form.city} onChange={onChange}>
                <option value="">-- Select City --</option>
                {cities.map(c => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
          </div>

          <div>
            <div className="label">Password</div>
            <input className="input" type="password" name="password" value={form.password} onChange={onChange} placeholder="Minimum 6 characters" required />
          </div>

          <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
            <button className="btn" type="submit" disabled={loading}>{loading? 'Creating...' : 'Create Driver'}</button>
          </div>
          {msg && <div style={{opacity:0.9}}>{msg}</div>}
        </form>
      </div>
    </div>
  )
}
